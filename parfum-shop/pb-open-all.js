/**
 * Barcha 3 collection uchun API Rules ni "" (bo'sh = hammaga ochiq) qilib belgilash
 */

const PB_URL = "http://145.223.100.16:8090";
const ADMIN_EMAIL = "doniponis5@gmail.com";
const ADMIN_PASSWORD = "Doniyor123";

const OPEN_RULES = {
  listRule:   "",
  viewRule:   "",
  createRule: "",
  updateRule: "",
  deleteRule: "",
};

async function main() {
  // Admin kirish
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const authData = await authRes.json();
  if (!authData.token) { console.error("❌ Admin kirish xatosi", authData); return; }
  const headers = { "Content-Type": "application/json", Authorization: authData.token };
  console.log("✅ Admin kirdi\n");

  // Collectionlarni olish
  const colRes = await fetch(`${PB_URL}/api/collections?perPage=100`, { headers });
  const { items: cols } = await colRes.json();

  for (const name of ["products", "orders", "clients"]) {
    const col = cols.find(c => c.name === name);
    if (!col) { console.log(`⚠️  ${name} topilmadi`); continue; }

    // To'liq objectni olib, rules ni "" bilan almashtirish
    const fullRes = await fetch(`${PB_URL}/api/collections/${col.id}`, { headers });
    const full = await fullRes.json();

    const body = {
      ...full,
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    };
    // schema maydonini tozalash (PUT uchun kerak emas)
    delete body.id;
    delete body.created;
    delete body.updated;

    const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        listRule:   "",
        viewRule:   "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      }),
    });

    if (res.ok) {
      const r = await res.json();
      console.log(`✅ ${name} — listRule: "${r.listRule}", createRule: "${r.createRule}"`);
    } else {
      const err = await res.text();
      console.log(`❌ ${name} xato (${res.status}):`, err);

      // Ikkinchi urinish — faqat rules bilan PATCH (token bilan)
      console.log(`   Ikkinchi urinish...`);
      const res2 = await fetch(`${PB_URL}/api/collections/${col.id}`, {
        method: "PATCH",
        headers: { ...headers, "X-Token": authData.token },
        body: JSON.stringify(OPEN_RULES),
      });
      console.log(`   Status: ${res2.status}`, await res2.text());
    }
  }

  console.log("\n📋 Tekshirish (403 yo'q bo'lishi kerak):");
  for (const name of ["products", "orders", "clients"]) {
    const r = await fetch(`${PB_URL}/api/collections/${name}/records?perPage=1`);
    console.log(`  ${name}: HTTP ${r.status} ${r.status === 200 ? "✅ OCHIQ" : "❌ " + r.status}`);
  }
}

main().catch(console.error);
