// pb_hooks/_lib/sms.js
//
// OTP delivery — Telegram Gateway ONLY (2026-07-08).
//
// Uses the official Telegram Gateway (https://gateway.telegram.org) —
// verified sender ("Коды подтверждения"), ~$0.01/delivered code, zero ban
// risk (it's Telegram's own product, built exactly for OTP delivery).
//
// GREEN_API (WhatsApp) is intentionally NOT used here anymore — it stays
// wired up only in pb_hooks/whatsapp.pb.js for order-status notifications,
// untouched. This file no longer has any SMS fallback (nikita.kg removed
// per explicit instruction) — if the phone has no Telegram account, the
// send fails and otp.pb.js returns an error to the client.
//
// Same `.send(phone, code)` signature as before — otp.pb.js is untouched.
//
// Env var (set on the PB host, never the client):
//   TELEGRAM_GATEWAY_TOKEN — from https://gateway.telegram.org account
//                            settings (register with your own Telegram
//                            account, top up balance, copy access token)
//
// Example (systemd):
//   sudo systemctl edit pocketbase →
//     [Service]
//     Environment="TELEGRAM_GATEWAY_TOKEN=..."
//   sudo systemctl daemon-reload && sudo systemctl restart pocketbase

function sendViaTelegram(e164, code) {
  const token = $os.getenv('TELEGRAM_GATEWAY_TOKEN');
  if (!token) {
    $app.logger().error('telegram-otp not configured — TELEGRAM_GATEWAY_TOKEN missing');
    throw new Error('telegram_not_configured');
  }

  try {
    const checkRes = $http.send({
      url:     'https://gatewayapi.telegram.org/checkSendAbility',
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body:    JSON.stringify({ phone_number: e164 }),
      timeout: 10,
    });
    const checkBody = JSON.parse(checkRes.raw || '{}');

    if (!checkBody.ok) {
      // No Telegram account on this number (or similar) — NOT charged.
      $app.logger().warn(
        'telegram-otp: cannot deliver to this number',
        'phone', e164, 'error', String(checkBody.error || 'unknown')
      );
      throw new Error('telegram_cannot_send: ' + String(checkBody.error || 'unknown'));
    }

    const requestId = checkBody.result.request_id;
    const sendRes = $http.send({
      url:     'https://gatewayapi.telegram.org/sendVerificationMessage',
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        phone_number: e164,
        request_id:   requestId,
        code:         code,   // we keep generating/hashing/verifying the
        ttl:          300,    // code ourselves — Telegram just delivers it.
      }),
      timeout: 10,
    });
    const sendBody = JSON.parse(sendRes.raw || '{}');

    if (!sendBody.ok) {
      $app.logger().error(
        'telegram-otp: send failed after check ok',
        'phone', e164, 'error', String(sendBody.error || 'unknown')
      );
      throw new Error('telegram_send_failed: ' + String(sendBody.error || 'unknown'));
    }

    $app.logger().info('telegram-otp sent', 'phone', e164, 'requestId', requestId);
  } catch (err) {
    if (err && err.message && err.message.indexOf('telegram_') === 0) throw err;
    $app.logger().error(
      'telegram-otp exception', 'phone', e164,
      'err', String((err && err.message) || err)
    );
    throw new Error('telegram_exception');
  }
}

module.exports = {
  send(phone, code) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) throw new Error('invalid_phone');
    const e164 = '+' + digits;

    sendViaTelegram(e164, code);
  },
};
