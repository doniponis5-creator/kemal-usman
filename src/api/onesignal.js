import { authedFetch } from './pb';
import OneSignalPlugin from '@onesignal/capacitor-plugin';
// ─── OneSignal remote push ───────────────────────────────────────────────────
// Delivers notifications even when the app is closed / backgrounded / locked.
//
// No-ops on web, and on native until VITE_ONESIGNAL_APP_ID is set (.env).
//
// Setup checklist:
//   • Create a free OneSignal app (iOS), upload your APNs .p8 key.
//   • Xcode: App target → Signing & Capabilities → + Push Notifications,
//     + Background Modes → Remote notifications.
//   • Put the OneSignal App ID in .env:  VITE_ONESIGNAL_APP_ID=xxxxxxxx-....

const APP_ID = (import.meta.env && import.meta.env.VITE_ONESIGNAL_APP_ID) || '';

let OneSignal = null;
let inited = false;

const isNative = () =>
  typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/** Initialize OneSignal, ask permission, and wire notification taps. */
export async function initPush(onOpen) {
  if (inited || !isNative() || !APP_ID) return;
  try {
    OneSignal = OneSignalPlugin;
    if (!OneSignal || !OneSignal.initialize) { OneSignal = null; return; }
    inited = true;

    OneSignal.initialize(APP_ID);

    // iOS system permission prompt (safe to call repeatedly).
    try { await OneSignal.Notifications.requestPermission(true); } catch { /* ignore */ }

    // Tap on a notification → let the app navigate.
    try {
      OneSignal.Notifications.addEventListener('click', (ev) => {
        const data = (ev && ev.notification && ev.notification.additionalData) || {};
        try { onOpen && onOpen(data); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  } catch {
    // Something went wrong initializing — stay a no-op.
    OneSignal = null;
  }
}

/** Link this device to a user (external id) so the backend can target them. */
export function setPushUser(userId) {
  if (!OneSignal || !userId) return;
  try { OneSignal.login(String(userId)); } catch { /* ignore */ }
}

/** Unlink on logout. */
export function clearPushUser() {
  if (!OneSignal) return;
  try { OneSignal.logout(); } catch { /* ignore */ }
}

// ─── Admin: broadcast a push to all subscribers (via the server hook) ────────
// The OneSignal REST key stays on the PB host; this only calls our own route.
export async function sendPushBroadcast({ title, message, screen, url } = {}) {
  return authedFetch('/api/custom/push/send', {
    method: 'POST',
    body: JSON.stringify({
      title: title || '',
      message: message || '',
      screen: screen || 'catalog',
      url: url || '',
    }),
  });
}
