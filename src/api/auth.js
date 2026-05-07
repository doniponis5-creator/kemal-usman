// OTP-based authentication client. Talks to the custom hooks at
// /api/custom/otp/request and /api/custom/otp/verify (see pb_hooks/otp.pb.js).

import { authedFetch, pb, PB_URL } from './pb';
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

// Admin login. Hits POST /api/admins/auth-with-password directly — the
// running PB server (verified via curl) uses the legacy admin route.
// Bypasses pb.admins.authWithPassword because some SDK versions try the
// renamed v0.23+ /api/collections/_superusers/... path first and 404 here,
// which surfaced as "Неверный пароль" even with valid credentials.
export async function adminLogin(email, password) {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });

  if (!res.ok) {
    throw new Error('Неверный email или пароль');
  }

  const data = await res.json();
  // Persist into the SDK's authStore so pb.authStore.isAdmin / .token /
  // .model are correct everywhere downstream (App.jsx mount-time session
  // restore, etc.).
  pb.authStore.save(data.token, data.admin);
  return data;
}

export const isAdmin = () => pb.authStore.isAdmin;
export const currentUser = () => pb.authStore.model;
