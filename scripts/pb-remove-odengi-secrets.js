// scripts/pb-remove-odengi-secrets.js
// Run: node scripts/pb-remove-odengi-secrets.js
//
// WHY: the `settings` collection is publicly readable (the app reads shop
// name / banners from it). The O!Деньги merchant SID + PASSWORD used to be
// stored there — meaning ANYONE could read them via
//   GET /api/collections/settings/records
// The payment hook (pb_hooks/odengi.pb.js v4) now reads credentials ONLY
// from environment variables, so these fields must be removed entirely.
//
// This script:
//   1. Authenticates as PB admin (PB_ADMIN_EMAIL / PB_ADMIN_PASS from .env)
//   2. Removes the `odengiSid` and `odengiPassword` FIELDS from the
//      `settings` collection schema (this also deletes their stored values)
//   3. Verifies they are gone
//
// Idempotent — safe to run multiple times.

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = (process.env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;

const SECRET_FIELDS = ['odengiSid', 'odengiPassword'];

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

async function adminAuth() {
  // LEGACY PB (<0.23): jonli server /api/admins/auth-with-password ishlatadi
  // (src/api/auth.js dagi adminLogin bilan bir xil yondashuv). Yangi SDK
  // to'g'ridan-to'g'ri _superusers endpointiga uradi va 404 oladi — shuning
  // uchun avval legacy endpoint, keyin SDK fallback.
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    if (res.ok) {
      const data = await res.json();
      pb.authStore.save(data.token, data.admin || data.record || null);
      return;
    }
    if (res.status === 400) throw new Error('Email yoki parol noto\'g\'ri (.env dagi PB_ADMIN_EMAIL/PB_ADMIN_PASS ni tekshiring)');
  } catch (e) {
    if (String(e.message || '').includes('parol')) throw e;
  }
  try { await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS); return; } catch { /* keyingisi */ }
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
}

async function main() {
  console.log(`🔐 Removing O!Деньги secret fields from public settings — ${PB_URL}\n`);
  await adminAuth();
  console.log('✅ Authenticated as admin');

  let col = null;
  try { col = await pb.collections.getOne('settings'); }
  catch {
    console.log("OK: 'settings' kolleksiyasi mavjud emas - sir maydonlar ham yo'q.");
    console.log("   (Yaratish uchun: node scripts/pb-ensure-settings.js)");
    return;
  }

  // PB < 0.23 keeps fields in `schema`; newer versions use `fields`.
  const fieldKey = Array.isArray(col.schema) ? 'schema' : 'fields';
  const fields = col[fieldKey] || [];

  const present = fields.filter((f) => SECRET_FIELDS.includes(f.name)).map((f) => f.name);
  if (present.length === 0) {
    console.log('✅ Already clean — no odengiSid/odengiPassword fields in settings.');
    return;
  }

  console.log(`⚠️  Found secret fields in PUBLIC collection: ${present.join(', ')}`);
  const cleaned = fields.filter((f) => !SECRET_FIELDS.includes(f.name));
  await pb.collections.update(col.id, { [fieldKey]: cleaned });
  console.log('🧹 Removed fields (and their stored values).');

  // Verify
  const after = await pb.collections.getOne('settings');
  const afterFields = (after[fieldKey] || []).map((f) => f.name);
  const leftovers = SECRET_FIELDS.filter((n) => afterFields.includes(n));
  if (leftovers.length > 0) {
    console.error(`❌ VERIFY FAILED — still present: ${leftovers.join(', ')}`);
    process.exit(1);
  }
  console.log('✅ VERIFIED: settings collection no longer contains payment secrets.');
  console.log('\nℹ️  Reminder: credentials now live in /etc/pocketbase/env on the server:');
  console.log('   ODENGI_SID=...  ODENGI_PASSWORD=...  (then: systemctl restart pocketbase)');
}

main().catch((e) => {
  console.error('❌ Failed:', e?.response?.message || e.message || e);
  process.exit(1);
});
