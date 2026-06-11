// Thin client wrapper for the server-side WhatsApp sender.
//
// The green-api INSTANCE + TOKEN now live ONLY in the PB process env (see
// pb_hooks/whatsapp.pb.js). This module just hands the recipient phone
// and message to the server, which talks to green-api on the client's
// behalf and never echoes credentials back.
//
// Returns a result object — never throws — so a flaky network or a missing
// server-side token doesn't break order placement. Callers are expected to
// log the failure and continue (a missed WA notification is recoverable;
// a thrown promise that aborts checkout is not).

import { pb, PB_URL } from './pb';

export const sendWhatsApp = async ({ phone, message, orderId, fileUrl } = {}) => {
  if (!phone || !message) return { ok: false, error: 'missing_args' };

  // Normalize to digits and append green-api's chatId suffix. Same shape
  // the old client-side code built ('996700123456@c.us'), just done here
  // so callers don't have to repeat the regex everywhere.
  const normalized = String(phone).replace(/\D/g, '');
  if (!normalized) return { ok: false, error: 'invalid_phone' };
  const chatId = `${normalized}@c.us`;

  try {
    const res = await fetch(`${PB_URL}/api/custom/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // PB hook gates this endpoint on info.authRecord || info.admin —
        // attach the current token if we have one. Anonymous calls hit 401.
        ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
      },
      body: JSON.stringify({
        chatId,
        message,
        orderId: orderId || null,
        fileUrl: fileUrl || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.warn('[whatsapp] server error:', res.status, err);
      return { ok: false, error: err.error || `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] network error:', err);
    return { ok: false, error: 'network' };
  }
};
