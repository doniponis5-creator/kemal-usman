// Centralized PocketBase client.
// Reads VITE_PB_URL from .env so the URL never lives in the bundle code.
// Never import the raw URL elsewhere — always import { pb, PB_URL } from this file.
import PocketBase from 'pocketbase';

const fallback = 'http://145.223.100.16:8090';
export const PB_URL = (import.meta.env.VITE_PB_URL || fallback).replace(/\/$/, '');

if (PB_URL.startsWith('http://') && !PB_URL.includes('localhost') && !PB_URL.includes('127.0.0.1')) {
  // eslint-disable-next-line no-console
  console.warn(
    '[security] PB_URL is not HTTPS — iOS App Transport Security will block this in release builds. Set VITE_PB_URL=https://… in .env.production.'
  );
}

export const pb = new PocketBase(PB_URL);

// Common file URL helper — collection-agnostic.
export const fileUrl = (collection, record, filename) =>
  `${PB_URL}/api/files/${collection}/${record.id}/${filename}`;

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
