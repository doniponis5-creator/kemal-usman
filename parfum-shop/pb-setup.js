/**
 * PocketBase avtomatik sozlash skripti
 * Ishlatish: node pb-setup.js
 *
 * ⚠️  AVVAL: ADMIN_EMAIL va ADMIN_PASSWORD ni o'zgartiring!
 */

const PB_URL = "http://145.223.100.16:8090";
const ADMIN_EMAIL = "doniponis5@gmail.com";    // ← o'z emailingizni yozing
const ADMIN_PASSWORD = "Doniyor123";      // ← o'z parolingizni yozing

async function main() {
  console.log("🚀 PocketBase sozlanmoqda...\n");

  // 1. Admin sifatida kirish
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!authRes.ok) {
    const err = await authRes.text();
    console.error("❌ Admin kirish xatosi:", err);
    console.log("\n⚠️  ADMIN_EMAIL va ADMIN_PASSWORD ni tekshiring!");
    process.exit(1);
  }
  const { token } = await authRes.json();
  console.log("✅ Admin sifatida kirildi\n");

  const headers = {
    "Content-Type": "application/json",
    Authorization: token,
  };

  // 2. Barcha collectionlarni olish
  const colRes = await fetch(`${PB_URL}/api/collections?perPage=100`, { headers });
  const colData = await colRes.json();
  const collections = colData.items || [];
  console.log(`📦 Topilgan collectionlar: ${collections.map(c => c.name).join(", ")}\n`);

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────
  const products = collections.find(c => c.name === "products");
  if (products) {
    console.log("🔧 products collection sozlanmoqda...");
    const productFields = [
      { name: "name", type: "text", required: true },
      { name: "brand", type: "text", required: false },
      { name: "category", type: "text", required: false },
      { name: "desc", type: "text", required: false },
      { name: "variants", type: "text", required: false },
      { name: "images", type: "file", required: false, options: { maxSelect: 10, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/webp"] } },
    ];
    await updateCollection(PB_URL, headers, products, productFields);
  } else {
    console.log("⚠️  products collection topilmadi! PocketBase da qo'lda yarating.");
  }

  // ─── ORDERS ─────────────────────────────────────────────────────────────────
  const orders = collections.find(c => c.name === "orders");
  if (orders) {
    console.log("🔧 orders collection sozlanmoqda...");
    const orderFields = [
      { name: "clientName", type: "text", required: false },
      { name: "clientPhone", type: "text", required: false },
      { name: "items", type: "text", required: false },
      { name: "date", type: "text", required: false },
      { name: "status", type: "text", required: false },
      { name: "total", type: "number", required: false },
      { name: "payMethod", type: "text", required: false },
      { name: "address", type: "text", required: false },
      { name: "comment", type: "text", required: false },
      { name: "bonusDiscount", type: "number", required: false },
    ];
    await updateCollection(PB_URL, headers, orders, orderFields);
  } else {
    console.log("⚠️  orders collection topilmadi!");
  }

  // ─── CLIENTS ────────────────────────────────────────────────────────────────
  const clients = collections.find(c => c.name === "clients");
  if (clients) {
    console.log("🔧 clients collection sozlanmoqda...");
    const clientFields = [
      { name: "phone", type: "text", required: false },
      { name: "name", type: "text", required: false },
      { name: "date", type: "text", required: false },
    ];
    await updateCollection(PB_URL, headers, clients, clientFields);
  } else {
    console.log("⚠️  clients collection topilmadi!");
  }

  // ─── API RULES (hammaga ochiq) ───────────────────────────────────────────────
  console.log("\n🔓 API Rules ochilmoqda (barcha collectionlar)...");
  for (const col of [products, orders, clients].filter(Boolean)) {
    const ruleRes = await fetch(`${PB_URL}/api/collections/${col.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      }),
    });
    if (ruleRes.ok) {
      console.log(`  ✅ ${col.name} — ochiq`);
    } else {
      const e = await ruleRes.text();
      console.log(`  ❌ ${col.name} rules xatosi:`, e);
    }
  }

  console.log("\n✅ ✅ ✅  PocketBase to'liq sozlandi!\n");
  console.log("Endi ilovangizni sinab ko'ring:");
  console.log("  cd parfum-shop && npm run dev\n");
}

async function updateCollection(PB_URL, headers, col, newFields) {
  // Mavjud fieldlarni olish
  const existingNames = (col.schema || []).map(f => f.name);

  // Faqat yo'q fieldlarni qo'shish
  const toAdd = newFields.filter(f => !existingNames.includes(f.name));
  if (toAdd.length === 0) {
    console.log(`  ✅ ${col.name} — barcha fieldlar mavjud`);
    return;
  }

  const updatedSchema = [...(col.schema || []), ...toAdd];
  const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ schema: updatedSchema }),
  });

  if (res.ok) {
    console.log(`  ✅ ${col.name} — ${toAdd.map(f => f.name).join(", ")} fieldlari qo'shildi`);
  } else {
    const e = await res.text();
    console.log(`  ❌ ${col.name} xatosi:`, e);
  }
}

main().catch(console.error);
