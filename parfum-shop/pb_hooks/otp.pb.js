/// <reference path="../pb_data/types.d.ts" />
//
// SMS OTP authentication for the `clients` collection.
//
// Flow:
//   1. Client POSTs { phone } to /api/custom/otp/request — server generates 6-digit
//      code, hashes it, stores it in `otp_codes` with 5-min TTL, sends SMS via
//      provider configured in env (SMS_PROVIDER=smsc by default).
//   2. Client POSTs { phone, code, name?, referredBy? } to /api/custom/otp/verify.
//      Server verifies hash, finds-or-creates the `clients` record, returns
//      a PocketBase auth token.
//
// Server-side rate limit: max 5 requests per phone per hour, max 5 verify
// attempts per code.

const crypto = require(`${__hooks}/_lib/crypto.js`);
const sms = require(`${__hooks}/_lib/sms.js`);

const REQUEST_LIMIT = 5; // per hour per phone
const VERIFY_LIMIT = 5;  // per code
const TTL_SECONDS = 5 * 60;

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('996') && d.length === 12) return '+' + d;
  if (d.length === 9) return '+996' + d;
  return '+' + d;
}

routerAdd('POST', '/api/custom/otp/request', (c) => {
  const body = $apis.requestInfo(c).data;
  const phone = normalizePhone(body.phone);
  if (!phone || phone.length < 10) return c.json(400, { error: 'invalid_phone' });

  // Rate limit per phone
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = $app.dao().findRecordsByFilter(
    'otp_codes',
    'phone = {:p} && created >= {:s}',
    '-created', 100, 0,
    { p: phone, s: since }
  );
  if (recent.length >= REQUEST_LIMIT) {
    return c.json(429, { error: 'too_many_requests' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.sha256(code + ':' + phone);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  const col = $app.dao().findCollectionByNameOrId('otp_codes');
  const rec = new Record(col, {
    phone, codeHash, expiresAt, attempts: 0, used: false,
  });
  $app.dao().saveRecord(rec);

  try {
    sms.send(phone, 'Kemal Usman: код ' + code + '. Никому не сообщайте.');
  } catch (err) {
    $app.logger().error('SMS send failed', 'phone', phone, 'err', err.message);
    return c.json(500, { error: 'sms_failed' });
  }

  return c.json(200, { ok: true, ttl: TTL_SECONDS });
});

routerAdd('POST', '/api/custom/otp/verify', (c) => {
  const body = $apis.requestInfo(c).data;
  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').replace(/\D/g, '');
  const name = (body.name || '').toString().slice(0, 80).trim() || phone;
  const referredBy = (body.referredBy || '').toString().slice(0, 12).trim().toUpperCase() || null;

  if (!phone || code.length !== 6) return c.json(400, { error: 'invalid_input' });

  // Find latest unused, unexpired code for this phone.
  const now = new Date().toISOString();
  let rec;
  try {
    rec = $app.dao().findFirstRecordByFilter(
      'otp_codes',
      'phone = {:p} && used = false && expiresAt >= {:n}',
      { p: phone, n: now }
    );
  } catch (_) {
    return c.json(400, { error: 'no_active_code' });
  }

  if (Number(rec.get('attempts')) >= VERIFY_LIMIT) {
    return c.json(429, { error: 'too_many_attempts' });
  }

  rec.set('attempts', Number(rec.get('attempts')) + 1);
  $app.dao().saveRecord(rec);

  const expectedHash = crypto.sha256(code + ':' + phone);
  if (expectedHash !== rec.get('codeHash')) {
    return c.json(400, { error: 'wrong_code' });
  }

  rec.set('used', true);
  $app.dao().saveRecord(rec);

  // Find or create the client.
  let client;
  try {
    client = $app.dao().findFirstRecordByFilter('clients', 'phone = {:p}', { p: phone });
    if (name && client.get('name') !== name) {
      client.set('name', name);
      $app.dao().saveRecord(client);
    }
  } catch (_) {
    // FIX: For auth collections, use the proper PB API (setPassword + refreshTokenKey)
    // instead of writing passwordHash/tokenKey directly — those raw writes are rejected.
    const col = $app.dao().findCollectionByNameOrId('clients');
    client = new Record(col, {
      phone,
      name,
      bonusBalance: 0,
      bonusHistory: [],
      referredBy: referredBy || null,
      // Auth collections require an email for the built-in validators even though
      // we never email it — synthesize a non-routable placeholder.
      email: phone.replace(/\D/g, '') + '@kemalusman.local',
      emailVisibility: false,
      verified: true,
    });
    // Random unguessable password — user authenticates only via OTP, never directly.
    client.setPassword(crypto.randomHex(48));
    client.refreshTokenKey();
    $app.dao().saveRecord(client);
    // PB fires onRecordAfterCreate('clients') after this — welcome bonus + referral kick in.
  }

  // Issue an auth token. Use the collection-aware helper.
  const token = $tokens.recordAuthToken($app, client);
  return c.json(200, {
    token,
    record: {
      id: client.id,
      phone: client.get('phone'),
      name: client.get('name'),
      bonusBalance: client.get('bonusBalance'),
      referralCode: client.get('referralCode'),
    },
  });
});
