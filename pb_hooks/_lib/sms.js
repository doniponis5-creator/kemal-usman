// pb_hooks/_lib/sms.js
//
// OTP delivery — historically SMS, now WhatsApp via green-api.
// The module name + function signature are kept (`require('./_lib/sms.js')`,
// `.send(phone, code)`) so otp.pb.js can call this without restructuring.
//
// Credentials come from PB process env (set on the host, never the client):
//   GREEN_API_INSTANCE  — green-api Instance ID
//   GREEN_API_TOKEN     — green-api API token
// These are the SAME variables pb_hooks/whatsapp.pb.js already uses for
// order notifications, so configuring once covers both flows.

module.exports = {
  send(phone, code) {
    const instance = $os.getenv('GREEN_API_INSTANCE');
    const token    = $os.getenv('GREEN_API_TOKEN');

    if (!instance || !token) {
      $app.logger().error(
        'whatsapp-otp not configured',
        'instance', instance ? 'set' : 'missing',
        'token',    token    ? 'set' : 'missing'
      );
      throw new Error('whatsapp_not_configured');
    }

    // Normalise phone → green-api chatId. Strip everything that isn't a digit
    // so any of "+996 700 123 456" / "996700123456" / "+996700123456" maps
    // to the same chatId.
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) throw new Error('invalid_phone');
    const chatId = digits + '@c.us';

    // Russian — matches the previous SMS template's tone. Keeping the brand
    // header bold so users see it's from the shop, not a random sender.
    const message =
      '🔐 *Kemal Usman Parfum*\n\n' +
      'Ваш код подтверждения:\n\n' +
      '*' + code + '*\n\n' +
      'Код действителен 5 минут.\n' +
      'Никому не сообщайте этот код.';

    const url =
      'https://api.green-api.com/waInstance' + instance +
      '/sendMessage/' + token;

    const res = $http.send({
      url:     url,
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId: chatId, message: message }),
      timeout: 10,
    });

    if (res.statusCode !== 200) {
      $app.logger().error(
        'whatsapp-otp send failed',
        'status', String(res.statusCode),
        'body',   String(res.raw || '').slice(0, 500)
      );
      throw new Error('whatsapp_send_failed: ' + res.statusCode);
    }

    $app.logger().info('whatsapp-otp sent', 'chatId', chatId);
  },
};
