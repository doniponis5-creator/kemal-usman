// Formatting & product field helpers — extracted from App.jsx (P2.1).

export function formatSum(n) { return Number(n).toLocaleString() + " сом"; }

// Language-aware product field reader. Falls back to RU (`name`/`desc`) if
// the KG variant isn't filled in. Keeps existing products with only `name`
// fully working — no PB schema migration needed.
export function pickName(p, lang) {
  if (!p) return "";
  if (lang === "kg" && p.name_kg && String(p.name_kg).trim()) return p.name_kg;
  return p.name || "";
}
export function pickDesc(p, lang) {
  if (!p) return "";
  if (lang === "kg" && p.desc_kg && String(p.desc_kg).trim()) return p.desc_kg;
  return p.desc || "";
}
export function generateReferralCode(name) {
  // Transliterate Cyrillic → Latin for clean referral codes
  const cyr = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  const lat = 'abvgdeejziiklmnoprstufhccsssiieua';
  const trans = (s) => s.split('').map(c => { const i = cyr.indexOf(c.toLowerCase()); return i >= 0 ? lat[i] : c; }).join('');
  const prefix = trans(name || 'USER').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'USER';
  return prefix + Math.floor(1000 + Math.random() * 9000);
}
