/// <reference path="../pb_data/types.d.ts" />
// OTP authentication — WhatsApp delivery via green-api.
//
// v2 (2026-06-10) — FIELD NAME FIX + security hardening:
//   • CLIENTS SXEMASI (jonli serverda 2026-06-10 da TASDIQLANGAN): snake_case
//     — bonus_balance, bonus_history, referral_code, referred_by.
//     Frontend'ga javob kalitlari camelCase qilib map qilinadi (pastda).
//   • Welcome / referral bonuses are NOT credited here. By design (see
//     main.pb.js RULE 1 + RULE 3) they fire on the FIRST DELIVERED order —
//     this prevents fake-account farming. This hook only records referredBy.
//   • OTP code is generated with a cryptographically secure RNG
//     ($security.randomStringWithAlphabet) instead of Math.random().

routerAdd('POST', '/api/custom/otp/request', function(c) {
  var REQUEST_LIMIT = 5;
  var TTL_SECONDS   = 300;
  var crypto = require(__hooks + '/_lib/crypto.js');
  var sms    = require(__hooks + '/_lib/sms.js');

  var raw   = String(($apis.requestInfo(c).data || {}).phone || '');
  var d     = raw.replace(/[^\d]/g, '');
  var phone = !d ? '' : (d.length === 12 && d.slice(0,3) === '996') ? '+'+d : d.length === 9 ? '+996'+d : '+'+d;

  if (!phone || phone.length < 10) return c.json(400, { error: 'invalid_phone' });

  // ── APPLE REVIEW DEMO ACCOUNT ──────────────────────────────────────────────
  // +996555000001 — App Review uchun. SMS yuborilmaydi, kod doim 123456
  // (/verify ichida tekshiriladi). O'chirish: serverda DEMO_REVIEW_DISABLED=1.
  var DEMO_PHONE = '+996555000001';
  var demoOff = false;
  try { demoOff = !!$os.getenv('DEMO_REVIEW_DISABLED'); } catch (_) {}
  if (!demoOff && phone === DEMO_PHONE) {
    return c.json(200, { ok: true, ttl: 300 });
  }

  var since  = new Date(Date.now() - 3600000).toISOString();
  var recent = $app.dao().findRecordsByFilter(
    'otp_codes', 'phone = {:p} && created >= {:s}', '-created', 100, 0, { p: phone, s: since }
  );
  if (recent.length >= REQUEST_LIMIT) return c.json(429, { error: 'too_many_requests' });

  // Cryptographically secure 6-digit code (P1.2). Falls back to Math.random
  // only if the PB build lacks $security.randomStringWithAlphabet.
  var code;
  try {
    code = $security.randomStringWithAlphabet(6, '0123456789');
    if (!code || String(code).length !== 6) throw new Error('bad code');
    code = String(code);
  } catch (_) {
    code = String(Math.floor(100000 + Math.random() * 900000));
  }
  var codeHash  = crypto.sha256(code + ':' + phone);
  var expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  var col = $app.dao().findCollectionByNameOrId('otp_codes');
  var rec = new Record(col, { phone: phone, codeHash: codeHash, expiresAt: expiresAt, attempts: 0, used: false });
  $app.dao().saveRecord(rec);

  try {
    sms.send(phone, code);
  } catch (err) {
    $app.logger().error('otp-send-failed', 'phone', phone, 'err', err.message);
    // Surface the SPECIFIC reason instead of one generic code, so the
    // client can show something actionable (e.g. "this number has no
    // Telegram") rather than a bare "SMS error". sms.js throws distinct
    // messages: telegram_not_configured / telegram_cannot_send / telegram_send_failed / telegram_exception.
    var reason = String((err && err.message) || '');
    var code2 =
      reason.indexOf('telegram_cannot_send')   === 0 ? 'telegram_cannot_send'   :
      reason.indexOf('telegram_not_configured') === 0 ? 'telegram_not_configured' :
      reason.indexOf('telegram_send_failed')   === 0 ? 'telegram_send_failed'   :
      'telegram_exception';
    return c.json(500, { error: code2 });
  }

  return c.json(200, { ok: true, ttl: TTL_SECONDS });
});

routerAdd('POST', '/api/custom/otp/verify', function(c) {
  var VERIFY_LIMIT = 5;
  var crypto = require(__hooks + '/_lib/crypto.js');

  var body  = $apis.requestInfo(c).data || {};
  var raw   = String(body.phone || '');
  var d     = raw.replace(/[^\d]/g, '');
  var phone = !d ? '' : (d.length === 12 && d.slice(0,3) === '996') ? '+'+d : d.length === 9 ? '+996'+d : '+'+d;

  var code       = String(body.code || '').replace(/[^\d]/g, '');
  var name       = String(body.name || '').slice(0, 80).trim() || phone;
  var referredBy = String(body.referredBy || '').slice(0, 12).trim().toUpperCase() || null;

  if (!phone || code.length !== 6) return c.json(400, { error: 'invalid_input' });

  // ── APPLE REVIEW DEMO: real akkaunt, real token — to'liq funksional ──
  var DEMO_PHONE = '+996555000001';
  var demoOff = false;
  try { demoOff = !!$os.getenv('DEMO_REVIEW_DISABLED'); } catch (_) {}
  var isDemo = !demoOff && phone === DEMO_PHONE;
  if (isDemo && code !== '123456') return c.json(400, { error: 'wrong_code' });

  // ── OTP check ─────────────────────────────────────────────────────────────
  var nowIso = new Date().toISOString();
  var otpRec;
  if (!isDemo) {
  try {
    var recs = $app.dao().findRecordsByFilter(
      'otp_codes', 'phone = {:p} && used = false && expiresAt >= {:n}',
      '-created', 1, 0, { p: phone, n: nowIso }
    );
    if (!recs || recs.length === 0) return c.json(400, { error: 'no_active_code' });
    otpRec = recs[0];
  } catch (_) { return c.json(400, { error: 'no_active_code' }); }

  if (Number(otpRec.get('attempts')) >= VERIFY_LIMIT) return c.json(429, { error: 'too_many_attempts' });
  otpRec.set('attempts', Number(otpRec.get('attempts')) + 1);
  $app.dao().saveRecord(otpRec);

  if (crypto.sha256(code + ':' + phone) !== otpRec.get('codeHash')) {
    return c.json(400, { error: 'wrong_code' });
  }
  otpRec.set('used', true);
  $app.dao().saveRecord(otpRec);
  } // end !isDemo

  // ── Find or create the client ─────────────────────────────────────────────
  // NOTE: no bonus crediting here. Welcome + referral bonuses are credited by
  // main.pb.js when the client's FIRST order reaches status 'delivered'.
  var client      = null;
  var isNewClient = false;

  try {
    client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:p}', { p: phone });
  } catch (_) { client = null; }

  if (client !== null) {
    // ── EXISTING CLIENT — refresh display name if it changed ──
    if (name && name !== phone && client.get('name') !== name) {
      client.set('name', name);
      try {
        $app.dao().saveRecord(client);
        client = $app.dao().findRecordById('clients', client.id);
      } catch (saveErr) {
        $app.logger().error('otp: save existing client failed', 'phone', phone, 'err', String(saveErr));
      }
    }
  } else {
    // ── NEW CLIENT (camelCase fields — matches the live schema) ──
    isNewClient = true;
    var col = $app.dao().findCollectionByNameOrId('clients');
    client = new Record(col, {
      username:     d,
      phone:        phone,
      name:         name,
      bonus_balance: 0,
      bonus_history: '[]',
      referred_by:  referredBy || null,
      email:        d + '@kemalusman.local',
      emailVisibility: false,
      verified:     true,
    });
    client.setPassword(crypto.randomHex(48));
    client.refreshTokenKey();
    $app.dao().saveRecord(client);

    // Re-read to get referralCode assigned by main.pb.js after-create hook.
    try { client = $app.dao().findRecordById('clients', client.id); } catch (_) {}

    // Self-referral guard: if someone typed their own fresh code, clear it so
    // the first-delivery payout (main.pb.js) can't self-credit.
    try {
      var ownCode = client.get('referral_code');
      if (referredBy && ownCode && String(referredBy) === String(ownCode)) {
        client.set('referred_by', null);
        $app.dao().saveRecord(client);
        $app.logger().info('otp: self-referral cleared', 'phone', phone);
      }
    } catch (_) {}

    if (referredBy) {
      $app.logger().info('otp: referral recorded — payout on first delivery',
        'phone', phone, 'referredBy', referredBy);
    }

    // ── WELCOME BONUS ON REGISTRATION (once per phone) ──────────────────────
    // Credited HERE (not on first delivery) per product decision 2026-07-07.
    // Safe because: (1) phone is OTP-verified at this exact point; (2) clients
    // are unique by phone and never deleted → re-registering the same number
    // hits the EXISTING-client branch, never this one → one bonus per number.
    // Idempotent: guarded by a 'welcome' entry in bonus_history, so the
    // first-delivery hook in main.pb.js (RULE 1) auto-skips → no double credit.
    // Bonus lives in bonus_balance (server-side) → logout/login preserves it.
    // Amount + on/off come from admin settings (welcomeBonus / welcomeBonusEnabled).
    // The bonus is discount-only: the app has no cash-out path and RULE 2 caps
    // it to a % discount on real, paid orders — so farming has no payout.
    try {
      var welcomeAmount = 0, welcomeOn = true;
      var s = null;
      try { s = $app.dao().findRecordById('settings', 'main'); } catch (_) {}
      if (!s) {
        var ss = $app.dao().findRecordsByFilter('settings', "id != ''", '-created', 1, 0);
        if (ss && ss.length > 0) s = ss[0];
      }
      if (s) {
        welcomeAmount = Number(s.get('welcomeBonus') || 0);
        welcomeOn = s.get('welcomeBonusEnabled') !== false;
      }
      var wHist = [];
      try {
        var rawWH = client.get('bonus_history');
        wHist = JSON.parse((typeof rawWH === 'string') ? (rawWH || '[]') : String(rawWH || '[]'));
      } catch (_) { wHist = []; }
      if (!Array.isArray(wHist)) wHist = [];
      var alreadyWelcomed = wHist.some(function (h) { return h && h.type === 'welcome'; });
      if (welcomeOn && welcomeAmount > 0 && !alreadyWelcomed) {
        var newBal = Number(client.get('bonus_balance') || 0) + welcomeAmount;
        wHist.push({ type: 'welcome', amount: welcomeAmount, label: 'Welcome bonus', date: new Date().toISOString() });
        client.set('bonus_balance', newBal);
        client.set('bonus_history', JSON.stringify(wHist));
        $app.dao().saveRecord(client);
        try { client = $app.dao().findRecordById('clients', client.id); } catch (_) {}
        $app.logger().info('otp: welcome bonus credited at registration', 'phone', phone, 'amount', welcomeAmount);
      }
    } catch (wErr) {
      $app.logger().error('otp: welcome credit failed', 'phone', phone, 'err', String(wErr));
    }
  }

  // ── Build response (camelCase reads — matches the live schema) ────────────
  var finalBalance = Number(client.get('bonus_balance') || 0);
  var finalHistory = [];
  try {
    var rawHist = client.get('bonus_history');
    finalHistory = JSON.parse((typeof rawHist === 'string') ? (rawHist || '[]') : String(rawHist || '[]'));
  } catch (_) { finalHistory = []; }
  if (!Array.isArray(finalHistory)) finalHistory = [];

  var token = $tokens.recordAuthToken($app, client);
  return c.json(200, {
    token: token,
    isNewClient: isNewClient,
    record: {
      id:           client.id,
      phone:        client.get('phone'),
      name:         client.get('name'),
      bonusBalance: finalBalance,
      bonusHistory: finalHistory,
      referralCode: client.get('referral_code'),
    },
  });
});
