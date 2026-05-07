/* eslint-disable no-console */
/**
 * pb-add-isPopular.js — adds the `isPopular` boolean field to the
 * `products` collection in PocketBase.
 *
 *   Idempotent — safe to run any number of times. If the field already
 *   exists it exits successfully without touching the schema.
 *
 *   Run from repo root:  node scripts/pb-add-isPopular.js
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

const log = (...a) => console.log('[pb-add-isPopular]', ...a);

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
  // PB v0.22+ exposes /api/collections/_superusers/auth-with-password.
  // Fall back to the older /api/admins/auth-with-password if that 404s.
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
  throw new Error('No admin auth endpoint responded — check PB version / URL.');
}

async function main() {
  log('PB_URL =', PB_URL);
  const token = await authAdmin();
  log('✓ admin authenticated');

  const auth = { Authorization: token };

  // 1) Fetch products collection
  const products = await http('/api/collections/products', { headers: auth });

  // 2) Skip if field already exists (idempotency)
  // PB v0.22+ exposes the schema as `fields`; older versions used `schema`.
  const fieldList = products.fields || products.schema || [];
  if (fieldList.some((f) => f.name === 'isPopular')) {
    log('✓ field `isPopular` already exists — nothing to do');
    return;
  }

  // 3) Append the new field and PATCH the collection
  const newField = {
    name: 'isPopular',
    type: 'bool',
    required: false,
    presentable: false,
    system: false,
  };
  const updated = { ...products, [products.fields ? 'fields' : 'schema']: [...fieldList, newField] };

  await http(`/api/collections/${products.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify(updated),
  });
  log('✓ added bool field `isPopular` to products');

  // 4) Verify
  const verify = await http('/api/collections/products', { headers: auth });
  const verifyFields = verify.fields || verify.schema || [];
  const ok = verifyFields.some((f) => f.name === 'isPopular' && f.type === 'bool');
  if (!ok) throw new Error('Field not present after PATCH — check PB logs');
  log('✓ verified');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
