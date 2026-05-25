/// <reference path="../pb_data/types.d.ts" />
routerAdd('POST', '/api/custom/debug-odengi', (c) => {
  try {
    const body = $apis.requestInfo(c).data || {};
    const orderId = body.orderId || 'none';
    
    let order;
    try { order = $app.dao().findRecordById('orders', orderId); }
    catch (e) { return c.json(200, {step:'find_order',error:String(e)}); }
    
    const total = Number(order.get('total') || 0);
    const md5fn = require(`${__hooks}/_lib/md5.js`);
    
    const sid = '5084412514';
    const password = 'ER@L6H&KMGH@P9X';
    const apiUrl = 'https://api.dengi.o.kg/api/json/json.php';
    const mktime = String(Math.floor(Date.now() / 1000));
    const amountKopecks = Math.round(total * 100);
    const oId = 'KU_' + orderId + '_' + Date.now();
    
    const data = {
      order_id: oId,
      desc: 'Kemal Usman #' + orderId,
      amount: amountKopecks,
      currency: 'KGS',
      test: 0
    };
    
    // Build body WITHOUT hash
    const bodyNoHash = {
      cmd: 'createInvoice',
      version: 1005,
      sid: sid,
      mktime: mktime,
      lang: 'ru',
      data: data
    };
    
    const jsonStr = JSON.stringify(bodyNoHash);
    
    const results = {};
    
    // HMAC-MD5(json_body, password) — the correct formula from docs
    const hmacHash = md5fn.hmac(jsonStr, password);
    const fullBody = JSON.parse(jsonStr);
    fullBody.hash = hmacHash;
    
    try {
      const r = $http.send({
        url: apiUrl,
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(fullBody),
        timeout: 15
      });
      results.hmac_md5 = {status: r.statusCode, body: String(r.raw).slice(0,500), hash: hmacHash};
    } catch(e) { results.hmac_md5 = {error: String(e), hash: hmacHash}; }
    
    // Also test: plain MD5 verification 
    const plainHash = md5fn(jsonStr);
    results.plain_md5_of_json = plainHash;
    
    // Also test HMAC with password as message, json as key (reversed)
    const hmacReversed = md5fn.hmac(password, jsonStr);
    results.hmac_reversed = hmacReversed;
    
    return c.json(200, {
      step: 'hmac_test',
      mktime: mktime,
      json_preview: jsonStr.slice(0, 300),
      results: results
    });
  } catch(e) {
    return c.json(200, {step:'error', error:String(e), stack: e.stack || ''});
  }
});
