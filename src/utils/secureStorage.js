// Secure storage wrapper.
// On native (Capacitor) -> @capacitor/preferences -> backed by Keychain (iOS) / EncryptedSharedPreferences (Android).
// On web -> falls back to localStorage with a warning for sensitive keys.
//
// Use this for: PB auth tokens, anything resembling a credential.
// DO NOT use for: shopping cart, language preference, etc. Plain localStorage is fine for those.

let Preferences = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Preferences = require('@capacitor/preferences').Preferences;
} catch { /* not installed yet */ }

const SENSITIVE_PREFIX = 'sec_';

export async function setItem(key, value) {
  if (Preferences) return Preferences.set({ key, value });
  if (key.startsWith(SENSITIVE_PREFIX) && location?.protocol !== 'https:') {
    // eslint-disable-next-line no-console
    console.warn('[secureStorage] storing sensitive key over non-HTTPS:', key);
  }
  localStorage.setItem(key, value);
}

export async function getItem(key) {
  if (Preferences) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function removeItem(key) {
  if (Preferences) return Preferences.remove({ key });
  localStorage.removeItem(key);
}

// Convenience for the PB auth token specifically.
export const TOKEN_KEY = SENSITIVE_PREFIX + 'pb_token';
export const setToken = (token) => setItem(TOKEN_KEY, token);
export const getToken = () => getItem(TOKEN_KEY);
export const clearToken = () => removeItem(TOKEN_KEY);
