/// <reference path="../pb_data/types.d.ts" />
// OTP authentication — WhatsApp delivery via green-api.
// PocketBase schema uses snake_case field names:
//   bonus_balance, bonus_history, referral_code, referred_by
// Always use snake_case in record.get() / record.set() calls.

routerAdd('POST', '/api/custom/otp/request', function(c) {
  var REQUEST_LIMIT = 5;
  var TTL_SECONDS   = 300;
  var crypto = require(__hooks + '/_lib/crypto.js');
  var sms    = require(__hooks + '/_lib/sms.js');

  var raw   = String(($apis.requestInfo(c).data || {}).phone || '');
  var d     = raw.replace(/[^\d]/g, '');
  var phone = !d ? '' : (d.length === 12 && d.slice(0,3) === '996') ? '+'+d : d.length === 9 ? '+996'+d : '+'+d;

  if (!phone || phone.length < 10) return c.json(400, { error: 'invalid_phone' });

  var since  = new Date(Date.now() - 3600000).toISOString();
  var recent = $app.dao().findRecordsByFilter(
    'otp_codes', 'phone = {:p} && created >= {:s}', '-created', 100, 0, { p: phone, s: since }
  );
  if (recent.length >= REQUEST_LIMIT) return c.json(429, { error: 'too_many_requests' });

  var code      = String(Math.floor(100000 + Math.random() * 900000));
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

  // ── OTP check ─────────────────────────────────────────────────────────────
  var nowIso = new Date().toISOString();
  var otpRec;
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

  // ── Read bonus settings ───────────────────────────────────────────────────
  var welcomeEnabled   = true;
  var welcomeAmount    = 150;
  var friendBonusAmt   = 50;
  var referrerBonusAmt = 100;
  try {
    var s = $app.dao().findRecordById('settings', 'main');
    welcomeEnabled   = s.get('welcomeBonusEnabled') !== false;
    welcomeAmount    = Number(s.get('welcomeBonus') || 150);
    friendBonusAmt   = Number(s.get('referralFriendBonus') || 50);
    referrerBonusAmt = Number(s.get('referralBonus') || 100);
  } catch (_) { /* use defaults */ }

  var nowStr     = new Date().toISOString();
  var client     = null;
  var isNewClient = false;

  // ── Try to find existing client (separate try so catch = "not found") ─────
  try {
    client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:p}', { p: phone });
  } catch (_) { client = null; }

  if (client !== null) {
    // ── EXISTING CLIENT ───────────────────────────────────────────────────
    var needsSave = false;

    if (name && client.get('name') !== name) {
      client.set('name', name);
      needsSave = true;
    }

    // Retroactive welcome bonus for accounts that never got it
    if (welcomeEnabled && welcomeAmount > 0) {
      var existHist = [];
      try { existHist = JSON.parse(client.get('bonus_history') || '[]'); } catch(_) { existHist = []; }
      if (!Array.isArray(existHist)) existHist = [];

      var hasWelcome = false;
      for (var i = 0; i < existHist.length; i++) {
        if (existHist[i] && existHist[i].type === 'welcome') { hasWelcome = true; break; }
      }

      if (!hasWelcome) {
        var existBal = Number(client.get('bonus_balance') || 0) + welcomeAmount;
        existHist.push({ type: 'welcome', amount: welcomeAmount, label: 'Welcome bonus', date: nowStr });
        client.set('bonus_balance', existBal);
        client.set('bonus_history', JSON.stringify(existHist));
        needsSave = true;
        $app.logger().info('bonus: retroactive welcome credited', 'phone', phone, 'amount', welcomeAmount);
      }
    }

    if (needsSave) {
      try {
        $app.dao().saveRecord(client);
        client = $app.dao().findRecordById('clients', client.id);
      } catch (saveErr) {
        $app.logger().error('otp: save existing client failed', 'phone', phone, 'err', String(saveErr));
      }
    }

  } else {
    // ── NEW CLIENT ────────────────────────────────────────────────────────
    isNewClient = true;
    var initBalance = 0;
    var initHistory = [];

    if (welcomeEnabled && welcomeAmount > 0) {
      initBalance += welcomeAmount;
      initHistory.push({ type: 'welcome', amount: welcomeAmount, label: 'Welcome bonus', date: nowStr });
      $app.logger().info('bonus: welcome credited at registration', 'phone', phone, 'amount', welcomeAmount);
    }

    if (referredBy && friendBonusAmt > 0) {
      initBalance += friendBonusAmt;
      initHistory.push({ type: 'referral', amount: friendBonusAmt, label: 'Referral friend bonus', date: nowStr });
    }

    var col = $app.dao().findCollectionByNameOrId('clients');
    client = new Record(col, {
      username:     d,
      phone:        phone,
      name:         name,
      bonus_balance: initBalance,
      bonus_history: initHistory,
      referred_by:  referredBy || null,
      email:        d + '@kemalusman.local',
      emailVisibility: false,
      verified:     true,
    });
    client.setPassword(crypto.randomHex(48));
    client.refreshTokenKey();
    $app.dao().saveRecord(client);

    // Re-read to get referral_code assigned by PB after-create hook
    try { client = $app.dao().findRecordById('clients', client.id); } catch (_) {}

    // Credit the referrer
    if (referredBy && referrerBonusAmt > 0) {
      var ownCode = client.get('referral_code');
      if (!ownCode || String(referredBy) !== String(ownCode)) {
        var referrer = null;
        try { referrer = $app.dao().findFirstRecordByFilter('clients', 'referral_code = {:c}', { c: referredBy }); } catch (_) {}
        if (referrer && referrer.id !== client.id) {
          var refBal = Number(referrer.get('bonus_balance') || 0) + referrerBonusAmt;
          var refHist = [];
          try { refHist = JSON.parse(referrer.get('bonus_history') || '[]'); } catch (_) { refHist = []; }
          refHist.push({ type: 'referral', amount: referrerBonusAmt, label: 'Referral payout for ' + phone, date: nowStr });
          referrer.set('bonus_balance', refBal);
          referrer.set('bonus_history', JSON.stringify(refHist));
          try {
            $app.dao().saveRecord(referrer);
            $app.logger().info('bonus: referrer credited', 'id', referrer.id, 'amount', referrerBonusAmt);
          } catch (refErr) {
            $app.logger().error('bonus: referrer save failed', 'err', String(refErr));
          }
        }
      }
    }
  }

  // ── Build response ────────────────────────────────────────────────────────
  var finalBalance = Number(client.get('bonus_balance') || 0);
  var finalHistory = [];
  try { finalHistory = JSON.parse(client.get('bonus_history') || '[]'); } catch (_) { finalHistory = []; }
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
