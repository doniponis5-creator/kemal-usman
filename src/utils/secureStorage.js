// Secure storage wrapper.
// On native (Capacitor) -> @capacitor/preferences (native Preferences store:
//   UserDefaults on iOS, SharedPreferences on Android).
// On web -> falls back to localStorage with a warning for sensitive keys.
//
// Use this for: PB auth tokens, anything resembling a credential.
// DO NOT use for: shopping cart, language preference, etc. Plain localStorage is fine for those.

// Lazy, cached loader for the native Preferences plugin.
// FIX (audit #3): the old code loaded the plugin with a CommonJS-style call
// that is undefined in the ESM / WKWebView bundle, so it always threw and
// EVERY value silently fell back to localStorage — even on device, so the PB
// auth token never reached the native secure store. We now use the same
// runtime dynamic-import pattern the rest of the app uses for Capacitor
// plugins, gated on isNativePlatform() so web behaviour is unchanged.
let _prefs = null;
let _prefsLoaded = false;
async function getPreferences() {
  if (_prefsLoaded) return _prefs;
  _prefsLoaded = true;
  const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  if (!isNative) return _prefs; // web -> localStorage fallback (unchanged)
  try {
    const pkg = '@capacitor/preferences';
    const mod = await import(/* @vite-ignore */ pkg);
    _prefs = mod?.Preferences || null;
  } catch {
    _prefs = null; // plugin unavailable -> localStorage fallback
  }
  return _prefs;
}

const SENSITIVE_PREFIX = 'sec_';

export async function setItem(key, value) {
  const Preferences = await getPreferences();
  if (Preferences) return Preferences.set({ key, value });
  if (key.startsWith(SENSITIVE_PREFIX) && location?.protocol !== 'https:') {
    console.warn('[secureStorage] storing sensitive key over non-HTTPS:', key);
  }
  localStorage.setItem(key, value);
}

export async function getItem(key) {
  const Preferences = await getPreferences();
  if (Preferences) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function removeItem(key) {
  const Preferences = await getPreferences();
  if (Preferences) return Preferences.remove({ key });
  localStorage.removeItem(key);
}

// Convenience for the PB auth token specifically.
export const TOKEN_KEY = SENSITIVE_PREFIX + 'pb_token';
export const setToken = (token) => setItem(TOKEN_KEY, token);
export const getToken = () => getItem(TOKEN_KEY);
export const clearToken = () => removeItem(TOKEN_KEY);
