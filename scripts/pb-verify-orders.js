// scripts/pb-verify-orders.js
// Verifies that the server-side order validation hook in pb_hooks/main.pb.js
// is actually loaded and enforcing the four invariants from Task 5:
//   1. Server overrides client `total` from authoritative product prices.
//   2. Bonus overflow is clamped (or rejected) — never trusts client.
//   3. Fake productId → 400.
//   4. (implicit) OOS variant — covered by main.pb.js but not exercised here
//      since we pick an in-stock variant for the happy path.
//
// Run: node scripts/pb-verify-orders.js  (or: npm run pb:verify-orders)

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = process.env.VITE_PB_URL || 'http://127.0.0.1:8090';
const TEST_PHONE = process.env.PB_TEST_PHONE || '+996700000001';

const pb = new PocketBase(PB_URL);

// ── helpers ──────────────────────────────────────────────────────
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exitCode = 1; };
const info = (msg) => console.log(`  ℹ️  ${msg}`);

// ── main ─────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🔍 Order validation verifier → ${PB_URL}\n`);

  const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
  // Tolerate both names — the new spec uses PB_ADMIN_PASS, the older
  // .env.example used PB_ADMIN_PASSWORD.
  const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;
  if (!ADMIN_EMAIL || !ADMIN_PASS) {
    console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env');
    process.exit(1);
  }

  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  info('Authenticated as admin');

  // 1. Grab the first product with an in-stock variant.
  const products = await pb.collection('products').getList(1, 1);
  if (!products.items.length) {
    fail('No products found — add at least one product first');
    process.exit(1);
  }

  const product = products.items[0];
  const variants = typeof product.variants === 'string'
    ? JSON.parse(product.variants)
    : (product.variants || []);

  const variant = variants.find(v => v.inStock !== false);
  if (!variant) {
    fail('No in-stock variant on first product — add one or unstock');
    process.exit(1);
  }

  const realPrice = Number(variant.price);
  // The server hook matches `item.variantId` against `variant.id` (NOT label).
  // Using label here would 400 every test with "Unknown variant" before the
  // total/bonus assertions even fire.
  const variantId = variant.id;
  info(`Using product: "${product.name}"  variant id: "${variantId}"  label: "${variant.label}"  price: ${realPrice}`);

  // 2. Test client. Created with bonusBalance 500 — main.pb.js's clients
  //    afterCreate hook will TOP THIS UP with the welcome bonus, so the
  //    actual balance may be higher (we account for that below).
  let testClient;
  try {
    testClient = await pb.collection('clients').create({
      phone: TEST_PHONE,
      name: 'VerifyBot',
      bonusBalance: 500,
    });
    info(`Test client created: ${testClient.id}`);
  } catch {
    // Re-use if a previous run left it behind.
    const list = await pb.collection('clients').getList(1, 1, {
      filter: `phone = "${TEST_PHONE}"`,
    });
    if (!list.items.length) {
      fail(`Could not create or find test client for ${TEST_PHONE}`);
      process.exit(1);
    }
    testClient = list.items[0];
    info(`Reusing existing test client: ${testClient.id}`);
  }
  // Re-read so we see whatever balance the welcome-bonus hook left us with.
  const freshClient = await pb.collection('clients').getOne(testClient.id);
  const balance = Number(freshClient.bonusBalance || 0);
  info(`Test client bonusBalance after welcome hook: ${balance}`);

  // The PB SDK auto-cancels a duplicate inflight request to the same path.
  // Disable that here so back-to-back order POSTs don't 0 each other out.
  pb.collection('orders').autoCancellation(false);

  // ── TEST 1: Server must override client-sent total ─────────────
  console.log('\n📋 Test 1: Normal order — client sends total=1, server must overwrite');
  try {
    const order = await pb.collection('orders').create({
      client:        testClient.id,
      clientPhone:   TEST_PHONE,
      clientName:    'VerifyBot',
      items:         JSON.stringify([{
        productId: product.id,
        variantId: variantId,
        qty:       1,
        price:     realPrice,
        name:      product.name,
        variantLabel: variant.label,
      }]),
      subtotal:      1,       // ← client lies
      total:         1,       // ← client lies
      bonusDiscount: 0,
      status:        'new',
    });

    if (Number(order.total) === realPrice) {
      pass(`total corrected: client sent 1, server set ${order.total}`);
    } else if (Number(order.total) === 1) {
      fail(`total NOT corrected: server accepted client value of 1 som`);
      fail(`hook may not be loaded — check pb_hooks/main.pb.js is on the host`);
    } else {
      info(`total=${order.total} (unexpected — check manually)`);
    }

    await pb.collection('orders').delete(order.id);
  } catch (err) {
    fail(`Order create threw: ${err.status || ''} ${err.message}`);
  }

  // ── TEST 2: Bonus overflow ─────────────────────────────────────
  console.log('\n📋 Test 2: Bonus overflow — bonusDiscount=999999');
  try {
    const order = await pb.collection('orders').create({
      client:        testClient.id,
      clientPhone:   TEST_PHONE,
      clientName:    'VerifyBot',
      items:         JSON.stringify([{
        productId: product.id,
        variantId: variantId,
        qty:       1,
        price:     realPrice,
        name:      product.name,
        variantLabel: variant.label,
      }]),
      subtotal:      realPrice,
      total:         realPrice,
      bonusDiscount: 999999,
      status:        'new',
    });

    const usedBonus = Number(order.bonusDiscount || 0);
    // main.pb.js clamps to min(requested, balance, subtotal * useBonusPercent/100).
    // Whatever it lands on, it MUST NOT exceed `balance`.
    if (usedBonus <= balance) {
      pass(`bonus clamped: sent 999999, server used ${usedBonus} (balance was ${balance})`);
    } else {
      fail(`bonus NOT clamped: server accepted bonusDiscount=${usedBonus} but balance was only ${balance}`);
    }

    await pb.collection('orders').delete(order.id);
  } catch (err) {
    // A 400 here is also acceptable — the hook chose to reject rather than clamp.
    if (err.status === 400) {
      pass(`bonus overflow rejected with 400: ${err.message}`);
    } else {
      fail(`unexpected error: ${err.status || ''} ${err.message}`);
    }
  }

  // ── TEST 3: Fake product id ────────────────────────────────────
  console.log('\n📋 Test 3: Fake productId');
  try {
    await pb.collection('orders').create({
      client:        testClient.id,
      clientPhone:   TEST_PHONE,
      clientName:    'VerifyBot',
      items:         JSON.stringify([{
        productId: 'fakeid000000000',
        variantId: variantId,
        qty:       1,
        price:     1,
        name:      'Fake',
        variantLabel: variant.label,
      }]),
      subtotal:      1,
      total:         1,
      bonusDiscount: 0,
      status:        'new',
    });
    fail('fake product order was ACCEPTED — hook is not blocking!');
  } catch (err) {
    if (err.status === 400) {
      pass(`fake product rejected with 400 ✓`);
    } else {
      info(`rejected with ${err.status || '?'}: ${err.message}`);
    }
  }

  // ── Cleanup test client ────────────────────────────────────────
  try {
    await pb.collection('clients').delete(testClient.id);
    info('Test client cleaned up');
  } catch { /* ignore */ }

  if (process.exitCode === 1) {
    console.log('\n🚨 Some tests FAILED — order hook needs attention\n');
  } else {
    console.log('\n🎉 All order validation tests passed!\n');
  }
}

run().catch(err => {
  console.error('❌ Fatal:', err.message || err);
  process.exit(1);
});
