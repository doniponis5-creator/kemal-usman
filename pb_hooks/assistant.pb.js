/// <reference path="../pb_data/types.d.ts" />
//
// Онлайн-консультант «Спросить» (Gemini). Ключ живёт только здесь, на сервере —
// в приложение и сайт он не попадает. Логика запроса — pb_hooks/_lib/assistant_core.js.
//
// Endpoints:
//   POST /api/custom/assistant
//     Body: { messages: [{ role: 'user'|'assistant', text }], lang: 'ru'|'kg', viewing?: productId, shown?: [productId] }
//     Auth: не нужна (гости тоже спрашивают). Лимит — по IP.
//     200 { reply, productIds: [id], handoff: bool, mode: 'ai'|'fallback' }
//   GET /api/custom/assistant/usage   — только админ: вызовы и токены за сегодня.
//
// Настройка на сервере PocketBase (НЕ в .env приложения):
//   GEMINI_API_KEY=<ключ из aistudio.google.com — отдельный для Kemal Usman>
//   GEMINI_MODEL=gemini-3.8-flash          (необязательно)
//   ASSISTANT_DAILY_LIMIT=1500             (необязательно; вызовов ИИ в сутки, дальше — ответ без ИИ)
// Запасной путь, как у O!Dengi: если env у процесса нет (PocketBase перезапущен через nohup),
// ключ читается из pb_data/assistant_credentials.json — его пишет deploy-odengi.sh из локального .env.
// Без ключа консультант не ломается: отвечает без ИИ и зовёт в WhatsApp.

routerAdd('POST', '/api/custom/assistant', (c) => {
  var core = require(__hooks + '/_lib/assistant_core.js');
  var info = $apis.requestInfo(c);
  var data = info.data || {};
  var lang = data.lang === 'kg' ? 'kg' : 'ru';
  var ip = String(c.realIP() || 'unknown');

  // ── Лимит: 20 вопросов за 10 минут с одного IP. Хранилище в памяти, сброс при перезапуске.
  try {
    var rlKey = 'ai_rl:' + ip;
    var now = Date.now();
    var entry = $app.store().get(rlKey) || { start: now, count: 0 };
    if (now - Number(entry.start || 0) > 600000) entry = { start: now, count: 0 };
    entry.count = Number(entry.count || 0) + 1;
    $app.store().set(rlKey, entry);
    if (entry.count > 20) return c.json(429, { error: 'too_many_requests' });
  } catch (_) { /* лимит не должен ронять ответ */ }

  // ── Каталог и настройки. Каталог держим в памяти 5 минут — 800 записей на каждый вопрос ни к чему.
  var products = null;
  try {
    var cached = $app.store().get('ai_products');
    if (cached && Date.now() - Number(cached.at || 0) < 300000) products = cached.list;
  } catch (_) { products = null; }
  if (!products) {
    products = [];
    var recs = $app.dao().findRecordsByExpr('products');
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      products.push({
        id: r.getId(),
        name: r.getString('name'),
        brand: r.getString('brand'),
        category: r.getString('category'),
        desc: r.getString('desc'),
        tags: r.getString('tags'),
        variants: r.getString('variants'),
        salePercent: r.getFloat('salePercent'),
        saleStart: r.getString('saleStart'),
        saleEnd: r.getString('saleEnd'),
        scheduled: r.getBool('scheduled'),
        showFrom: r.getString('showFrom'),
        showUntil: r.getString('showUntil'),
        isHit: r.getBool('isHit'),
        isNew: r.getBool('isNew'),
        isPopular: r.getBool('isPopular')
      });
    }
    try { $app.store().set('ai_products', { at: Date.now(), list: products }); } catch (_) {}
  }

  var settings = {};
  try {
    var srecs = $app.dao().findRecordsByExpr('settings');
    if (srecs.length > 0) {
      var s = srecs[0];
      settings = {
        shopName: s.getString('shopName'),
        shopAddress: s.getString('shopAddress'),
        workingHours: s.getString('workingHours'),
        deliveryCost: s.getFloat('deliveryCost'),
        freeDeliveryFrom: s.getFloat('freeDeliveryFrom'),
        minOrderForFreeDelivery: s.getFloat('minOrderForFreeDelivery'),
        minOrder: s.getFloat('minOrder'),
        onlinePaymentEnabled: s.getBool('onlinePaymentEnabled'),
        bonusPercent: s.getFloat('bonusPercent'),
        useBonusPercent: s.getFloat('useBonusPercent'),
        welcomeBonus: s.getFloat('welcomeBonus'),
        welcomeBonusEnabled: s.getBool('welcomeBonusEnabled'),
        whatsappPhone: s.getString('whatsappPhone')
      };
    }
  } catch (e) {
    $app.logger().warn('assistant: settings read failed', 'err', String(e));
  }

  var prepared = core.prepare(data, products, settings, Date.now());
  if (!prepared.ok) return c.json(400, { error: prepared.error });

  var cfg = require(__hooks + '/_lib/assistant_config.js').read();
  var key = cfg.key;
  var model = cfg.model;
  var limit = cfg.limit;
  var day = new Date().toISOString().slice(0, 10);
  var dayKey = 'ai_day:' + day;
  var stat = $app.store().get(dayKey) || { calls: 0, fallbacks: 0, input: 0, cached: 0, output: 0 };

  var answer = null;
  if (key && stat.calls < limit) {
    try {
      var res = $http.send({
        url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(prepared.body),
        timeout: 25
      });
      stat.calls += 1;
      if (res.statusCode === 200) {
        answer = core.finish(prepared, JSON.parse(res.raw));
      } else {
        $app.logger().warn('assistant: gemini http error', 'status', String(res.statusCode), 'body', String(res.raw).slice(0, 300));
      }
    } catch (e) {
      $app.logger().warn('assistant: gemini failed', 'err', String(e));
    }
  }

  var mode = 'ai';
  if (!answer) {
    answer = core.fallbackReply(prepared, lang);
    mode = 'fallback';
    stat.fallbacks += 1;
  }
  if (answer.usage) {
    stat.input += answer.usage.input;
    stat.cached += answer.usage.cached;
    stat.output += answer.usage.output;
  }
  try { $app.store().set(dayKey, stat); } catch (_) {}

  return c.json(200, { reply: answer.reply, productIds: answer.productIds, handoff: answer.handoff, mode: mode });
});

routerAdd('GET', '/api/custom/assistant/usage', (c) => {
  var info = $apis.requestInfo(c);
  if (!info.admin) return c.json(403, { error: 'admin_only' });
  var day = new Date().toISOString().slice(0, 10);
  var stat = $app.store().get('ai_day:' + day) || { calls: 0, fallbacks: 0, input: 0, cached: 0, output: 0 };
  var cfg = require(__hooks + '/_lib/assistant_config.js').read();
  return c.json(200, { day: day, configured: !!cfg.key, model: cfg.model, limit: cfg.limit, stat: stat });
});
