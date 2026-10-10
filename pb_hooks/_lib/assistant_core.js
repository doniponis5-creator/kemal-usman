/* global module */
/* eslint no-unused-vars: ["error", { "caughtErrors": "none" }] */
// Онлайн-консультант «Спросить» — общая логика без ввода-вывода.
//
// Один и тот же файл работает в двух местах:
//   • pb_hooks/assistant.pb.js — на сервере PocketBase (goja, синхронный $http.send);
//   • vite.config.js — локальный предпросмотр (Node, fetch).
// Поэтому здесь только чистые функции и CommonJS: prepare() собирает запрос к
// Gemini, finish() разбирает ответ, fallbackReply() отвечает без ИИ.
// Пишем на ES5-подмножестве (var, function) — goja старых версий не знает ?. и spread.

var MAX_TURNS = 10;
var MAX_TEXT = 600;
var MAX_CARDS = 3;
var OUT_OF_STOCK_MATCHES = 20;

// ─── нормализация и нечёткое сравнение ──────────────────────────────────────
var CYR = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ң': 'n', 'ө': 'o', 'ү': 'u',
  'қ': 'k', 'ғ': 'g', 'ҳ': 'h', 'ў': 'u'
};

function latin(s) {
  var out = '';
  var low = String(s || '').toLowerCase();
  for (var i = 0; i < low.length; i++) {
    var ch = low.charAt(i);
    out += Object.prototype.hasOwnProperty.call(CYR, ch) ? CYR[ch] : ch;
  }
  return out;
}

// «Звуковой» ключ слова: Chanel/Шанель, Baccarat/Баккара сводятся к одному виду.
function sound(word) {
  var w = latin(word).replace(/[^a-z0-9]/g, '');
  w = w.replace(/ph/g, 'f').replace(/ch/g, 'sh').replace(/c(?=[eiy])/g, 's').replace(/sch/g, 'sh').replace(/ck/g, 'k')
    .replace(/c/g, 'k').replace(/q/g, 'k').replace(/w/g, 'v').replace(/x/g, 'ks')
    .replace(/y/g, 'i').replace(/j/g, 'zh').replace(/ou/g, 'u').replace(/ee/g, 'i');
  w = w.replace(/(.)\1+/g, '$1');
  if (w.length > 4) w = w.replace(/[ht]$/, '');
  return w;
}

function words(s) {
  var parts = latin(s).split(/[^a-z0-9]+/);
  var out = [];
  for (var i = 0; i < parts.length; i++) if (parts[i].length >= 2) out.push(parts[i]);
  return out;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  var prev = [];
  var j;
  for (j = 0; j <= b.length; j++) prev.push(j);
  for (var i = 1; i <= a.length; i++) {
    var cur = [i];
    for (j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length];
}

// ─── товар → короткая строка для модели ─────────────────────────────────────
function parseVariants(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try { var parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; }
  }
  return [];
}

function activeSale(p, now) {
  var pct = Number(p.salePercent) || 0;
  if (pct <= 0 || !p.saleEnd) return 0;
  var end = new Date(String(p.saleEnd).replace(' ', 'T')).getTime();
  if (!(end > now)) return 0;
  if (p.saleStart) {
    var start = new Date(String(p.saleStart).replace(' ', 'T')).getTime();
    if (start > now) return 0;
  }
  return pct;
}

// Товар скрыт расписанием — консультант о нём не знает (как и каталог).
function hiddenBySchedule(p, now) {
  if (!p.scheduled) return false;
  if (p.showFrom && new Date(String(p.showFrom).replace(' ', 'T')).getTime() > now) return true;
  if (p.showUntil && new Date(String(p.showUntil).replace(' ', 'T')).getTime() < now) return true;
  return false;
}

// desc в каталоге: «🔝 Верхние: …», «💎 Средние: …», «🌿 Базовые: …», «📋 Тип: EDP · Стойкость: …», потом текст.
function describe(desc) {
  // Часть описаний в базе записана с \r\n — без этого «.+$» не совпадал и ноты терялись.
  var lines = String(desc || '').split(/\r?\n/);
  var notes = [];
  var kind = '';
  var mood = '';
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^[^A-Za-zА-Яа-яЁё]+/, '').trim();
    if (!line) continue;
    var m = line.match(/^(Верхние|Средние|Базовые|Ноты)\s*:\s*(.+)$/i);
    if (m) { notes.push(m[2].trim()); continue; }
    if (/^Тип\s*:/i.test(line)) { kind = line.replace(/^Тип\s*:\s*/i, '').replace(/\s*·\s*/g, ', '); continue; }
    if (!mood) {
      var stop = line.search(/[.!?](\s|$)/);
      mood = (stop > 0 ? line.slice(0, stop + 1) : line).slice(0, 110);
    }
  }
  return { notes: notes.join(' / '), kind: kind, mood: mood };
}

function plainProduct(p) {
  return {
    id: String(p.id),
    name: String(p.name || ''),
    brand: String(p.brand || ''),
    category: String(p.category || ''),
    desc: String(p.desc || ''),
    tags: String(p.tags || ''),
    variants: parseVariants(p.variants),
    salePercent: Number(p.salePercent) || 0,
    saleStart: p.saleStart || '',
    saleEnd: p.saleEnd || '',
    scheduled: p.scheduled === true || p.scheduled === 'true',
    showFrom: p.showFrom || '',
    showUntil: p.showUntil || '',
    isHit: p.isHit === true || p.isHit === 'true',
    isNew: p.isNew === true || p.isNew === 'true',
    isPopular: p.isPopular === true || p.isPopular === 'true'
  };
}

function hasStock(p) {
  for (var i = 0; i < p.variants.length; i++) if (p.variants[i].inStock) return true;
  return false;
}

function line(p, now) {
  var d = describe(p.desc);
  var sale = activeSale(p, now);
  var have = [];
  var none = [];
  for (var i = 0; i < p.variants.length; i++) {
    var v = p.variants[i];
    var label = String(v.label || '').trim();
    if (v.type === 'pkg' && !/упаков|флакон/i.test(label)) label = 'флакон ' + label;
    if (v.inStock) {
      var price = Number(v.price) || 0;
      have.push(label + ' — ' + (sale ? Math.round(price * (1 - sale / 100)) + ' сом (без скидки ' + price + ')' : price + ' сом'));
    } else {
      none.push(label);
    }
  }
  var parts = ['[' + p.id + '] ' + p.brand + ' ' + p.name, p.category];
  parts.push(have.length ? 'есть: ' + have.join(', ') : 'НЕТ В НАЛИЧИИ');
  if (have.length && none.length) parts.push('нет: ' + none.join(', '));
  if (d.kind) parts.push(d.kind);
  if (d.notes) parts.push('ноты: ' + d.notes);
  if (d.mood && have.length) parts.push(d.mood);
  var marks = [];
  if (sale) marks.push('скидка ' + sale + '%');
  if (p.isHit) marks.push('хит');
  if (p.isNew) marks.push('новинка');
  if (marks.length) parts.push(marks.join(', '));
  return parts.join(' | ');
}

// ─── какие товары показать модели ───────────────────────────────────────────
// Слова вопроса, которые не про аромат («есть», «бар», «сколько»…) — уже в латинице.
var STOP = {};
('est estli bar barby barbi bary barmy bolobu bolot by bi li u vas vam mne nam men biz siz sizde '
  + 'skolko stoit tsena tsenu narhy kancha kanchadan kerek nuzhen nuzhna nuzhno hochu hotela hotel '
  + 'dlya ili eto kak chto kakoy kakie kakaya pro ot do pod nad na po iz za so ne net da '
  + 'aromat aromata aromaty parfum duhi zhyt zhypar atir ml mililitr som soma sizga uchun bormi '
  + 'pozhaluysta salam assalamu alaykum zdravstvuyte privet rahmat spasibo the and for de la le eau').split(' ')
  .forEach(function (w) { STOP[w] = true; });

// Для каждого слова вопроса берём ЛУЧШЕЕ совпадение, а не сумму: иначе «Dior Dior Homme»
// обгонял «Sauvage» на вопрос «Sauvage dior» только потому, что «Dior» в нём дважды.
function scoreFor(p, qWords, qSounds) {
  var hay = words(p.brand + ' ' + p.name + ' ' + p.tags);
  var s = 0;
  for (var i = 0; i < qWords.length; i++) {
    var q = qWords[i];
    if (q.length < 3 || STOP[q]) continue;
    var best = 0;
    for (var j = 0; j < hay.length; j++) {
      var w = hay[j];
      if (w === q) { best = 40; break; }
      if (q.length >= 4 && w.length >= 4 && (w.indexOf(q) === 0 || q.indexOf(w) === 0)) { best = Math.max(best, 25); continue; }
      var a = qSounds[i];
      var b = sound(w);
      if (a.length >= 4 && b.length >= 4 && editDistance(a, b) <= (a.length >= 7 ? 2 : 1)) best = Math.max(best, 20);
    }
    s += best;
  }
  return s;
}

function selectProducts(all, question, keepIds, now) {
  var qWords = words(question);
  var qSounds = [];
  for (var i = 0; i < qWords.length; i++) qSounds.push(sound(qWords[i]));
  var inStock = [];
  var scored = [];
  for (var k = 0; k < all.length; k++) {
    var p = all[k];
    if (hiddenBySchedule(p, now)) continue;
    if (hasStock(p)) { inStock.push(p); continue; }
    var keep = keepIds.indexOf(p.id) >= 0;
    var s = scoreFor(p, qWords, qSounds);
    if (keep || s > 0) scored.push({ p: p, s: keep ? 1000 : s });
  }
  scored.sort(function (a, b) { return b.s - a.s; });
  var missing = [];
  for (var m = 0; m < scored.length && m < OUT_OF_STOCK_MATCHES; m++) missing.push(scored[m].p);
  return { inStock: inStock, missing: missing };
}

function brandIndex(all, now) {
  var map = {};
  for (var i = 0; i < all.length; i++) {
    if (hiddenBySchedule(all[i], now)) continue;
    var b = all[i].brand || '—';
    map[b] = (map[b] || 0) + 1;
  }
  var keys = Object.keys(map).sort();
  var out = [];
  for (var k = 0; k < keys.length; k++) out.push(keys[k]);
  return out.join(', ');
}

// ─── правила для модели ─────────────────────────────────────────────────────
function money(n) { return Math.round(Number(n) || 0) + ' сом'; }

function shopFacts(st) {
  var f = [];
  f.push('Магазин: ' + (st.shopName || 'Kemal Usman') + ', Бишкек. Парфюм на разлив (распив во флакончики 1–30 мл) и целые флаконы (в каталоге «Упаковка»).');
  if (st.shopAddress) f.push('Адрес: ' + st.shopAddress + '.');
  if (st.workingHours) f.push('Часы работы: ' + st.workingHours + '.');
  var cost = Number(st.deliveryCost) || 0;
  var free = Number(st.freeDeliveryFrom || st.minOrderForFreeDelivery) || 0;
  if (cost) f.push('Доставка по Бишкеку: ' + money(cost) + (free ? ', бесплатно от ' + money(free) : '') + '. Есть самовывоз.');
  if (Number(st.minOrder)) f.push('Минимальный заказ: ' + money(st.minOrder) + '.');
  f.push('Оплата: наличными, MBank' + (st.onlinePaymentEnabled ? ', онлайн через O!Dengi' : '') + '.');
  var bonus = [];
  if (Number(st.bonusPercent)) bonus.push('с каждого заказа начисляется ' + Number(st.bonusPercent) + '% бонусами');
  if (Number(st.useBonusPercent)) bonus.push('бонусами можно оплатить до ' + Number(st.useBonusPercent) + '% заказа');
  if (st.welcomeBonusEnabled && Number(st.welcomeBonus)) bonus.push('за регистрацию дарим ' + money(st.welcomeBonus) + ' бонусами');
  if (bonus.length) f.push('Бонусы: ' + bonus.join('; ') + '.');
  if (st.whatsappPhone) f.push('WhatsApp магазина: ' + st.whatsappPhone + '.');
  return f.join('\n');
}

function rules(st) {
  return [
    'Ты — консультант интернет-магазина парфюма Kemal Usman в Бишкеке. Отвечаешь в чате на сайте и в приложении.',
    '',
    'ГЛАВНОЕ: НЕ ВЫДУМЫВАЙ. Ароматы, цены, объёмы и наличие — только из списка товаров ниже. Условия магазина — только из блока «МАГАЗИН».',
    'Чего нет в тексте — ты этого не знаешь: честно скажи и предложи написать в WhatsApp (поле handoff = true).',
    'Про оригинальность, происхождение, сертификаты, сроки годности, оптовые цены, возврат и жалобы не рассуждай — handoff = true, коротко: «уточню у руководства, напишите нам в WhatsApp».',
    '',
    'ЯЗЫК: отвечай на языке последнего сообщения покупателя — русский, кыргызский или узбекский.',
    '',
    'КАК ГОВОРИТЬ — как опытный продавец парфюмерии, который пишет с телефона:',
    '- Коротко: одно-два предложения, три — предел. Без списков, звёздочек и решёток.',
    '- Обращайся на «вы». Не хвали выбор, не пиши «с удовольствием», «отличный выбор», «к сожалению», «чем могу помочь».',
    '- Не здоровайся: чат уже поздоровался с покупателем («Ассаламу алейкум»). Сразу к делу. Себя не представляй.',
    '- Подбираешь аромат — сначала один уточняющий вопрос, если неясно главное: для кого, какие ароматы нравятся, на сезон или повод, бюджет.',
    '- Советуешь — назови 1–3 аромата, у каждого цену самого ходового объёма и одну причину, почему подходит именно ему (по нотам из списка).',
    '- Ноты, стойкость и шлейф бери только из списка. Если их там нет — не придумывай.',
    '- «Похож на …» — сравнивай только по нотам из списка, без обещаний «один в один».',
    '- Товара нет в наличии — скажи прямо и предложи похожий по нотам из тех, что есть.',
    '- Объём: распив 1, 5, 10, 20, 30 мл — чтобы попробовать или носить с собой; «Упаковка» — целый флакон.',
    '- Заказ ты не оформляешь. Покупатель кладёт аромат в корзину кнопкой под твоим ответом и оформляет заказ в корзине.',
    '',
    'ФОРМАТ: поле reply — только готовый текст покупателю. productIds — id из квадратных скобок для ароматов, которые ты назвал в этом ответе (до трёх, в наличии — в первую очередь). Служебные id в тексте не пиши.',
    '',
    'МАГАЗИН',
    shopFacts(st)
  ].join('\n');
}

function lastUserText(turns) {
  for (var i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') return turns[i].text;
  return '';
}

// Чистит то, что пришло от клиента: роли, длина, количество.
function cleanTurns(raw) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var t = list[i] || {};
    var text = String(t.text || '').replace(/\s+$/, '').slice(0, MAX_TEXT);
    if (!text.trim()) continue;
    out.push({ role: t.role === 'assistant' ? 'assistant' : 'user', text: text });
  }
  out = out.slice(-MAX_TURNS);
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/**
 * input: { messages, lang, viewing, shown } — от клиента.
 * products: записи products (сырые или уже простые объекты); settings: запись settings.
 * Возвращает { ok, turns, body, selected } или { ok: false, error }.
 */
function prepare(input, products, settings, now) {
  now = now || Date.now();
  var turns = cleanTurns(input && input.messages);
  if (!turns.length || turns[turns.length - 1].role !== 'user') return { ok: false, error: 'empty_question' };
  var all = [];
  for (var i = 0; i < products.length; i++) all.push(plainProduct(products[i]));
  var keep = [];
  if (input && input.viewing) keep.push(String(input.viewing));
  var shown = (input && Array.isArray(input.shown)) ? input.shown : [];
  for (var s = 0; s < shown.length && s < 12; s++) keep.push(String(shown[s]));
  var userText = '';
  for (var u = 0; u < turns.length; u++) if (turns[u].role === 'user') userText += ' ' + turns[u].text;
  var sel = selectProducts(all, userText, keep, now);

  var stockLines = [];
  for (var a = 0; a < sel.inStock.length; a++) stockLines.push(line(sel.inStock[a], now));
  // Неизменная часть — первой: Gemini берёт со скидкой одинаковое начало запросов.
  var fixed = rules(settings || {}) + '\n\nАРОМАТЫ В НАЛИЧИИ (' + sel.inStock.length + ')\n' + stockLines.join('\n')
    + '\n\nВСЕ БРЕНДЫ КАТАЛОГА (у большинства ароматов сейчас нет в наличии): ' + brandIndex(all, now);

  var tail = [];
  if (sel.missing.length) {
    var miss = [];
    for (var b = 0; b < sel.missing.length; b++) miss.push(line(sel.missing[b], now));
    tail.push('ПОХОЖЕЕ ПО ВОПРОСУ, НО НЕТ В НАЛИЧИИ\n' + miss.join('\n'));
  }
  if (input && input.viewing) {
    for (var v = 0; v < all.length; v++) {
      if (all[v].id === String(input.viewing)) { tail.push('Покупатель сейчас смотрит страницу: [' + all[v].id + '] ' + all[v].brand + ' ' + all[v].name); break; }
    }
  }
  tail.push('Язык сайта у покупателя: ' + (input && input.lang === 'kg' ? 'кыргызский' : 'русский') + ' (но отвечай на языке его сообщения).');

  var known = {};
  for (var x = 0; x < sel.inStock.length; x++) known[sel.inStock[x].id] = true;
  for (var y = 0; y < sel.missing.length; y++) known[sel.missing[y].id] = true;

  var contents = [];
  for (var c = 0; c < turns.length; c++) {
    contents.push({ role: turns[c].role === 'assistant' ? 'model' : 'user', parts: [{ text: turns[c].text }] });
  }
  var body = {
    systemInstruction: { parts: [{ text: fixed + '\n\nСЕЙЧАС\n' + tail.join('\n\n') }] },
    contents: contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2000,
      thinkingConfig: { thinkingLevel: 'low' },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          reply: { type: 'STRING', description: 'Готовый ответ покупателю, слово в слово' },
          productIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'id названных ароматов, не больше трёх' },
          handoff: { type: 'BOOLEAN', description: 'true — нужен живой человек: ответа нет в тексте или вопрос не про подбор' }
        },
        required: ['reply']
      }
    }
  };
  return { ok: true, turns: turns, body: body, known: known, question: lastUserText(turns), all: all, now: now };
}

/** Ответ Gemini (уже JSON-объект) → { reply, productIds, handoff, usage }. */
function finish(prepared, data) {
  var cand = data && data.candidates && data.candidates[0];
  var parts = (cand && cand.content && cand.content.parts) || [];
  var text = '';
  for (var i = 0; i < parts.length; i++) if (parts[i] && !parts[i].thought && parts[i].text) text += parts[i].text;
  var row;
  try { row = JSON.parse(text); } catch (_) { row = null; }
  var reply = row && typeof row.reply === 'string' ? row.reply : (row ? '' : text);
  reply = String(reply || '').replace(/\s*\[[a-z0-9]{10,20}\]/gi, '').trim();
  if (!reply) return null;
  var ids = [];
  var raw = row && Array.isArray(row.productIds) ? row.productIds : [];
  for (var k = 0; k < raw.length && ids.length < MAX_CARDS; k++) {
    var id = String(raw[k]).replace(/[[\]\s]/g, '');
    if (prepared.known[id] && ids.indexOf(id) < 0) ids.push(id);
  }
  var u = (data && data.usageMetadata) || {};
  return {
    reply: reply,
    productIds: ids,
    handoff: !!(row && row.handoff),
    usage: {
      input: Number(u.promptTokenCount) || 0,
      cached: Number(u.cachedContentTokenCount) || 0,
      output: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0)
    }
  };
}

var FALLBACK = {
  ru: {
    found: 'Сейчас не могу ответить подробно. Вот что нашлось по вашему вопросу — а с подбором поможем в WhatsApp.',
    none: 'Сейчас не могу ответить подробно. Напишите нам в WhatsApp — поможем подобрать аромат.'
  },
  kg: {
    found: 'Азыр толук жооп бере албайм. Сурооңуз боюнча табылганы ушул — тандоого WhatsApp аркылуу жардам беребиз.',
    none: 'Азыр толук жооп бере албайм. WhatsApp\'ка жазыңыз — жыпар тандоого жардам беребиз.'
  }
};

/** Ответ без ИИ: ключа нет, лимит исчерпан или Google не ответил. */
function fallbackReply(prepared, lang) {
  var t = FALLBACK[lang === 'kg' ? 'kg' : 'ru'];
  var ids = [];
  if (prepared && prepared.ok) {
    var qWords = words(prepared.question);
    var qSounds = [];
    for (var i = 0; i < qWords.length; i++) qSounds.push(sound(qWords[i]));
    var scored = [];
    for (var k = 0; k < prepared.all.length; k++) {
      var p = prepared.all[k];
      if (hiddenBySchedule(p, prepared.now)) continue;
      var s = scoreFor(p, qWords, qSounds);
      if (s > 0) scored.push({ id: p.id, s: s + (hasStock(p) ? 30 : 0) });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    for (var m = 0; m < scored.length && ids.length < MAX_CARDS; m++) ids.push(scored[m].id);
  }
  return { reply: ids.length ? t.found : t.none, productIds: ids, handoff: true, usage: null };
}

module.exports = {
  prepare: prepare,
  finish: finish,
  fallbackReply: fallbackReply,
  // для тестов
  _sound: sound,
  _describe: describe,
  _line: line,
  _plainProduct: plainProduct
};
