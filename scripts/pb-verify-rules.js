// scripts/pb-verify-rules.js
// Run AFTER pb-secure-rules.js to confirm rules are live.
// Issues anonymous HTTP (no auth header) — i.e. exactly what an attacker
// would do — and asserts that the sensitive collections refuse to leak data.

import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = process.env.VITE_PB_URL || 'http://127.0.0.1:8090';

// Sensitive endpoints — these MUST refuse anonymous reads.
// 401 (unauthorised) and 403 (forbidden) are both acceptable; PB returns
// 403 when a rule is set but doesn't match, 401 when no public rule exists
// and you hit a route that requires auth.
const MUST_BLOCK = [
  '/api/collections/clients/records',
  '/api/collections/orders/records',
  '/api/collections/otp_codes/records',
];

// Public-by-design endpoints — these MUST keep working anonymously
// or the storefront breaks for guests.
const MUST_ALLOW = [
  '/api/collections/products/records',
  '/api/collections/settings/records',
  '/api/collections/banners/records',
];

async function verify() {
  console.log(`🔍 Verifying PocketBase rules at ${PB_URL} (anonymous access)...\n`);
  let passed = 0;
  let failed = 0;

  for (const path of MUST_BLOCK) {
    let res;
    try { res = await fetch(PB_URL + path); }
    catch (e) {
      console.error(`❌ NETWORK ${path} — ${e.message}`);
      failed++;
      continue;
    }
    if (res.status === 403 || res.status === 401 || res.status === 404) {
      // 404 is acceptable for otp_codes when even the collection metadata
      // is hidden — same intent (anon can't reach it).
      console.log(`✅ BLOCKED ${path} → ${res.status}`);
      passed++;
    } else {
      console.error(`❌ EXPOSED ${path} → ${res.status} ← DATA LEAK!`);
      failed++;
    }
  }

  console.log('');

  for (const path of MUST_ALLOW) {
    let res;
    try { res = await fetch(PB_URL + path); }
    catch (e) {
      console.error(`❌ NETWORK ${path} — ${e.message}`);
      failed++;
      continue;
    }
    if (res.status === 200) {
      console.log(`✅ PUBLIC  ${path} → 200`);
      passed++;
    } else {
      console.warn(`⚠️  BLOCKED ${path} → ${res.status} (app may break)`);
      failed++;
    }
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n🚨 RULES NOT SECURE — run pb-secure-rules.js again');
    process.exit(1);
  } else {
    console.log('\n🎉 All rules verified. Safe to deploy.');
  }
}

verify().catch(err => {
  console.error('❌ Verify failed:', err.message || err);
  process.exit(1);
});
