// i18n core — extracted from App.jsx (P2.1 refactor, 2026-06-10).
// Single source of truth: strings-ru.json / strings-kg.json.
import { createContext, useContext } from "react";
import ruStrings from "./strings-ru.json";
import kgStrings from "./strings-kg.json";

// ─── i18n: yagona manba — src/i18n/strings-*.json (P1.6 unifikatsiya) ───
// Eski inline TRANSLATIONS obyekti (240 qator) JSON fayllarga ko'chirildi.
// i18next konfiguratsiyasi (src/i18n/index.js) ham AYNAN shu fayllarni o'qiydi,
// shuning uchun ikkala tizim endi bitta lug'atdan ishlaydi.
export const TRANSLATIONS = { ru: ruStrings, kg: kgStrings };

export const LangContext = createContext({ lang: "ru", setLang: () => { }, t: TRANSLATIONS.ru });
export function useLang() { return useContext(LangContext); }

// ─── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
