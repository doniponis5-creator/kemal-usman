// Robust deep-link opener for payment apps (M-Bank, O!Bank, etc.)
//
// Why this exists:
//   `window.location.href = 'mbank://...'` works in mobile browsers but is
//   UNRELIABLE inside Capacitor's WKWebView (iOS) — non-http schemes are
//   sometimes silently dropped. The proper API is `App.openUrl()` from
//   `@capacitor/app`, which forwards the URL to the OS and returns whether
//   the launch succeeded (a registered scheme exists).
//
// This module:
//   1. Tries `App.openUrl()` on native; falls back to `window.location.href`
//      on web.
//   2. Walks a list of known scheme variants (M-Bank changes them between
//      versions) — first one that opens, wins.
//   3. Provides `dialPhone()` and `copyToClipboard()` as escape hatches if
//      the bank app isn't installed.

// Try a single URL. Returns true if the OS reported the launch succeeded.
async function tryOpenUrl(url) {
  // Capacitor native path
  try {
    // Dynamic require keeps Vite from trying to resolve the package at build
    // time when it isn't installed yet (web-only dev).
    const mod = await import(/* @vite-ignore */ '@capacitor/' + 'app');
    if (mod?.App?.openUrl) {
      const result = await mod.App.openUrl({ url });
      // openUrl returns { completed: boolean } — false means scheme not handled
      if (result?.completed === false) return false;
      return true;
    }
  } catch (_) { /* not on native, fall through */ }

  // Web fallback — best-effort. Note: browsers may silently no-op on
  // unregistered schemes; we can't detect that, so always return true here.
  try {
    window.location.href = url;
    return true;
  } catch (_) {
    return false;
  }
}

// Known URL scheme variants per provider. M-Bank Kyrgyzstan currently uses
// `mbank://transfer?...`; we keep extras as resilience against version churn.
const SCHEMES = {
  mbank: [
    'mbank://transfer?phone={phone}&amount={amount}&comment={comment}',
    'mbankkg://transfer?phone={phone}&amount={amount}&comment={comment}',
    'mbank://qr?phone={phone}&amount={amount}',
    'mbank://',
  ],
  obank: [
    'obank://transfer?phone={phone}&amount={amount}&comment={comment}',
    'optimabank://transfer?phone={phone}&amount={amount}',
    'obank://',
  ],
};

function fillTemplate(tpl, { phone, amount, comment }) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  const cleanComment = encodeURIComponent(String(comment || '').slice(0, 80));
  return tpl
    .replace('{phone}', cleanPhone)
    .replace('{amount}', String(cleanAmount))
    .replace('{comment}', cleanComment);
}

/**
 * Attempt to open a bank app. Returns { ok: boolean, url?: string }.
 * If `ok === false`, the caller should display fallback options
 * (manual transfer details, dial admin, etc.).
 *
 *   const r = await openPaymentApp('mbank', { phone: '996700123456', amount: 1500, comment: 'Order #ABC123' })
 *   if (!r.ok) showManualInstructions()
 */
export async function openPaymentApp(provider, params = {}) {
  const candidates = SCHEMES[provider] || [];
  for (const tpl of candidates) {
    const url = fillTemplate(tpl, params);
    const opened = await tryOpenUrl(url);
    if (opened) return { ok: true, url };
  }
  return { ok: false };
}

/** Open the OS phone dialer pre-filled with the given number. */
export async function dialPhone(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return false;
  return tryOpenUrl('tel:' + cleaned);
}

/** Open the OS SMS composer pre-filled with text. */
export async function sendSms(phone, body = '') {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return false;
  const sep = '?'; // iOS uses ?body, Android uses ?body — same behaviour
  return tryOpenUrl(`sms:${cleaned}${sep}body=${encodeURIComponent(body)}`);
}

/** Copy a string to the clipboard. Works on both web and Capacitor. */
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  // Modern API
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) { /* fall through */ }
  // Legacy fallback (works inside iframes / older WebKit)
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_) {
    return false;
  }
}
