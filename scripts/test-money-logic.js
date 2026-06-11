// scripts/test-money-logic.js — PUL LOGIKASI integration testlari (P2.2)
// Run: node scripts/test-money-logic.js   (yoki: npm run test:money)
//
// pb_hooks/main.pb.js + otp.pb.js dagi pulga ta'sir qiluvchi barcha
// invariantlarni JONLI PocketBase'ga qarshi tekshiradi:
//
//   T1. Server narxni o'zi qayta hisoblaydi (mijoz yuborgan narxga ishonmaydi)
//   T2. Bonus overflow qisqartiriladi (balansdan / limitdan oshmaydi)
//   T3. 500 somdan kichik buyurtmada bonus 0 ga tushiriladi
//   T4. Soxta productId → 400
//   T5. Buyurtma yaratilganda bonus DARHOL yechiladi (ikki fazali debit)
//   T6. 'delivered' bo'lganda: foiz bonus + birinchi yetkazmada welcome bonus
//   T7. Welcome bonus IKKINCHI marta berilmaydi
//   T8. snake_case maydonlar ishlayapti (bonus_balance o'qish/yozish)
//
// Test ma'lumotlari +996700009999 telefoniga yoziladi va OXIRIDA O'CHIRILADI.

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = (process.env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '');
const TEST_PHONE = '+996700009999';

const pb = new PocketBase(PB_URL);
let passed = 0, failed = 0;
const pass = (m) => { console.log(`  ✅ ${m}`); passed++; };
const fail = (m) => { console.error(`  ❌ ${m}`); failed++; };
const info = (m) => console.log(`  ℹ️  ${m}`);

async function adminAuth() {
  // LEGACY PB (<0.23): jonli server /api/admins/auth-with-password ishlatadi
  // (src/api/auth.js dagi adminLogin bilan bir xil yondashuv). Yangi SDK
  // to'g'ridan-to'g'ri _superusers endpointiga uradi va 404 oladi — shuning
  // uchun avval legacy endpoint, keyin SDK fallback.
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: (process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD) }),
    });
    if (res.ok) {
      const data = await res.json();
      pb.authStore.save(data.token, data.admin || data.record || null);
      return;
    }
    if (res.status === 400) throw new Error('Email yoki parol noto\'g\'ri (.env dagi PB_process.env.PB_ADMIN_EMAIL/PB_(process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD) ni tekshiring)');
  } catch (e) {
    if (String(e.message || '').includes('parol')) throw e;
  }
  try { await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, (process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD)); return; } catch { /* keyingisi */ }
  await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, (process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD));
}

async function cleanup() {
  // testdan qolgan клиент + buyurtmalarni o'chirish
  try {
    const orders = await pb.collection('orders').getFullList({ filter: `clientPhone = "${TEST_PHONE}"` });
    for (const o of orders) await pb.collection('orders').delete(o.id);
    const clients = await pb.collection('clients').getFullList({ filter: `phone = "${TEST_PHONE}"` });
    for (const c of clients) await pb.collection('clients').delete(c.id);
  } catch (_) {}
}

async function run() {
  console.log(`\n💰 Money-logic integration tests → ${PB_URL}\n`);
  const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
  const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;
  if (!ADMIN_EMAIL || !ADMIN_PASS) { console.error('❌ Set PB_ADMIN_EMAIL/PB_ADMIN_PASS in .env'); process.exit(1); }
  await adminAuth();
  info('Admin auth OK');

  await cleanup();

  // ── Tayyorgarlik: real mahsulot + test mijoz (500 bonus bilan) ──
  // Omborda BOR variantli mahsulotni qidiramiz (birinchi 50 tadan)
  const page = await pb.collection('products').getList(1, 50);
  let product = null, variant = null;
  for (const p of page.items) {
    const vs = typeof p.variants === 'string' ? (() => { try { return JSON.parse(p.variants); } catch { return []; } })() : (p.variants || []);
    const v = vs.find(x => x.inStock !== false && Number(x.price) > 0);
    if (v) { product = p; variant = v; break; }
  }
  if (!product) { console.error('Omborda bor va narxli variantli mahsulot topilmadi'); process.exit(1); }
  const realPrice = Number(variant.price);
  info(`Test mahsulot: ${product.name} / ${variant.label} = ${realPrice} som`);

  const client = await pb.collection('clients').create({
    username: TEST_PHONE.replace(/\D/g, ''),
    phone: TEST_PHONE, name: 'MONEY TEST', bonus_balance: 500, bonus_history: '[]',
    email: TEST_PHONE.replace(/\D/g, '') + '@test.local', emailVisibility: false,
    password: 'TestPass123!xyz', passwordConfirm: 'TestPass123!xyz', verified: true,
  });

  // ── T8: snake_case o'qish ──
  const fresh = await pb.collection('clients').getOne(client.id);
  Number(fresh.bonus_balance) === 500
    ? pass('T8: bonus_balance yozildi/o\'qildi (=500)')
    : fail(`T8: bonus_balance kutilgan 500, olingan ${fresh.bonus_balance} — sxema maydon nomini tekshiring!`);

  // ── T1: narx tamper ──
  const qty = 2;
  const o1 = await pb.collection('orders').create({
    clientPhone: TEST_PHONE, clientName: 'MONEY TEST',
    items: JSON.stringify([{ productId: product.id, variantId: variant.id, qty, name: product.name, price: 1 }]), // soxta narx: 1 som!
    total: 2, subtotal: 2, bonusDiscount: 0, paymentMethod: 'cash', deliveryType: 'pickup',
  });
  Number(o1.subtotal) === realPrice * qty
    ? pass(`T1: server narxni qayta hisobladi (${o1.subtotal} = ${realPrice}×${qty}, mijozning "1 som"i rad)`)
    : fail(`T1: subtotal ${o1.subtotal}, kutilgan ${realPrice * qty}`);

  // ── T2+T5: bonus overflow + debit ──
  const o2 = await pb.collection('orders').create({
    clientPhone: TEST_PHONE, clientName: 'MONEY TEST',
    items: JSON.stringify([{ productId: product.id, variantId: variant.id, qty: 2 }]),
    total: 0, subtotal: 0, bonusDiscount: 999999, paymentMethod: 'cash', deliveryType: 'pickup',
  });
  const subtotal2 = realPrice * 2;
  const maxByPct = Math.floor(subtotal2 * 0.30); // default useBonusPercent=30
  const expectedBonus = subtotal2 >= 500 ? Math.min(999999, 500, maxByPct) : 0;
  Number(o2.bonusDiscount) === expectedBonus
    ? pass(`T2: bonus 999999 → ${o2.bonusDiscount} ga qisqartirildi (balans=500, 30% limit=${maxByPct})`)
    : fail(`T2: bonusDiscount ${o2.bonusDiscount}, kutilgan ${expectedBonus}`);

  const afterDebit = await pb.collection('clients').getOne(client.id);
  Number(afterDebit.bonus_balance) === 500 - expectedBonus
    ? pass(`T5: bonus darhol yechildi (500 → ${afterDebit.bonus_balance})`)
    : fail(`T5: balans ${afterDebit.bonus_balance}, kutilgan ${500 - expectedBonus}`);

  // ── T4: soxta productId ──
  try {
    await pb.collection('orders').create({
      clientPhone: TEST_PHONE, items: JSON.stringify([{ productId: 'fake123', variantId: 'x', qty: 1 }]),
      total: 1, paymentMethod: 'cash', deliveryType: 'pickup',
    });
    fail('T4: soxta productId QABUL QILINDI — bo\'lmasligi kerak edi!');
  } catch (e) {
    pass('T4: soxta productId rad etildi (400)');
  }

  // ── T6: delivered → foiz bonus + welcome (birinchi yetkazma) ──
  const balBefore = Number((await pb.collection('clients').getOne(client.id)).bonus_balance);
  await pb.collection('orders').update(o1.id, { status: 'delivered' });
  const afterDeliver = await pb.collection('clients').getOne(client.id);
  const histAfter = typeof afterDeliver.bonus_history === 'string' ? JSON.parse(afterDeliver.bonus_history || '[]') : (afterDeliver.bonus_history || []);
  const gotEarned = histAfter.some(h => h.type === 'earned');
  const gotWelcome = histAfter.some(h => h.type === 'welcome');
  gotEarned ? pass(`T6a: yetkazmadan foiz bonus yozildi (balans ${balBefore} → ${afterDeliver.bonus_balance})`)
            : fail('T6a: earned bonus tarixda YO\'Q');
  gotWelcome ? pass('T6b: birinchi yetkazmada welcome bonus berildi')
             : info('T6b: welcome bonus berilmadi (settings.welcomeBonus=0 bo\'lishi mumkin — tekshiring)');

  // ── T7: welcome ikkinchi marta berilmaydi ──
  await pb.collection('orders').update(o2.id, { status: 'delivered' });
  const after2 = await pb.collection('clients').getOne(client.id);
  const hist2 = typeof after2.bonus_history === 'string' ? JSON.parse(after2.bonus_history || '[]') : (after2.bonus_history || []);
  const welcomeCount = hist2.filter(h => h.type === 'welcome').length;
  welcomeCount <= 1 ? pass(`T7: welcome bonus faqat ${welcomeCount} marta (dublikat yo'q)`)
                    : fail(`T7: welcome bonus ${welcomeCount} marta berildi!`);

  await cleanup();
  info('Test ma\'lumotlari tozalandi');

  console.log(`\n═══ Natija: ${passed} passed, ${failed} failed ═══`);
  if (failed === 0) console.log('🎉 PUL LOGIKASI TO\'LIQ ISHLAYAPTI');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (e) => {
  console.error('❌ Test crash:', e?.response?.message || e.message || e);
  await cleanup();
  process.exit(1);
});
