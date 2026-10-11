// Цвет флакона по фото: средний оттенок «цветных» пикселей (белый фон и почти
// серые пиксели не считаются). Нужен, чтобы фон баннера был в тон аромату:
// Tobacco Vanille — тёплый янтарь, Miss Dior — пудрово-розовый, прозрачный — нейтральный.
// Результат кешируется в localStorage (ku_tint_v1). Фото PocketBase отдаёт с CORS.
const KEY = 'ku_tint_v1';
const SIZE = 48;

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  return cache;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* приватный режим */ }
}

export function getTint(src) {
  return src ? load()[src] || null : null;
}

// { h, s } — оттенок 0…360 и насыщенность 0…1; null, если цвета во фото нет.
function measure(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const k = Math.min(1, SIZE / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let x = 0, y = 0, sw = 0, total = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 0.93 && min > 0.88) continue; // белый фон
    total++;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.18 || max < 0.12) continue; // серое и чёрное оттенка не дают
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    const rad = (hue * 60) * Math.PI / 180;
    x += Math.cos(rad) * sat; y += Math.sin(rad) * sat; sw += sat;
  }
  if (!total || sw / total < 0.06) return null; // почти бесцветный флакон
  let hue = Math.atan2(y, x) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  return { h: Math.round(hue), s: Math.min(1, +(Math.hypot(x, y) / sw).toFixed(2)) };
}

// Загружает фото (из кеша браузера) и вызывает done(tint или null).
export function loadTint(src, done) {
  if (!src) { done(null); return; }
  const known = load()[src];
  if (known !== undefined) { done(known); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    let t;
    try { t = measure(img); } catch { t = null; }
    load()[src] = t;
    save();
    done(t);
  };
  img.onerror = () => done(null);
  img.src = src;
}
