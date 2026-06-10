/// <reference path="../pb_data/types.d.ts" />
//
// PocketBase JSVM hooks — runs server-side inside PocketBase.
// Deploy: copy the entire pb_hooks/ folder to the same directory as your
// `pocketbase` binary on the server, then restart PB. Hooks reload automatically.
//
// THIS FILE WIRES ALL OTHER HOOKS. Do not delete.
//
// Why this exists:
// The frontend was previously calculating bonuses, totals, welcome rewards and
// referral payouts on the client and writing them to localStorage. That meant
// any user could open DevTools, set parfum_bonus_balance = 999999 and check out
// for free. Every money-affecting calculation now happens here, on the server,
// using the authoritative product/variant prices and the authoritative bonus
// balance stored in the `clients` collection.
//
// All hooks below are idempotent — safe to re-deploy.

// Order create — TWO-PHASE to avoid the bonus race:
//
//   Phase 1 (beforeCreate): validate items, recompute total/subtotal/bonus,
//   compute the allowed bonus discount and stash it on the record. DO NOT
//   debit the client's bonus yet — if the order save fails the client would
//   lose bonus permanently.
//
//   Phase 2 (afterCreate): now that the order is committed, debit the bonus
//   inside a transaction so a crash mid-flow leaves balance + history aligned.

onRecordBeforeCreateRequest((e) => {
  if (e.collection.name !== 'orders') return;
  $app.logger().info('orders.beforeCreate', 'phone', e.record.get('clientPhone'));

  // ── Parse items from the HTTP request body, NOT from e.record.get() ──
  // PocketBase JSVM (goja) wraps JSON fields as proxy objects. Property
  // access on proxied array elements silently returns undefined even though
  // the data is present. Pulling the raw body via $apis.requestInfo() gives
  // us a plain JS string we can JSON.parse ourselves — no proxy issues.
  const info = $apis.requestInfo(e.httpContext);
  let rawItems = (info.data || {}).items;
  $app.logger().info('items_source', 'type', typeof rawItems,
    'preview', String(typeof rawItems === 'string' ? rawItems : JSON.stringify(rawItems)).slice(0, 400));

  let items;
  if (typeof rawItems === 'string') {
    // Double-stringified safety: parse once, check if still string, parse again.
    try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
    }
    items = rawItems;
  } else if (Array.isArray(rawItems)) {
    // Already an array (PB SDK sent JSON object, not string).
    // Force through JSON round-trip to shed any residual goja proxies.
    try { items = JSON.parse(JSON.stringify(rawItems)); } catch { items = []; }
  } else if (rawItems && typeof rawItems === 'object') {
    // goja may present the array as an object with numeric keys.
    try { items = JSON.parse(JSON.stringify(rawItems)); } catch { items = []; }
    if (!Array.isArray(items)) {
      // Convert {0: {...}, 1: {...}} → [{...}, {...}]
      const arr = [];
      for (let k = 0; rawItems[String(k)] !== undefined; k++) {
        try { arr.push(JSON.parse(JSON.stringify(rawItems[String(k)]))); } catch { break; }
      }
      items = arr;
    }
  } else {
    items = [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    $app.logger().error('items_invalid', 'raw',
      String(typeof rawItems === 'string' ? rawItems : JSON.stringify(rawItems)).slice(0, 500));
    throw new BadRequestError('Items list is empty or malformed.');
  }
  // Recompute the total from authoritative product prices.
  let serverTotal = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Defensive: extract fields explicitly in case proxy lingers on elements.
    const pId  = item.productId || item['productId'] || '';
    const vId  = item.variantId || item['variantId'] || '';
    const qNum = Number(item.qty || item['qty'] || 0);
    $app.logger().info('item_check', 'index', String(i),
      'productId', String(pId), 'variantId', String(vId), 'qty', String(qNum),
      'keys', Object.keys(item).join(','));
    if (!pId || !vId || !qNum) {
      $app.logger().error('item_missing_field', 'index', String(i),
        'item', JSON.stringify(item).slice(0, 200),
        'pId', String(pId), 'vId', String(vId), 'qty', String(qNum));
      throw new BadRequestError('Item missing productId/variantId/qty.');
    }
    // Normalize the item for downstream use.
    items[i] = { productId: String(pId), variantId: String(vId), qty: qNum,
                 name: item.name || '', price: Number(item.price || 0) };
    if (qNum < 1 || qNum > 999) {
      throw new BadRequestError('Quantity must be between 1 and 999.');
    }
    let product;
    try {
      product = $app.dao().findRecordById('products', String(pId));
    } catch (err) {
      throw new BadRequestError('Unknown product: ' + pId);
    }
    // PB JSVM returns JSON fields as Go JsonRaw (byte array), not parsed JS.
    // Must convert to string first, then parse.
    let rawV = product.get('variants');
    let variants = [];
    try {
      const vStr = (typeof rawV === 'string') ? rawV : String(rawV);
      variants = JSON.parse(vStr);
    } catch (_) { variants = []; }
    if (!Array.isArray(variants)) { variants = []; }
    // Goja .find() is unreliable on JSON-parsed arrays — use manual loop
    let v = null;
    const vIdStr = String(vId);
    for (let vi = 0; vi < variants.length; vi++) {
      const candidate = variants[vi];
      if (candidate && String(candidate.id) === vIdStr) { v = candidate; break; }
    }
    $app.logger().info('variant_lookup', 'vId', vIdStr, 'found', String(!!v),
      'variants_count', String(variants.length),
      'variant_ids', variants.map(function(x){ return String(x.id); }).join(','));
    if (!v) throw new BadRequestError('Unknown variant: ' + vId);
    if (v.inStock === false) throw new BadRequestError('Variant out of stock: ' + v.label);
    serverTotal += Number(v.price) * qNum;
  }
  // Write the fully-normalized plain JS items back so PB stores clean JSON.
  e.record.set('items', items);

  // Pull max-discount-percent from settings.
  let useBonusPct = 30;
  try {
    const s = $app.dao().findRecordById('settings', 'main');
    useBonusPct = Number(s.get('useBonusPercent') || 30);
  } catch (_) { /* default */ }

  // RULE 2: bonus can only be spent on orders ≥ MIN_ORDER_FOR_BONUS som.
  // Anything below this — silently zero out the requested bonus.
  const MIN_ORDER_FOR_BONUS = 500;
  let bonusRequested = Number(e.record.get('bonusDiscount') || 0);
  if (bonusRequested > 0 && serverTotal < MIN_ORDER_FOR_BONUS) {
    $app.logger().info('bonus: order subtotal below minimum — bonus zeroed',
      'subtotal', serverTotal, 'min', MIN_ORDER_FOR_BONUS, 'requested', bonusRequested);
    bonusRequested = 0;
  }

  const phone = e.record.get('clientPhone');
  let bonusBalance = 0;
  if (phone) {
    try {
      const client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:phone}', { phone });
      bonusBalance = Number(client.get('bonusBalance') || 0);
    } catch (_) { /* guest */ }
  }

  const maxDiscount = Math.floor(serverTotal * useBonusPct / 100);
  const allowedBonus = Math.max(0, Math.min(bonusRequested, bonusBalance, maxDiscount));
  if (bonusRequested > allowedBonus) {
    $app.logger().warn('Bonus tampering blocked', 'phone', phone, 'requested', bonusRequested, 'allowed', allowedBonus);
  }

  e.record.set('total', Math.max(0, serverTotal - allowedBonus));
  e.record.set('subtotal', serverTotal);
  e.record.set('bonusDiscount', allowedBonus);
  e.record.set('status', 'new');
  e.record.set('paymentStatus', e.record.get('paymentMethod') === 'cash' ? 'pending_cash' : 'pending');
}, 'orders');

// Phase 2 — debit bonus AFTER the order is committed.
onRecordAfterCreateRequest((e) => {
  if (e.collection.name !== 'orders') return;
  const allowedBonus = Number(e.record.get('bonusDiscount') || 0);
  const phone = e.record.get('clientPhone');
  if (!phone || allowedBonus <= 0) return;

  $app.dao().runInTransaction((txDao) => {
    let client;
    try { client = txDao.findFirstRecordByFilter('clients', 'phone = {:phone}', { phone }); }
    catch (_) { return; }
    const balance = Number(client.get('bonusBalance') || 0);
    let history = client.get('bonusHistory') || [];
    if (typeof history === 'string') { try { history = JSON.parse(history); } catch { history = []; } }
    history.push({ type: 'spent', amount: -allowedBonus, label: 'Order #' + e.record.id, date: new Date().toISOString() });
    client.set('bonusBalance', Math.max(0, balance - allowedBonus));
    client.set('bonusHistory', history);
    txDao.saveRecord(client);
  });
}, 'orders');

// Order delivered: credit earned bonus + first-delivery rewards (RULE 1 + RULE 3).
//
// Welcome bonus and referral payouts are NO LONGER credited at registration.
// They fire here, only when the client's FIRST order transitions to 'delivered'.
// This prevents fake-account farming: registering 100 phones earns 0 bonus
// unless each one actually completes a delivery.
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name !== 'orders') return;
  const oldStatus = e.record.originalCopy().get('status');
  const newStatus = e.record.get('status');
  if (oldStatus === 'delivered' || newStatus !== 'delivered') return;

  const phone = e.record.get('clientPhone');
  if (!phone) return;
  let client;
  try { client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:phone}', { phone }); } catch (_) { return; }

  // Load all settings once.
  let pct = 5, welcomeAmount = 0, welcomeOn = true,
      friendBonus = 0, referrerBonus = 0;
  try {
    const s = $app.dao().findRecordById('settings', 'main');
    pct = Number(s.get('bonusPercent') || 5);
    welcomeAmount = Number(s.get('welcomeBonus') || 0);
    welcomeOn = s.get('welcomeBonusEnabled') !== false;
    friendBonus = Number(s.get('referralFriendBonus') || 0);
    referrerBonus = Number(s.get('referralBonus') || 0);
  } catch (_) { /* defaults */ }

  // PocketBase schema uses camelCase: bonusBalance, bonusHistory,
  // referralCode, referredBy — consistent with the frontend.
  let balance = Number(client.get('bonusBalance') || 0);
  let history = [];
  try { history = JSON.parse(client.get('bonusHistory') || '[]'); } catch (_) { history = []; }
  if (!Array.isArray(history)) history = [];

  // Is this the client's first delivery? (Excludes the order being delivered now.)
  let isFirstDelivery = false;
  try {
    const prev = $app.dao().findRecordsByFilter(
      'orders',
      'clientPhone = {:phone} && status = "delivered" && id != {:id}',
      '-created', 1, 0,
      { phone, id: e.record.id }
    );
    isFirstDelivery = prev.length === 0;
  } catch (_) { isFirstDelivery = false; }

  // 1. Earn bonus from order percentage — every delivery.
  const earned = Math.floor(Number(e.record.get('total') || 0) * pct / 100);
  if (earned > 0) {
    balance += earned;
    history.push({ type: 'earned', amount: earned, label: 'Bonus for order ' + e.record.id, date: new Date().toISOString() });
  }

  // 2. Welcome bonus on first delivery — skip if already given at registration.
  const hasWelcomeInHistory = history.some(function(h) { return h && h.type === 'welcome'; });
  if (isFirstDelivery && welcomeOn && welcomeAmount > 0 && !hasWelcomeInHistory) {
    balance += welcomeAmount;
    history.push({ type: 'welcome', amount: welcomeAmount, label: 'Welcome bonus', date: new Date().toISOString() });
    $app.logger().info('bonus: welcome credited on first delivery', 'phone', phone, 'amount', welcomeAmount);
  }

  // 3. Referral payout on first delivery — skip if already given at registration.
  const usedRef = client.get('referredBy');
  const hasReferralInHistory = history.some(function(h) { return h && h.type === 'referral'; });
  if (isFirstDelivery && usedRef && !hasReferralInHistory) {
    const ownCode = client.get('referralCode');
    if (ownCode && String(usedRef) === String(ownCode)) {
      $app.logger().info('referral: self-referral blocked', 'phone', phone);
    } else {
      if (friendBonus > 0) {
        balance += friendBonus;
        history.push({ type: 'referral', amount: friendBonus, label: 'Referral friend bonus', date: new Date().toISOString() });
      }
      if (referrerBonus > 0) {
        let referrer;
        try { referrer = $app.dao().findFirstRecordByFilter('clients', 'referralCode = {:c}', { c: usedRef }); } catch (_) {}
        if (referrer && referrer.id !== client.id) {
          const refBal = Number(referrer.get('bonusBalance') || 0) + referrerBonus;
          let refHistory = [];
          try { refHistory = JSON.parse(referrer.get('bonusHistory') || '[]'); } catch (_) { refHistory = []; }
          refHistory.push({ type: 'referral', amount: referrerBonus, label: 'Referral payout for ' + phone, date: new Date().toISOString() });
          referrer.set('bonusBalance', refBal);
          referrer.set('bonusHistory', JSON.stringify(refHistory));
          $app.dao().saveRecord(referrer);
          $app.logger().info('referral: payout credited', 'referrerId', referrer.id, 'amount', referrerBonus);
        }
      }
    }
  }

  client.set('bonusBalance', balance);
  client.set('bonusHistory', JSON.stringify(history));
  $app.dao().saveRecord(client);
}, 'orders');

// Client create: assign referral code only.
//
// Welcome bonus and referral payouts are NOT credited here anymore (they were
// trivially farmable — register 100 phones, collect 100×welcomeBonus). Both now
// fire from the orders.beforeUpdate hook on first delivery. See RULE 1 + RULE 3.
onRecordAfterCreateRequest((e) => {
  if (e.collection.name !== 'clients') return;

  const phone = e.record.get('phone');
  if (!phone) return;

  // Generate a unique referral code if missing.
  if (!e.record.get('referralCode')) {
    const code = (phone.replace(/\D/g, '').slice(-4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
    e.record.set('referralCode', code);
    $app.dao().saveRecord(e.record);
  }

  if (e.record.get('referredBy')) {
    $app.logger().info('client: pending referral on first delivery',
      'phone', phone, 'referredBy', e.record.get('referredBy'));
  }
}, 'clients');

// Public custom endpoint: GET /api/custom/me — returns the authenticated client.
routerAdd('GET', '/api/custom/me', (c) => {
  const auth = c.get('authRecord');
  if (!auth) return c.json(401, { error: 'unauthorized' });
  return c.json(200, {
    id: auth.id,
    phone: auth.get('phone'),
    name: auth.get('name'),
    bonusBalance: auth.get('bonusBalance'),
    referralCode: auth.get('referralCode'),
  });
}, $apis.requireRecordAuth('clients'));

// Public custom endpoint: POST /api/custom/account/delete — soft-delete & PII purge.
routerAdd('POST', '/api/custom/account/delete', (c) => {
  const auth = c.get('authRecord');
  if (!auth) return c.json(401, { error: 'unauthorized' });
  auth.set('phone', 'deleted_' + auth.id);
  auth.set('name', 'Deleted user');
  auth.set('bonusHistory', '[]');
  auth.set('bonusBalance', 0);
  auth.set('referralCode', null);
  auth.set('deletedAt', new Date().toISOString());
  $app.dao().saveRecord(auth);
  return c.json(200, { ok: true });
}, $apis.requireRecordAuth('clients'));
