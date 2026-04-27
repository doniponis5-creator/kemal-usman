/**
 * orders collection API Rules ni tuzatish
 */

const PB_URL = "http://145.223.100.16:8090";
const ADMIN_EMAIL = "doniponis5@gmail.com";
const ADMIN_PASSWORD = "Doniyor123";

async function main() {
  // 1. Admin kirish
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const { token } = await authRes.json();
  const headers = { "Content-Type": "application/json", Authorization: token };
  console.log("✅ Admin kirdi\n");

  // 2. orders collectionni to'liq olish
  const colRes = await fetch(`${PB_URL}/api/collections/orders`, { headers });
  const col = await colRes.json();
  console.log("orders collection id:", col.id);

  // 3. To'liq collection objectini yuborish (rules null bilan)
  const updateBody = {
    ...col,
    listRule:   null,
    viewRule:   null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };

  const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(updateBody),
  });

  const result = await res.json();
  if (res.ok) {
    console.log("✅ orders API Rules muvaffaqiyatli ochildi!");
    console.log("  listRule:", result.listRule);
    console.log("  createRule:", result.createRule);
  } else {
    console.log("❌ Xato:", JSON.stringify(result, null, 2));

    // 4. Fallback: faqat rules bilan PATCH
    console.log("\nFallback usulini sinab ko'rmoqda...");
    const fallbackRes = await fetch(`${PB_URL}/api/collections/${col.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        listRule:   null,
        viewRule:   null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      }),
    });
    const fallbackResult = await fallbackRes.json();
    if (fallbackRes.ok) {
      console.log("✅ Fallback ishladi! orders ochiq.");
    } else {
      console.log("❌ Fallback ham ishlamadi:", JSON.stringify(fallbackResult, null, 2));
      console.log("\n📌 Qo'lda tuzatish: http://145.223.100.16:8090/_/ → orders → API Rules → barcha maydonlarni bo'shatib Save bosing");
    }
  }
}

main().catch(console.error);
