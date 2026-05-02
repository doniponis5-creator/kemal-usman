/* eslint-disable no-console */
/**
 * pb-secure-rules.js — REPLACES the dangerous pb-open-all.js / pb-fix-rules.js.
 *
 * What it does (in order):
 *   1. Reads admin email + password from .env (NEVER hardcoded).
 *   2. Authenticates as admin.
 *   3. Migrates the schema:
 *      - clients: type=auth (PB built-in auth), unique phone, bonusBalance,
 *                 bonusHistory(json), referralCode(unique), referredBy, deletedAt
 *      - products: variants -> json, images keeps file
 *      - orders: items -> json, adds subtotal, paymentStatus, owner relation
 *      - settings: single-doc collection for bonus % / welcome / etc.
 *      - otp_codes: phone, codeHash, expiresAt, attempts, used
 *   4. Locks API rules with strict expressions:
 *      - products: list/view = public, create/update/delete = admin only
 *      - orders:   list/view = owner OR admin, create = anyone (will be re-validated by hook)
 *      - clients:  list/view = self OR admin, create = open (auth flow), update = self/admin
 *      - settings: list/view = public, write = admin only
 *      - otp_codes: list/view/write = admin only (clients hit /api/custom/otp/* instead)
 *
 *  Run from repo root:  node scripts/pb-secure-rules.js
 */

// Fail fast if dotenv is missing rather than the cryptic ERR_MODULE_NOT_FOUND.
try { await import('dotenv/config'); } catch {
  console.error('❌ Missing dependency `dotenv`. Run: npm install dotenv');
  process.exit(1);
}

const PB_URL = (process.env.PB_URL || process.env.VITE_PB_URL || 'http://145.223.100.16:8090').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
  console.error('   Tip: copy .env.example -> .env and fill in values.');
  process.exit(1);
}
if (PB_URL.startsWith('http://') && !PB_URL.includes('localhost') && !PB_URL.includes('127.0.0.1')) {
  console.warn('⚠️  PB_URL is not HTTPS. Production rules should be applied via HTTPS only.');
  console.warn('   Continue anyway? Press Ctrl+C to cancel, or wait 5s...');
  await new Promise((r) => setTimeout(r, 5000));
}

async function api(path, init = {}, token) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function main() {
  console.log('🔒 Locking down PocketBase at', PB_URL);

  // 1. Auth.
  const auth = await api('/api/admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const token = auth.token;
  console.log('  ✅ admin authenticated');

  // 2. Inventory existing collections.
  const { items: collections } = await api('/api/collections?perPage=200', {}, token);
  const byName = Object.fromEntries(collections.map((c) => [c.name, c]));

  // ─── helper: upsert a collection ────────────────────────────────────────────
  async function upsertCollection(name, def) {
    const existing = byName[name];
    if (existing) {
      // PocketBase forbids changing collection type after creation. If the
      // existing collection is a different type than what we want, fall back
      // to keeping the existing type and only updating fields + rules. The
      // operator must do a manual data migration to the new auth collection.
      if (def.type && existing.type && def.type !== existing.type) {
        console.warn(`  ⚠️  ${name}: existing type "${existing.type}" != desired "${def.type}". Keeping existing type. Manual migration required (see MIGRATION_GUIDE.md §5).`);
        def = { ...def, type: existing.type, options: existing.options };
      }
      const merged = { ...existing, ...def, schema: mergeSchema(existing.schema || [], def.schema || []) };
      delete merged.id;
      delete merged.created;
      delete merged.updated;
      await api(`/api/collections/${existing.id}`, { method: 'PATCH', body: JSON.stringify(merged) }, token);
      console.log(`  ✅ updated ${name}`);
    } else {
      await api('/api/collections', { method: 'POST', body: JSON.stringify(def) }, token);
      console.log(`  ✅ created ${name}`);
    }
  }
  function mergeSchema(oldFields, newFields) {
    const oldByName = Object.fromEntries(oldFields.map((f) => [f.name, f]));
    const result = [...oldFields];
    for (const nf of newFields) {
      if (oldByName[nf.name]) {
        // upgrade type if PB schema differs
        const idx = result.findIndex((f) => f.name === nf.name);
        result[idx] = { ...oldByName[nf.name], ...nf };
      } else {
        result.push(nf);
      }
    }
    return result;
  }

  // 3. Schema migrations.
  await upsertCollection('clients', {
    name: 'clients',
    type: 'auth',
    schema: [
      { name: 'phone', type: 'text', required: true, unique: true, options: { min: 10, max: 20 } },
      { name: 'name', type: 'text', required: false },
      { name: 'bonusBalance', type: 'number', required: false, options: { min: 0 } },
      { name: 'bonusHistory', type: 'json', required: false },
      { name: 'referralCode', type: 'text', required: false, unique: true },
      { name: 'referredBy', type: 'text', required: false },
      { name: 'deletedAt', type: 'text', required: false },
    ],
    listRule: 'id = @request.auth.id',
    viewRule: 'id = @request.auth.id',
    createRule: '', // open — server hooks generate proper records
    updateRule: 'id = @request.auth.id',
    deleteRule: null,
    options: { allowEmailAuth: false, allowOAuth2Auth: false, allowUsernameAuth: false, requireEmail: false, manageRule: null },
  });

  await upsertCollection('products', {
    name: 'products',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'brand', type: 'text', required: false },
      { name: 'category', type: 'text', required: false },
      { name: 'desc', type: 'text', required: false },
      { name: 'variants', type: 'json', required: false },
      { name: 'images', type: 'file', required: false, options: { maxSelect: 10, maxSize: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] } },
      { name: 'audioUrl', type: 'file', required: false, options: { maxSelect: 1, maxSize: 2 * 1024 * 1024, mimeTypes: ['audio/webm', 'audio/mpeg', 'audio/mp4'] } },
      { name: 'active', type: 'bool', required: false },
    ],
    listRule: '',
    viewRule: '',
    createRule: null, // admin only
    updateRule: null,
    deleteRule: null,
  });

  await upsertCollection('orders', {
    name: 'orders',
    type: 'base',
    schema: [
      { name: 'clientName', type: 'text', required: false },
      { name: 'clientPhone', type: 'text', required: true },
      { name: 'items', type: 'json', required: true },
      { name: 'date', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'subtotal', type: 'number', required: false },
      { name: 'total', type: 'number', required: false },
      { name: 'paymentMethod', type: 'text', required: false },
      { name: 'paymentStatus', type: 'text', required: false },
      { name: 'address', type: 'text', required: false },
      { name: 'comment', type: 'text', required: false },
      { name: 'bonusDiscount', type: 'number', required: false },
    ],
    listRule: "@request.auth.phone != '' && clientPhone = @request.auth.phone",
    viewRule: "@request.auth.phone != '' && clientPhone = @request.auth.phone",
    createRule: '', // open — server hook validates and recomputes total
    updateRule: null, // admin only
    deleteRule: null, // admin only
  });

  await upsertCollection('settings', {
    name: 'settings',
    type: 'base',
    schema: [
      { name: 'shopName', type: 'text', required: false },
      { name: 'whatsappPhone', type: 'text', required: false },
      { name: 'bonusPercent', type: 'number', required: false },
      { name: 'useBonusPercent', type: 'number', required: false },
      { name: 'welcomeBonus', type: 'number', required: false },
      { name: 'welcomeBonusEnabled', type: 'bool', required: false },
      { name: 'referralBonus', type: 'number', required: false },
      { name: 'referralFriendBonus', type: 'number', required: false },
      { name: 'deliveryCost', type: 'number', required: false },
      { name: 'minOrderForFreeDelivery', type: 'number', required: false },
      { name: 'shopAddress', type: 'text', required: false },
      { name: 'workingHours', type: 'text', required: false },
      { name: 'aboutText', type: 'text', required: false },
    ],
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  await upsertCollection('otp_codes', {
    name: 'otp_codes',
    type: 'base',
    schema: [
      { name: 'phone', type: 'text', required: true },
      { name: 'codeHash', type: 'text', required: true },
      { name: 'expiresAt', type: 'text', required: true },
      { name: 'attempts', type: 'number', required: false },
      { name: 'used', type: 'bool', required: false },
    ],
    listRule: null, // admin only
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  // 4. Seed singleton settings doc if missing.
  try {
    await api('/api/collections/settings/records/main', {}, token);
    console.log('  ✅ settings/main exists');
  } catch (_) {
    await api('/api/collections/settings/records', {
      method: 'POST',
      body: JSON.stringify({
        id: 'main',
        shopName: 'Kemal Usman',
        whatsappPhone: '996557100505',
        bonusPercent: 5,
        useBonusPercent: 30,
        welcomeBonus: 150,
        welcomeBonusEnabled: true,
        referralBonus: 100,
        referralFriendBonus: 50,
        deliveryCost: 0,
        minOrderForFreeDelivery: 0,
      }),
    }, token);
    console.log('  ✅ created settings/main');
  }

  // 5. Smoke-test rules.
  console.log('\n🧪 Smoke test (no auth):');
  for (const [name, expected] of [['products', 200], ['orders', 401], ['clients', 401]]) {
    const r = await fetch(`${PB_URL}/api/collections/${name}/records?perPage=1`);
    const ok = r.status === expected ? '✅' : '❌';
    console.log(`  ${ok} ${name}: ${r.status} (expected ${expected})`);
  }

  console.log('\n🎉 PocketBase secured.');
  console.log('   Next: deploy pb_hooks/ folder to the same dir as the pocketbase binary and restart.');
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
