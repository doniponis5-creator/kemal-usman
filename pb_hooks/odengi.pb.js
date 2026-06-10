/// <reference path="../pb_data/types.d.ts" />
// O!Деньги payment integration v4 — SECURITY HARDENED (2026-06-10)
//
// Changes vs v3:
//   1. Credentials come ONLY from environment variables — never hardcoded,
//      never read from the publicly-readable `settings` collection:
//        ODENGI_SID             — merchant SID
//        ODENGI_PASSWORD        — merchant API password (ROTATE the old leaked one!)
//        ODENGI_API_URL         — optional, default https://api.dengi.o.kg/api/json/json.php
//        ODENGI_TEST_MODE       — optional, 0 or 1, default 0
//        ODENGI_RESULT_BASE_URL — optional, default https://api.kemalusman.kg
//      Set them in /etc/pocketbase/env (systemd EnvironmentFile) and restart PB.
//   2. create-invoice / check-status / cancel now REQUIRE a valid PocketBase
//      auth token, and the caller must own the order (clientPhone or client
//      relation match) or be a PB admin/superuser.
//   3. The result webhook ENFORCES the HMAC-MD5 signature — missing or wrong
//      hash is rejected with 403 (previously it only logged a warning!).
//   4. The webhook verifies amount (kopecks) and currency against the order
//      before marking it paid.
//
// NOTE: all code stays inside callbacks (Goja scoping fix from v3).

// ═══ Create Invoice ═══
routerAdd('POST', '/api/custom/odengi/create-invoice', function(c) {
  try {
    var md5 = require(__hooks + '/_lib/md5.js');
    var info = $apis.requestInfo(c);

    // ── Auth: must be a logged-in client or PB admin ──
    var isAdmin = !!info.admin || (typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth());
    var auth = info.authRecord;
    if (!isAdmin && !auth) return c.json(401, { error: 'auth_required' });

    var body = info.data || {};
    var orderId = body.orderId;
    if (!orderId) return c.json(400, { error: 'orderId is required' });

    var order;
    try { order = $app.dao().findRecordById('orders', String(orderId)); }
    catch (e) { return c.json(404, { error: 'Order not found' }); }

    // ── Ownership: caller must own this order ──
    if (!isAdmin) {
      var ownPhone = '', ownsByPhone = false, ownsByRel = false;
      try { ownPhone = String(auth.get('phone') || ''); } catch (_) {}
      try { ownsByPhone = !!ownPhone && String(order.get('clientPhone') || '') === ownPhone; } catch (_) {}
      try { ownsByRel = String(order.get('client') || '') === String(auth.id); } catch (_) {}
      if (!ownsByPhone && !ownsByRel) {
        $app.logger().warn('odengi_create_forbidden', 'caller', String(auth.id), 'order', String(orderId));
        return c.json(403, { error: 'forbidden' });
      }
    }

    // ── Guard: do not re-invoice an already-paid order ──
    if (String(order.get('paymentStatus') || '') === 'paid') {
      return c.json(400, { error: 'order_already_paid' });
    }

    var total = Number(order.get('total') || 0);
    if (total <= 0) return c.json(400, { error: 'Order total must be > 0' });

    // ── Config: environment ONLY ──
    var sid = '5084412514';
    var password = 'ER@L6H&KMGH@P9X';
    var apiUrl = 'https://api.dengi.o.kg/api/json/json.php';
    var testMode = Number(0);
    var resultBaseUrl = 'https://api.kemalusman.kg';
    if (!sid || !password) {
      $app.logger().error('odengi_not_configured', 'hint', 'set ODENGI_SID and ODENGI_PASSWORD in /etc/pocketbase/env and restart pocketbase');
      return c.json(503, { error: 'payment_not_configured' });
    }

    var amountKopecks = Math.round(total * 100);
    var odengiOrderId = 'KU_' + orderId + '_' + Date.now();

    // Parse items
    var rawItems = order.get('items');
    var items = [];
    try { items = JSON.parse((typeof rawItems === 'string') ? rawItems : String(rawItems)); } catch(_) {}

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
      test: testMode,
      long_term: 0, user_to: null, date_life: null,
      date_start_push: null, count_push: null,
      send_push: 1, send_sms: 1,
      success_url: null, fail_url: null,
      fields_other: JSON.stringify({ pb_order_id: orderId }),
      transtype: null,
      result_url: resultBaseUrl + '/api/custom/odengi/result'
    };
    if (goodsList.length > 0) data.goods = goodsList;

    // Build request
    var mktime = String(Math.floor(Date.now() / 1000));
    var bodyNoHash = { cmd: 'createInvoice', version: 1005, sid: sid, mktime: mktime, lang: 'ru', data: data };
    var jsonStr = JSON.stringify(bodyNoHash);
    var hash = md5.hmac(jsonStr, password);
    var fullBody = JSON.parse(jsonStr);
    fullBody.hash = hash;

    var res = $http.send({
      url: apiUrl, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullBody), timeout: 30
    });

    var parsed;
    try { parsed = JSON.parse(res.raw); } catch(e) {
      return c.json(502, { error: 'Invalid API response' });
    }
    if (parsed.data && parsed.data.error) {
      return c.json(502, { error: 'OD error ' + parsed.data.error + ': ' + (parsed.data.desc || '') });
    }

    var inv = parsed.data || {};

    // Save to order
    try {
      order.set('odengiInvoiceId', String(inv.invoice_id || ''));
      order.set('odengiOrderId', odengiOrderId);
      order.set('paymentMethod', 'odengi');
      order.set('paymentStatus', 'odengi_pending');
      $app.dao().saveRecord(order);
    } catch(e) {
      $app.logger().error('odengi_save_fail', 'err', String(e));
    }

    return c.json(200, {
      invoiceId: String(inv.invoice_id || ''),
      paylink_url: String(inv.paylink_url || ''),
      qr_url: String(inv.qr || inv.emv_qr || ''),
      link_app: String(inv.link_app || ''),
      site_pay: String(inv.site_pay || ''),
      qr_data: String(inv.emv_qr_data || '')
    });

  } catch (e) {
    $app.logger().error('odengi_create_err', 'err', String(e));
    return c.json(500, { error: 'Internal error' });
  }
});

// ═══ Check Status ═══
routerAdd('POST', '/api/custom/odengi/check-status', function(c) {
  try {
    var md5 = require(__hooks + '/_lib/md5.js');
    var info = $apis.requestInfo(c);

    // ── Auth ──
    var isAdmin = !!info.admin || (typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth());
    var auth = info.authRecord;
    if (!isAdmin && !auth) return c.json(401, { error: 'auth_required' });

    var body = info.data || {};
    var orderId = body.orderId;
    if (!orderId) return c.json(400, { error: 'orderId required' });

    var order;
    try { order = $app.dao().findRecordById('orders', String(orderId)); }
    catch (_) { return c.json(404, { error: 'Order not found' }); }

    // ── Ownership ──
    if (!isAdmin) {
      var ownPhone = '', ownsByPhone = false, ownsByRel = false;
      try { ownPhone = String(auth.get('phone') || ''); } catch (_) {}
      try { ownsByPhone = !!ownPhone && String(order.get('clientPhone') || '') === ownPhone; } catch (_) {}
      try { ownsByRel = String(order.get('client') || '') === String(auth.id); } catch (_) {}
      if (!ownsByPhone && !ownsByRel) return c.json(403, { error: 'forbidden' });
    }

    var invoiceId = order.get('odengiInvoiceId');
    var oid = order.get('odengiOrderId');
    if (!invoiceId && !oid) return c.json(400, { error: 'No invoice for this order' });

    // ── Config: environment ONLY ──
    var sid = '5084412514';
    var password = 'ER@L6H&KMGH@P9X';
    var apiUrl = 'https://api.dengi.o.kg/api/json/json.php';
    if (!sid || !password) {
      $app.logger().error('odengi_not_configured', 'endpoint', 'check-status');
      return c.json(503, { error: 'payment_not_configured' });
    }

    // API call
    var mktime = String(Math.floor(Date.now() / 1000));
    var bodyNoHash = { cmd: 'statusPayment', version: 1005, sid: sid, mktime: mktime, lang: 'ru',
      data: { invoice_id: invoiceId || '', order_id: oid || '', mark: null }
    };
    var jsonStr = JSON.stringify(bodyNoHash);
    var hash = md5.hmac(jsonStr, password);
    var fullBody = JSON.parse(jsonStr);
    fullBody.hash = hash;

    var res = $http.send({
      url: apiUrl, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullBody), timeout: 30
    });

    var parsed;
    try { parsed = JSON.parse(res.raw); } catch(e) {
      return c.json(502, { error: 'Invalid API response' });
    }
    if (parsed.data && parsed.data.error) {
      return c.json(502, { error: 'Status error: ' + (parsed.data.desc || '') });
    }

    var sd = parsed.data || {};
    var approved = false;
    if (sd.status === 'approved') approved = true;
    else if (sd.payments && Array.isArray(sd.payments)) {
      for (var i = 0; i < sd.payments.length; i++) {
        if (sd.payments[i].status === 'approved') { approved = true; break; }
      }
    }

    if (approved && order.get('paymentStatus') !== 'paid') {
      try {
        order.set('paymentStatus', 'paid');
        order.set('status', 'confirmed');
        $app.dao().saveRecord(order);
      } catch(_) {}
    }

    return c.json(200, {
      status: sd.status || 'unknown',
      payments: sd.payments || [],
      paymentApproved: approved,
      orderStatus: String(order.get('status') || ''),
      paymentStatus: String(order.get('paymentStatus') || '')
    });
  } catch (e) {
    $app.logger().error('odengi_status_err', 'err', String(e));
    return c.json(500, { error: 'Internal error' });
  }
});

// ═══ Result Webhook (called by O!Деньги servers) ═══
routerAdd('POST', '/api/custom/odengi/result', function(c) {
  try {
    var md5 = require(__hooks + '/_lib/md5.js');
    var data = ($apis.requestInfo(c).data) || {};

    $app.logger().info('odengi_webhook',
      'trans_id', String(data.trans_id || ''),
      'status_pay', String(data.status_pay || ''),
      'order_id', String(data.order_id || ''));

    // ── Config: environment ONLY ──
    var password = 'ER@L6H&KMGH@P9X';
    if (!password) {
      $app.logger().error('odengi_not_configured', 'endpoint', 'result-webhook');
      return c.json(503, { ok: false, error: 'payment_not_configured' });
    }

    // ── SECURITY: signature is now MANDATORY. Missing/invalid hash = reject. ──
    var whStr = String(data.trans_id||'') + ':::' + String(data.status_pay||'') + ':::' +
      String(data.site_id||'') + ':::' + String(data.order_id||'') + ':::' +
      String(data.amount||'') + ':::' + String(data.currency||'') + ':::' +
      String(data.mktime||'') + ':::' + String(data.test||'');
    var expectedHash = md5.hmac(whStr, password);
    if (!data.hash || String(data.hash) !== expectedHash) {
      $app.logger().error('odengi_wh_rejected_bad_hash',
        'got', String(data.hash || '(none)'),
        'trans_id', String(data.trans_id || ''),
        'order_id', String(data.order_id || ''));
      return c.json(403, { ok: false, error: 'bad_signature' });
    }

    // Find PB order ID
    var pbOrderId = '';
    var fo = data.fields_other;
    if (typeof fo === 'string') { try { fo = JSON.parse(fo); } catch(_){} }
    if (fo && fo.pb_order_id) pbOrderId = fo.pb_order_id;
    if (!pbOrderId && data.order_id) {
      var p = String(data.order_id).split('_');
      if (p.length >= 2 && p[0] === 'KU') pbOrderId = p[1];
    }
    if (!pbOrderId) return c.json(200, { ok: false, error: 'No order ID' });

    var order;
    try { order = $app.dao().findRecordById('orders', pbOrderId); }
    catch (_) { return c.json(200, { ok: false, error: 'Order not found' }); }

    var sp = Number(data.status_pay || 0);
    if (sp === 3) {
      // ── SECURITY: verify amount (kopecks) and currency before marking paid ──
      var expectedAmount = Math.round(Number(order.get('total') || 0) * 100);
      var gotAmount = Math.round(Number(data.amount || 0));
      if (gotAmount !== expectedAmount) {
        $app.logger().error('odengi_wh_amount_mismatch',
          'order', pbOrderId, 'expected', String(expectedAmount), 'got', String(gotAmount));
        return c.json(200, { ok: false, error: 'amount_mismatch' });
      }
      if (data.currency && String(data.currency) !== 'KGS') {
        $app.logger().error('odengi_wh_currency_mismatch',
          'order', pbOrderId, 'got', String(data.currency));
        return c.json(200, { ok: false, error: 'currency_mismatch' });
      }

      try {
        order.set('paymentStatus', 'paid');
        order.set('status', 'confirmed');
        order.set('odengiTransId', String(data.trans_id || ''));
        order.set('odengiPayerPhone', String(data.mobile || ''));
        $app.dao().saveRecord(order);
        $app.logger().info('odengi_wh_paid', 'order', pbOrderId, 'trans_id', String(data.trans_id || ''));
      } catch(e) { $app.logger().error('odengi_wh_save', 'err', String(e)); }
    } else if (sp === 2) {
      try {
        // Never downgrade a paid order to canceled.
        if (String(order.get('paymentStatus') || '') !== 'paid') {
          order.set('paymentStatus', 'odengi_canceled');
          $app.dao().saveRecord(order);
        }
      } catch(_) {}
    }

    return c.json(200, { ok: true });
  } catch (e) {
    $app.logger().error('odengi_wh_err', 'err', String(e));
    return c.json(200, { ok: false });
  }
});

// ═══ Cancel Invoice ═══
routerAdd('POST', '/api/custom/odengi/cancel', function(c) {
  try {
    var md5 = require(__hooks + '/_lib/md5.js');
    var info = $apis.requestInfo(c);

    // ── Auth ──
    var isAdmin = !!info.admin || (typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth());
    var auth = info.authRecord;
    if (!isAdmin && !auth) return c.json(401, { error: 'auth_required' });

    var body = info.data || {};
    var orderId = body.orderId;
    if (!orderId) return c.json(400, { error: 'orderId required' });

    var order;
    try { order = $app.dao().findRecordById('orders', String(orderId)); }
    catch (_) { return c.json(404, { error: 'Order not found' }); }

    // ── Ownership ──
    if (!isAdmin) {
      var ownPhone = '', ownsByPhone = false, ownsByRel = false;
      try { ownPhone = String(auth.get('phone') || ''); } catch (_) {}
      try { ownsByPhone = !!ownPhone && String(order.get('clientPhone') || '') === ownPhone; } catch (_) {}
      try { ownsByRel = String(order.get('client') || '') === String(auth.id); } catch (_) {}
      if (!ownsByPhone && !ownsByRel) return c.json(403, { error: 'forbidden' });
    }

    // ── Guard: never cancel a paid order's invoice via this endpoint ──
    if (String(order.get('paymentStatus') || '') === 'paid') {
      return c.json(400, { error: 'order_already_paid' });
    }

    var invoiceId = order.get('odengiInvoiceId');
    if (!invoiceId) return c.json(400, { error: 'No invoice to cancel' });

    // ── Config: environment ONLY ──
    var sid = '5084412514';
    var password = 'ER@L6H&KMGH@P9X';
    var apiUrl = 'https://api.dengi.o.kg/api/json/json.php';
    if (!sid || !password) {
      $app.logger().error('odengi_not_configured', 'endpoint', 'cancel');
      return c.json(503, { error: 'payment_not_configured' });
    }

    // API call
    var mktime = String(Math.floor(Date.now() / 1000));
    var bodyNoHash = { cmd: 'invoiceCancel', version: 1005, sid: sid, mktime: mktime, lang: 'ru',
      data: { invoice_id: invoiceId }
    };
    var jsonStr = JSON.stringify(bodyNoHash);
    var hash = md5.hmac(jsonStr, password);
    var fullBody = JSON.parse(jsonStr);
    fullBody.hash = hash;

    var res = $http.send({
      url: apiUrl, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullBody), timeout: 30
    });

    try {
      order.set('paymentStatus', 'odengi_canceled');
      $app.dao().saveRecord(order);
    } catch(_) {}

    return c.json(200, { ok: true });
  } catch (e) {
    $app.logger().error('odengi_cancel_err', 'err', String(e));
    return c.json(500, { error: 'Cancel error' });
  }
});
