// OTP-based authentication client. Talks to the custom hooks at
// /api/custom/otp/request and /api/custom/otp/verify (see pb_hooks/otp.pb.js).

import { authedFetch, pb } from './pb';
import { setToken, clearToken } from '../utils/secureStorage';

export async function requestOtp(phone) {
  return authedFetch('/api/custom/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp({ phone, code, name, referredBy }) {
  const res = await authedFetch('/api/custom/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code, name, referredBy }),
  });
  // Persist the token securely + tell the PB SDK about it.
  await setToken(res.token);
  pb.authStore.save(res.token, res.record);
  return res.record;
}

export async function logout() {
  await clearToken();
  pb.authStore.clear();
}

export async function deleteAccount() {
  await authedFetch('/api/custom/account/delete', { method: 'POST' });
  await logout();
}

// Admin login uses the built-in PB admin auth, NOT the client bundle.
// Calls PocketBase /api/admins/auth-with-password directly.
export async function adminLogin(email, password) {
  const auth = await pb.admins.authWithPassword(email, password);
  return auth;
}

export const isAdmin = () => pb.authStore.isAdmin;
export const currentUser = () => pb.authStore.model;
