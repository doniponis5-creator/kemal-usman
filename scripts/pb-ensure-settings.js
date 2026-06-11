// scripts/pb-ensure-settings.js
// Run: node scripts/pb-ensure-settings.js
//
// Jonli serverda `settings` kolleksiyasi YO'Q ekan (2026-06-10 da aniqlandi) —
// shuning uchun admin sozlamalari PB'ga saqlanmasdi va server hook'lari
// (bonus %, yetkazish) doim default qiymatlarda ishlardi.
//
// Bu skript: settings kolleksiyasini yaratadi (bo'lsa — yetishmagan
// maydonlarni qo'shadi), o'qish ochiq / yozish faqat admin qiladi,
// va bitta boshlang'ich yozuv yaratadi. Idempotent.

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = (process.env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASS) { console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env'); process.exit(1); }

const pb = new PocketBase(PB_URL);

const text = (name) => ({ name, type: 'text', required: false, options: { min: null, max: null, pattern: '' } });
const num  = (name) => ({ name, type: 'number', required: false, options: { min: null, max: null } });
const bool = (name) => ({ name, type: 'bool', required: false, options: {} });

// Ilova + hook'lar ishlatadigan BARCHA kalitlar (grep bilan yig'ilgan)
const FIELDS = [
  num('bonusPercent'), num('useBonusPercent'), num('welcomeBonus'), bool('welcomeBonusEnabled'),
  num('referralBonus'), num('referralFriendBonus'),
  num('deliveryCost'), num('minOrder'), num('freeDeliveryFrom'), num('minOrderForFreeDelivery'),
  text('whatsappPhone'), bool('onlinePaymentEnabled'),
  text('shopName'), text('shopAddress'), text('workingHours'), text('shopLat'), text('shopLng'), text('aboutText'),
  text('heroSubtitle'), text('heroTagline'), text('heroButtonText'), text('announcementTexts'),
  text('loginBrandName'), text('loginBrandTagline'),
  text('instagramUrl'), text('tiktokUrl'), text('youtubeUrl'), text('contactPhone'), text('supportPhone'),
  text('footerCompanyLinks'), text('footerHelpLinks'), text('copyrightText'),
];

async function adminAuth() {
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    if (res.ok) { const d = await res.json(); pb.authStore.save(d.token, d.admin || d.record || null); return; }
  } catch { /* keyingisi */ }
  try { await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS); return; } catch { /* keyingisi */ }
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
}

async function main() {
  console.log(`⚙️  settings kolleksiyasini ta'minlash — ${PB_URL}\n`);
  await adminAuth();
  console.log('✅ Admin auth OK');

  let col = null;
  try { col = await pb.collections.getOne('settings'); } catch { col = null; }

  if (!col) {
    console.log('➕ settings kolleksiyasi YO\'Q — yaratilmoqda...');
    col = await pb.collections.create({
      name: 'settings', type: 'base', schema: FIELDS,
      listRule: '', viewRule: '',          // o'qish hammaga (do'kon nomi, banner...)
      createRule: null, updateRule: null, deleteRule: null,  // yozish faqat admin
    });
    console.log('✅ Yaratildi');
  } else {
    const key = Array.isArray(col.schema) ? 'schema' : 'fields';
    const have = new Set((col[key] || []).map(f => f.name));
    const missing = FIELDS.filter(f => !have.has(f.name));
    if (missing.length) {
      console.log(`➕ Yetishmagan ${missing.length} maydon qo'shilmoqda: ${missing.map(f=>f.name).join(', ')}`);
      // PB 0.22: maydonlarni BITTALAB qo'shamiz — qaysi biri xato berishini aniq bilamiz
      for (const f of missing) {
        try {
          const fresh = await pb.collections.getOne('settings');
          await pb.collections.update(fresh.id, { [key]: [...fresh[key], f] });
          console.log(`   ✅ ${f.name}`);
        } catch (e) {
          console.log(`   ❌ ${f.name}: ${e?.response?.message || e.message}`);
        }
      }
    } else {
      console.log('✅ Barcha maydonlar mavjud');
    }
  }

  // Boshlang'ich yozuv
  const recs = await pb.collection('settings').getFullList({ requestKey: null });
  if (recs.length === 0) {
    await pb.collection('settings').create({
      bonusPercent: 5, useBonusPercent: 30, welcomeBonus: 150, welcomeBonusEnabled: true,
      referralBonus: 100, referralFriendBonus: 50,
      deliveryCost: 200, minOrder: 500, freeDeliveryFrom: 3000,
      shopName: 'Kemal Usman', onlinePaymentEnabled: true,
    });
    console.log('✅ Boshlang\'ich yozuv yaratildi (bonus 5%, yetkazish 200 som...)');
  } else {
    console.log(`✅ Yozuv mavjud (${recs.length} ta)`);
  }
  console.log('\n🎉 TAYYOR. Endi admin paneldagi sozlamalar serverga saqlanadi va');
  console.log('   hook\'lar (bonus/yetkazish) admin qiymatlarini o\'qiydi.');
}

main().catch(e => { console.error('❌ Failed:', e?.response?.message || e.message || e); process.exit(1); });
