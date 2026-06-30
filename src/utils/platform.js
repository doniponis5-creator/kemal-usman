// Platform detection — single source of truth for native-vs-web gating.
//
// CRITICAL: every Liquid Glass visual in this app is gated on IS_NATIVE so the
// web / PWA / desktop build renders EXACTLY as before. Glass must never reach
// the browser. When in doubt, branch on IS_NATIVE and leave the web path alone.

const cap = (typeof window !== 'undefined' && window.Capacitor) || null;

/** True only inside the Capacitor native shell (the App Store / iOS app). */
export const IS_NATIVE = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

/** Platform string: 'ios' | 'android' | 'web'. */
export const PLATFORM = (cap && cap.getPlatform && cap.getPlatform()) || 'web';

/** True only in the native iOS build — where Liquid Glass truly belongs. */
export const IS_IOS = IS_NATIVE && PLATFORM === 'ios';
