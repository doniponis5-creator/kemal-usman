// Centralized PocketBase client.
// Reads VITE_PB_URL from .env so the URL never lives in the bundle code.
// Never import the raw URL elsewhere — always import { pb, PB_URL } from this file.
import PocketBase from 'pocketbase';

// HTTPS-only fallback — the staging http:// IP is gone. If VITE_PB_URL is
// missing in dev, point it at a Cloudflare Tunnel or the prod host.
const fallback = 'https://api.kemalusman.kg';
export const PB_URL = (import.meta.env.VITE_PB_URL || fallback).replace(/\/$/, '');

if (PB_URL.startsWith('http://') && !PB_URL.includes('localhost') && !PB_URL.includes('127.0.0.1')) {
  // eslint-disable-next-line no-console
  console.warn(
    '[security] PB_URL is not HTTPS — iOS App Transport Security will block this in release builds. Set VITE_PB_URL=https://… in .env.production.'
  );
}

export const pb = new PocketBase(PB_URL);

// Common file URL helper — collection-agnostic.
// Defensive: returns `null` if record or filename are missing/empty so a
// freshly-saved record with no images doesn't blow up downstream callers.
// Callers can still null-check if they want to render a placeholder.
export const fileUrl = (collection, record, filename) => {
  if (!record || !record.id || !filename) return null;
  return `${PB_URL}/api/files/${collection}/${record.id}/${filename}`;
};

// Convenience helper for the `audio` single-file field on products.
// Returns null if the record has no audio attached.
export const audioUrl = (record) => {
  if (!record?.id || !record?.audio) return null;
  return `${PB_URL}/api/files/products/${record.id}/${record.audio}`;
};

// Ishonchli admin-token aniqlash. MUAMMO: jonli server eski PocketBase (<0.23),
// admin login legacy /api/admins endpointidan o'tadi va saqlangan modelda
// collectionName YO'Q — yangi SDK'ning authStore.isAdmin esa buni tanimaydi.
// Natija: sahifa yangilanganda admin mijoz tomoniga uloqtirilardi.
// YECHIM: JWT token ichidagi `type` claim'ini tekshiramiz — legacy admin
// tokenlarda type === "admin", mijoz tokenlarida type === "authRecord".
export function isAdminAuth() {
  if (!pb.authStore.isValid) return false;
  if (pb.authStore.isAdmin) return true;
  const m = pb.authStore.model;
  if (m?.collectionName === '_superusers') return true;
  try {
    const payload = JSON.parse(atob(pb.authStore.token.split('.')[1]));
    return payload?.type === 'admin';
  } catch { return false; }
}

// Fetch wrapper that auto-injects the current PB auth token (for hook calls).
export async function authedFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (pb.authStore.isValid) headers.set('Authorization', pb.authStore.token);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${PB_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
