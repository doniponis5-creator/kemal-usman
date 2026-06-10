// Production i18n setup using i18next + react-i18next.
//
// UNIFIED (2026-06-10): the single source of truth is the flat dictionaries in
// strings-ru.json / strings-kg.json — the exact same files App.jsx's legacy
// LangContext (useLang) reads. There is no longer a second, nested key scheme.
//
// Usage in any component:
//   import { useTranslation } from 'react-i18next';
//   const { t, i18n } = useTranslation();
//   <span>{t('addToCart')}</span>
//   i18n.changeLanguage('kg');

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ru from './strings-ru.json';
import kg from './strings-kg.json';

export const SUPPORTED_LANGS = ['ru', 'kg'];
export const DEFAULT_LANG = 'ru';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru }, kg: { translation: kg } },
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGS,
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'parfum_lang',
    },
    returnNull: false,
  });

export default i18n;
