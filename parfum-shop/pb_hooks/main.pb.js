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

  // Items must be a valid JSON array of { productId, variantId, qty }.
  let items = e.record.get('items');
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('Items list is empty or malformed.');
  }

  // Recompute the total from authoritative product prices.
  let serverTotal = 0;
  for (const item of items) {
    if (!item || !item.productId || !item.variantId || !item.qty) {
      throw new BadRequestError('Item missing productId/variantId/qty.');
    }
    if (item.qty < 1 || item.qty > 999) {
      throw new BadRequestError('Quantity must be between 1 and 999.');
    }
    let product;
    try {
      product = $app.dao().findRecordById('products', item.productId);
    } catch (err) {
      throw new BadRequestError('Unknown product: ' + item.productId);
    }
    let variants = product.get('variants');
    if (typeof variants === 'string') { try { variants = JSON.parse(variants); } catch { variants = []; } }
    const v = (variants || []).find((x) => String(x.id) === String(item.variantId));
    if (!v) throw new BadRequestError('Unknown variant: ' + item.variantId);
    if (v.inStock === false) throw new BadRequestError('Variant out of stock: ' + v.label);
    serverTotal += Number(v.price) * Number(item.qty);
  }

  // Pull max-discount-percent from settings.
  let useBonusPct = 30;
  try {
    const s = $app.dao().findRecordById('settings', 'main');
    useBonusPct = Number(s.get('useBonusPercent') || 30);
  } catch (_) { /* default */ }

  const bonusRequested = Number(e.record.get('bonusDiscount') || 0);
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

// Order delivered: credit earned bonus.
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name !== 'orders') return;
  const oldStatus = e.record.originalCopy().get('status');
  const newStatus = e.record.get('status');
  if (oldStatus !== 'delivered' && newStatus === 'delivered') {
    const phone = e.record.get('clientPhone');
    if (!phone) return;
    let client;
    try { client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:phone}', { phone }); } catch (_) { return; }

    let pct = 5;
    try { pct = Number($app.dao().findRecordById('settings', 'main').get('bonusPercent') || 5); } catch (_) {}

    const earned = Math.floor(Number(e.record.get('total') || 0) * pct / 100);
    if (earned > 0) {
      const balance = Number(client.get('bonusBalance') || 0) + earned;
      let history = [];
      try { history = JSON.parse(client.get('bonusHistory') || '[]'); } catch (_) { history = []; }
      history.push({ type: 'earned', amount: earned, label: 'Bonus for order ' + e.record.id, date: new Date().toISOString() });
      client.set('bonusBalance', balance);
      client.set('bonusHistory', JSON.stringify(history));
      $app.dao().saveRecord(client);
    }
  }
}, 'orders');

// Client create: welcome bonus + referral pairing — ONE TIME ONLY per phone.
onRecordAfterCreateRequest((e) => {
  if (e.collection.name !== 'clients') return;

  const phone = e.record.get('phone');
  if (!phone) return;

  // Generate a unique referral code if missing.
  if (!e.record.get('referralCode')) {
    const code = (phone.replace(/\D/g, '').slice(-4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
    e.record.set('referralCode', code);
  }

  // Welcome bonus — always exactly once because phone is UNIQUE.
  let welcomeAmount = 0, welcomeOn = true;
  try {
    const s = $app.dao().findRecordById('settings', 'main');
    welcomeAmount = Number(s.get('welcomeBonus') || 0);
    welcomeOn = s.get('welcomeBonusEnabled') !== false;
  } catch (_) {}

  let balance = Number(e.record.get('bonusBalance') || 0);
  let history = [];
  try { history = JSON.parse(e.record.get('bonusHistory') || '[]'); } catch (_) { history = []; }

  if (welcomeOn && welcomeAmount > 0) {
    balance += welcomeAmount;
    history.push({ type: 'welcome', amount: welcomeAmount, label: 'Welcome bonus', date: new Date().toISOString() });
  }

  // Referral handling.
  const usedRef = e.record.get('referredBy');
  if (usedRef) {
    let friendBonus = 0, referrerBonus = 0;
    try {
      const s = $app.dao().findRecordById('settings', 'main');
      friendBonus = Number(s.get('referralFriendBonus') || 0);
      referrerBonus = Number(s.get('referralBonus') || 0);
    } catch (_) {}

    if (friendBonus > 0) {
      balance += friendBonus;
      history.push({ type: 'referral', amount: friendBonus, label: 'Referral friend bonus', date: new Date().toISOString() });
    }
    // Reward the owner of the referral code.
    if (referrerBonus > 0) {
      let referrer;
      try { referrer = $app.dao().findFirstRecordByFilter('clients', 'referralCode = {:c}', { c: usedRef }); } catch (_) {}
      if (referrer && referrer.id !== e.record.id) {
        const refBal = Number(referrer.get('bonusBalance') || 0) + referrerBonus;
        let refHistory = [];
        try { refHistory = JSON.parse(referrer.get('bonusHistory') || '[]'); } catch (_) { refHistory = []; }
        refHistory.push({ type: 'referral', amount: referrerBonus, label: 'Referral payout for ' + phone, date: new Date().toISOString() });
        referrer.set('bonusBalance', refBal);
        referrer.set('bonusHistory', JSON.stringify(refHistory));
        $app.dao().saveRecord(referrer);
      }
    }
  }

  e.record.set('bonusBalance', balance);
  e.record.set('bonusHistory', JSON.stringify(history));
  $app.dao().saveRecord(e.record);
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
