// scripts/pb-fix-bonus-fields.js
// Run: node scripts/pb-fix-bonus-fields.js
//
// WHY: otp.pb.js used to write snake_case fields (bonus_balance, bonus_history,
// referred_by) while main.pb.js + the frontend use camelCase (bonusBalance,
// bonusHistory, referredBy). This script makes the DB consistent:
//
//   1. Ensures the camelCase fields EXIST on `clients`
//      (bonusBalance number, bonusHistory json, referralCode text, referredBy text)
//   2. If legacy snake_case fields exist AND hold data, copies values into the
//      camelCase fields (only where the camelCase value is empty/zero).
//   3. NEVER deletes or renames existing fields (live-data safety rule).
//   4. Prints a full report.
//
// Idempotent — safe to run multiple times.

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = (process.env.VITE_PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env');
  process.exit(1);
}

const WANTED = [
  { name: 'bonusBalance', type: 'number', options: { min: null, max: null } },
  { name: 'bonusHistory', type: 'json',   options: {} },
  { name: 'referralCode', type: 'text',   options: { min: null, max: null, pattern: '' } },
  { name: 'referredBy',   type: 'text',   options: { min: null, max: null, pattern: '' } },
];
const LEGACY_MAP = {
  bonus_balance: 'bonusBalance',
  bonus_history: 'bonusHistory',
  referral_code: 'referralCode',
  referred_by:   'referredBy',
};

const pb = new PocketBase(PB_URL);

async function adminAuth() {
  try { await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS); }
  catch { await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS); }
}

function isEmpty(v) {
  if (v === null || v === undefined || v === '' || v === 0) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'string' && (v === '[]' || v === '{}')) return true;
  return false;
}

async function main() {
  console.log(`🔧 clients bonus-field consistency check — ${PB_URL}\n`);
  await adminAuth();
  console.log('✅ Authenticated as admin');

  const col = await pb.collections.getOne('clients');
  const fieldKey = Array.isArray(col.schema) ? 'schema' : 'fields';
  const fields = col[fieldKey] || [];
  const names = fields.map((f) => f.name);

  console.log(`\n📋 Current clients fields: ${names.join(', ')}`);

  // 1. Ensure camelCase fields exist
  const toAdd = WANTED.filter((w) => !names.includes(w.name));
  if (toAdd.length > 0) {
    console.log(`➕ Adding missing camelCase fields: ${toAdd.map((f) => f.name).join(', ')}`);
    await pb.collections.update(col.id, { [fieldKey]: [...fields, ...toAdd] });
  } else {
    console.log('✅ All camelCase fields already exist.');
  }

  // 2. Migrate data from legacy snake_case fields (if they exist)
  const legacyPresent = Object.keys(LEGACY_MAP).filter((n) => names.includes(n));
  if (legacyPresent.length === 0) {
    console.log('✅ No legacy snake_case fields in schema — nothing to migrate.');
  } else {
    console.log(`⚠️  Legacy fields present: ${legacyPresent.join(', ')} — migrating data...`);
    const clients = await pb.collection('clients').getFullList({ batch: 200 });
    let migrated = 0;
    for (const rec of clients) {
      const patch = {};
      for (const [oldName, newName] of Object.entries(LEGACY_MAP)) {
        if (!legacyPresent.includes(oldName)) continue;
        const oldVal = rec[oldName];
        const newVal = rec[newName];
        if (!isEmpty(oldVal) && isEmpty(newVal)) patch[newName] = oldVal;
      }
      if (Object.keys(patch).length > 0) {
        await pb.collection('clients').update(rec.id, patch);
        migrated++;
      }
    }
    console.log(`🔁 Migrated data for ${migrated} client(s). Legacy fields kept (NOT deleted) for safety.`);
  }

  // 3. Report
  const sample = await pb.collection('clients').getList(1, 5, { sort: '-created' });
  console.log('\n📊 Sample (latest 5 clients):');
  for (const r of sample.items) {
    console.log(`   ${r.phone || r.id}: bonusBalance=${r.bonusBalance ?? '—'} referralCode=${r.referralCode ?? '—'} referredBy=${r.referredBy ?? '—'}`);
  }
  console.log('\n✅ Done. otp.pb.js v2 + main.pb.js now read/write the same camelCase fields.');
}

main().catch((e) => {
  console.error('❌ Failed:', e?.response?.message || e.message || e);
  process.exit(1);
});
