// Formatting & product field helpers — extracted from App.jsx (P2.1).

export function formatSum(n) { return Number(n).toLocaleString() + " сом"; }

// Robust order-date parser. order.date is historically saved as a ru-RU
// locale string ("11.06.2026, 14:23:45") which `new Date()` can NOT parse —
// it returns Invalid Date WITHOUT throwing, so try/catch never fires and
// the admin UI showed "Invalid Date" + "Сегодня: 0 заказов" stats.
// Accepts ru-RU strings, ISO strings and Date instances. Returns Date|null.
export function parseOrderDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

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
