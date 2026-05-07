/* eslint-disable no-console */
/**
 * pb-add-audio.js — adds the `audio` single-file field to the `products`
 * collection in PocketBase.
 *
 *   Idempotent — safe to run any number of times.
 *
 *   Run from repo root:  node scripts/pb-add-audio.js
 *   Requires .env with PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD.
 */

try { await import('dotenv/config'); } catch {
  console.error('❌ Missing dependency `dotenv`. Run: npm install dotenv');
  process.exit(1);
}

const PB_URL = (process.env.PB_URL || process.env.VITE_PB_URL || 'http://145.223.100.16:8090').replace(/\/$/, '');
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('❌ PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

const log = (...a) => console.log('[pb-add-audio]', ...a);

async function http(path, init = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message || res.statusText;
    throw new Error(`${res.status} ${msg} — ${JSON.stringify(body)}`);
  }
  return body;
}

async function authAdmin() {
  const payload = JSON.stringify({ identity: EMAIL, password: PASSWORD });
  for (const path of [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password',
  ]) {
    try {
      const r = await http(path, { method: 'POST', body: payload });
      return r.token;
    } catch (e) {
      if (!String(e.message).startsWith('404')) throw e;
    }
  }
  throw new Error('No admin auth endpoint responded');
}

async function main() {
  log('PB_URL =', PB_URL);
  const token = await authAdmin();
  log('✓ admin authenticated');
  const auth = { Authorization: token };

  const products = await http('/api/collections/products', { headers: auth });
  const fieldList = products.fields || products.schema || [];
  if (fieldList.some((f) => f.name === 'audio')) {
    log('✓ field `audio` already exists — nothing to do');
    return;
  }

  const newField = {
    name: 'audio',
    type: 'file',
    required: false,
    presentable: false,
    system: false,
    options: {
      maxSelect: 1,
      maxSize: 5242880, // 5 MB cap — single 10s recording is well under this
      mimeTypes: ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-m4a'],
      thumbs: [],
      protected: false,
    },
  };
  const updated = { ...products, [products.fields ? 'fields' : 'schema']: [...fieldList, newField] };
  await http(`/api/collections/${products.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify(updated),
  });
  log('✓ added file field `audio` (single, 5MB cap) to products');
}

main().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
