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
  // Jonli sxemada orders'da `client` relation yo'q — egalik clientPhone orqali.
  // Admin (legacy token) qoidalarni baribir chetlab o'tadi.
  orders: {
    listRule:   'clientPhone = @request.auth.phone',
    viewRule:   'clientPhone = @request.auth.phone',
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: null,
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

  // ─── NOTIFICATIONS ───────────────────────────────────────────
  // O'qish: ommaviy xabarlar hammaga, shaxsiy (targetPhone) faqat egasiga.
  // Yozish: faqat admin (mark-read mijoz uchun custom hook orqali).
  notifications: {
    listRule:   'targetPhone = "" || targetPhone = @request.auth.phone',
    viewRule:   'targetPhone = "" || targetPhone = @request.auth.phone',
    createRule: null,
    updateRule: null,
    deleteRule: null,
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

  // LEGACY PB (<0.23): avval eski /api/admins endpointi, keyin SDK fallback
  let authed = false;
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    if (res.ok) {
      const d = await res.json();
      pb.authStore.save(d.token, d.admin || d.record || null);
      authed = true;
    }
  } catch { /* fallback */ }
  if (!authed) {
    try { await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS); }
    catch { await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS); }
  }
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

    try {
      await pb.collections.update(col.id, rules);
      console.log(`🔒 ${name} — rules updated`);
      changed++;
    } catch (e) {
      console.error(`❌ ${name} — ${e?.response?.message || e.message}`,
        e?.response?.data ? JSON.stringify(e.response.data) : '');
      missing++;
    }
  }

  console.log(`\n📊 Result: ${changed} updated, ${skipped} already correct, ${missing} missing`);
  console.log('\n✅ All done. Run verify step next:  npm run pb:verify\n');
}

applyRules().catch(err => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
