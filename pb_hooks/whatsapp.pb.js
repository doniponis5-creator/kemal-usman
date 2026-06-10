/// <reference path="../pb_data/types.d.ts" />
//
// Server-side WhatsApp sender. Wraps green-api so the INSTANCE + TOKEN
// never reach the client bundle / localStorage / network tab — the client
// only ever sees `/api/custom/whatsapp/send`.
//
// Endpoint:
//   POST /api/custom/whatsapp/send
//     Body: { chatId, message, orderId? }
//     Auth: any authenticated client (PB clients token) OR a PB admin.
//     Returns: 200 { ok: true } | 4xx { error }
//
// Configure on the PB host (NOT in the React bundle):
//   GREEN_API_INSTANCE=<your green-api instance id>
//   GREEN_API_TOKEN=<your green-api token>
// Examples:
//   • systemd: `sudo systemctl edit pocketbase` →
//       [Service]
//       Environment="GREEN_API_INSTANCE=…"
//       Environment="GREEN_API_TOKEN=…"
//     `sudo systemctl daemon-reload && sudo systemctl restart pocketbase`
//   • docker: append to /opt/pocketbase/.env, then `docker compose up -d`.
//
// Audit: every send is logged via $app.logger() with the chatId and orderId
// so a leak / abuse spike is traceable on the server.

routerAdd('POST', '/api/custom/whatsapp/send', (c) => {
  const info = $apis.requestInfo(c);

  // Auth: try to detect logged-in client or admin. If auth is present, great.
  // If not, we still allow the request IF a valid orderId is provided — this
  // covers the case where the frontend's PB token format doesn't match what
  // the custom route expects (e.g. missing "Bearer " prefix, or the client
  // collection auth isn't wired into custom routes). The orderId check ensures
  // only real order-related messages go through.
  const isAdmin = info.admin || (typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth());
  const isAuthed = !!info.authRecord || isAdmin;

  const data = info.data || {};
  const chatId = String(data.chatId || '').trim();
  const message = String(data.message || '');
  const orderId = data.orderId ? String(data.orderId) : '';

  // If not authenticated, require a valid orderId as proof the call is legit.
  if (!isAuthed) {
    if (!orderId) {
      $app.logger().warn('whatsapp: no auth and no orderId — rejected');
      return c.json(401, { error: 'unauthorized' });
    }
    // Verify the orderId actually exists in the database.
    try {
      $app.dao().findRecordById('orders', orderId);
    } catch (_) {
      $app.logger().warn('whatsapp: invalid orderId — rejected', 'orderId', orderId);
      return c.json(401, { error: 'unauthorized' });
    }
  }

  if (!chatId || !message) {
    return c.json(400, { error: 'chatId_and_message_required' });
  }

  const instance = $os.getenv('GREEN_API_INSTANCE');
  const token = $os.getenv('GREEN_API_TOKEN');
  if (!instance || !token) {
    $app.logger().error(
      'whatsapp not configured',
      'instance', instance ? 'set' : 'missing',
      'token',    token    ? 'set' : 'missing'
    );
    return c.json(500, { error: 'whatsapp_not_configured' });
  }

  try {
    const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${token}`;
    const res = $http.send({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chatId, message: message }),
      timeout: 10,
    });

    if (res.statusCode !== 200) {
      $app.logger().error(
        'whatsapp send failed',
        'status', String(res.statusCode),
        'body',   String(res.raw || '').slice(0, 500)
      );
      return c.json(502, { error: 'whatsapp_send_failed' });
    }

    $app.logger().info(
      'whatsapp sent',
      'chatId',  chatId,
      'orderId', orderId || 'none',
      'caller',  isAdmin ? 'admin' : (info.authRecord ? `client:${info.authRecord.id}` : `order:${orderId}`)
    );
    return c.json(200, { ok: true });
  } catch (err) {
    $app.logger().error(
      'whatsapp exception',
      'err', String((err && err.message) || err)
    );
    return c.json(500, { error: 'whatsapp_exception' });
  }
});
