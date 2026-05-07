/**
 * Fragrantica dan to'g'ri rasm ID larini topib App.jsx ni yangilash
 * Ishlatish: node find-images.js
 */

const fs = require("fs");
const path = require("path");

const PRODUCTS = [
  { name: "Sauvage",           brand: "Christian-Dior",   search: "Dior Sauvage eau de toilette 2015" },
  { name: "Miss Dior",         brand: "Christian-Dior",   search: "Miss Dior eau de parfum 2021" },
  { name: "Bleu de Chanel",    brand: "Chanel",           search: "Bleu de Chanel eau de toilette" },
  { name: "N°5",               brand: "Chanel",           search: "Chanel No 5 eau de parfum" },
  { name: "Black Opium",       brand: "Yves-Saint-Laurent", search: "YSL Black Opium eau de parfum" },
  { name: "Y Eau de Parfum",   brand: "Yves-Saint-Laurent", search: "YSL Y eau de parfum men" },
  { name: "Eros",              brand: "Versace",          search: "Versace Eros eau de toilette" },
  { name: "Bright Crystal",    brand: "Versace",          search: "Versace Bright Crystal eau de toilette" },
  { name: "Acqua di Giò",      brand: "Giorgio-Armani",   search: "Acqua di Gio pour homme eau de toilette" },
  { name: "Sì",                brand: "Giorgio-Armani",   search: "Armani Si eau de parfum" },
  { name: "Light Blue",        brand: "Dolce-Gabbana",    search: "Dolce Gabbana Light Blue pour femme" },
  { name: "The One",           brand: "Dolce-Gabbana",    search: "Dolce Gabbana The One pour homme" },
  { name: "Boss Bottled",      brand: "Hugo-Boss",        search: "Hugo Boss Bottled eau de toilette" },
  { name: "Hugo Man",          brand: "Hugo-Boss",        search: "Hugo Boss Hugo Man eau de toilette" },
  { name: "CK One",            brand: "Calvin-Klein",     search: "Calvin Klein CK One eau de toilette" },
  { name: "Euphoria",          brand: "Calvin-Klein",     search: "Calvin Klein Euphoria pour femme" },
  { name: "My Burberry",       brand: "Burberry",         search: "My Burberry eau de parfum" },
  { name: "1 Million",         brand: "Paco-Rabanne",     search: "Paco Rabanne 1 Million eau de toilette" },
  { name: "Lady Million",      brand: "Paco-Rabanne",     search: "Paco Rabanne Lady Million eau de parfum" },
  { name: "Black Orchid",      brand: "Tom-Ford",         search: "Tom Ford Black Orchid eau de parfum" },
  { name: "Oud Wood",          brand: "Tom-Ford",         search: "Tom Ford Oud Wood eau de parfum" },
  { name: "Guilty",            brand: "Gucci",            search: "Gucci Guilty eau de toilette pour homme" },
  { name: "Bloom",             brand: "Gucci",            search: "Gucci Bloom eau de parfum" },
  { name: "L'Interdit",        brand: "Givenchy",         search: "Givenchy L Interdit eau de parfum 2018" },
  { name: "Gentleman",         brand: "Givenchy",         search: "Givenchy Gentleman eau de parfum 2017" },
  { name: "La Vie Est Belle",  brand: "Lancome",          search: "Lancome La Vie Est Belle eau de parfum" },
  { name: "Cool Water",        brand: "Davidoff",         search: "Davidoff Cool Water eau de toilette men" },
  { name: "Angel",             brand: "Thierry-Mugler",   search: "Mugler Angel eau de parfum" },
  { name: "Aventus",           brand: "Creed",            search: "Creed Aventus eau de parfum" },
  { name: "Baccarat Rouge 540","brand": "Maison-Francis-Kurkdjian", search: "Maison Francis Kurkdjian Baccarat Rouge 540" },
];

async function searchFragrantica(searchQuery) {
  try {
    const url = `https://www.fragrantica.com/search/?query=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
    });
    const html = await res.text();
    // Birinchi mahsulot linkini topish
    const match = html.match(/href="(\/perfume\/[^"]+?)"/);
    if (match) {
      const idMatch = match[1].match(/-(\d+)\.html/);
      if (idMatch) return idMatch[1];
    }
  } catch (e) {}
  return null;
}

async function checkImage(id) {
  try {
    const res = await fetch(`https://fimgs.net/mdimg/perfume/375x500.${id}.jpg`, { method: "HEAD" });
    return res.ok && res.status === 200;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log("🔍 Fragrantica dan rasm ID lari qidirilmoqda...\n");

  const result = {};

  for (const prod of PRODUCTS) {
    process.stdout.write(`  ⏳ "${prod.name}" ...`);
    const id = await searchFragrantica(prod.search);
    if (id) {
      const imgOk = await checkImage(id);
      if (imgOk) {
        result[prod.name] = `https://fimgs.net/mdimg/perfume/375x500.${id}.jpg`;
        console.log(` ✅ ID: ${id}`);
      } else {
        console.log(` ⚠️  ID: ${id} (rasm yo'q)`);
      }
    } else {
      console.log(` ❌ topilmadi`);
    }
    await new Promise(r => setTimeout(r, 800)); // Rate limiting
  }

  // FALLBACK_IMAGES ni App.jsx da yangilash
  const appPath = path.join(__dirname, "src", "App.jsx");
  let appContent = fs.readFileSync(appPath, "utf8");

  const newMap = Object.entries(result)
    .map(([name, url]) => `  "${name}": "${url}",`)
    .join("\n");

  const updated = appContent.replace(
    /\/\/ Fragrantica CDN fallback images[\s\S]*?^};/m,
    `// Fragrantica CDN fallback images (avtomatik yangilangan)\nconst FALLBACK_IMAGES = {\n${newMap}\n};`
  );

  if (updated !== appContent) {
    fs.writeFileSync(appPath, updated, "utf8");
    console.log(`\n✅ App.jsx yangilandi — ${Object.keys(result).length} ta rasm!`);
    console.log("Browserni yangilang — haqiqiy rasmlar chiqadi 🎉");
  } else {
    console.log("\n⚠️  App.jsx yangilanmadi. Natijalar:");
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
