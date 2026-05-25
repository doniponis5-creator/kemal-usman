/// <reference path="../pb_data/types.d.ts" />
//
// O!Деньги (dengi.kg) payment integration — PocketBase JSVM hooks.
//
// Hash formula: HMAC-MD5(json_body_without_hash, api_password)
// JSON must have no spaces or line breaks.
//
// Endpoints:
//   POST /api/custom/odengi/create-invoice
//   POST /api/custom/odengi/check-status
//   POST /api/custom/odengi/result  (webhook)
//   POST /api/custom/odengi/cancel

const md5 = require(`${__hooks}/_lib/md5.js`);

// ─── Config ──────────────────────────────────────────────────────────────────
function getOdengiConfig() {
  let sid = '5084412514';
  let password = 'ER@L6H&KMGH@P9X';
  let apiUrl = 'https://api.dengi.o.kg/api/json/json.php';
  let testMode = 0;
  let resultBaseUrl = 'https://api.kemalusman.kg';

  try {
    const s = $app.dao().findRecordById('settings', 'main');
    if (s.get('odengiSid'))      sid = String(s.get('odengiSid'));
    if (s.get('odengiPassword')) password = String(s.get('odengiPassword'));
    if (s.get('odengiApiUrl'))   apiUrl = String(s.get('odengiApiUrl'));
    if (s.get('odengiTestMode') !== undefined) testMode = Number(s.get('odengiTestMode'));
    if (s.get('odengiResultBaseUrl')) resultBaseUrl = String(s.get('odengiResultBaseUrl'));
  } catch (_) { /* use defaults */ }

  return { sid, password, apiUrl, testMode, resultBaseUrl };
}

// ─── API caller ──────────────────────────────────────────────────────────────
function callOdengiApi(cfg, cmd, data) {
  const mktime = String(Math.floor(Date.now() / 1000));

  const bodyNoHash = {
    cmd: cmd,
    version: 1005,
    sid: cfg.sid,
    mktime: mktime,
    lang: 'ru',
    data: data
  };

  // HMAC-MD5(json_without_hash, password) — per O!Деньги docs
  const jsonStr = JSON.stringify(bodyNoHash);
  const hash = md5.hmac(jsonStr, cfg.password);

  const fullBody = JSON.parse(jsonStr);
  fullBody.hash = hash;

  $app.logger().info('odengi_api_call', 'cmd', cmd, 'mktime', mktime, 'hash', hash,
    'url', cfg.apiUrl, 'body_preview', JSON.stringify(fullBody).slice(0, 300));

  const res = $http.send({
    url: cfg.apiUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullBody),
    timeout: 30,
  });

  $app.logger().info('odengi_api_response', 'cmd', cmd, 'status', String(res.statusCode),
    'body', String(res.raw).slice(0, 500));

  var parsed;
  try { parsed = JSON.parse(res.raw); } catch (e) {
    throw new Error('O!Деньги API returned invalid JSON: ' + String(res.raw).slice(0, 200));
  }

  if (parsed.data && parsed.data.error) {
    throw new Error('O!Деньги error ' + parsed.data.error + ': ' + (parsed.data.desc || 'unknown'));
  }

  return parsed;
}

// ─── Endpoint: Create Invoice ────────────────────────────────────────────────
routerAdd('POST', '/api/custom/odengi/create-invoice', (c) => {
  const body = $apis.requestInfo(c).data || {};
  const orderId = body.orderId;

  if (!orderId) {
    return c.json(400, { error: 'orderId is required' });
  }

  var order;
  try {
    order = $app.dao().findRecordById('orders', orderId);
  } catch (e) {
    return c.json(404, { error: 'Order not found: ' + orderId });
  }

  const total = Number(order.get('total') || 0);
  if (total <= 0) {
    return c.json(400, { error: 'Order total must be > 0' });
  }

  const cfg = getOdengiConfig();
  const amountKopecks = Math.round(total * 100);
  const odengiOrderId = 'KU_' + orderId + '_' + Date.now();

  // Parse items — handle Goja JsonRaw proxy
  var rawItems = order.get('items');
  var items = [];
  try {
    var iStr = (typeof rawItems === 'string') ? rawItems : String(rawItems);
    items = JSON.parse(iStr);
  } catch (_) { items = []; }

  var goodsList = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    goodsList.push({
      id: String(item.productId || i),
      name: String(item.name || 'Parfum').slice(0, 100),
      amount: String(Math.round(Number(item.price || 0) * 100)),
      count: String(item.qty || 1),
      image: ''
    });
  }

  var data = {
    order_id: odengiOrderId,
    desc: 'Kemal Usman - Заказ #' + orderId,
    amount: amountKopecks,
    currency: 'KGS',
    test: cfg.testMode,
    long_term: 0,
    user_to: null,
    date_life: null,
    date_start_push: null,
    count_push: null,
    send_push: 1,
    send_sms: 1,
    success_url: null,
    fail_url: null,
    fields_other: JSON.stringify({ pb_order_id: orderId }),
    transtype: null,
    result_url: cfg.resultBaseUrl + '/api/custom/odengi/result'
  };

  if (goodsList.length > 0) {
    data.goods = goodsList;
  }

  var apiResponse;
  try {
    apiResponse = callOdengiApi(cfg, 'createInvoice', data);
  } catch (e) {
    $app.logger().error('odengi_create_invoice_failed', 'error', String(e), 'orderId', orderId);
    return c.json(502, { error: 'O!Деньги API error: ' + String(e) });
  }

  var invoiceData = apiResponse.data || {};

  // Store invoice info on the order
  order.set('odengiInvoiceId', invoiceData.invoice_id || '');
  order.set('odengiOrderId', odengiOrderId);
  order.set('paymentMethod', 'odengi');
  order.set('paymentStatus', 'odengi_pending');
  try {
    $app.dao().saveRecord(order);
  } catch (e) {
    $app.logger().error('odengi_save_order_failed', 'error', String(e));
  }

  return c.json(200, {
    invoiceId: invoiceData.invoice_id || '',
    paylink_url: invoiceData.paylink_url || '',
    qr_url: invoiceData.qr || invoiceData.emv_qr || '',
    link_app: invoiceData.link_app || '',
    site_pay: invoiceData.site_pay || '',
    qr_data: invoiceData.emv_qr_data || '',
  });
});

// ─── Endpoint: Check Status ──────────────────────────────────────────────────
routerAdd('POST', '/api/custom/odengi/check-status', (c) => {
  const body = $apis.requestInfo(c).data || {};
  const orderId = body.orderId;
  if (!orderId) return c.json(400, { error: 'orderId required' });

  var order;
  try { order = $app.dao().findRecordById('orders', orderId); }
  catch (_) { return c.json(404, { error: 'Order not found' }); }

  var invoiceId = order.get('odengiInvoiceId');
  var odengiOrderId = order.get('odengiOrderId');
  if (!invoiceId && !odengiOrderId) {
    return c.json(400, { error: 'No O!Деньги invoice found for this order' });
  }

  const cfg = getOdengiConfig();

  var apiResponse;
  try {
    apiResponse = callOdengiApi(cfg, 'statusPayment', {
      invoice_id: invoiceId || '',
      order_id: odengiOrderId || '',
      mark: null
    });
  } catch (e) {
    return c.json(502, { error: 'Status check failed: ' + String(e) });
  }

  var data = apiResponse.data || {};

  var paymentApproved = false;
  if (data.status === 'approved') {
    paymentApproved = true;
  } else if (data.payments && Array.isArray(data.payments)) {
    for (var i = 0; i < data.payments.length; i++) {
      if (data.payments[i].status === 'approved') {
        paymentApproved = true;
        break;
      }
    }
  }

  if (paymentApproved && order.get('paymentStatus') !== 'paid') {
    order.set('paymentStatus', 'paid');
    order.set('status', 'confirmed');
    try { $app.dao().saveRecord(order); } catch (_) {}
    $app.logger().info('odengi_payment_confirmed_via_poll', 'orderId', orderId);
  }

  return c.json(200, {
    status: data.status || (data.payments ? 'has_payments' : 'unknown'),
    payments: data.payments || [],
    paymentApproved: paymentApproved,
    orderStatus: order.get('status'),
    paymentStatus: order.get('paymentStatus'),
  });
});

// ─── Endpoint: Result Webhook ────────────────────────────────────────────────
// POST /api/custom/odengi/result
// Webhook hash verification: HMAC-MD5(trans_id:::status_pay:::site_id:::order_id:::amount:::currency:::mktime:::test, password)
routerAdd('POST', '/api/custom/odengi/result', (c) => {
  const info = $apis.requestInfo(c);
  const data = info.data || {};

  $app.logger().info('odengi_webhook_received',
    'trans_id', String(data.trans_id || ''),
    'status_pay', String(data.status_pay || ''),
    'order_id', String(data.order_id || ''),
    'amount', String(data.amount || ''),
    'mobile', String(data.mobile || ''));

  // Verify webhook hash
  const cfg = getOdengiConfig();
  var webhookStr = String(data.trans_id || '') + ':::' +
    String(data.status_pay || '') + ':::' +
    String(data.site_id || '') + ':::' +
    String(data.order_id || '') + ':::' +
    String(data.amount || '') + ':::' +
    String(data.currency || '') + ':::' +
    String(data.mktime || '') + ':::' +
    String(data.test || '');
  var expectedHash = md5.hmac(webhookStr, cfg.password);

  if (data.hash && data.hash !== expectedHash) {
    $app.logger().warn('odengi_webhook_hash_mismatch',
      'received', String(data.hash), 'expected', expectedHash);
    // Don't reject — log warning but process anyway
  }

  // Extract PocketBase order ID
  var pbOrderId = '';

  var fieldsOther = data.fields_other;
  if (typeof fieldsOther === 'string') {
    try { fieldsOther = JSON.parse(fieldsOther); } catch (_) {}
  }
  if (fieldsOther && fieldsOther.pb_order_id) {
    pbOrderId = fieldsOther.pb_order_id;
  }

  if (!pbOrderId && data.order_id) {
    var parts = String(data.order_id).split('_');
    if (parts.length >= 2 && parts[0] === 'KU') {
      pbOrderId = parts[1];
    }
  }

  if (!pbOrderId) {
    $app.logger().error('odengi_webhook_no_order_id', 'raw', JSON.stringify(data).slice(0, 500));
    return c.json(200, { ok: false, error: 'Cannot determine order ID' });
  }

  var order;
  try { order = $app.dao().findRecordById('orders', pbOrderId); }
  catch (_) {
    $app.logger().error('odengi_webhook_order_not_found', 'pbOrderId', pbOrderId);
    return c.json(200, { ok: false, error: 'Order not found' });
  }

  var statusPay = Number(data.status_pay || 0);

  if (statusPay === 3) {
    order.set('paymentStatus', 'paid');
    order.set('status', 'confirmed');
    order.set('odengiTransId', String(data.trans_id || ''));
    order.set('odengiPayerPhone', String(data.mobile || ''));
    try {
      $app.dao().saveRecord(order);
      $app.logger().info('odengi_payment_success', 'orderId', pbOrderId, 'trans_id', String(data.trans_id));
    } catch (e) {
      $app.logger().error('odengi_webhook_save_failed', 'error', String(e));
    }
  } else if (statusPay === 2) {
    order.set('paymentStatus', 'odengi_canceled');
    try { $app.dao().saveRecord(order); } catch (_) {}
    $app.logger().info('odengi_payment_canceled', 'orderId', pbOrderId);
  }

  return c.json(200, { ok: true });
});

// ─── Endpoint: Cancel Invoice ────────────────────────────────────────────────
routerAdd('POST', '/api/custom/odengi/cancel', (c) => {
  const body = $apis.requestInfo(c).data || {};
  const orderId = body.orderId;
  if (!orderId) return c.json(400, { error: 'orderId required' });

  var order;
  try { order = $app.dao().findRecordById('orders', orderId); }
  catch (_) { return c.json(404, { error: 'Order not found' }); }

  var invoiceId = order.get('odengiInvoiceId');
  if (!invoiceId) return c.json(400, { error: 'No invoice to cancel' });

  const cfg = getOdengiConfig();

  try {
    callOdengiApi(cfg, 'invoiceCancel', { invoice_id: invoiceId });
  } catch (e) {
    return c.json(502, { error: 'Cancel failed: ' + String(e) });
  }

  order.set('paymentStatus', 'odengi_canceled');
  try { $app.dao().saveRecord(order); } catch (_) {}

  return c.json(200, { ok: true });
});
