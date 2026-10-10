// Избранное — список id ароматов в localStorage этого устройства.
// Один общий источник: карточки, страница аромата, вкладка и экран обновляются вместе.
import { useSyncExternalStore } from 'react';

const KEY = 'ku_favorites';
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch { return []; }
}

let ids = read();

function emit() { listeners.forEach(fn => fn()); }

export function toggleFavorite(id) {
  const k = String(id);
  ids = ids.includes(k) ? ids.filter(x => x !== k) : [k, ...ids];
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* память переполнена — оставляем только в сессии */ }
  emit();
  return ids.includes(k);
}

function subscribe(fn) {
  listeners.add(fn);
  // Другая вкладка браузера тоже могла поменять список.
  const onStorage = (e) => { if (e.key === KEY) { ids = read(); fn(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

export function useFavorites() {
  return useSyncExternalStore(subscribe, () => ids, () => ids);
}

export function useIsFavorite(id) {
  const list = useFavorites();
  return id != null && list.includes(String(id));
}
