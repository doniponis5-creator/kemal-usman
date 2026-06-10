/// <reference path="../pb_data/types.d.ts" />
// OTP authentication — WhatsApp delivery via green-api.
//
// v2 (2026-06-10) — FIELD NAME FIX + security hardening:
//   • The clients schema uses camelCase: bonusBalance, bonusHistory,
//     referralCode, referredBy (verified against main.pb.js after-create hook,
//     the frontend, scripts/pb-verify-orders.js and FIXES_APPLIED.md).
//     The previous version wrote snake_case (bonus_balance, referred_by) —
//     those writes were silently IGNORED by PocketBase, which meant the
//     referral system never recorded who invited whom.
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
    return c.json(500, { error: 'whatsapp_failed' });
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
      bonusBalance: 0,
      bonusHistory: '[]',
      referredBy:   referredBy || null,
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
      var ownCode = client.get('referralCode');
      if (referredBy && ownCode && String(referredBy) === String(ownCode)) {
        client.set('referredBy', null);
        $app.dao().saveRecord(client);
        $app.logger().info('otp: self-referral cleared', 'phone', phone);
      }
    } catch (_) {}

    if (referredBy) {
      $app.logger().info('otp: referral recorded — payout on first delivery',
        'phone', phone, 'referredBy', referredBy);
    }
  }

  // ── Build response (camelCase reads — matches the live schema) ────────────
  var finalBalance = Number(client.get('bonusBalance') || 0);
  var finalHistory = [];
  try {
    var rawHist = client.get('bonusHistory');
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
      referralCode: client.get('referralCode'),
    },
  });
});
