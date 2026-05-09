// scripts/pb-secure-rules.js
// Run: node scripts/pb-secure-rules.js  (or: npm run pb:secure)
//
// Idempotent: locks every collection to its minimum required access surface.
// Re-running this script after schema drifts (new field added in PB UI, etc.)
// just re-asserts the same rules — no destructive operations.
//
// What this DOESN'T do (and used to):
//   • Schema migration (creating fields / collections). The previous version
//     of this file mixed that in. Schema is now done by separate, explicit
//     migration scripts in scripts/ (pb-add-audio.js, pb-add-isPopular.js,
//     etc.) so a "lock the rules" run cannot accidentally alter schema.
//
// Auth: PB_ADMIN_EMAIL + PB_ADMIN_PASS in .env (NEVER committed).

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = process.env.VITE_PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
// Accept either name — the spec calls for PB_ADMIN_PASS, the older
// .env.example used PB_ADMIN_PASSWORD. Tolerate both so a stale .env
// doesn't silently fail-open on first run.
const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env');
  process.exit(1);
}

if (PB_URL.startsWith('http://') && !PB_URL.includes('localhost') && !PB_URL.includes('127.0.0.1')) {
  console.warn('⚠️  PB_URL is not HTTPS — admin credentials will travel in cleartext.');
  console.warn('    Cancel with Ctrl+C if this is production. Continuing in 5s...');
  await new Promise((r) => setTimeout(r, 5000));
}

const pb = new PocketBase(PB_URL);

// Rule definitions per collection.
// Empty string = public; null = nobody (only admin via /_/ or hooks); other =
// PB filter expression. The `_superusers` collection check is the modern
// (PB 0.22+) way to assert "admin caller" — `pb.authStore.isAdmin` mirrors
// this on the client SDK.
const RULES = {

  // ─── PRODUCTS (public catalog) ───────────────────────────────
  products: {
    listRule:   '',        // anyone can browse catalog
    viewRule:   '',        // anyone can view product detail
    createRule: '@request.auth.id != "" && @request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.id != "" && @request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.id != "" && @request.auth.collectionName = "_superusers"',
  },

  // ─── CLIENTS (users) ─────────────────────────────────────────
  clients: {
    listRule:   '@request.auth.id != ""'
                + ' && @request.auth.collectionName = "_superusers"',
    viewRule:   '@request.auth.id = id'
                + ' || @request.auth.collectionName = "_superusers"',
    createRule: '',        // OTP hook creates records (unauthenticated hook context)
    updateRule: '@request.auth.id = id'
                + ' || @request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── ORDERS ──────────────────────────────────────────────────
  orders: {
    listRule:   '@request.auth.id != ""'
                + ' && (client = @request.auth.id'
                + '  || @request.auth.collectionName = "_superusers")',
    viewRule:   '@request.auth.id != ""'
                + ' && (client = @request.auth.id'
                + '  || @request.auth.collectionName = "_superusers")',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── OTP CODES ───────────────────────────────────────────────
  otp_codes: {
    listRule:   null,      // nobody — only pb_hooks can access
    viewRule:   null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },

  // ─── SETTINGS ────────────────────────────────────────────────
  settings: {
    listRule:   '',        // app reads shop name, banner etc — public ok
    viewRule:   '',
    createRule: '@request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── BANNERS ─────────────────────────────────────────────────
  banners: {
    listRule:   '',
    viewRule:   '',
    createRule: '@request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── CATEGORIES ──────────────────────────────────────────────
  categories: {
    listRule:   '',
    viewRule:   '',
    createRule: '@request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── SITE_MEDIA (shared images — instagram screenshot etc.) ──
  site_media: {
    listRule:   '',        // anyone can see shared media
    viewRule:   '',
    createRule: '@request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

  // ─── REVIEWS ─────────────────────────────────────────────────
  reviews: {
    listRule:   '',
    viewRule:   '',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id = client'
                + ' || @request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.collectionName = "_superusers"',
  },

};

// ── Apply rules ──────────────────────────────────────────────────
async function applyRules() {
  console.log('🔐 pb-secure-rules.js — locking collections...\n');

  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated as admin\n');

  const collections = await pb.collections.getFullList();
  const byName = Object.fromEntries(collections.map(c => [c.name, c]));

  let changed = 0;
  let skipped = 0;
  let missing = 0;

  for (const [name, rules] of Object.entries(RULES)) {
    const col = byName[name];
    if (!col) {
      console.warn(`⚠️  Collection "${name}" not found — skipping`);
      missing++;
      continue;
    }

    // Idempotency: only PATCH if at least one rule actually differs.
    const alreadyCorrect = (
      col.listRule   === rules.listRule   &&
      col.viewRule   === rules.viewRule   &&
      col.createRule === rules.createRule &&
      col.updateRule === rules.updateRule &&
      col.deleteRule === rules.deleteRule
    );

    if (alreadyCorrect) {
      console.log(`✓  ${name} — already locked`);
      skipped++;
      continue;
    }

    await pb.collections.update(col.id, rules);
    console.log(`🔒 ${name} — rules updated`);
    changed++;
  }

  console.log(`\n📊 Result: ${changed} updated, ${skipped} already correct, ${missing} missing`);
  console.log('\n✅ All done. Run verify step next:  npm run pb:verify\n');
}

applyRules().catch(err => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
