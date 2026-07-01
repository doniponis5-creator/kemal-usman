/// <reference path="../pb_data/types.d.ts" />
//
// Server-side OneSignal push sender. The REST API key NEVER reaches the client
// bundle — the admin panel only ever calls POST /api/custom/push/send.
//
// Configure on the PB host (NOT in the React bundle):
//   ONESIGNAL_REST_API_KEY=<your OneSignal REST API Key>
//   systemd:  sudo systemctl edit pocketbase
//     [Service]
//     Environment="ONESIGNAL_REST_API_KEY=..."
//     then: sudo systemctl daemon-reload && sudo systemctl restart pocketbase
//   docker:   append to the PB .env, then recreate the container.
// (The OneSignal App ID is public, so it's hardcoded below.)
//
// Endpoint:
//   POST /api/custom/push/send
//     Body: { title?, message, segment?, screen?, url? }
//     Auth: PB admin (superuser) only.
//     Returns: 200 { ok:true, id } | 4xx/5xx { error }

routerAdd('POST', '/api/custom/push/send', (c) => {
  const info = $apis.requestInfo(c);
  const isAdmin = info.admin || (typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth());
  if (!isAdmin) {
    $app.logger().warn('push: non-admin send attempt rejected');
    return c.json(401, { error: 'unauthorized' });
  }

  const data = info.data || {};
  const title = String(data.title || '').slice(0, 120);
  const message = String(data.message || '').slice(0, 300);
  if (!message) return c.json(400, { error: 'message_required' });

  const APP_ID = '4cdb1d97-6eed-428c-bead-901fd6069d55';
  const KEY = $os.getenv('ONESIGNAL_REST_API_KEY');
  if (!KEY) {
    $app.logger().error('push: ONESIGNAL_REST_API_KEY missing on host');
    return c.json(500, { error: 'onesignal_not_configured' });
  }

  const payload = {
    app_id: APP_ID,
    included_segments: [String(data.segment || 'Total Subscriptions')],
    contents: { en: message, ru: message },
    data: { screen: String(data.screen || 'catalog') },
  };
  if (title) payload.headings = { en: title, ru: title };
  if (data.url) payload.url = String(data.url);

  try {
    const res = $http.send({
      url: 'https://onesignal.com/api/v1/notifications',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + KEY },
      body: JSON.stringify(payload),
      timeout: 20,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const raw = String(res.raw || '').slice(0, 500);
      $app.logger().warn('push: onesignal failed', 'status', res.statusCode, 'body', raw);
      return c.json(502, { error: 'push_send_failed', status: res.statusCode, detail: raw.slice(0, 300) });
    }
    let id = '';
    try { id = (res.json && res.json.id) || ''; } catch (_) { /* ignore */ }
    $app.logger().info('push: sent', 'title', title, 'id', id);
    return c.json(200, { ok: true, id: id });
  } catch (e) {
    $app.logger().error('push: exception', 'err', String(e));
    return c.json(500, { error: 'push_exception' });
  }
});
