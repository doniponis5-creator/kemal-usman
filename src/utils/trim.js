// Где на фото сам флакон: рамка вокруг «не белых» пикселей в долях картинки
// {x, y, w, h}. Считается один раз на маленькой копии (до 96px), результат
// хранится в памяти и localStorage — повторно не считаем.
// Нужен CORS у сервера с фото (PocketBase отдаёт его); без него вернём null,
// и карточка покажет фото как раньше.
const KEY = 'ku_trim_v1';
const SIZE = 96;
const WHITE = 236; // ярче этого — фон (белый/почти белый фон JPEG)

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  return cache;
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const entries = Object.entries(cache);
      // Не даём кешу расти бесконечно: оставляем последние 600 фото.
      const trimmed = entries.length > 600 ? Object.fromEntries(entries.slice(-600)) : cache;
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch { /* память переполнена — посчитаем снова в следующий раз */ }
  }, 400);
}

export function getTrim(src) {
  return src ? load()[src] || null : null;
}

export function measureTrim(img) {
  const src = img?.currentSrc || img?.src;
  if (!src) return null;
  const known = getTrim(src);
  if (known) return known;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  try {
    const k = Math.min(1, SIZE / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 16) continue;
        if (d[i] > WHITE && d[i + 1] > WHITE && d[i + 2] > WHITE) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    // Пустое фото или флакон и так во весь кадр — подгонять нечего.
    const res = x1 < 0 ? null : { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
    load()[src] = res || { x: 0, y: 0, w: 1, h: 1 };
    save();
    return load()[src];
  } catch {
    return null; // CORS не дал прочитать пиксели
  }
}
