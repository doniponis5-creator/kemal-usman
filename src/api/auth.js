// OTP-based authentication client. Talks to the custom hooks at
// /api/custom/otp/request and /api/custom/otp/verify (see pb_hooks/otp.pb.js).

import { authedFetch, pb, PB_URL } from './pb';
import { setToken, clearToken } from '../utils/secureStorage';

// Apple Review demo account — bypasses OTP for the review phone number.
const DEMO_PHONE = '+996555000001';
const DEMO_CODE = '123456';

export async function requestOtp(phone) {
  // Skip real SMS for Apple Review demo account
  if (phone.replace(/\D/g, '') === DEMO_PHONE.replace(/\D/g, '')) {
    return { success: true };
  }
  return authedFetch('/api/custom/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp({ phone, code, name, referredBy }) {
  const cleanPhone = phone.replace(/\D/g, '');
  // Apple Review demo account — bypass real OTP verification
  if (cleanPhone === DEMO_PHONE.replace(/\D/g, '') && code === DEMO_CODE) {
    const demoRecord = {
      id: 'demo_apple_review',
      phone: DEMO_PHONE,
      name: name || 'Apple Reviewer',
      bonusBalance: 500,
      bonusHistory: [],
      referralCode: 'DEMO-REVIEW',
      collectionId: 'clients',
      collectionName: 'clients',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    // Create a minimal JWT-like token so pb.authStore.save() doesn't throw.
    // Format: base64(header).base64(payload).base64(sig) — PB SDK just checks structure.
    const hdr = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const pld = btoa(JSON.stringify({ id: 'demo_apple_review', type: 'authRecord', collectionId: 'clients', exp: Math.floor(Date.now() / 1000) + 86400 * 365 }));
    const demoToken = hdr + '.' + pld + '.' + btoa('demo_signature');
    try { await setToken(demoToken); } catch (_) {}
    try { pb.authStore.save(demoToken, demoRecord); } catch (_) {}
    return { record: demoRecord, isNewClient: false };
  }

  const res = await authedFetch('/api/custom/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code, name, referredBy }),
  });
  // Persist the token securely + tell the PB SDK about it.
  await setToken(res.token);
  pb.authStore.save(res.token, res.record);
  // Return record + isNewClient flag so caller can show welcome celebration.
  return { record: res.record, isNewClient: res.isNewClient === true };
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
  // Try legacy admin endpoint first (PocketBase < v0.23)
  let res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });

  // Fallback: newer PocketBase versions renamed admins → _superusers
  if (!res.ok && res.status === 404) {
    res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
  }

  if (!res.ok) {
    throw new Error('Неверный email или пароль');
  }

  const data = await res.json();
  // Handle both response shapes: legacy uses data.admin, new uses data.record
  const adminModel = data.admin || data.record || null;
  pb.authStore.save(data.token, adminModel);
  return data;
}

export const isAdmin = () => pb.authStore.isAdmin;
export const currentUser = () => pb.authStore.model;
