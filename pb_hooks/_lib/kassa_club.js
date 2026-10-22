/* global $app, $apis, $os, __hooks, require, module */
/* eslint-disable no-unused-vars, no-empty -- catch (_) {} — так пишут все хуки PocketBase 0.22 (goja) в этом репозитории */
// Бонусы клуба Kemal для кассы на телефоне (папка kassa/ этого репозитория).
//
// Касса — отдельный сервер; бонусы покупателя живут здесь, в clients.bonus_balance / bonus_history (как у сайта).
// Касса зовёт POST /api/custom/kassa/club (kassa.pb.js) с ключом в заголовке X-Kassa-Key:
//   balance {phone}                              → {found, balance, earnPct, maxPct}
//   spend   {phone, opId, amount, who}           → списать бонусы за покупку в магазине (не больше баланса)
//   refund  {phone, opId}                        → вернуть списанное (продажу отменили)
//   earn    {phone, opId, total}                 → начислить bonusPercent % от оплаченного (продажа проведена в 1С)
//   unearn  {phone, opId}                        → забрать начисленное (проведённую продажу отменили)
// Каждый шаг записывается в bonus_history с ref «kassa:<opId>:<шаг>»: повтор того же запроса ничего не меняет.
// Ключ: переменная KASSA_CLUB_KEY или файл pb_data/kassa_credentials.json {"key": "…"} (как odengi_credentials.json).

// Файл → строка. Глобальный toString в PB 0.22 — это Object.prototype.toString («[object Undefined]»), как в assistant_config.js.
function bytesToString(bytes) {
  if (typeof bytes === 'string') return bytes;
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function loadKey() {
  var key = $os.getenv('KASSA_CLUB_KEY') || '';
  if (!key) {
    try {
      key = String(JSON.parse(bytesToString($os.readFile($app.dataDir() + '/kassa_credentials.json'))).key || '');
    } catch (e) {
      try { $app.logger().warn('kassa club: key file not read', 'err', String(e)); } catch (_) {}
      key = '';
    }
  }
  return key;
}

function settings() {
  var out = { earnPct: 5, maxPct: 30 };
  try {
    var s = null;
    try { s = $app.dao().findRecordById('settings', 'main'); } catch (_) {}
    if (!s) {
      var ss = $app.dao().findRecordsByFilter('settings', "id != ''", '-created', 1, 0);
      if (ss && ss.length > 0) s = ss[0];
    }
    if (s) {
      out.earnPct = Number(s.get('bonusPercent') || 5);
      out.maxPct = Number(s.get('useBonusPercent') || 30);
    }
  } catch (_) { /* по умолчанию */ }
  return out;
}

function history(client) {
  var list;
  try {
    var raw = client.getString('bonus_history');
    list = raw ? JSON.parse(raw) : [];
  } catch (_) { list = []; }
  return Array.isArray(list) ? list : [];
}

function findRef(list, ref) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].ref === ref) return list[i];
  }
  return null;
}

function findClient(dao, phone) {
  try { return dao.findFirstRecordByFilter('clients', 'phone = {:phone}', { phone: phone }); }
  catch (_) { return null; }
}

// Ключ кассы из заголовка X-Kassa-Key. PB 0.22: заголовки в requestInfo — строчными, «-» → «_»; запасной путь — сам запрос.
function keyOk(c, info) {
  var key = loadKey();
  var given = String((info.headers || {})['x_kassa_key'] || '');
  if (!given) {
    try { given = String(c.request().header.get('X-Kassa-Key') || ''); } catch (_) { given = ''; }
  }
  return !!key && given === key;
}

function handle(c) {
  var phoneLib = require(__hooks + '/_lib/phone.js');
  var info = $apis.requestInfo(c);
  if (!keyOk(c, info)) return c.json(401, { ok: false, error: 'key' });

  var data = info.data || {};
  var action = String(data.action || '');
  var digits = String(data.phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.charAt(0) === '0') digits = digits.slice(1);   // 0555 123 456 → 555123456
  var phone = phoneLib.normalizePhone(digits);
  var opId = String(data.opId || '').slice(0, 40);
  if (!phone || phone.length !== 13) return c.json(400, { ok: false, error: 'phone' });
  var conf = settings();

  if (action === 'balance') {
    var found = findClient($app.dao(), phone);
    return c.json(200, { ok: true, found: !!found, balance: found ? Number(found.get('bonus_balance') || 0) : 0,
                         earnPct: conf.earnPct, maxPct: conf.maxPct, name: found ? found.getString('name') : '' });
  }
  if (['spend', 'refund', 'earn', 'unearn'].indexOf(action) < 0) return c.json(400, { ok: false, error: 'action' });
  if (!opId) return c.json(400, { ok: false, error: 'opId' });

  var result = null;
  try {
    $app.dao().runInTransaction(function (tx) {
      var client = findClient(tx, phone);
      if (!client) { result = { status: 404, body: { ok: false, error: 'no_client' } }; return; }
      var balance = Number(client.get('bonus_balance') || 0);
      var list = history(client);
      var ref = 'kassa:' + opId + ':' + action;
      if (findRef(list, ref)) {   // уже сделано — повтор запроса
        result = { status: 200, body: { ok: true, repeated: true, balance: balance } };
        return;
      }
      var change;
      var label;
      if (action === 'spend') {
        var amount = Math.floor(Number(data.amount || 0));
        if (amount <= 0) { result = { status: 400, body: { ok: false, error: 'amount' } }; return; }
        if (amount > balance) { result = { status: 409, body: { ok: false, error: 'not_enough', balance: balance } }; return; }
        change = -amount;
        label = 'Покупка в магазине (касса)' + (data.who ? ', ' + String(data.who).slice(0, 40) : '');
      } else if (action === 'refund') {
        var spent = findRef(list, 'kassa:' + opId + ':spend');
        if (!spent) { result = { status: 200, body: { ok: true, nothing: true, balance: balance } }; return; }
        change = -Number(spent.amount || 0);
        label = 'Возврат бонусов: покупка отменена';
      } else if (action === 'earn') {
        change = Math.floor(Number(data.total || 0) * conf.earnPct / 100);
        if (change <= 0) { result = { status: 200, body: { ok: true, nothing: true, balance: balance } }; return; }
        label = 'Бонус за покупку в магазине';
      } else {
        var earned = findRef(list, 'kassa:' + opId + ':earn');
        if (!earned) { result = { status: 200, body: { ok: true, nothing: true, balance: balance } }; return; }
        change = -Math.min(Number(earned.amount || 0), balance);
        label = 'Бонус снят: покупка отменена';
      }
      list.push({ type: change < 0 ? 'spent' : 'earned', amount: change, label: label, ref: ref, date: new Date().toISOString() });
      client.set('bonus_balance', Math.max(0, balance + change));
      client.set('bonus_history', JSON.stringify(list));
      tx.saveRecord(client);
      result = { status: 200, body: { ok: true, amount: change, balance: Math.max(0, balance + change) } };
    });
  } catch (err) {
    $app.logger().error('kassa club: ' + action + ' failed', 'error', String(err));
    return c.json(500, { ok: false, error: 'server' });
  }
  return c.json(result.status, result.body);
}

// Наличие на сайте из 1С (владелец 22.10: «faqat 1C qoldig'i saytda ko'rinsin»). Касса шлёт
//   {updates: [{productId, variants: [{id, inStock}]}]} — меняется ТОЛЬКО inStock у вариантов с этими id;
// цены, названия, фото не трогаем. Ответ {ok, products: сколько товаров изменено, variants: сколько вариантов}.
function handleStock(c) {
  var info = $apis.requestInfo(c);
  if (!keyOk(c, info)) return c.json(401, { ok: false, error: 'key' });
  var updates = (info.data || {}).updates;
  if (!Array.isArray(updates)) return c.json(400, { ok: false, error: 'updates' });
  var products = 0, variants = 0, missing = [];
  for (var u = 0; u < updates.length && u < 2000; u++) {
    var up = updates[u] || {};
    var record;
    try { record = $app.dao().findRecordById('products', String(up.productId || '')); } catch (_) { record = null; }
    if (!record) { missing.push(String(up.productId || '')); continue; }
    var list;
    try { list = JSON.parse(record.getString('variants') || '[]'); } catch (_) { list = []; }
    if (!Array.isArray(list)) continue;
    var wanted = {};
    var ups = Array.isArray(up.variants) ? up.variants : [];
    for (var w = 0; w < ups.length; w++) wanted[String(ups[w].id)] = !!ups[w].inStock;
    var changed = 0;
    for (var i = 0; i < list.length; i++) {
      var key = String(list[i] && list[i].id);
      if (Object.prototype.hasOwnProperty.call(wanted, key) && !!list[i].inStock !== wanted[key]) {
        list[i].inStock = wanted[key];
        changed++;
      }
    }
    if (changed) {
      record.set('variants', list);
      $app.dao().saveRecord(record);
      products++;
      variants += changed;
    }
  }
  return c.json(200, { ok: true, products: products, variants: variants, missing: missing });
}

module.exports = { handle: handle, handleStock: handleStock };
