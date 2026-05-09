import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { createPortal } from "react-dom";
// FIX (CRITICAL): PB URL no longer hardcoded. Driven by VITE_PB_URL in .env so
// production builds can point at HTTPS. The fallback is local-dev only.
// See src/api/pb.js — it warns in console if PB_URL is not HTTPS in release.
import { pb, PB_URL, fileUrl, audioUrl } from "./api/pb";
// Real auth: OTP-based client login + PB admin login. Replaces the previous
// client-side password compare against `settings.adminPassword` (insecure —
// the password lived in the React bundle and any user could read it).
import {
  requestOtp,
  verifyOtp,
  adminLogin as adminLoginApi,
  logout as authLogout,
} from "./api/auth";
// WhatsApp notifications now go through the server-side PB hook
// (pb_hooks/whatsapp.pb.js). The green-api INSTANCE + TOKEN no longer
// exist in the client bundle / localStorage / network tab.
import { sendWhatsApp } from "./api/whatsapp";
// Dev-only logger + Sentry hooks. logger.* compiles down to noops in prod
// (terser strips them via pure_funcs in vite.config.js); captureError /
// setSentryUser / clearSentryUser are explicit error/identity reporters.
import logger from "./utils/logger";
import { captureError, setSentryUser, clearSentryUser } from "./utils/sentry";
import { useAudioPlayer } from "./api/audioPlayer";
import AudioPlayerOverlay from "./components/AudioPlayerOverlay";
import AudioHintTooltip, { shouldShowAudioHint } from "./components/AudioHintTooltip";
// FIX: Phone normalization util — fixes the "MyOrders shows 0 orders" bug
// where '+996 700 123 456' was compared against '996700123456'.
import { normalizePhone } from "./utils/phone";
// PRO: Native haptic feedback on cart / buttons (no-op on web).
import { haptic } from "./utils/haptics";
// PRO: screen transitions + button micro-animations
import { MotionScreen } from "./components/MotionScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
// PRO: shimmering placeholder while PocketBase loads
import { CatalogGridSkeleton } from "./components/Skeleton";
import { motion, AnimatePresence, animate as fmAnimate, useMotionValue, useTransform } from "framer-motion";

// Smoothly counts between previous and new value when `value` changes —
// used by the floating checkout bar's price label so it doesn't snap.
function AnimatedSum({ value, duration = 0.5 }) {
  const [display, setDisplay] = React.useState(value);
  const prevRef = React.useRef(value);
  React.useEffect(() => {
    const controls = fmAnimate(prevRef.current, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevRef.current = value;
    return () => controls.stop();
  }, [value, duration]);
  return <>{Number(display).toLocaleString()} сом</>;
}
// PRO: iOS-style edge swipe-to-dismiss for product detail
import { EdgeSwipeBack } from "./components/EdgeSwipeBack";
// PRO: Domino's-style live order tracker timeline
import { OrderTimeline } from "./components/OrderTimeline";
// PRO: animated empty states (cart empty / no orders)
import { EmptyState } from "./components/EmptyState";
// PRO: welcome bonus celebration modal with confetti
import { BonusCelebration } from "./components/BonusCelebration";
// PRO: count-up number animation
import { NumberCounter } from "./components/NumberCounter";
// PRO: iOS-style pull-to-refresh on catalog
import { PullToRefresh } from "./components/PullToRefresh";
// PRO: catalog sort bottom-sheet
import { SortFilterSheet } from "./components/SortFilterSheet";
// FIX: inline SVG bank logos — replaces /frame_4.png and /O bank.jpg which don't exist in /public.
import { MBankLogo, OBankLogo, CashLogo } from "./components/BankLogos";
// FIX: robust deep-link opener for M-Bank / O!Bank — uses Capacitor App.openUrl on native.
import { openPaymentApp, dialPhone, copyToClipboard } from "./utils/openPayment";
// PRO: premium iOS-style floating glass navbar with liquid bubble
import { GlassNavBar } from "./components/GlassNavBar";

// ─── TRANSLATIONS ──────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  ru: {
    appName: "Kemal Usman", appSubtitle: "Бишкек · Парфюм на разлив",
    login: "Войти", logout: "Выйти", loginLabel: "Логин", passwordLabel: "Пароль",
    loginPlaceholder: "user или admin", passwordPlaceholder: "Пароль",
    loginError: "Неверный логин или пароль!", demoHint: "Демо: admin / admin123",
    register: "Регистрация", getStarted: "Начать",
    catalog: "Каталог", cart: "Корзина", myOrders: "Заказы", profile: "Профиль",
    orders: "Заказы", products: "Товары", stats: "Статистика", settings: "Настройки",
    banners: "Баннеры", bonus: "Бонус", adminPanel: "Администратор",
    search: "Поиск парфюма...", allCategories: "Все",
    fromPrice: "от", variants: "вар.", selectVariant: "Выберите объём",
    addToCart: "В корзину", addedToCart: "Добавлено!", outOfStock: "Нет в наличии",
    inStock: "В наличии", available: "Есть",
    cart: "Корзина", cartEmpty: "Корзина пуста", cartEmptyHint: "Добавьте товары из каталога",
    subtotal: "Сумма", delivery: "Доставка", total: "Итого", free: "Бесплатно",
    placeOrder: "Оформить заказ", deliveryType: "Тип доставки", pickup: "Самовывоз",
    address: "Адрес доставки", comment: "Комментарий к заказу",
    paymentMethod: "Способ оплаты", useBonus: "Использовать бонусы",
    maxDiscount: "Макс. скидка", bonusDiscount: "Скидка бонусами",
    orderPlaced: "Заказ оформлен!", enterAddress: "Укажите адрес",
    name: "Имя", phone: "Телефон",
    bonusBalance: "Бонусный счёт", bonusHistory: "История",
    bonusEarned: "Начислено", bonusSpent: "Потрачено",
    earned: "Заработано", spent: "Потрачено",
    noBonusHistory: "История пуста", noOrders: "Заказов нет",
    myOrders: "Мои заказы", accountInfo: "Аккаунт",
    referralCode: "Реф. код", referralHint: "Поделитесь и получите бонус:",
    copy: "Копировать", copied: "Скопировано!",
    registrationDate: "Дата регистрации", guest: "Гость",
    totalRevenue: "Выручка", totalOrders: "Заказов", newOrders: "Новых",
    avgOrder: "Средний чек", ordersByStatus: "По статусам", topProducts: "Топ товары",
    pcs: "шт.", allOrders: "Все",
    changeStatus: "Изменить статус", sendWhatsApp: "Написать в WhatsApp",
    client: "Клиент", date: "Дата",
    add: "Добавить", save: "Сохранить", delete: "Удалить", confirmDelete: "Удалить товар?",
    newProduct: "Новый товар", productName: "Название", brand: "Бренд",
    description: "Описание", addVariant: "Добавить вариант",
    variantLabel: "Объём / название", price: "Цена", outOfStock2: "Нет",
    editBanner: "Редактировать баннер", bannerTitle: "Заголовок",
    bannerSubtitle: "Подзаголовок", background: "Фон", active: "Активен",
    noTitle: "Без названия",
    images: "Изображения",
    image: "Изображение",
    selectCover: "Выберите обложку",
    maxImages: "Макс. 3 изображения",
    cover: "Обложка",
    setCover: "Сделать обложкой",
    nameRequired: "Введите название",
    brandRequired: "Введите бренд",
    imageRequired: "Добавьте хотя бы 1 изображение",
    bonusSettings: "Настройки бонусов", bonusPercent: "% начисления",
    useBonusPercent: "% списания", welcomeBonus: "Приветственный бонус",
    referralBonus: "Бонус рефереру", referralFriendBonus: "Бонус другу",
    deliveryCost: "Стоимость доставки", minOrderForFreeDelivery: "Мин. заказ (бесплат.)",
    welcomeBonusEnabled: "Включить приветственный бонус",
    welcomeBonusOnlyFirst: "Только первый заказ",
    saveSettings: "Сохранить", shopName: "Название магазина",
    adminPassword: "Пароль администратора", whatsappPhone: "WhatsApp номер",
    bonusAccrued: "бонусов начислено", welcomeAdmin: "Добро пожаловать!",
    wrongPassword: "Неверный пароль", fillAll: "Заполните все поля",
    sum: "сом", newStatus: "Новый",
    status_new: "Новый", status_confirmed: "Подтверждён",
    status_preparing: "Готовится", status_delivering: "Доставляется",
    status_delivered: "Доставлен", status_cancelled: "Отменён",
    orderCount: "заказов", totalSpent: "потрачено",
    variantsCount: "вариантов", chooseSize: "Выберите размер",
    visits: "Посещений", registeredCount: "Зарегистрировано",
    todayOrders: "Заказов сегодня", todayRevenue: "Доход сегодня",
    last7days: "Последние 7 дней", recentUsers: "Новые клиенты",
    deleteOrder: "Удалить заказ", confirmDeleteOrder: "Удалить этот заказ?",
    listenAroma: "Послушай аромат", aromaDesc: "Описание аромата",
    listenBtn: "Слушать", playingAroma: "Воспроизведение...",
    pausedAroma: "Пауза", tapToContinue: "Нажмите для продолжения", continueBtn: "Продолжить",
    // ── Feature 3 keys ─────────────────────────────────────────────────
    hint_audio: "🎵 Послушай аромат парфюма!",
    listen_scent: "Послушать аромат",
    popular: "🔥 Популярно",
    audio_file: "Аудио аромата",
    is_popular: "Популярный",
  },
  kg: {
    appName: "Kemal Usman", appSubtitle: "Бишкек · Атир куюп жана упаковка",
    login: "Кирүү", logout: "Чыгуу", loginLabel: "Логин", passwordLabel: "Сыр сөз",
    loginPlaceholder: "user же admin", passwordPlaceholder: "Сыр сөз",
    loginError: "Логин же сыр сөз туура эмес!", demoHint: "Демо: admin / admin123",
    register: "Катталуу", getStarted: "Баштоо",
    catalog: "Каталог", myOrders: "Заказдар", profile: "Профиль",
    orders: "Заказдар", products: "Товарлар", stats: "Статистика", settings: "Жөндөөлөр",
    banners: "Баннерлер", bonus: "Бонус", adminPanel: "Администратор",
    search: "Атир издөө...", allCategories: "Баары",
    fromPrice: "баштап", variants: "вар.", selectVariant: "Көлөмдү тандаңыз",
    addToCart: "Себетке", addedToCart: "Кошулду!", outOfStock: "Жок",
    inStock: "Барда", available: "Бар",
    cart: "Себет", cartEmpty: "Себет бош", cartEmptyHint: "Каталогдон товар кошуңуз",
    subtotal: "Сумма", delivery: "Жеткирүү", total: "Жыйынтык", free: "Акысыз",
    placeOrder: "Заказ берүү", deliveryType: "Жеткирүү түрү", pickup: "Өзү алуу",
    address: "Жеткирүү дареги", comment: "Комментарий",
    paymentMethod: "Төлөм ыкмасы", useBonus: "Бонус колдонуу",
    maxDiscount: "Макс. арзандатуу", bonusDiscount: "Бонус арзандатуусу",
    orderPlaced: "Заказ берилди!", enterAddress: "Даректи жазыңыз",
    name: "Аты-жөнү", phone: "Телефон",
    bonusBalance: "Бонус балансы", bonusHistory: "Тарых",
    bonusEarned: "Эсептелди", bonusSpent: "Жумшалды",
    earned: "Жыйылды", spent: "Жумшалды",
    noBonusHistory: "Тарых бош", noOrders: "Заказдар жок",
    myOrders: "Заказдарым", accountInfo: "Аккаунт",
    referralCode: "Реф. код", referralHint: "Бөлүшүп бонус алыңыз:",
    copy: "Көчүрүү", copied: "Көчүрүлдү!",
    registrationDate: "Катталган күнү", guest: "Конок",
    totalRevenue: "Киреше", totalOrders: "Заказдар", newOrders: "Жаңылар",
    avgOrder: "Орточо чек", ordersByStatus: "Статус боюнча", topProducts: "Топ товарлар",
    pcs: "дана", allOrders: "Баары",
    changeStatus: "Статус өзгөртүү", sendWhatsApp: "WhatsApp жазуу",
    client: "Кардар", date: "Күнү",
    add: "Кошуу", save: "Сактоо", delete: "Өчүрүү", confirmDelete: "Өчүрүлсүнбү?",
    newProduct: "Жаңы товар", productName: "Аты", brand: "Бренд",
    description: "Сүрөттөмө", addVariant: "Вариант кошуу",
    variantLabel: "Көлөм / аты", price: "Баасы", outOfStock2: "Жок",
    editBanner: "Баннер өзгөртүү", bannerTitle: "Башлык",
    bannerSubtitle: "Кичи башлык", background: "Фон", active: "Активдүү",
    noTitle: "Аталышы жок",
    images: "Сүрөттөр",
    image: "Сүрөт",
    selectCover: "Обложканы тандаңыз",
    maxImages: "Макс. 3 сүрөт",
    cover: "Обложка",
    setCover: "Обложка кылуу",
    nameRequired: "Аталышын жазыңыз",
    brandRequired: "Брендин жазыңыз",
    imageRequired: "Жок дегенде 1 сүрөт кошуңуз",
    bonusSettings: "Бонус жөндөөлөрү", bonusPercent: "% эсептөө",
    useBonusPercent: "% эсептен чыгаруу", welcomeBonus: "Кош келүү бонусу",
    referralBonus: "Реферерге бонус", referralFriendBonus: "Досуна бонус",
    deliveryCost: "Жеткирүү баасы", minOrderForFreeDelivery: "Мин. заказ (акысыз)",
    welcomeBonusEnabled: "Кош келүү бонусу",
    welcomeBonusOnlyFirst: "Биринчи заказ гана",
    saveSettings: "Сактоо", shopName: "Дүкөн аты",
    adminPassword: "Администратор сыр сөзү", whatsappPhone: "WhatsApp номери",
    bonusAccrued: "бонус эсептелди", welcomeAdmin: "Кош келиңиз!",
    wrongPassword: "Сыр сөз туура эмес", fillAll: "Бардык талааларды толтуруңуз",
    sum: "сом", newStatus: "Жаңы",
    status_new: "Жаңы", status_confirmed: "Ырасталды",
    status_preparing: "Даярдалууда", status_delivering: "Жеткирилүүдө",
    status_delivered: "Жеткирилди", status_cancelled: "Жокко чыгарылды",
    orderCount: "заказ", totalSpent: "жумшалды",
    variantsCount: "вариант", chooseSize: "Көлөм тандаңыз",
    visits: "Келүүлөр", registeredCount: "Катталгандар",
    todayOrders: "Бүгүнкү заказдар", todayRevenue: "Бүгүнкү киреше",
    last7days: "Акыркы 7 күн", recentUsers: "Жаңы кардарлар",
    deleteOrder: "Заказды өчүрүү", confirmDeleteOrder: "Бул заказды өчүрүлсүнбү?",
    listenAroma: "Жытын угуп көр", aromaDesc: "Аромат баяны",
    listenBtn: "Угуу", playingAroma: "Угулууда...",
    pausedAroma: "Токтотулду", tapToContinue: "Улантуу үчүн басыңыз", continueBtn: "Улантуу",
    // ── Feature 3 keys ─────────────────────────────────────────────────
    hint_audio: "🎵 Атирдын жытын уккула!",
    listen_scent: "Жытын ук",
    popular: "🔥 Популярдуу",
    audio_file: "Аудио жыт",
    is_popular: "Популярдуу",
  },
};

const LangContext = createContext({ lang: "ru", setLang: () => { }, t: TRANSLATIONS.ru });
function useLang() { return useContext(LangContext); }

// ─── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const T = {
  bg: "#F5F5F5",
  bgSecond: "#EEEEEE",
  white: "#FFFFFF",
  accent: "#111111",
  accentDark: "#000000",
  accentLight: "rgba(0,0,0,0.06)",
  accentPale: "rgba(0,0,0,0.04)",
  text: "#111111",
  textSecond: "#666666",
  textMuted: "#AAAAAA",
  border: "#EEEEEE",
  card: "#FFFFFF",
  // iOS premium depth — tight contact + soft ambient (y:8, blur:20, low opacity)
  shadow:   "0 1px 2px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.06)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.04)",
  shadowLg: "0 2px 4px rgba(0,0,0,0.05), 0 16px 32px rgba(0,0,0,0.10)",
  danger: "#E53935",
  success: "#43A047",
  bonus: "#FF6B00",
  referral: "#7C5CBF",
  navH: 64,
};

// Card helper
const card = (extra = {}) => ({
  background: T.card,
  borderRadius: 16,
  boxShadow: T.shadow,
  border: "none",
  ...extra,
});

const inputStyle = {
  background: "#F5F5F5",
  border: "none",
  borderRadius: 12,
  color: T.text,
  fontSize: 16,
  padding: "13px 16px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

const btnGreen = (extra = {}) => ({
  background: "#111111",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "15px 20px",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: -0.1,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  // iOS premium soft shadow — y:6, blur:16, low opacity
  boxShadow: "0 6px 16px rgba(17,17,17,0.18), 0 1px 3px rgba(0,0,0,0.08)",
  fontFamily: "inherit",
  transition: "transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.15s ease",
  ...extra,
});

const btnOutline = (extra = {}) => ({
  background: "transparent",
  color: T.accent,
  border: `1.5px solid ${T.accent}`,
  borderRadius: 14,
  padding: "13px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  ...extra,
});

// ─── ICONS (SVG) ───────────────────────────────────────────────────────────────
const IC = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  cart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>,
  orders: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
  profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
  chevron: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  gift: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" rx="1" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>,
  star: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>,
  lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  stats: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  settings: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  image: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  bell: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  drop: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></svg>,
  pkg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
  filter: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="18" x2="12" y2="18" /></svg>,
  bottle: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v2l2 3v12a2 2 0 01-2 2H9a2 2 0 01-2-2V8l2-3V3z" /><line x1="7" y1="11" x2="17" y2="11" /></svg>,
};

// ─── DATA ──────────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: "mbank", label: "M Bank", color: "#E4002B" },
  { id: "obank", label: "O!Bank", color: "#7B2D8B" },
  { id: "cash", label: "Наличные / Нак. акча", color: "#111111" },
];

const BG_PRESETS = [
  "linear-gradient(135deg,#111111,#000000)",
  "linear-gradient(135deg,#3B82F6,#1D4ED8)",
  "linear-gradient(135deg,#F59E0B,#D97706)",
  "linear-gradient(135deg,#EF4444,#B91C1C)",
  "linear-gradient(135deg,#8B5CF6,#6D28D9)",
  "linear-gradient(135deg,#EC4899,#BE185D)",
  "linear-gradient(135deg,#06B6D4,#0E7490)",
  "linear-gradient(135deg,#111111,#111111)",
];

// ─── POCKETBASE API ────────────────────────────────────────────────────────────
const api = {
  // Products
  getProducts: () => pb.collection("products").getFullList({ sort: "created", requestKey: null }),
  createProduct: (data) => pb.collection("products").create(data, { requestKey: null }),
  updateProduct: (id, data) => pb.collection("products").update(id, data, { requestKey: null }),
  deleteProduct: (id) => pb.collection("products").delete(id, { requestKey: null }),
  // FIX (CRITICAL): use env-driven PB_URL — was hardcoded HTTP, would break on HTTPS migration.
  getImageUrl: (record, filename) => `${PB_URL}/api/files/products/${record.id}/${filename}`,

  // Orders
  getOrders: () => pb.collection("orders").getFullList({ sort: "-created", requestKey: null }),
  createOrder: (data) => pb.collection("orders").create(data, { requestKey: null }),
  updateOrder: (id, data) => pb.collection("orders").update(id, data, { requestKey: null }),
  deleteOrder: (id) => pb.collection("orders").delete(id, { requestKey: null }),

  // Clients
  getClients: () => pb.collection("clients").getFullList({ sort: "-created", requestKey: null }),
  createClient: (data) => pb.collection("clients").create(data, { requestKey: null }),
  updateClient: (id, data) => pb.collection("clients").update(id, data, { requestKey: null }),
  // Reviews
  getReviews: () => pb.collection("reviews").getFullList({ sort: "-created", requestKey: null }),
  createReview: (data) => pb.collection("reviews").create(data, { requestKey: null }),
  updateReview: (id, data) => pb.collection("reviews").update(id, data, { requestKey: null }),
  deleteReview: (id) => pb.collection("reviews").delete(id, { requestKey: null }),

  // ─── Site Media (shared images — visible to ALL users) ─────────
  // Collection: site_media { key(text,unique), file(file) }
  // Used for: instagramScreen, instaStories, etc.
  getSiteMedia: async (key) => {
    try {
      const records = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      if (records.length > 0 && records[0].file) {
        return `${PB_URL}/api/files/site_media/${records[0].id}/${records[0].file}`;
      }
      return null;
    } catch { return null; }
  },
  uploadSiteMedia: async (key, file) => {
    try {
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      const formData = new FormData();
      formData.append("key", key);
      formData.append("file", file);
      if (existing.length > 0) {
        return await pb.collection("site_media").update(existing[0].id, formData, { requestKey: null });
      } else {
        return await pb.collection("site_media").create(formData, { requestKey: null });
      }
    } catch (e) { console.warn('uploadSiteMedia error:', e); return null; }
  },
  deleteSiteMedia: async (key) => {
    try {
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      if (existing.length > 0) await pb.collection("site_media").delete(existing[0].id, { requestKey: null });
    } catch { /* ignore */ }
  },

  // ─── Instagram Graph API ───────────────────────────────────────
  // Fetches recent media from Instagram Graph API using long-lived token.
  // Token must be set in settings.instagramToken by admin.
  // Endpoint: GET /me/media?fields=...&access_token=TOKEN
  // Also fetches profile info from /me?fields=...
  getInstagramProfile: async (token) => {
    if (!token) return null;
    try {
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG profile fetch failed');
      return await res.json();
    } catch (e) { console.warn('Instagram profile error:', e); return null; }
  },

  getInstagramPosts: async (token, limit = 12) => {
    if (!token) return [];
    try {
      const res = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG fetch failed');
      const data = await res.json();
      return (data.data || []).filter(
        m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM'
      );
    } catch (e) { console.warn('Instagram posts error:', e); return []; }
  },

  // Refresh long-lived token (valid 60 days, call every ~50 days)
  refreshInstagramToken: async (token) => {
    if (!token) return null;
    try {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG token refresh failed');
      const data = await res.json();
      return data.access_token || null;
    } catch (e) { console.warn('Instagram token refresh error:', e); return null; }
  },

  findClientByPhone: async (phone) => {
    try {
      const res = await pb.collection("clients").getFirstListItem(`phone="${phone}"`, { requestKey: null });
      return res;
    } catch { return null; }
  },
};

const DEFAULT_SETTINGS = {
  shopName: "Kemal Usman", whatsappPhone: "996557100505",
  contactPhone1: "+996551120009", contactPhone2: "+996557100505",
  // adminPassword removed — admin auth now goes through PocketBase
  // (`pb.admins.authWithPassword`). Manage credentials at /_/ on the PB host.
  bonusPercent: 5, useBonusPercent: 30,
  welcomeBonus: 150, welcomeBonusEnabled: true,
  referralBonus: 100, referralFriendBonus: 50,
  deliveryCost: 300, minOrderForFreeDelivery: 1000,
  loginBg: null,
  // Login screen branding
  loginBrandName: 'Kemal Usman',
  loginBrandTagline: 'Parfum',
  // Desktop hero
  heroSubtitle: 'Bishkek · Parfum na razliv',
  heroTagline: 'Оригинальные ароматы · Лучшие бренды',
  heroButtonText: 'ВЫБРАТЬ АРОМАТ',
  // Footer
  footerCompanyLinks: 'О нас\nДоставка и оплата\nВозврат товара\nКонтакты\nУсловия',
  footerHelpLinks: 'Как сделать заказ\nОтследить заказ\nFAQ',
  copyrightText: '© 2021–2026 Kemal Usman',
  // Social links
  instagramUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
};

// Fragrantica CDN fallback images (agar PocketBase da rasm bo'lmasa)
const FALLBACK_IMAGES = {
  "Sauvage":            "https://fimgs.net/mdimg/perfume/375x500.25921.jpg",
  "Miss Dior":          "https://fimgs.net/mdimg/perfume/375x500.22038.jpg",
  "Bleu de Chanel":     "https://fimgs.net/mdimg/perfume/375x500.17439.jpg",
  "N°5":                "https://fimgs.net/mdimg/perfume/375x500.1.jpg",
  "Black Opium":        "https://fimgs.net/mdimg/perfume/375x500.25426.jpg",
  "Y Eau de Parfum":    "https://fimgs.net/mdimg/perfume/375x500.48617.jpg",
  "Eros":               "https://fimgs.net/mdimg/perfume/375x500.22392.jpg",
  "Bright Crystal":     "https://fimgs.net/mdimg/perfume/375x500.7206.jpg",
  "Acqua di Giò":       "https://fimgs.net/mdimg/perfume/375x500.1174.jpg",
  "Sì":                 "https://fimgs.net/mdimg/perfume/375x500.24031.jpg",
  "Sì Passione":        "https://fimgs.net/mdimg/perfume/375x500.40523.jpg",
  "Light Blue":         "https://fimgs.net/mdimg/perfume/375x500.5676.jpg",
  "The One":            "https://fimgs.net/mdimg/perfume/375x500.4957.jpg",
  "Boss Bottled":       "https://fimgs.net/mdimg/perfume/375x500.2017.jpg",
  "Hugo Man":           "https://fimgs.net/mdimg/perfume/375x500.2020.jpg",
  "CK One":             "https://fimgs.net/mdimg/perfume/375x500.865.jpg",
  "Euphoria":           "https://fimgs.net/mdimg/perfume/375x500.3022.jpg",
  "My Burberry":        "https://fimgs.net/mdimg/perfume/375x500.23629.jpg",
  "1 Million":          "https://fimgs.net/mdimg/perfume/375x500.7361.jpg",
  "Lady Million":       "https://fimgs.net/mdimg/perfume/375x500.11604.jpg",
  "Black Orchid":       "https://fimgs.net/mdimg/perfume/375x500.3669.jpg",
  "Oud Wood":           "https://fimgs.net/mdimg/perfume/375x500.5071.jpg",
  "Guilty":             "https://fimgs.net/mdimg/perfume/375x500.11960.jpg",
  "Bloom":              "https://fimgs.net/mdimg/perfume/375x500.42268.jpg",
  "L'Interdit":         "https://fimgs.net/mdimg/perfume/375x500.49052.jpg",
  "Gentleman":          "https://fimgs.net/mdimg/perfume/375x500.45895.jpg",
  "La Vie Est Belle":   "https://fimgs.net/mdimg/perfume/375x500.17836.jpg",
  "Cool Water":         "https://fimgs.net/mdimg/perfume/375x500.801.jpg",
  "Angel":              "https://fimgs.net/mdimg/perfume/375x500.1135.jpg",
  "Aventus":            "https://fimgs.net/mdimg/perfume/375x500.19439.jpg",
  "Baccarat Rouge 540": "https://fimgs.net/mdimg/perfume/375x500.38088.jpg",
};

const INITIAL_PRODUCTS = [
  {
    id: 1, name: "Sauvage", brand: "Dior", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.25921.jpg",
    desc: "Свежий, дерзкий аромат с нотами бергамота из Калабрии, жасмина и амброксана. Дикий и благородный — как звёздная ночь в пустыне.",
    variants: [{ id: 1, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 2, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 3, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 301, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 2, name: "Miss Dior", brand: "Dior", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.22038.jpg",
    desc: "Нежный цветочный аромат с розой, пионом и белым мускусом. Воплощение женственности, изящества и искренней любви.",
    variants: [{ id: 4, label: "5 мл", price: 380, type: "ml", inStock: true }, { id: 5, label: "10 мл", price: 650, type: "ml", inStock: true }, { id: 6, label: "20 мл", price: 1200, type: "ml", inStock: true }, { id: 302, label: "Упаковка 50 мл", price: 2300, type: "pkg", inStock: true }],
  },
  {
    id: 3, name: "Bleu de Chanel", brand: "Chanel", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.17439.jpg",
    desc: "Древесный ароматический аромат с цитрусовыми нотами, ладаном и сандалом. Элегантный, уверенный, безвременный.",
    variants: [{ id: 7, label: "5 мл", price: 420, type: "ml", inStock: true }, { id: 8, label: "10 мл", price: 750, type: "ml", inStock: true }, { id: 9, label: "20 мл", price: 1350, type: "ml", inStock: true }, { id: 303, label: "Упаковка 50 мл", price: 2600, type: "pkg", inStock: true }],
  },
  {
    id: 4, name: "N°5", brand: "Chanel", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.1.jpg",
    desc: "Легендарный цветочный альдегидный аромат с розой, жасмином и ветивером. Символ роскоши и женственности с 1921 года.",
    variants: [{ id: 10, label: "5 мл", price: 450, type: "ml", inStock: true }, { id: 11, label: "10 мл", price: 800, type: "ml", inStock: true }, { id: 12, label: "20 мл", price: 1450, type: "ml", inStock: true }, { id: 304, label: "Упаковка 50 мл", price: 2800, type: "pkg", inStock: true }],
  },
  {
    id: 5, name: "Black Opium", brand: "YSL", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.25426.jpg",
    desc: "Соблазнительный кофейно-ванильный аромат с жасмином и белым чаем. Для смелых, уверенных и ярких женщин.",
    variants: [{ id: 13, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 14, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 15, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 305, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 6, name: "Y Eau de Parfum", brand: "YSL", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.48617.jpg",
    desc: "Мужественный аромат с яблоком, имбирём, шалфеем и амброксаном. Свежий, современный, уверенный в себе.",
    variants: [{ id: 16, label: "5 мл", price: 390, type: "ml", inStock: true }, { id: 17, label: "10 мл", price: 680, type: "ml", inStock: true }, { id: 18, label: "20 мл", price: 1250, type: "ml", inStock: true }, { id: 306, label: "Упаковка 60 мл", price: 2400, type: "pkg", inStock: true }],
  },
  {
    id: 7, name: "Eros", brand: "Versace", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.22392.jpg",
    desc: "Страстный восточный аромат с мятой, зелёным яблоком, ванилью и ветивером. Вдохновлён греческим богом любви.",
    variants: [{ id: 19, label: "5 мл", price: 320, type: "ml", inStock: true }, { id: 20, label: "10 мл", price: 560, type: "ml", inStock: true }, { id: 21, label: "20 мл", price: 1000, type: "ml", inStock: true }, { id: 307, label: "Упаковка 50 мл", price: 1950, type: "pkg", inStock: true }],
  },
  {
    id: 8, name: "Bright Crystal", brand: "Versace", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.7206.jpg",
    desc: "Нежный цветочный аромат с гранатом, нарциссом, магнолией и мускусом. Прозрачный как хрусталь, чистый как роса.",
    variants: [{ id: 22, label: "5 мл", price: 300, type: "ml", inStock: true }, { id: 23, label: "10 мл", price: 520, type: "ml", inStock: true }, { id: 24, label: "20 мл", price: 950, type: "ml", inStock: true }, { id: 308, label: "Упаковка 50 мл", price: 1850, type: "pkg", inStock: true }],
  },
  {
    id: 9, name: "Acqua di Giò", brand: "Armani", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.1174.jpg",
    desc: "Свежий морской аромат с бергамотом, персиком и нотами океана. Вдохновлён морем острова Пантеллерия.",
    variants: [{ id: 25, label: "5 мл", price: 340, type: "ml", inStock: true }, { id: 26, label: "10 мл", price: 590, type: "ml", inStock: true }, { id: 27, label: "20 мл", price: 1080, type: "ml", inStock: true }, { id: 309, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 10, name: "Sì", brand: "Armani", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.24031.jpg",
    desc: "Чувственный женственный аромат с чёрной смородиной, нероли, розой и ванилью. Современная элегантность.",
    variants: [{ id: 28, label: "5 мл", price: 370, type: "ml", inStock: true }, { id: 29, label: "10 мл", price: 640, type: "ml", inStock: true }, { id: 30, label: "20 мл", price: 1180, type: "ml", inStock: true }, { id: 310, label: "Упаковка 50 мл", price: 2250, type: "pkg", inStock: true }],
  },
  {
    id: 11, name: "Light Blue", brand: "Dolce&Gabbana", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.5676.jpg",
    desc: "Лёгкий свежий средиземноморский аромат с сицилийским лимоном, яблоком и бамбуком. Летнее настроение круглый год.",
    variants: [{ id: 31, label: "5 мл", price: 280, type: "ml", inStock: true }, { id: 32, label: "10 мл", price: 490, type: "ml", inStock: true }, { id: 33, label: "20 мл", price: 900, type: "ml", inStock: true }, { id: 311, label: "Упаковка 50 мл", price: 1750, type: "pkg", inStock: true }],
  },
  {
    id: 12, name: "The One", brand: "Dolce&Gabbana", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.4957.jpg",
    desc: "Восточный пряный аромат с табаком, имбирём, кардамоном и янтарём. Тёплый, обволакивающий, роскошный.",
    variants: [{ id: 34, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 35, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 36, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 312, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 13, name: "Boss Bottled", brand: "Hugo Boss", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.2017.jpg",
    desc: "Классический мужской аромат с яблоком, корицей, сандалом и кедром. Для уверенного, целеустремлённого мужчины.",
    variants: [{ id: 37, label: "5 мл", price: 290, type: "ml", inStock: true }, { id: 38, label: "10 мл", price: 500, type: "ml", inStock: true }, { id: 39, label: "20 мл", price: 920, type: "ml", inStock: true }, { id: 313, label: "Упаковка 50 мл", price: 1780, type: "pkg", inStock: true }],
  },
  {
    id: 14, name: "Hugo Man", brand: "Hugo Boss", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.801.jpg",
    desc: "Дерзкий свежий аромат с мятой, зелёным яблоком и кедром. Для свободного, современного и независимого.",
    variants: [{ id: 40, label: "5 мл", price: 260, type: "ml", inStock: true }, { id: 41, label: "10 мл", price: 450, type: "ml", inStock: true }, { id: 42, label: "20 мл", price: 830, type: "ml", inStock: true }, { id: 314, label: "Упаковка 40 мл", price: 1600, type: "pkg", inStock: true }],
  },
  {
    id: 15, name: "CK One", brand: "Calvin Klein", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.865.jpg",
    desc: "Культовый унисекс аромат с зелёным чаем, бергамотом, кардамоном и мускусом. Свежесть, свобода и единство.",
    variants: [{ id: 43, label: "5 мл", price: 240, type: "ml", inStock: true }, { id: 44, label: "10 мл", price: 420, type: "ml", inStock: true }, { id: 45, label: "20 мл", price: 780, type: "ml", inStock: true }, { id: 315, label: "Упаковка 100 мл", price: 2000, type: "pkg", inStock: true }],
  },
  {
    id: 16, name: "Euphoria", brand: "Calvin Klein", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.3022.jpg",
    desc: "Чувственный восточный аромат с гранатом, лотосом, чёрной орхидеей и красным деревом. Таинственный и соблазнительный.",
    variants: [{ id: 46, label: "5 мл", price: 310, type: "ml", inStock: true }, { id: 47, label: "10 мл", price: 540, type: "ml", inStock: true }, { id: 48, label: "20 мл", price: 980, type: "ml", inStock: true }, { id: 316, label: "Упаковка 50 мл", price: 1900, type: "pkg", inStock: true }],
  },
  {
    id: 17, name: "My Burberry", brand: "Burberry", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.23629.jpg",
    desc: "Цветочный аромат с нотами садовых цветов, персика, сладкого горошка и патчули. Вдохновлён лондонским садом после дождя.",
    variants: [{ id: 49, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 50, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 51, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 317, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 18, name: "1 Million", brand: "Paco Rabanne", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.7361.jpg",
    desc: "Пряный кожаный аромат с кровавым апельсином, розой, корицей и патчули. Роскошь, соблазн и уверенность.",
    variants: [{ id: 52, label: "5 мл", price: 330, type: "ml", inStock: true }, { id: 53, label: "10 мл", price: 580, type: "ml", inStock: true }, { id: 54, label: "20 мл", price: 1060, type: "ml", inStock: true }, { id: 318, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 19, name: "Lady Million", brand: "Paco Rabanne", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.11604.jpg",
    desc: "Роскошный цветочный аромат с нероли, жасмином, белой розой и мёдом. Для женщины, которая знает себе цену.",
    variants: [{ id: 55, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 56, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 57, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 319, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 20, name: "Black Orchid", brand: "Tom Ford", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.3669.jpg",
    desc: "Тёмный роскошный аромат с трюфелем, чёрной орхидеей, сандалом и ладаном. Таинственный, обольстительный, незабываемый.",
    variants: [{ id: 58, label: "5 мл", price: 700, type: "ml", inStock: true }, { id: 59, label: "10 мл", price: 1300, type: "ml", inStock: true }, { id: 60, label: "20 мл", price: 2400, type: "ml", inStock: true }, { id: 320, label: "Упаковка 50 мл", price: 5500, type: "pkg", inStock: true }],
  },
  {
    id: 21, name: "Oud Wood", brand: "Tom Ford", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.5071.jpg",
    desc: "Экзотический уд с розовым перцем, сандалом, кардамоном и ванилью. Согревающий восточный шедевр для ценителей.",
    variants: [{ id: 61, label: "5 мл", price: 800, type: "ml", inStock: true }, { id: 62, label: "10 мл", price: 1500, type: "ml", inStock: true }, { id: 63, label: "20 мл", price: 2800, type: "ml", inStock: true }, { id: 321, label: "Упаковка 50 мл", price: 6200, type: "pkg", inStock: true }],
  },
  {
    id: 22, name: "Guilty", brand: "Gucci", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.11960.jpg",
    desc: "Чувственный восточный аромат с лавандой, розовым перцем, геранью и амброй. Для тех, кто живёт по своим правилам.",
    variants: [{ id: 64, label: "5 мл", price: 380, type: "ml", inStock: true }, { id: 65, label: "10 мл", price: 660, type: "ml", inStock: true }, { id: 66, label: "20 мл", price: 1200, type: "ml", inStock: true }, { id: 322, label: "Упаковка 50 мл", price: 2300, type: "pkg", inStock: true }],
  },
  {
    id: 23, name: "Bloom", brand: "Gucci", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.42268.jpg",
    desc: "Белый цветочный аромат с жасмином, туберозой, нероли и ранункулюсом. Богатый, насыщенный, по-женски сильный.",
    variants: [{ id: 67, label: "5 мл", price: 400, type: "ml", inStock: true }, { id: 68, label: "10 мл", price: 700, type: "ml", inStock: true }, { id: 69, label: "20 мл", price: 1280, type: "ml", inStock: true }, { id: 323, label: "Упаковка 50 мл", price: 2450, type: "pkg", inStock: true }],
  },
  {
    id: 24, name: "L'Interdit", brand: "Givenchy", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.49052.jpg",
    desc: "Белый цветочный аромат с тёмным сердцем из ветивера, пачули и белых цветов. Запретный и невыразимо притягательный.",
    variants: [{ id: 70, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 71, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 72, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 324, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 25, name: "Gentleman", brand: "Givenchy", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.45895.jpg",
    desc: "Элегантный ирисово-ванильный аромат с виски, пачули и бергамотом. Для современного джентльмена с характером.",
    variants: [{ id: 73, label: "5 мл", price: 370, type: "ml", inStock: true }, { id: 74, label: "10 мл", price: 640, type: "ml", inStock: true }, { id: 75, label: "20 мл", price: 1180, type: "ml", inStock: true }, { id: 325, label: "Упаковка 60 мл", price: 2250, type: "pkg", inStock: true }],
  },
  {
    id: 26, name: "La Vie Est Belle", brand: "Lancôme", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.17836.jpg",
    desc: "Сладкий гурманский аромат с ирисом, жасмином, пралине и ванилью. Жизнь прекрасна — и этот аромат напоминает об этом.",
    variants: [{ id: 76, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 77, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 78, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 326, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 27, name: "Cool Water", brand: "Davidoff", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.801.jpg",
    desc: "Классический свежий морской аромат с мятой, лавандой, геранью и океанской солью. Культовый аромат с 1988 года.",
    variants: [{ id: 79, label: "5 мл", price: 220, type: "ml", inStock: true }, { id: 80, label: "10 мл", price: 380, type: "ml", inStock: true }, { id: 81, label: "20 мл", price: 700, type: "ml", inStock: true }, { id: 327, label: "Упаковка 75 мл", price: 1650, type: "pkg", inStock: true }],
  },
  {
    id: 28, name: "Angel", brand: "Mugler", category: "Женские",
    img: "https://fimgs.net/mdimg/perfume/375x500.1135.jpg",
    desc: "Сладкий гурманский аромат с хлопком, ванилью, шоколадом и пачули. Первый «съедобный» аромат, ставший иконой моды.",
    variants: [{ id: 82, label: "5 мл", price: 340, type: "ml", inStock: true }, { id: 83, label: "10 мл", price: 590, type: "ml", inStock: true }, { id: 84, label: "20 мл", price: 1080, type: "ml", inStock: true }, { id: 328, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 29, name: "Aventus", brand: "Creed", category: "Мужские",
    img: "https://fimgs.net/mdimg/perfume/375x500.19439.jpg",
    desc: "Фруктово-дымный аромат с ананасом, берёзой, розой и мускусом. Символ силы, успеха и роскоши для настоящих лидеров.",
    variants: [{ id: 85, label: "5 мл", price: 950, type: "ml", inStock: true }, { id: 86, label: "10 мл", price: 1800, type: "ml", inStock: true }, { id: 87, label: "20 мл", price: 3400, type: "ml", inStock: true }, { id: 329, label: "Упаковка 50 мл", price: 8500, type: "pkg", inStock: true }],
  },
  {
    id: 30, name: "Baccarat Rouge 540", brand: "Maison Francis Kurkdjian", category: "Унисекс",
    img: "https://fimgs.net/mdimg/perfume/375x500.38088.jpg",
    desc: "Культовый янтарно-цветочный аромат с жасмином, шафраном, амброксаном и берёзой. Для тех, кто ценит истинное совершенство.",
    variants: [{ id: 88, label: "5 мл", price: 1200, type: "ml", inStock: true }, { id: 89, label: "10 мл", price: 2200, type: "ml", inStock: true }, { id: 90, label: "20 мл", price: 4200, type: "ml", inStock: true }, { id: 330, label: "Упаковка 70 мл", price: 12000, type: "pkg", inStock: true }],
  },
];

const DEFAULT_BANNERS = [
  { id: 1, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner1.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 2, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner2.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 3, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner3.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
];

function formatSum(n) { return Number(n).toLocaleString() + " сом"; }

// Language-aware product field reader. Falls back to RU (`name`/`desc`) if
// the KG variant isn't filled in. Keeps existing products with only `name`
// fully working — no PB schema migration needed.
function pickName(p, lang) {
  if (!p) return "";
  if (lang === "kg" && p.name_kg && String(p.name_kg).trim()) return p.name_kg;
  return p.name || "";
}
function pickDesc(p, lang) {
  if (!p) return "";
  if (lang === "kg" && p.desc_kg && String(p.desc_kg).trim()) return p.desc_kg;
  return p.desc || "";
}
function generateReferralCode(name) { return (name.slice(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000)); }
// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  // PRO: spring entrance from above, soft scale + fade. Auto-dismisses via
  // parent setTimeout AND tap-to-dismiss so a stuck error can never be
  // permanent. maxWidth lets long backend messages wrap instead of going
  // off-screen.
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          onClick={onDismiss}
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 12px) + 12px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: toast.type === 'error' ? T.danger : "#111111",
            color: "#F5F5F5",
            padding: "12px 22px",
            borderRadius: 30,
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: -0.1,
            maxWidth: "min(86vw, 480px)",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            whiteSpace: "normal",
            wordBreak: "break-word",
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            cursor: 'pointer',
          }}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusChip({ status }) {
  const map = { new: { bg: "#FFF3E0", color: "#FF6B00", label: "Новый" }, confirmed: { bg: "#E3F2FD", color: "#1976D2", label: "Подтверждён" }, preparing: { bg: "#E8F5E9", color: "#388E3C", label: "Готовится" }, delivering: { bg: "#EDE7F6", color: "#7C5CBF", label: "Доставляется" }, delivered: { bg: "#E8F5E9", color: "#388E3C", label: "Доставлен" }, cancelled: { bg: "#FFEBEE", color: "#E53935", label: "Отменён" } };
  const s = map[status] || { bg: "rgba(0,0,0,0.08)", color: T.textSecond, label: status };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
}

function NavBar({ items, active, onSelect }) {
  // PRO: each tab tap fires a light haptic; the active indicator slides
  // between tabs via Framer Motion's layoutId magic.
  const handleSelect = (id) => {
    if (id !== active) haptic('light');
    onSelect(id);
  };
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", background: "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderTop: "0.5px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 1000, paddingTop: 8, paddingBottom: "env(safe-area-inset-bottom, 8px)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {items.map((item) => {
        const isActive = item.id === active;
        const isCenter = item.center;
        if (isCenter) return (
          <motion.button
            key={item.id}
            onClick={() => handleSelect(item.id)}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.18 }}
            style={{ width: 52, height: 52, borderRadius: "50%", background: "#111111", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", transform: "translateY(-12px)" }}>
            {React.cloneElement(item.icon, { style: { width: 24, height: 24 } })}
          </motion.button>
        );
        return (
          <motion.button
            key={item.id}
            onClick={() => handleSelect(item.id)}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.18 }}
            style={{ flex: 1, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: isActive ? "#111111" : T.textMuted, position: "relative", paddingBottom: 4, fontSize: 11 }}>
            <motion.div
              animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              style={{ position: "relative" }}
            >
              {React.cloneElement(item.icon, { style: { width: 22, height: 22 } })}
              {item.badge > 0 && (
                <motion.div
                  // PRO: re-animate on every count change → pops when an item is added.
                  key={item.badge}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: [0.4, 1.35, 1], opacity: 1 }}
                  transition={{ duration: 0.42, times: [0, 0.55, 1], ease: [0.32, 0.72, 0, 1] }}
                  style={{ position: "absolute", top: -4, right: -6, background: T.danger, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                  {item.badge}
                </motion.div>
              )}
            </motion.div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, transition: 'font-weight 0.15s' }}>{item.label}</span>
            {isActive && (
              <motion.div
                layoutId="navbar-indicator"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ position: "absolute", bottom: 0, width: 20, height: 3, background: T.accent, borderRadius: 2 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── IMAGE UPLOAD + CROP ───────────────────────────────────────────────────────
function CropModal({ src, onDone, onCancel }) {
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [scale, setScale] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  const [start, setStart] = React.useState({ x: 0, y: 0 });
  const canvasRef = React.useRef(null);
  const imgRef = React.useRef(new Image());
  const SIZE = 300;

  React.useEffect(() => {
    imgRef.current.onload = () => draw();
    imgRef.current.src = src;
  }, [src]);

  React.useEffect(() => { draw(); }, [pos, scale]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    if (!img.complete) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, pos.x, pos.y, w, h);
  };

  const onMouseDown = (e) => {
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStart({ x: clientX - pos.x, y: clientY - pos.y });
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPos({ x: clientX - start.x, y: clientY - start.y });
  };

  const onMouseUp = () => setDragging(false);

  const handleDone = () => {
    const canvas = canvasRef.current;
    onDone(canvas.toDataURL('image/jpeg', 0.95));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 4 }}>Обрезать фото</div>
        <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 16 }}>Перетащите фото на нужное место</div>
        <div style={{ position: 'relative', margin: '0 auto 16px', width: SIZE, height: SIZE, borderRadius: 14, overflow: 'hidden', cursor: 'grab', border: '2px solid #111', background: '#fff' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
            style={{ display: 'block', touchAction: 'none', background: '#fff' }}
          />
          {[[0, 0], [SIZE - 20, 0], [0, SIZE - 20], [SIZE - 20, SIZE - 20]].map(([x, y], i) => (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: 20, height: 20, borderTop: i < 2 ? '3px solid #111' : 'none', borderBottom: i >= 2 ? '3px solid #111' : 'none', borderLeft: i % 2 === 0 ? '3px solid #111' : 'none', borderRight: i % 2 !== 0 ? '3px solid #111' : 'none' }} />
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textAlign: 'center' }}>Масштаб</div>
          <input type="range" min={0.3} max={3} step={0.01} value={scale} onChange={e => setScale(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid #eee', background: '#f5f5f5', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#666' }}>Отмена</button>
          <button onClick={handleDone} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Готово ✓</button>
        </div>
      </div>
    </div>
  );
}

// ─── BANNER CROP MODAL — 1200×480 output for crisp desktop hero ───────────────
// Display: 320×128 (fits phone screen). Export: 1200×480 @ JPEG 0.93.
// Scale 3.75× on export so 1400px-wide hero stays sharp.
function BannerCropModal({ src, onDone, onCancel }) {
  const DISP_W = 320, DISP_H = 128; // display canvas (fits modal)
  const OUT_W  = 1200, OUT_H = 480; // export canvas (desktop-crisp)
  const SCALE  = OUT_W / DISP_W;    // 3.75

  const [pos, setPos]       = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom]     = React.useState(1);
  const [dragging, setDrag] = React.useState(false);
  const [start, setStart]   = React.useState({ x: 0, y: 0 });
  const canvasRef = React.useRef(null);
  const imgRef    = React.useRef(new Image());

  React.useEffect(() => {
    imgRef.current.crossOrigin = 'anonymous';
    imgRef.current.onload = () => {
      // Auto-fit: scale image so it fills the display canvas width
      const img = imgRef.current;
      const fit = Math.max(DISP_W / img.width, DISP_H / img.height);
      setZoom(fit);
      setPos({ x: (DISP_W - img.width * fit) / 2, y: (DISP_H - img.height * fit) / 2 });
      draw(fit, { x: (DISP_W - img.width * fit) / 2, y: (DISP_H - img.height * fit) / 2 });
    };
    imgRef.current.src = src;
  }, [src]);

  const draw = (z = zoom, p = pos) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current; if (!img.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, DISP_W, DISP_H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DISP_W, DISP_H);
    ctx.drawImage(img, p.x, p.y, img.width * z, img.height * z);
    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    [DISP_W/3, DISP_W*2/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,DISP_H); ctx.stroke(); });
    [DISP_H/3, DISP_H*2/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(DISP_W,y); ctx.stroke(); });
  };

  React.useEffect(() => { draw(); }, [pos, zoom]);

  const onDown = (e) => {
    setDrag(true);
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    setStart({ x: cx - pos.x, y: cy - pos.y });
  };
  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const np = { x: cx - start.x, y: cy - start.y };
    setPos(np); draw(zoom, np);
  };
  const onUp = () => setDrag(false);

  const handleDone = () => {
    // Render at full 1200×480 resolution
    const out = document.createElement('canvas');
    out.width = OUT_W; out.height = OUT_H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(imgRef.current, pos.x * SCALE, pos.y * SCALE, imgRef.current.width * zoom * SCALE, imgRef.current.height * zoom * SCALE);
    onDone(out.toDataURL('image/jpeg', 0.93));
  };

  // createPortal → renders directly into document.body, escaping any
  // CSS transform ancestor (Framer Motion) that would break position:fixed.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 99990,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#111', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 2 }}>
          Баннер (Десктоп)
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 14 }}>
          Перетащите · 1200×480px · Высокое качество
        </div>
        <div style={{ position: 'relative', margin: '0 auto 12px', width: DISP_W, height: DISP_H,
          borderRadius: 10, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab',
          border: '1px solid rgba(255,255,255,0.15)', touchAction: 'none', userSelect: 'none' }}>
          <canvas
            ref={canvasRef}
            width={DISP_W}
            height={DISP_H}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
            style={{ display: 'block', touchAction: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textAlign: 'center', letterSpacing: 1 }}>
            МАСШТАБ
          </div>
          <input type="range" min={0.1} max={4} step={0.01} value={zoom}
            onChange={e => { const z = Number(e.target.value); setZoom(z); draw(z, pos); }}
            style={{ width: '100%', accentColor: '#C9A84C' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
            Отмена
          </button>
          <button onClick={handleDone}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
              background: '#C9A84C', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#111' }}>
            Готово ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ImageUpload({ value, onChange }) {
  const [cropSrc, setCropSrc] = useState(null);
  const fileRef = useRef(null);
  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setCropSrc(ev.target.result);
    r.readAsDataURL(f);
  };
  return (
    <div>
      {cropSrc && <CropModal src={cropSrc} onDone={v => { onChange(v); setCropSrc(null); }} onCancel={() => setCropSrc(null)} />}
      <div onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 120, borderRadius: 16, border: `2px dashed ${value ? T.accent : T.border}`, background: value ? "transparent" : T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative" }}>
        {value
          ? <img src={value} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.textMuted }}>
            {React.cloneElement(IC.camera, { style: { width: 28, height: 28 } })}
            <span style={{ fontSize: 13 }}>Загрузить фото</span>
          </div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}

function MultiImageUpload({ images = [], coverImg, onImagesChange, onCoverChange }) {
  const { t } = useLang();
  const fileRef0 = useRef(null);
  const fileRef1 = useRef(null);
  const fileRef2 = useRef(null);
  const fileRefs = [fileRef0, fileRef1, fileRef2];
  const [cropSrc, setCropSrc] = useState(null);
  const [cropSlot, setCropSlot] = useState(null);

  const handleFile = (e, slotIndex) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setCropSrc(ev.target.result); setCropSlot(slotIndex); };
    r.readAsDataURL(f);
    e.target.value = '';
  };

  const handleCropDone = (croppedUrl) => {
    const newImages = [...images];
    newImages[cropSlot] = croppedUrl;
    onImagesChange(newImages);
    if (!coverImg) onCoverChange(croppedUrl);
    setCropSrc(null); setCropSlot(null);
  };

  const handleRemove = (slotIndex) => {
    const newImages = [...images];
    const removedUrl = newImages[slotIndex];
    newImages.splice(slotIndex, 1);
    onImagesChange(newImages);
    if (coverImg === removedUrl) {
      onCoverChange(newImages[0] || null);
    }
  };

  const slots = [0, 1, 2];

  return (
    <div>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => { setCropSrc(null); setCropSlot(null); }}
        />
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>
        {t.images} · {t.maxImages} · {t.selectCover}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {slots.map(i => {
          const imgUrl = images[i] || null;
          const isCover = !!(coverImg && coverImg === imgUrl);
          return (
            <div key={i} style={{ flex: 1, position: "relative" }}>
              <div
                onClick={() => { if (!imgUrl) fileRefs[i].current?.click(); }}
                style={{
                  width: "100%", height: 90, borderRadius: 14,
                  border: isCover ? `2.5px solid ${T.accent}` : `2px dashed ${imgUrl ? T.accent : T.border}`,
                  background: imgUrl ? "#fff" : T.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: imgUrl ? "default" : "pointer",
                  overflow: "hidden", position: "relative",
                  boxSizing: "border-box"
                }}
              >
                {imgUrl
                  ? <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
                  : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: T.textMuted }}>
                      {React.cloneElement(IC.camera, { style: { width: 22, height: 22 } })}
                      <span style={{ fontSize: 11 }}>{t.image} {i + 1}</span>
                    </div>
                }
                {isCover && (
                  <div style={{ position: "absolute", top: 5, left: 5, background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px" }}>
                    {t.cover}
                  </div>
                )}
              </div>

              {imgUrl && (
                <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                  {!isCover && (
                    <button
                      onClick={() => onCoverChange(imgUrl)}
                      style={{ flex: 1, fontSize: 10, padding: "4px 0", borderRadius: 7, border: `1px solid ${T.accent}`, background: T.accentLight, color: T.accent, fontWeight: 700, cursor: "pointer" }}
                    >
                      ✓ {t.cover}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(i)}
                    style={{ flex: isCover ? 1 : 0, width: isCover ? "auto" : 28, fontSize: 10, padding: "4px 0", borderRadius: 7, border: `1px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontWeight: 700, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => fileRefs[i].current?.click()}
                    style={{ flex: 0, width: 28, fontSize: 10, padding: "4px 0", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.textMuted, cursor: "pointer" }}
                  >
                    ↑
                  </button>
                </div>
              )}

              <input
                ref={fileRefs[i]}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => handleFile(e, i)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BANNER SLIDER ─────────────────────────────────────────────────────────────
function BannerSlider({ banners }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx(i => (i + 1) % banners.length), 3000);
    return () => clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[idx];
  return (
    <div style={{ margin: "0 16px", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", position: "relative", height: 160 }}>
      <div style={{ width: "100%", height: "100%", background: b.img ? "transparent" : b.bg, position: "relative" }}>
        {b.img && <img src={b.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center", background: b.img ? "rgba(0,0,0,0.35)" : "transparent" }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>АКЦИЯ</div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, lineHeight: 1.2, marginBottom: 8 }}>{b.title}</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{b.subtitle}</div>
        </div>
      </div>
      {banners.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 5 }}>
          {banners.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", transition: "width 0.3s", cursor: "pointer" }} />)}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, welcomeConfig = { enabled: false, amount: 0, expireDays: 0 }, onGuest, loginBg, showToast, desktopMode = false, loginBrandName, loginBrandTagline }) {
  const { lang, setLang, t } = useLang();
  const [phone, setPhone] = useState("+996");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [refCode, setRefCode] = useState("");
  const [showRefInput, setShowRefInput] = useState(false);
  // OTP step state — 'idle' shows phone+name, 'verify' shows the SMS code input.
  // The phone is locked once we've requested a code so the server-side rate
  // limit applies to the same number.
  const [otpStep, setOtpStep] = useState('idle');
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  // Resend cooldown — 60s after a successful request. Disables the resend
  // button so we don't spam the SMS provider (server enforces 5/hr too).
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  React.useEffect(() => {
    const scrollToInput = () => {
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    };
    window.addEventListener('keyboardDidShow', scrollToInput);
    window.addEventListener('keyboardWillShow', scrollToInput);
    document.addEventListener('focusin', scrollToInput);
    return () => {
      window.removeEventListener('keyboardDidShow', scrollToInput);
      window.removeEventListener('keyboardWillShow', scrollToInput);
      document.removeEventListener('focusin', scrollToInput);
    };
  }, []);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      const offsetFromBottom = window.innerHeight - viewport.height - viewport.offsetTop;
      const formEl = document.getElementById('login-form-container');
      if (formEl) {
        if (offsetFromBottom > 50) {
          formEl.style.transform = `translateY(-${offsetFromBottom * 0.5}px)`;
          formEl.style.transition = 'transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
          formEl.style.transform = 'translateY(0px)';
          formEl.style.transition = 'transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }
      }
    };
    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, []);

  const formatPhone = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 12);
    if (digits.length <= 3) return '+' + digits;
    if (digits.length <= 6) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3);
    if (digits.length <= 9) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
    return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6, 9) + ' ' + digits.slice(9, 12);
  };

  // Step 1 — phone + name → request SMS code via /api/custom/otp/request.
  // The server normalizes the phone, generates+stores a hashed 6-digit code
  // and dispatches it via the configured SMS provider (see pb_hooks/otp.pb.js).
  async function handleRequestOtp() {
    if (!phone || !name) { setErr(lang === "ru" ? "Заполните все поля" : "Бардык талааларды толтуруңуз"); return; }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 11) { setErr(lang === "ru" ? "Введите корректный номер" : "Туура номер жазыңыз"); return; }
    setErr("");
    setOtpLoading(true);
    try {
      await requestOtp(phone);
      setOtpStep('verify');
      setOtpCode("");
      setResendCooldown(60);
      showToast?.(lang === 'ru' ? 'Код отправлен по SMS' : 'Код SMS аркылуу жөнөтүлдү');
    } catch (e) {
      const msg = String(e?.message || '');
      // Server returns 429 too_many_requests when phone exceeds 5 reqs/hr.
      if (msg.includes('429') || msg.includes('too_many')) {
        setErr(lang === 'ru' ? 'Слишком много попыток, попробуйте позже' : 'Көп аракет, кийинчерээк аракет кылыңыз');
      } else {
        setErr(lang === 'ru' ? 'Ошибка отправки SMS' : 'SMS жөнөтүүдө ката');
      }
    } finally {
      setOtpLoading(false);
    }
  }

  // Step 2 — verify the 6-digit code → server returns a PB auth token + record.
  // auth.js `verifyOtp` already saves the token into pb.authStore + secureStorage.
  async function handleVerifyOtp() {
    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) { setErr(lang === "ru" ? "Введите код из SMS" : "SMS кодду жазыңыз"); return; }
    setErr("");
    setOtpLoading(true);
    try {
      const { record, isNewClient } = await verifyOtp({ phone, code, name, referredBy: refCode.trim().toUpperCase() || null });
      // Hand the verified record + isNewClient flag up to the parent.
      // pb.authStore is already populated by verifyOtp.
      onLogin({ phone, name, refCode: refCode.trim().toUpperCase(), record, isNewClient });
    } catch (e) {
      setErr(lang === 'ru' ? 'Неверный код' : 'Код туура эмес');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || otpLoading) return;
    await handleRequestOtp();
  }

  const setGuestMode = () => onGuest && onGuest();

  /* ── DESKTOP MODE — white-bg form only, no background/branding ── */
  if (desktopMode) {
    const inputDesktop = {
      width: '100%', padding: '13px 16px', fontSize: 15,
      background: '#F5F5F5', border: '1px solid #E5E5E5',
      borderRadius: 14, color: '#111', outline: 'none',
      boxSizing: 'border-box',
    };
    const labelDesktop = { fontSize: 10, color: '#888', marginBottom: 6, letterSpacing: 2, textTransform: 'uppercase' };
    return (
      <div style={{ width: '100%' }}>
        {/* Phone */}
        <div style={{ width: '100%', marginBottom: 12 }}>
          <div style={labelDesktop}>{lang === 'ru' ? 'НОМЕР ТЕЛЕФОНА' : 'ТЕЛЕФОН НОМЕРИ'}</div>
          <input
            type="tel" value={phone}
            onChange={e => { if (otpStep === 'idle') { setPhone(formatPhone(e.target.value)); setErr(''); } }}
            readOnly={otpStep !== 'idle'}
            placeholder="+996 700 123 456"
            style={{ ...inputDesktop, letterSpacing: 1, opacity: otpStep !== 'idle' ? 0.7 : 1 }}
          />
        </div>

        {otpStep === 'idle' ? (
          <>
            {/* Name */}
            <div style={{ width: '100%', marginBottom: 18 }}>
              <div style={labelDesktop}>{lang === 'ru' ? 'ВАШЕ ИМЯ' : 'АТЫҢЫЗ'}</div>
              <input
                type="text" value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                placeholder={lang === 'ru' ? 'Введите имя' : 'Атыңызды жазыңыз'}
                style={inputDesktop}
              />
            </div>

            {/* Referral */}
            <div style={{ width: '100%', marginBottom: 14 }}>
              <button onClick={() => setShowRefInput(p => !p)} style={{ background: 'none', border: 'none', color: '#AAA', fontSize: 12, cursor: 'pointer', padding: 0, letterSpacing: 0.5 }}>
                {lang === 'ru' ? 'Есть реферальный код? +' : 'Реферал код барбы? +'}
              </button>
              {showRefInput && (
                <input
                  type="text" value={refCode}
                  onChange={e => setRefCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder={lang === 'ru' ? 'Введите код (6 символов)' : 'Код жазыңыз (6 белги)'}
                  style={{ ...inputDesktop, marginTop: 8, letterSpacing: 2, textAlign: 'center' }}
                />
              )}
            </div>

            {err && (
              <div style={{ width: '100%', color: '#E53935', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#FFF5F5', borderRadius: 10, border: '1px solid #FFCDD2', textAlign: 'center', boxSizing: 'border-box' }}>{err}</div>
            )}

            <button onClick={handleRequestOtp} disabled={otpLoading} style={{
              width: '100%', padding: '15px',
              background: '#111', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              color: '#fff', cursor: otpLoading ? 'default' : 'pointer', letterSpacing: 2,
              marginBottom: 14, boxSizing: 'border-box',
              opacity: otpLoading ? 0.6 : 1,
            }}>
              {otpLoading ? (lang === 'ru' ? 'ОТПРАВКА…' : 'ЖӨНӨТҮҮ…') : (lang === 'ru' ? 'ПОЛУЧИТЬ КОД' : 'КОДДУ АЛУУ')}
            </button>
          </>
        ) : (
          <>
            {/* OTP code input */}
            <div style={{ width: '100%', marginBottom: 14 }}>
              <div style={labelDesktop}>{lang === 'ru' ? 'КОД ИЗ SMS' : 'SMS КОДУ'}</div>
              <input
                type="tel" inputMode="numeric" maxLength={6} value={otpCode}
                onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
                placeholder="••••••"
                autoFocus
                style={{ ...inputDesktop, fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
              />
            </div>

            {err && (
              <div style={{ width: '100%', color: '#E53935', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#FFF5F5', borderRadius: 10, border: '1px solid #FFCDD2', textAlign: 'center', boxSizing: 'border-box' }}>{err}</div>
            )}

            <button onClick={handleVerifyOtp} disabled={otpLoading} style={{
              width: '100%', padding: '15px',
              background: '#111', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              color: '#fff', cursor: otpLoading ? 'default' : 'pointer', letterSpacing: 2,
              marginBottom: 10, boxSizing: 'border-box',
              opacity: otpLoading ? 0.6 : 1,
            }}>
              {otpLoading ? (lang === 'ru' ? 'ПРОВЕРКА…' : 'ТЕКШЕРҮҮ…') : (lang === 'ru' ? 'ВОЙТИ' : 'КИРҮҮ')}
            </button>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button onClick={() => { setOtpStep('idle'); setOtpCode(''); setErr(''); }}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0, letterSpacing: 0.5 }}>
                {lang === 'ru' ? 'Изменить номер' : 'Номерди өзгөртүү'}
              </button>
              <button onClick={handleResendOtp} disabled={resendCooldown > 0 || otpLoading}
                style={{ background: 'none', border: 'none', color: resendCooldown > 0 ? '#CCC' : '#555', fontSize: 12, cursor: (resendCooldown > 0 || otpLoading) ? 'default' : 'pointer', padding: 0, letterSpacing: 0.5 }}>
                {resendCooldown > 0 ? (lang === 'ru' ? `Повторно через ${resendCooldown}с` : `${resendCooldown}с кийин кайра`) : (lang === 'ru' ? 'Отправить ещё раз' : 'Кайра жөнөтүү')}
              </button>
            </div>
          </>
        )}

        {/* Guest */}
        {onGuest && (
          <button onClick={setGuestMode} style={{ background: 'none', border: 'none', color: '#BBB', fontSize: 12, cursor: 'pointer', letterSpacing: 0.5, padding: 0 }}>
            {lang === 'ru' ? 'Войти как гость' : 'Мейман катары кирүү'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end"
    }}>
      {/* Full-screen background photo — PRO: Ken Burns slow zoom + pan */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <style>{`
          @keyframes kenBurns {
            0%   { transform: scale(1.06) translate(0, 0); }
            50%  { transform: scale(1.14) translate(-1.5%, -1%); }
            100% { transform: scale(1.06) translate(0, 0); }
          }
        `}</style>
        <img
          src={loginBg || "/login-bg.jpeg"}
          alt=""
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center top",
            animation: "kenBurns 22s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      </div>
      {/* Dark gradient overlay — top stop darkened so the transparent
          status bar (white text) stays readable over any photo region */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 14%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.97) 100%)"
      }} />

      {/* Lang toggle — sits just below the transparent status bar */}
      <div style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 44px) + 8px)",
        right: 20, zIndex: 10,
        display: "flex",
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 30, padding: 3,
        border: "1px solid rgba(255,255,255,0.25)"
      }}>
        {["ru", "kg"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: "5px 14px", borderRadius: 26, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
            background: lang === l ? "rgba(255,255,255,0.9)" : "transparent",
            color: lang === l ? "#111" : "rgba(255,255,255,0.7)",
            transition: "all 0.2s"
          }}>{l === "ru" ? "РУС" : "КЫР"}</button>
        ))}
      </div>

      {/* Form section — brand title now lives at the top of this block,
          directly above the phone input, so the whole login group reads as
          one balanced composition. The dark gradient overlay above (defined
          on the parent) handles legibility over the photo. */}
      <div id="login-form-container" style={{
        position: "relative", zIndex: 2,
        padding: "0 24px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        boxSizing: "border-box",
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        maxHeight: '100%'
      }}>

      {/* Branding — sits right above the inputs, centred */}
      <div style={{ width: "100%", textAlign: "center", marginBottom: 22 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "clamp(24px, 7vw, 28px)",
          color: "#f5f0e8",
          letterSpacing: 0.5,
          lineHeight: 1.2,
          textShadow: "0 2px 24px rgba(0,0,0,0.7)",
        }}>{loginBrandName || 'Kemal Usman'}</div>
        <div style={{
          width: 40, height: 1,
          background: "linear-gradient(90deg, transparent, #c9a96e, transparent)",
          margin: "10px auto 8px"
        }} />
        <div style={{
          fontSize: 12, color: "#c9a96e",
          letterSpacing: 4, textTransform: "uppercase",
          fontWeight: 500,
        }}>{loginBrandTagline || 'Parfum'}</div>
      </div>

      {/* Phone input — locked once OTP has been requested so the same number
          binds to the server-side rate limit & code lookup. */}
      <div style={{ width: "100%", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1.5 }}>
          {lang === "ru" ? "НОМЕР ТЕЛЕФОНА" : "ТЕЛЕФОН НОМЕРИ"}
        </div>
        <input
          className="login-input"
          type="tel" value={phone}
          onChange={e => { if (otpStep === 'idle') { setPhone(formatPhone(e.target.value)); setErr(""); } }}
          readOnly={otpStep !== 'idle'}
          placeholder="+996 700 123 456"
          style={{
            width: "100%", padding: "13px 16px", fontSize: 15,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 14, color: "#fff", outline: "none",
            letterSpacing: 1, boxSizing: "border-box",
            opacity: otpStep !== 'idle' ? 0.7 : 1,
          }}
        />
      </div>

      {otpStep === 'idle' ? (
        <>
          {/* Name input */}
          <div style={{ width: "100%", marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1.5 }}>
              {lang === "ru" ? "ВАШЕ ИМЯ" : "АТЫҢЫЗ"}
            </div>
            <input
              className="login-input"
              type="text" value={name} onChange={e => { setName(e.target.value); setErr(""); }}
              placeholder={lang === "ru" ? "Введите имя" : "Атыңызды жазыңыз"}
              style={{
                width: "100%", padding: "13px 16px", fontSize: 15,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14, color: "#fff", outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Referral code input */}
          <div style={{ width: "100%", marginBottom: 14 }}>
            <button onClick={() => setShowRefInput(p => !p)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", padding: 0, letterSpacing: 0.5 }}>
              {lang === "ru" ? "Есть реферальный код? +" : "Реферал код барбы? +"}
            </button>
            {showRefInput && (
              <input
                type="text" value={refCode}
                onChange={e => setRefCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder={lang === "ru" ? "Введите код (6 символов)" : "Код жазыңыз (6 белги)"}
                style={{ width: "100%", padding: "11px 16px", fontSize: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, color: "#fff", outline: "none", boxSizing: "border-box", marginTop: 8, letterSpacing: 2, textAlign: "center" }}
              />
            )}
          </div>

          {err && (
            <div style={{ width: "100%", color: "#ff7b7b", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(255,80,80,0.15)", borderRadius: 10, border: "1px solid rgba(255,80,80,0.3)", textAlign: "center", boxSizing: "border-box" }}>{err}</div>
          )}

          {/* Request-code button — disabled while in flight */}
          <button onClick={handleRequestOtp} disabled={otpLoading} style={{
            width: "100%", padding: "15px",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, fontSize: 14, fontWeight: 700,
            color: "#fff", cursor: otpLoading ? "default" : "pointer", letterSpacing: 2,
            marginBottom: 14, boxSizing: "border-box",
            opacity: otpLoading ? 0.6 : 1,
          }}>
            {otpLoading
              ? (lang === "ru" ? "ОТПРАВКА…" : "ЖӨНӨТҮҮ…")
              : (lang === "ru" ? "ПОЛУЧИТЬ КОД" : "КОДДУ АЛУУ")}
          </button>
        </>
      ) : (
        <>
          {/* SMS code input — large monospace, 6 digits, autoFocus */}
          <div style={{ width: "100%", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1.5 }}>
              {lang === "ru" ? "КОД ИЗ SMS" : "SMS КОДУ"}
            </div>
            <input
              className="login-input"
              type="tel" inputMode="numeric" maxLength={6} value={otpCode}
              onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(""); }}
              placeholder="••••••"
              autoFocus
              style={{
                width: "100%", padding: "13px 16px", fontSize: 22,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14, color: "#fff", outline: "none",
                letterSpacing: 8, textAlign: "center",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                boxSizing: "border-box",
              }}
            />
          </div>

          {err && (
            <div style={{ width: "100%", color: "#ff7b7b", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(255,80,80,0.15)", borderRadius: 10, border: "1px solid rgba(255,80,80,0.3)", textAlign: "center", boxSizing: "border-box" }}>{err}</div>
          )}

          {/* Verify button */}
          <button onClick={handleVerifyOtp} disabled={otpLoading} style={{
            width: "100%", padding: "15px",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, fontSize: 14, fontWeight: 700,
            color: "#fff", cursor: otpLoading ? "default" : "pointer", letterSpacing: 2,
            marginBottom: 10, boxSizing: "border-box",
            opacity: otpLoading ? 0.6 : 1,
          }}>
            {otpLoading
              ? (lang === "ru" ? "ПРОВЕРКА…" : "ТЕКШЕРҮҮ…")
              : (lang === "ru" ? "ВОЙТИ" : "КИРҮҮ")}
          </button>

          {/* Resend / change-number row */}
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button
              onClick={() => { setOtpStep('idle'); setOtpCode(""); setErr(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", padding: 0, letterSpacing: 0.5 }}
            >
              {lang === "ru" ? "Изменить номер" : "Номерди өзгөртүү"}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || otpLoading}
              style={{
                background: "none", border: "none",
                color: resendCooldown > 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                fontSize: 12,
                cursor: (resendCooldown > 0 || otpLoading) ? "default" : "pointer",
                padding: 0, letterSpacing: 0.5,
              }}
            >
              {resendCooldown > 0
                ? (lang === "ru" ? `Повторно через ${resendCooldown}с` : `${resendCooldown}с кийин кайра`)
                : (lang === "ru" ? "Отправить ещё раз" : "Кайра жөнөтүү")}
            </button>
          </div>
        </>
      )}

      {/* Guest mode */}
      {onGuest && (
        <button onClick={setGuestMode} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)",
          fontSize: 13, cursor: "pointer", letterSpacing: 0.5, padding: 0
        }}>
          {lang === "ru" ? "Войти как гость" : "Мейман катары кирүү"}
        </button>
      )}

      </div>{/* end glassmorphism form */}
    </div>
  );
}

// ─── Shared product helpers (used by ProductCard + CatalogScreen) ────────────
const productMinPrice = (p) => {
  const inStock = (p?.variants || []).filter(v => v.inStock).map(v => v.price);
  if (inStock.length === 0) return null;
  return Math.min(...inStock);
};
const productHasStock = (p) => (p?.variants || []).some(v => v.inStock);

// ─── SALE HELPERS ─────────────────────────────────────────────────────────────
// Returns { active, percent, remaining: {h,m,s}, progress (0-1) } or null
const getSaleInfo = (p) => {
  if (!p?.salePercent || !p?.saleEnd) return null;
  const pct = Number(p.salePercent);
  if (!pct || pct <= 0) return null;
  const end = new Date(p.saleEnd).getTime();
  const now = Date.now();
  if (now >= end) return null; // expired
  const start = p.saleStart ? new Date(p.saleStart).getTime() : (end - 86400000); // default: 24h campaign
  const total = end - start;
  const remaining = end - now;
  const progress = Math.max(0, Math.min(1, remaining / total));
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { active: true, percent: pct, remaining: { h, m, s }, progress, totalMs: remaining };
};

// Sale price calculator
const salePrice = (originalPrice, salePercent) => Math.round(originalPrice * (1 - salePercent / 100));

// Live countdown hook
function useSaleCountdown(product) {
  const [info, setInfo] = React.useState(() => getSaleInfo(product));
  React.useEffect(() => {
    if (!product?.salePercent || !product?.saleEnd) { setInfo(null); return; }
    const tick = () => setInfo(getSaleInfo(product));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [product?.salePercent, product?.saleEnd, product?.saleStart]);
  return info;
}

// Compact countdown badge for product cards (mobile + desktop)
function SaleCountdownBadge({ product }) {
  const sale = useSaleCountdown(product);
  if (!sale) return null;
  const pad = n => String(n).padStart(2, '0');
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={{
        position: 'absolute', top: 8, left: 8, right: 8,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 10, padding: '7px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF3B30', animation: 'salePulse 1.5s infinite' }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, textTransform: 'uppercase' }}>Акция</span>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[
          { val: pad(sale.remaining.h), label: 'ч' },
          { val: pad(sale.remaining.m), label: 'м' },
          { val: pad(sale.remaining.s), label: 'с' },
        ].map((t, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, lineHeight: 1, paddingTop: 2 }}>:</span>}
            <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: 5, padding: '2px 5px', minWidth: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: i === 2 ? '#FF3B30' : '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{t.val}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{t.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

// Time progress bar for bottom of card
function SaleProgressBar({ product }) {
  const sale = useSaleCountdown(product);
  if (!sale) return null;
  const label = sale.remaining.h > 0
    ? `${sale.remaining.h}ч ${sale.remaining.m}м осталось`
    : `${sale.remaining.m}м ${sale.remaining.s}с осталось`;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#FF3B30', fontWeight: 600 }}>−{sale.percent}%</span>
        <span style={{ fontSize: 10, color: '#999' }}>{label}</span>
      </div>
      <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sale.progress * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', background: sale.progress < 0.2 ? '#FF3B30' : 'linear-gradient(90deg, #FF3B30, #FF6B5E)', borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

// ─── ProductImage — single source of truth for image rendering ───────────────
// One component covers every product image surface in the app:
//
//   size="card"   → catalog grid + admin preview + admin list thumbnail
//                   180px, object-fit: cover (uniform crop, premium grid)
//   size="detail" → product modal hero + any future "fit to box" surface
//                   260px, object-fit: contain on light gray (no crop, full
//                   bottle visible end-to-end).
//
// Renders:
//   • <img> with onError that swaps in the neutral fallback
//   • a "no image" / "load failed" placeholder (bottle icon + label)
// Caller wraps with badges, gradients, parallax, swipe — anything overlay-style
// goes around this component, not inside.
function ProductImage({ src, size = "card", alt = "", lang: langProp }) {
  // Gracefully read lang from context but fall back to prop or 'ru' if a caller
  // renders this outside <LangContext> (e.g. a future static export).
  let langCtx = "ru";
  try { langCtx = useLang().lang; } catch { /* outside provider */ }
  const lang = langProp || langCtx;

  const isCard = size === "card";
  const containerStyle = {
    width: "100%",
    height: isCard ? 180 : 260,
    background: isCard ? "#FAFAFA" : "#F5F5F5",
    position: "relative",
    overflow: "hidden",
  };
  const imgStyle = {
    width: "100%",
    height: "100%",
    objectFit: isCard ? "cover" : "contain",
    display: "block",
  };

  return (
    <div style={containerStyle}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={imgStyle}
          onError={(e) => {
            // 404 / blocked / corrupt → reveal the fallback sibling.
            e.currentTarget.style.display = "none";
            const ph = e.currentTarget.parentElement?.querySelector("[data-img-fallback]");
            if (ph) ph.style.display = "flex";
          }}
        />
      ) : null}
      <div
        data-img-fallback
        style={{
          display: src ? "none" : "flex",
          position: "absolute", inset: 0,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: containerStyle.background,
        }}
      >
        {React.cloneElement(IC.bottle, { style: { width: isCard ? 44 : 56, height: isCard ? 44 : 56, color: "#D1D1D6" } })}
        <span style={{ fontSize: isCard ? 10 : 12, fontWeight: 500, color: "#AEAEB2", letterSpacing: 0.3 }}>
          {lang === 'kg' ? 'Сүрөт жок' : 'Нет фото'}
        </span>
      </div>
    </div>
  );
}

// ─── PRODUCT CARD — single source of truth used by both catalog and admin ────
// Admin preview passes `preview` to disable click + add-to-cart visuals so the
// admin sees the EXACT same card the client sees, edited live as form state
// changes. Image rendering is delegated to <ProductImage size="card" />.
function ProductCard({ p, onClick, preview = false, showAudioHint = false, onAudioHintDismiss }) {
  const { lang, t } = useLang();
  const stk = productHasStock(p);
  const minP = productMinPrice(p);
  const saleInfo = useSaleCountdown(p);
  const saleMinP = saleInfo && minP !== null ? salePrice(minP, saleInfo.percent) : null;
  // Tooltip is only meaningful when this card actually has audio.
  const audioForHint = audioUrl(p) || (typeof window !== 'undefined' && p?.id ? localStorage.getItem('parfum_audio_' + p.id) : null);
  const hintVisible = !preview && showAudioHint && !!audioForHint;
  return (
    <motion.div
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{ ...card({ borderRadius: 16, overflow: "hidden", cursor: onClick ? "pointer" : "default" }) }}
    >
      {/* Image area — delegates rendering to <ProductImage>. Overlays
          (gradient, badges, audio button, out-of-stock chip) sit on top
          of this wrapper, not inside the image component. */}
      <div style={{ position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
        <ProductImage src={p?.img || null} size="card" />
        {/* Bottom gradient overlay — premium read-on-photo look (only with image) */}
        {p?.img && (
          <div style={{
            position: "absolute", inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35))",
          }} />
        )}
        {!preview && <SaleCountdownBadge product={p} />}
        {saleInfo && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: '#FF3B30', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, zIndex: 4 }}>
            −{saleInfo.percent}%
          </div>
        )}
        {!stk && (
          <div style={{ position: "absolute", top: saleInfo ? 46 : 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3, backdropFilter: "blur(8px)" }}>
            {t.outOfStock}
          </div>
        )}
        {stk && !saleInfo && p?.isPopular === true && (
          <motion.div
            initial={{ opacity: 0, y: -3, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 460, damping: 28, delay: 0.05 }}
            style={{
              position: "absolute", top: 8, left: 8,
              display: "inline-flex", alignItems: "center", gap: 3,
              background: "linear-gradient(135deg, #FF6A00 0%, #FF3B30 100%)",
              color: "#fff",
              borderRadius: 20,
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.1,
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(255,59,48,0.25)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <span style={{ fontSize: 10, lineHeight: 1 }}>🔥</span>
            <span>{lang === 'kg' ? 'Популярдуу' : 'Популярно'}</span>
          </motion.div>
        )}
        {/* Audio preview overlay — only renders if product has recorded audio.
            In preview mode we skip it so the admin doesn't accidentally play
            the client-side preview while editing. */}
        {!preview && p?.id && <AudioPlayerOverlay product={p} />}
        <AudioHintTooltip
          visible={hintVisible}
          text={t.hint_audio}
          onDismiss={onAudioHintDismiss}
        />
      </div>
      {/* Content — brand · name · variant chips · price */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 400, lineHeight: 1 }}>
          {p?.brand || ""}
        </div>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.2 }}>
          {pickName(p, lang) || (lang === 'kg' ? 'Жаңы продукт' : 'Новый товар')}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(() => {
            const sizes = (p?.sizes || p?.variants || []).slice(0, 2);
            const extra = (p?.sizes || p?.variants || []).length - 2;
            return <>
              {sizes.map((v, idx) => (
                <span key={v.id || v.label || idx} style={{ fontSize: 10, padding: "3px 9px", background: T.accentPale, color: T.accent, borderRadius: 20, fontWeight: 500 }}>
                  {v.label}
                </span>
              ))}
              {extra > 0 && (
                <span style={{ fontSize: 11, color: T.textMuted, padding: "3px 9px", border: `1px solid ${T.border}`, borderRadius: 20 }}>+{extra}</span>
              )}
            </>;
          })()}
        </div>
        {!preview && <SaleProgressBar product={p} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ lineHeight: 1.1 }}>
            {minP !== null ? (
              saleMinP !== null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: '#FF3B30', fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>{t.fromPrice} {formatSum(saleMinP)}</span>
                  <span style={{ color: '#BBB', fontSize: 12, textDecoration: 'line-through' }}>{formatSum(minP)}</span>
                </div>
              ) : (
                <span style={{ color: "#111111", fontWeight: 600, fontSize: 16, letterSpacing: -0.3 }}>{t.fromPrice} {formatSum(minP)}</span>
              )
            ) : <span style={{ color: T.danger, fontSize: 11, fontWeight: 500 }}>{t.outOfStock}</span>}
          </div>
          <motion.div
            whileTap={!preview && stk ? { scale: 0.88 } : {}}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: stk ? "#111111" : T.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 20,
              boxShadow: stk ? "0 4px 10px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)" : "none",
              flexShrink: 0,
              opacity: preview ? 0.6 : 1,
            }}
          >
            {React.cloneElement(IC.plus, { style: { width: 16, height: 16 } })}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CATALOG SCREEN ────────────────────────────────────────────────────────────
function CatalogScreen({ products, addToCart, banners, showToast, onAdminLogin, onRefresh, setIsDetailOpen }) {
  const { lang, t } = useLang();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [detail, setDetail] = useState(null);
  const [selVariant, setSelVariant] = useState(null);
  // First-time audio hint — visible briefly after catalog mount, capped at 5
  // lifetime shows. Counter is incremented exactly once per mount inside
  // `shouldShowAudioHint()` so refreshes don't blow the budget.
  const [audioHintVisible, setAudioHintVisible] = React.useState(false);
  React.useEffect(() => {
    if (!shouldShowAudioHint()) return;
    const showTimer = setTimeout(() => setAudioHintVisible(true), 1500);
    return () => clearTimeout(showTimer);
  }, []);
  const [adminTap, setAdminTap] = React.useState(0);
  const [adminTapTimer, setAdminTapTimer] = React.useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const lastScrollYRef = useRef(0);
  const [imgIndex, setImgIndex] = useState(0);
  const [touchStartX, setTouchStartX] = React.useState(null);
  // Hero scroll animations — driven by framer-motion motion values so the
  // image transform runs on the compositor thread without forcing a React
  // re-render on every scroll tick.
  //   scrollMV   — current scrollTop of the detail scroll container.
  //   heroY      — parallax lift derived from scrollMV (0 → 400 maps to 0 → -80).
  //   heroScale  — pull-down zoom; manipulated directly by touch handlers
  //                because overscroll-behavior: none means scrollTop never
  //                goes negative, so we read the touch delta ourselves.
  const scrollMV  = useMotionValue(0);
  // Hero outer height grows from 320 → 440 across the first 200px of scroll —
  // reveals the image fully (cover crop is replaced by `objectFit: contain`,
  // so growing the box is what actually exposes more of the bottle).
  const heroHeight = useTransform(scrollMV, [0, 200], [320, 440], { clamp: true });
  const heroScale = useMotionValue(1);
  const touchStartYRef = useRef(0);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      const prev = lastScrollYRef.current;
      if (y < 40) setHeaderCollapsed(false);
      else if (y > prev + 8) setHeaderCollapsed(true);
      else if (y < prev - 8) setHeaderCollapsed(false);
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleSecretTap = () => {
    if (adminTapTimer) clearTimeout(adminTapTimer);
    const newCount = adminTap + 1;
    setAdminTap(newCount);
    if (newCount >= 5) {
      setAdminTap(0);
      onAdminLogin?.();
    } else {
      const timer = setTimeout(() => setAdminTap(0), 2000);
      setAdminTapTimer(timer);
    }
  };

  const cats = ["all", ...Array.from(new Set(products.map(p => p.category)))];
  // PRO: sort state + bottom-sheet
  const [sort, setSort] = useState('default');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  let filteredProducts = products.filter(p => {
    const matchCat = cat === "all" || p.category === cat;
    const q = search.toLowerCase();
    const matchSearch =
      (p.name || "").toLowerCase().includes(q) ||
      (p.name_kg || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
  // Apply sort
  const minPriceFor = (p) => {
    const inStock = (p.variants || []).filter(v => v.inStock).map(v => v.price);
    return inStock.length ? Math.min(...inStock) : Infinity;
  };
  if (sort === 'price_asc')  filteredProducts = [...filteredProducts].sort((a, b) => minPriceFor(a) - minPriceFor(b));
  if (sort === 'price_desc') filteredProducts = [...filteredProducts].sort((a, b) => minPriceFor(b) - minPriceFor(a));
  if (sort === 'name_asc')   filteredProducts = [...filteredProducts].sort((a, b) => (pickName(a, lang) || '').localeCompare(pickName(b, lang) || ''));
  if (sort === 'default') {
    // Default: featured first, then priority desc, then original order
    filteredProducts = [...filteredProducts].sort((a, b) => {
      const fa = a.featured ? 1 : 0;
      const fb = b.featured ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const pa = Number(a.priority) || 0;
      const pb = Number(b.priority) || 0;
      return pb - pa;
    });
  }

  const openDetail = (p) => { setDetail(p); setSelVariant(p.variants.find(v => v.inStock) || p.variants[0]); setImgIndex(0); setDescExpanded(false); scrollMV.set(0); heroScale.set(1); setIsDetailOpen?.(true); };

  // Manual scroll wiring for the detail body — React's synthetic onScroll
  // misses fires inside Capacitor's WKWebView momentum scroll, so attach
  // a native listener via ref + addEventListener. Effect re-runs every time
  // a different product opens so the listener rebinds to the fresh DOM node.
  const detailScrollRef = useRef(null);
  useEffect(() => {
    if (!detail) return;
    const el = detailScrollRef.current;
    if (!el) {
      // eslint-disable-next-line no-console
      logger.log("[detail] scroll ref is null — container hasn't mounted yet");
      return;
    }
    // eslint-disable-next-line no-console
    logger.log("[detail] attaching scroll listener", {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      isScrollable: el.scrollHeight > el.clientHeight,
    });
    const onScroll = () => {
      const y = el.scrollTop || 0;
      // Push to motion value — drives heroY without a React re-render.
      scrollMV.set(y);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [detail]);

  if (detail) {
    const allImages = (detail.images && detail.images.length > 0) ? detail.images : (detail.img ? [detail.img] : []);
    const dismiss = () => { setDetail(null); scrollMV.set(0); heroScale.set(1); setIsDetailOpen?.(false); };

    return (
      <EdgeSwipeBack onDismiss={dismiss}>

        {/* Back button — high-contrast dark glass, white arrow. Reads cleanly
            on any cover (light beige, dark photo, blurred backdrop). */}
        <motion.button
          onClick={dismiss}
          whileTap={{ scale: 0.86 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          style={{
            position: "absolute",
            top: 52,
            left: 16,
            zIndex: 10,
            width: 36, height: 36,
            borderRadius: 18,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "0.5px solid rgba(255,255,255,0.20)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            padding: 0,
          }}
        >
          {IC.back}
        </motion.button>

        {/* Scroll body — native scroll listener (see detailScrollRef effect).
            `flex: 1` claims the remaining EdgeSwipeBack height after the
            sticky CTA bar; `minHeight: 0` is the WebKit fix that lets flex
            items shrink below their content size so `overflowY: auto`
            actually engages instead of pushing the parent's height. */}
        <div
          ref={detailScrollRef}
          onTouchStart={(e) => {
            touchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            const el = detailScrollRef.current;
            // Only zoom when already at the very top — anywhere else this
            // is a normal scroll, not a pull-down gesture.
            if (!el || el.scrollTop > 0) return;
            const delta = e.touches[0].clientY - touchStartYRef.current;
            if (delta > 0) {
              const next = 1 + Math.min(delta * 0.0025, 0.18);
              heroScale.set(next);
            }
          }}
          onTouchEnd={() => {
            // Spring back. fmAnimate is framer-motion's imperative animate.
            fmAnimate(heroScale, 1, { type: "spring", stiffness: 400, damping: 30 });
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* ── Hero image — edge-to-edge, height-animated 320 → 440 on scroll
              so the bottle reveals fully without ever getting cropped. The
              foreground uses objectFit: contain so the entire product image
              is always visible inside the gray frame. ── */}
          <motion.div
            style={{
              position: "relative",
              width: "100%",
              height: heroHeight,
              backgroundColor: "#F4F4F6",
              overflow: "hidden",
            }}
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null || allImages.length <= 1) return;
              const diff = touchStartX - e.changedTouches[0].clientX;
              if (Math.abs(diff) > 40) {
                if (diff > 0) setImgIndex(i => (i + 1) % allImages.length);
                else setImgIndex(i => (i - 1 + allImages.length) % allImages.length);
              }
              setTouchStartX(null);
            }}
          >
            {allImages.length > 0 ? (
              <>
                {/* Blurred backdrop — same cover, scaled up + heavy blur,
                    dimmed slightly so the foreground image stays the focus.
                    Premium feel without an extra asset. */}
                <img
                  src={allImages[imgIndex]}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(36px) saturate(120%) brightness(1.04)",
                    transform: "scale(1.18)",
                    opacity: 0.55,
                    pointerEvents: "none",
                  }}
                />
                {/* Foreground product — full-bleed `objectFit: cover` fills
                    the hero box edge-to-edge. Tall portrait bottle photos
                    will be cropped top/bottom — accepted trade-off vs. the
                    gray letterbox on the sides that `contain` produces.
                    `scale` is the pull-down zoom from touch handlers. */}
                <motion.img
                  src={allImages[imgIndex]}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    zIndex: 1,
                    scale: heroScale,
                    transformOrigin: "center center",
                    willChange: "transform",
                  }}
                />
              </>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {React.cloneElement(IC.bottle, { style: { width: 72, height: 72, color: "#C7C7CC" } })}
              </div>
            )}

            {/* Carousel dots — positioned ABOVE the audio strip when audio is present
                (audioUrl returns null when no audio so dots fall back to bottom). */}
            {allImages.length > 1 && (
              <div style={{
                position: "absolute",
                bottom: audioUrl(detail) ? 56 : 12,
                left: 0, right: 0,
                display: "flex", justifyContent: "center", gap: 6,
                zIndex: 12,
              }}>
                {allImages.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setImgIndex(i)}
                    style={{
                      width: i === imgIndex ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === imgIndex ? "#111" : "rgba(0,0,0,0.30)",
                      transition: "width 0.25s",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}

          </motion.div>

          {/* Content card — overlaps hero by 24px, rounded top corners, white.
              Mount animation: fade + 24px slide-up over 350ms, 100ms delay so
              the hero settles first (matches the spec's iOS-style entrance). */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{
            background: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            marginTop: -24,
            padding: 24,
            paddingBottom: 28,
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            flex: 1,
          }}>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{detail.brand}</div>
              <div style={{ color: "#111", fontSize: 26, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5, marginBottom: pickDesc(detail, lang) ? 12 : 0 }}>{pickName(detail, lang)}</div>
              {pickDesc(detail, lang) && (
                <div>
                  <motion.div
                    animate={{ height: descExpanded ? "auto" : 44 }}
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    style={{
                      color: "#6b6b70",
                      fontSize: 14,
                      lineHeight: 1.55,
                      overflow: "hidden",
                      letterSpacing: -0.05,
                      WebkitMaskImage: descExpanded ? "none" : "linear-gradient(to bottom, #000 60%, transparent 100%)",
                      maskImage: descExpanded ? "none" : "linear-gradient(to bottom, #000 60%, transparent 100%)",
                    }}
                  >
                    {pickDesc(detail, lang)}
                  </motion.div>
                  <button
                    onClick={() => { haptic('light'); setDescExpanded(v => !v); }}
                    style={{
                      marginTop: 6,
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#111",
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: -0.1,
                      cursor: "pointer",
                    }}
                  >
                    {descExpanded
                      ? (lang === "ru" ? "Свернуть" : "Жыйыштыруу")
                      : (lang === "ru" ? "Показать ещё" : "Дагы көрсөтүү")}
                  </button>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: "#f0f0f0", marginBottom: 20 }} />

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#111", fontSize: 13, fontWeight: 700, letterSpacing: 0.2, marginBottom: 12 }}>{t.chooseSize}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 10 }}>
                {detail.variants.map((v, i) => {
                  const isSel = selVariant?.id === v.id;
                  // Stagger only the first 4 chips (200, 260, 320, 380ms);
                  // anything past that appears instantly so a long variant
                  // list doesn't drag the entrance out.
                  const staggered = i < 4;
                  return (
                    <motion.div
                      key={v.id}
                      initial={staggered ? { opacity: 0, y: 10 } : false}
                      animate={staggered ? { opacity: 1, y: 0 } : undefined}
                      transition={staggered ? { duration: 0.28, delay: 0.2 + i * 0.06, ease: [0.22, 1, 0.36, 1] } : undefined}
                    >
                      <motion.button
                        onClick={() => v.inStock && setSelVariant(v)}
                        whileTap={v.inStock ? { scale: 0.94 } : {}}
                        animate={{
                          scale: isSel ? 1.04 : 1,
                          backgroundColor: isSel ? "#111111" : "#fafafa",
                          borderColor: isSel ? "#111111" : "#ebebeb",
                          boxShadow: isSel
                            ? "0 6px 18px rgba(17,17,17,0.22), 0 1px 3px rgba(0,0,0,0.10)"
                            : "0 1px 2px rgba(0,0,0,0.03)",
                        }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        style={{
                          width: "100%",
                          padding: "13px 8px",
                          borderRadius: 14,
                          border: isSel ? "1.5px solid #111" : "1.5px solid #ebebeb",
                          cursor: v.inStock ? "pointer" : "default",
                          opacity: v.inStock ? 1 : 0.38,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? "#fff" : "#111", lineHeight: 1.2 }}>{v.label}</div>
                        <div style={{ fontSize: 12, color: isSel ? "rgba(255,255,255,0.65)" : "#999", marginTop: 4 }}>{formatSum(v.price)}</div>
                        {!v.inStock && <div style={{ fontSize: 10, color: T.danger, marginTop: 2 }}>{t.outOfStock}</div>}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <ClientAudioBtn product={detail} />

          </motion.div>
        </div>

        {/* CTA bar — raised from tab bar, premium glass, prominent price */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 32, delay: 0.06 }}
          style={{
            flexShrink: 0,
            padding: "16px 18px 0",
            paddingBottom: "calc(env(safe-area-inset-bottom, 34px) + 22px)",
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            borderTop: "0.5px solid rgba(0,0,0,0.06)",
            boxShadow: "0 -1px 24px rgba(0,0,0,0.04)",
          }}
        >
          {selVariant && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ color: "#9a9a9f", fontSize: 12, fontWeight: 500, letterSpacing: 0.2, textTransform: "uppercase" }}>{t.total}</div>
              <motion.div
                key={selVariant.id}
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                style={{ color: "#111", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1 }}
              >
                {formatSum(selVariant.price)}
              </motion.div>
            </div>
          )}
          <motion.button
            onClick={() => { if (!selVariant) return; haptic('medium'); addToCart(detail.id, selVariant.id); dismiss(); }}
            disabled={!selVariant?.inStock}
            whileTap={selVariant?.inStock ? { scale: 0.97 } : {}}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              ...btnGreen({ opacity: selVariant?.inStock ? 1 : 0.4, padding: "17px", borderRadius: 16, fontSize: 15, letterSpacing: 0.3 }),
              boxShadow: selVariant?.inStock
                ? "0 10px 28px rgba(17,17,17,0.26), 0 2px 8px rgba(0,0,0,0.10)"
                : "none",
            }}
          >
            {React.cloneElement(IC.cart, { style: { width: 18, height: 18, display: "inline", marginRight: 8 } })}
            {t.addToCart}
          </motion.button>
        </motion.div>

      </EdgeSwipeBack>
    );
  }

  // PRO: wrap the catalog in PullToRefresh; the wrapper IS the scroll container.
  // Bottom padding lets content scroll behind the floating Liquid Glass tab bar
  // without hiding the last items (--nav-height already accounts for safe area).
  const outerStyle = {
    background: T.bg,
    minHeight: "100vh",
    paddingBottom: "calc(var(--nav-height) + 24px)",
    WebkitOverflowScrolling: "touch",
  };
  const Outer = onRefresh ? PullToRefresh : 'div';
  const outerProps = onRefresh
    ? { onRefresh, style: outerStyle }
    : { style: outerStyle };
  return (
    <Outer {...outerProps}>
      {/* Sticky collapsing header */}
      <motion.div
        animate={{
          boxShadow: headerCollapsed
            ? "0 1px 12px rgba(0,0,0,0.10)"
            : "0 1px 0 rgba(0,0,0,0.04)",
        }}
        transition={{ duration: 0.2 }}
        style={{
          background: "#fff",
          paddingTop: "max(44px, env(safe-area-inset-top, 44px))",
          position: "sticky",
          top: 0,
          zIndex: 20,
          overflow: "hidden",
        }}
      >
        {/* Brand row — slides up & fades when scrolled down */}
        <AnimatePresence initial={false}>
          {!headerCollapsed && (
            <motion.div
              key="brand-row"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 56 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
              style={{ overflow: "hidden", display: "flex", alignItems: "center", padding: "6px 16px 10px" }}
            >
              <div>
                <div onClick={handleSecretTap} style={{ fontSize: 28, color: "#111", fontFamily: "'Playfair Display', 'Georgia', serif", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, letterSpacing: -0.5, cursor: "default", userSelect: "none" }}>Kemal Usman</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Search bar — always visible */}
        <motion.div
          animate={{ paddingTop: headerCollapsed ? 10 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          style={{ padding: "0 16px 10px" }}
        >
          <div style={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: 12, padding: "10px 14px", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" stroke="#aaa" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="#aaa" strokeWidth="2" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "ru" ? "Поиск парфюма..." : "Атыр издөө..."} style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, color: "#111", width: "100%", fontFamily: "inherit" }} />
            <AnimatePresence>
              {search && (
                <motion.button
                  key="clear"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", alignItems: "center", color: "#aaa", flexShrink: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
      {/* Banner */}
      {banners.length > 0 && <div style={{ marginTop: 14, marginBottom: 16 }}><BannerSlider banners={banners} /></div>}
      {/* Categories + sort button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
        <div className="no-scrollbar" style={{ flex: 1, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {cats.map(c => {
              const active = cat === c;
              return (
                <motion.button
                  key={c}
                  onClick={() => { haptic('light'); setCat(c); }}
                  whileTap={{ scale: 0.94 }}
                  animate={{
                    background: active ? "#111111" : 'rgba(0,0,0,0)',
                    color: active ? '#fff' : T.textSecond,
                    scale: active ? 1.04 : 1,
                    boxShadow: active
                      ? '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)'
                      : '0 0 0 rgba(0,0,0,0)',
                  }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                  style={{ padding: "6px 16px", minHeight: 36, borderRadius: 20, border: active ? "none" : "0.5px solid #EEEEEE", fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {c === "all" ? t.allCategories : c}
                </motion.button>
              );
            })}
          </div>
        </div>
        <motion.button
          onClick={() => { haptic('light'); setSortSheetOpen(true); }}
          whileTap={{ scale: 0.92 }}
          animate={{
            background: sort !== 'default' ? '#111' : '#FFFFFF',
            color: sort !== 'default' ? '#fff' : '#111',
            scale: sort !== 'default' ? 1.04 : 1,
            boxShadow: sort !== 'default'
              ? '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)'
              : '0 1px 3px rgba(0,0,0,0.04)',
          }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          aria-label={lang === 'kg' ? 'Иргөө' : 'Сортировка'}
          style={{
            width: 36, height: 36, borderRadius: 18,
            border: sort !== 'default' ? 'none' : '0.5px solid #EEE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
        </motion.button>
      </div>
      <SortFilterSheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        sort={sort}
        onSortChange={setSort}
        lang={lang}
      />
      {/* Products grid */}
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: 'center', padding: '60px 20px', color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSecond, marginBottom: 6 }}>Ничего не найдено</div>
            <div style={{ fontSize: 13 }}>Попробуйте изменить запрос</div>
          </div>
        )}
        {filteredProducts.map((p, idx) => {
          // PRO: subtle stagger fade-in (only first 12 cards staggered to avoid jank).
          const delay = idx < 12 ? idx * 0.035 : 0;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay, ease: [0.32, 0.72, 0, 1] }}
            >
              <ProductCard
                p={p}
                onClick={() => openDetail(p)}
                showAudioHint={idx === 0 && audioHintVisible}
                onAudioHintDismiss={() => setAudioHintVisible(false)}
              />
            </motion.div>
          );
        })}
      </div>
    </Outer>
  );
}
// ─── CART SCREEN ───────────────────────────────────────────────────────────────
function CartScreen({ cart, setCart, products, onOrder, bonusBalance, useBonusPercent, settings, showToast, goToCatalog }) {
  const { t, lang } = useLang();
  const [comment, setComment] = useState("");
  const [useBonus, setUseBonus] = useState(false);
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [address, setAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0].id);

  // Reverse-geocode current device location into a human-readable address.
  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const d = await r.json();
        setAddress(d.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    }, () => {}, { enableHighAccuracy: true });
  };

  const items = cart.map(ci => {
    const prod = products.find(p => String(p.id) === String(ci.productId));
    const variant = prod?.variants.find(v => String(v.id) === String(ci.variantId));
    if (prod && variant) return { ...ci, prod, variant };
    return {
      ...ci,
      prod: { id: ci.productId, name: ci.name || "Товар", brand: ci.brand || "", img: ci.img || null, variants: [] },
      variant: { id: ci.variantId, label: ci.variantLabel || "", price: ci.price || 0 },
    };
  });

  const subtotal = items.reduce((s, i) => s + i.variant.price * i.qty, 0);
  const _minFree = settings?.minOrderForFreeDelivery || 0;
  const deliveryCost = deliveryType === "delivery" ? (_minFree > 0 && subtotal >= _minFree ? 0 : (settings?.deliveryCost || 0)) : 0;
  const bonusDiscount = useBonus ? Math.min(bonusBalance, Math.floor(subtotal * (useBonusPercent / 100))) : 0;
  const total = subtotal + deliveryCost - bonusDiscount;

  const updateQty = (ci, d) => setCart(prev => { const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId ? { ...i, qty: Math.max(1, i.qty + d) } : i); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });
  const remove = (ci) => setCart(prev => { const next = prev.filter(i => !(i.productId === ci.productId && i.variantId === ci.variantId)); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });

  // The single floating checkout bar (in App.jsx) submits the order from the
  // cart screen via this window event. We mirror form state into a ref so the
  // listener never closes over stale values.
  const formRef = React.useRef(null);
  formRef.current = { comment, useBonus, deliveryType, address, payMethod, total, bonusDiscount, subtotal };
  React.useEffect(() => {
    const handler = () => onOrder?.(formRef.current);
    window.addEventListener('cart:checkout', handler);
    return () => window.removeEventListener('cart:checkout', handler);
  }, [onOrder]);

  if (!items.length) {
    // PRO: spring-animated empty state with iOS-style CTA
    return (
      <EmptyState
        icon={IC.cart}
        title={t.cartEmpty}
        hint={t.cartEmptyHint}
        action={goToCatalog && (
          <motion.button
            onClick={() => { haptic('light'); goToCatalog(); }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
            style={btnGreen({ width: 'auto', padding: '14px 28px' })}
          >
            {lang === 'kg' ? 'Каталогго өтүү' : 'Перейти в каталог'}
          </motion.button>
        )}
      />
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "calc(var(--nav-height) + 100px)" /* navbar + sticky checkout button + breathing room */ }}>
      <div style={{ padding: "52px 16px 12px", fontSize: 26, fontWeight: 800, color: "#111", background: "#f5f5f5" }}>{t.cart}</div>
      {/* Items — PRO: AnimatePresence makes adds spring in, removes swipe out */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={`${item.productId}-${item.variantId}`}
              layout
              initial={{ opacity: 0, x: -16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 120, scale: 0.85, transition: { duration: 0.22 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ ...card({ padding: "14px 16px" }), display: "flex", gap: 12, alignItems: "center" }}
            >
              <div style={{ width: 60, height: 60, borderRadius: 14, background: T.accentPale, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {item.prod.img ? <img src={item.prod.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : React.cloneElement(IC.bottle, { style: { width: 28, height: 28, color: T.accent, opacity: 0.5 } })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{item.prod.brand}</div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{item.prod.name}</div>
                <div style={{ color: T.accent, fontSize: 12, fontWeight: 600 }}>{item.variant.label}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <button onClick={() => remove(item)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2 }}>{IC.close}</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => updateQty(item, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer", fontSize: 16, fontWeight: 700, color: T.text }}>−</button>
                  <motion.span key={item.qty} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 22 }} style={{ fontWeight: 700, minWidth: 16, textAlign: "center", color: T.text, display: 'inline-block' }}>{item.qty}</motion.span>
                  <button onClick={() => updateQty(item, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.accent, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#fff" }}>+</button>
                </div>
                <motion.div key={item.variant.price * item.qty} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }} style={{ color: T.accent, fontWeight: 800, fontSize: 14 }}>{formatSum(item.variant.price * item.qty)}</motion.div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* Delivery — Apple Pay-style segmented control + address card */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.deliveryType}</div>

          {/* iOS segmented control — gray track, white active pill that slides */}
          <div
            style={{
              background: "#F2F2F7",
              borderRadius: 14,
              padding: 4,
              display: "flex",
              marginBottom: deliveryType === "delivery" ? 12 : 0,
            }}
          >
            {[{ id: "delivery", label: t.delivery }, { id: "pickup", label: t.pickup }].map(opt => {
              const active = deliveryType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { haptic('light'); setDeliveryType(opt.id); }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    minHeight: 32,
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="delivery-seg-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "#FFFFFF",
                        borderRadius: 10,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      fontWeight: 600,
                      fontSize: 13,
                      letterSpacing: -0.1,
                      color: active ? "#111" : "#6E6E73",
                      transition: "color 0.18s",
                    }}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Address card — flat #F2F2F7 fill, no border, weight-500 value */}
          {deliveryType === "delivery" && (
            <motion.div
              whileTap={editingAddress ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{
                background: "#F2F2F7",
                border: "none",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                onClick={() => !editingAddress && setEditingAddress(true)}
                style={{ flex: 1, minWidth: 0, cursor: editingAddress ? "default" : "pointer" }}
              >
                <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500, letterSpacing: 0.2, marginBottom: 4 }}>
                  Адрес доставки
                </div>
                {editingAddress ? (
                  <input
                    autoFocus
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    onBlur={() => setEditingAddress(false)}
                    onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
                    placeholder="ул. Манаса 45, кв. 12"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#111",
                      padding: 0,
                      fontFamily: "inherit",
                      letterSpacing: -0.2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      letterSpacing: -0.2,
                      color: address ? "#111" : "#9A9AA0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {address || "ул. Манаса 45, кв. 12"}
                  </div>
                )}
              </div>

              {/* Right-aligned inline actions — softer, smaller, 70% opacity */}
              {!editingAddress && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 460, damping: 24 }}
                    onClick={(e) => { e.stopPropagation(); haptic('light'); setEditingAddress(true); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0A84FF",
                      fontSize: 12,
                      fontWeight: 500,
                      opacity: 0.7,
                      cursor: "pointer",
                      padding: "6px 8px",
                      letterSpacing: -0.1,
                    }}
                  >
                    Изменить
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 460, damping: 24 }}
                    onClick={(e) => { e.stopPropagation(); haptic('light'); getLocation(); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0A84FF",
                      fontSize: 12,
                      fontWeight: 500,
                      opacity: 0.7,
                      cursor: "pointer",
                      padding: "6px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      letterSpacing: -0.1,
                    }}
                  >
                    📍 Локация
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
      {/* Comment */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>Комментарий к заказу</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {[
              { icon: "📞", text: "Позвоните перед доставкой", value: "Позвоните перед доставкой" },
              { icon: "🚪", text: "Оставьте у двери",          value: "Оставьте у двери" },
              { icon: "💬", text: "Пишите в WhatsApp",         value: "Не звоните, пишите в WhatsApp" },
              { icon: "⚡", text: "Побыстрее",                  value: "Побыстрее пожалуйста" },
            ].map(chip => {
              // Multi-select: each chip toggles independently in the comment string.
              const active = comment.includes(chip.value);
              return (
                <motion.button
                  key={chip.value}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 480, damping: 24 }}
                  onClick={() => {
                    haptic('light');
                    if (active) {
                      setComment(c => c.replace(chip.value, "").replace(/\n\n/g, "\n").trim());
                    } else {
                      setComment(c => c ? c + "\n" + chip.value : chip.value);
                    }
                  }}
                  animate={{
                    backgroundColor: active ? "#111111" : "#F2F2F7",
                    color: active ? "#FFFFFF" : "#3A3A3C",
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 20,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    letterSpacing: -0.1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{chip.icon}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.1 }}>{chip.text}</span>
                </motion.button>
              );
            })}
          </div>
          <motion.textarea
            placeholder="Или напишите сами..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            initial={false}
            whileFocus={{
              boxShadow: "0 0 0 3px rgba(10, 132, 255, 0.20)",
              backgroundColor: "#FFFFFF",
            }}
            transition={{ duration: 0.18 }}
            style={{
              width: "100%",
              minHeight: 56,
              fontSize: 14,
              fontWeight: 500,
              color: "#111",
              padding: "12px 14px",
              background: "#F2F2F7",
              border: "none",
              borderRadius: 12,
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              marginBottom: 0,
              fontFamily: "inherit",
              letterSpacing: -0.1,
            }}
          />
        </div>
      </div>
      {/* Payment — PRO: spring tap, animated check icon, smooth border morph */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.paymentMethod}</div>
          {[
            // Real brand assets from /public — encoded for the URL because
            // "M bank.png" contains a space. Cash keeps the inline SVG since
            // there's no real cash logo asset. All three render at 28×28
            // contained, no wrapper background.
            { id: 'mbank', label: 'M Bank',                  accent: '#0E7A6E', accentRgb: '14, 122, 110', logo: <img src={encodeURI('/M bank.png')} alt="M Bank" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0, display: 'block' }} /> },
            { id: 'obank', label: 'O!Bank',                  accent: '#E5007E', accentRgb: '229, 0, 126',  logo: <img src="/OBANK.jpg"               alt="O!Bank" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0, display: 'block' }} /> },
            { id: 'cash',  label: 'Наличные / Нак. акча',    accent: T.accent,  accentRgb: '17, 17, 17',   logo: <CashLogo size={28} /> },
          ].map(opt => {
            const selected = payMethod === opt.id;
            return (
              <motion.button
                key={opt.id}
                onClick={() => { haptic('light'); setPayMethod(opt.id); }}
                whileTap={{ scale: 0.97 }}
                animate={{
                  borderColor: selected ? `rgba(${opt.accentRgb}, 0.25)` : T.border,
                  backgroundColor: selected ? `rgba(${opt.accentRgb}, 0.08)` : T.bg,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: '1px solid', cursor: "pointer", width: "100%", marginBottom: 8, textAlign: "left", boxSizing: "border-box" }}
              >
                {opt.logo}
                <motion.span
                  animate={{ color: selected ? opt.accent : T.text }}
                  transition={{ duration: 0.22 }}
                  style={{ fontWeight: 500, fontSize: 14, flex: 1, opacity: 1, letterSpacing: -0.1 }}
                >
                  {opt.label}
                </motion.span>
                <AnimatePresence>
                  {selected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: opt.accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
      {/* Bonus */}
      {bonusBalance > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12 }}>
          <div style={{ ...card({ padding: "14px 16px" }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: T.bonus, fontWeight: 700, fontSize: 14 }}>{t.useBonus}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{formatSum(bonusBalance)} · {t.maxDiscount} {useBonusPercent}%</div>
            </div>
            <div onClick={() => setUseBonus(v => !v)} style={{ width: 48, height: 28, borderRadius: 14, background: useBonus ? T.accent : T.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: useBonus ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </div>
          </div>
        </div>
      )}
      {/* Summary — clear hierarchy: secondary rows lighter, "Итого" 20/700 */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          {[
            { label: t.subtotal, val: formatSum(subtotal) },
            deliveryType === "delivery" && { label: t.delivery, val: deliveryCost > 0 ? formatSum(deliveryCost) : t.free },
            useBonus && bonusDiscount > 0 && { label: t.bonusDiscount, val: `−${formatSum(bonusDiscount)}`, color: T.bonus },
          ].filter(Boolean).map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#8E8E93", fontSize: 13, fontWeight: 500, letterSpacing: -0.05 }}>{row.label}</span>
              <span style={{ color: row.color || "#3A3A3C", fontWeight: 500, fontSize: 13, letterSpacing: -0.05 }}>{row.val}</span>
            </div>
          ))}
          <div style={{ height: 1, background: T.border, margin: "10px 0 14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: T.text, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{t.total}</span>
            {/* Total morphs in fresh on every change */}
            <motion.span
              key={total}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              style={{ color: T.accent, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}
            >
              {formatSum(total)}
            </motion.span>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px", marginBottom: 8 }}>
        <motion.button
          style={{ ...btnGreen(), width: "100%", marginTop: 12, marginBottom: 8 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={() => { haptic('medium'); window.dispatchEvent(new CustomEvent('cart:checkout')); }}
        >
          {t.placeOrder}
        </motion.button>
      </div>
    </div>
  );
}

// ─── MY ORDERS SCREEN ──────────────────────────────────────────────────────────
function MyOrdersScreen({ orders, goToCatalog, reviews, user, showToast }) {
  const { t, lang } = useLang();
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSending, setReviewSending] = useState(false);
  if (!orders?.length) {
    // PRO: animated empty state with iOS-style CTA
    return (
      <EmptyState
        icon={IC.orders}
        title={t.noOrders}
        hint={lang === 'kg' ? 'Биринчи заказыңызды каталогдон бериңиз' : 'Сделайте первый заказ из каталога'}
        action={goToCatalog && (
          <motion.button
            onClick={() => { haptic('light'); goToCatalog(); }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
            style={btnGreen({ width: 'auto', padding: '14px 28px' })}
          >
            {lang === 'kg' ? 'Каталогго өтүү' : 'Перейти в каталог'}
          </motion.button>
        )}
      />
    );
  }
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      <div style={{ padding: "52px 16px 14px", fontSize: 26, fontWeight: 800, color: "#111" }}>{t.myOrders}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <AnimatePresence initial={false}>
          {orders.slice().reverse().map((order, i) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: Math.min(i, 6) * 0.04, ease: [0.32, 0.72, 0, 1] }}
              style={{ ...card({ padding: "16px" }) }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ color: T.textMuted, fontSize: 11 }}>#{order.id}</div>
                  <motion.div
                    key={order.total}
                    initial={{ y: -4, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    style={{ color: T.text, fontWeight: 800, fontSize: 16 }}
                  >
                    {formatSum(order.total)}
                  </motion.div>
                </div>
                <StatusChip status={order.status} />
              </div>
              {/* PRO: live status timeline */}
              <div style={{ marginBottom: 14 }}>
                <OrderTimeline status={order.status} lang={lang} />
              </div>
              {(order.items || []).map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} × {item.qty}</span>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{formatSum(item.price * item.qty)}</span>
                </div>
              ))}
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{order.date}</span>
                {order.status === 'delivered' && !reviews?.find(r => r.orderId === order.id) && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setReviewOrderId(order.id); setReviewText(''); setReviewRating(5); }}
                    style={{ background: 'none', border: '1px solid #111', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, color: '#111', cursor: 'pointer' }}>
                    {lang === 'kg' ? 'Пикир калтыруу' : 'Оставить отзыв'}
                  </motion.button>
                )}
                {order.status === 'delivered' && reviews?.find(r => r.orderId === order.id) && (
                  <span style={{ fontSize: 11, color: '#388E3C', fontWeight: 500 }}>
                    {lang === 'kg' ? 'Пикир жөнөтүлдү' : 'Отзыв отправлен'}
                  </span>
                )}
              </div>
              {/* Review form inline */}
              {reviewOrderId === order.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f0f0' }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 8 }}>
                      {lang === 'kg' ? 'Баа бериңиз:' : 'Ваша оценка:'}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} onClick={() => setReviewRating(s)} width="24" height="24" viewBox="0 0 24 24" fill={s <= reviewRating ? '#111' : '#ddd'} style={{ cursor: 'pointer' }}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder={lang === 'kg' ? 'Сиздин пикириңиз...' : 'Ваш отзыв...'}
                    style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      disabled={reviewSending || !reviewText.trim()}
                      onClick={async () => {
                        if (!reviewText.trim()) return;
                        setReviewSending(true);
                        try {
                          await api.createReview({
                            orderId: order.id,
                            name: user?.name || user?.phone || '',
                            city: '',
                            text: reviewText.trim(),
                            rating: reviewRating,
                            approved: false,
                          });
                          setReviewOrderId(null);
                          showToast?.(lang === 'kg' ? 'Пикир жөнөтүлдү!' : 'Отзыв отправлен!');
                        } catch (e) {
                          console.warn('Review error:', e);
                          showToast?.(lang === 'kg' ? 'Ката кетти' : 'Ошибка');
                        } finally { setReviewSending(false); }
                      }}
                      style={{ ...btnGreen({ padding: '10px 20px', fontSize: 12 }), opacity: reviewSending || !reviewText.trim() ? 0.5 : 1 }}>
                      {reviewSending
                        ? (lang === 'kg' ? 'Жөнөтүлүүдө...' : 'Отправка...')
                        : (lang === 'kg' ? 'Жөнөтүү' : 'Отправить')}
                    </motion.button>
                    <button onClick={() => setReviewOrderId(null)}
                      style={{ background: 'none', border: 'none', fontSize: 12, color: '#999', cursor: 'pointer', padding: '10px 14px' }}>
                      {lang === 'kg' ? 'Жокко чыгаруу' : 'Отмена'}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
// ─── PROFILE SCREEN ────────────────────────────────────────────────────────────
function ProfileScreen({ user, onLogout, bonusBalance, bonusHistory, referralCode, settings, onCopyReferral, onAdminLogin, goToOrders }) {
  const { t, lang, setLang } = useLang();
  const [tab, setTab] = useState("bonus");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  // Real admin auth — calls PB /api/admins/auth-with-password. The token is
  // saved by the SDK into pb.authStore so subsequent requests go as admin.
  const submitAdminLogin = async () => {
    if (!adminEmail || !adminPass) { setAdminErr(t.fillAll || "Заполните все поля"); return; }
    setAdminLoading(true); setAdminErr("");
    try {
      await adminLoginApi(adminEmail, adminPass);
      setShowAdminModal(false);
      setAdminEmail(""); setAdminPass("");
      onAdminLogin?.();
    } catch (e) {
      setAdminErr(t.wrongPassword || "Неверный email или пароль");
    } finally {
      setAdminLoading(false);
    }
  };
  const handleCopyReferralLocal = () => {
    haptic('light'); // PRO: native vibration on copy
    onCopyReferral();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      <div style={{ background: "linear-gradient(160deg, #111111 0%, #000000 100%)", padding: "calc(env(safe-area-inset-top, 44px) + 8px) 20px 28px", borderRadius: "0 0 32px 32px", marginBottom: 20 }}>
        {/* Language toggle moved to Settings — header stays clean & minimal. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.user, { style: { width: 26, height: 26, color: "#fff" } })}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>{user?.name || t.guest}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 300 }}>{user?.phone}</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t.logout}</button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          style={{ marginTop: 20, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 300, letterSpacing: 1, textTransform: "uppercase" }}>{t.bonusBalance}</div>
            {/* PRO: count-up from 0 to current balance on mount */}
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>
              <NumberCounter value={bonusBalance} duration={1.0} format={(v) => Math.round(v).toLocaleString() + ' сом'} />
            </div>
          </div>
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 1.4, delay: 0.6, ease: [0.32, 0.72, 0, 1] }}
          >
            {React.cloneElement(IC.gift, { style: { width: 28, height: 28, color: "#fff" } })}
          </motion.div>
        </motion.div>
      </div>
      {referralCode && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "20px" }) }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            textAlign: "center",
            marginBottom: 14
          }}>
            {t.referralCode}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: T.bg,
            borderRadius: 14,
            padding: "12px 16px",
            marginBottom: 12
          }}>
            <div style={{
              flex: 1,
              fontSize: 20,
              fontWeight: 900,
              color: T.text,
              letterSpacing: 3,
              textAlign: "center",
              fontFamily: "monospace"
            }}>
              {referralCode}
            </div>
            <button
              onClick={handleCopyReferralLocal}
              style={{
                background: T.accent,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              {copied ? t.copied : t.copy}
            </button>
          </div>
          <div style={{
            fontSize: 13,
            color: T.textMuted,
            textAlign: "center"
          }}>
            {t.referralHint} {settings?.referralBonus || 100} {t.sum || "сом"}
          </div>
        </div>
      )}
      <div style={{ margin: "0 16px 14px", display: "flex", gap: 8 }}>
        {[{ id: "bonus", label: t.bonusHistory }, { id: "info", label: t.accountInfo }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: tab === tb.id ? "none" : `1px solid ${T.border}`, background: tab === tb.id ? "#111111" : "transparent", color: tab === tb.id ? "#fff" : T.textSecond, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{tb.label}</button>
        ))}
      </div>
      {tab === "bonus" ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!bonusHistory.length
            ? <div style={{ color: T.textMuted, textAlign: "center", padding: 40 }}>{t.noBonusHistory}</div>
            : bonusHistory.slice().reverse().map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, delay: Math.min(i, 8) * 0.04, ease: [0.32, 0.72, 0, 1] }}
                style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 14, background: h.type === "spent" ? "rgba(224,85,85,0.10)" : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {React.cloneElement(h.type === "spent" ? IC.cart : IC.gift, { style: { width: 18, height: 18, color: h.type === "spent" ? T.danger : T.accent } })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{h.label || (h.type === "spent" ? t.bonusSpent : t.bonusEarned)}</div>
                  <div style={{ color: T.textMuted, fontSize: 11 }}>{h.date}</div>
                </div>
                <div style={{ color: h.type === "spent" ? T.danger : T.accent, fontWeight: 800, fontSize: 15 }}>
                  {h.type === "spent" ? "−" : "+"}{formatSum(Math.abs(h.amount))}
                </div>
              </motion.div>
            ))}
        </div>
      ) : (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[{ label: t.name, val: user?.name }, { label: t.phone, val: user?.phone }, { label: t.registrationDate, val: user?.registrationDate }].map(row => (
            <div key={row.label} style={{ ...card({ padding: "14px 16px" }), display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textSecond, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>{row.val || "—"}</span>
            </div>
          ))}
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────
          ADDED SECTIONS — independent blocks below the existing content.
          Each section uses the same `card()` helper, `T` colour tokens
          and 8/12/16/20 spacing as the rest of the screen.
          ────────────────────────────────────────────────────────────── */}

      {/* ── Orders section ─────────────────────────────────────────────── */}
      <div style={{ padding: "24px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5, paddingLeft: 4, marginBottom: 4 }}>
          {lang === 'kg' ? 'Заказтар' : 'Заказы'}
        </div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => goToOrders && goToOrders()}
          style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.orders, { style: { width: 18, height: 18, color: T.accent } })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{lang === 'kg' ? 'Менин заказтарым' : 'Мои заказы'}</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{lang === 'kg' ? 'Тарых жана статус' : 'История и статусы'}</div>
          </div>
          {React.cloneElement(IC.chevron, { style: { width: 16, height: 16, color: T.textMuted, flexShrink: 0 } })}
        </motion.div>
      </div>

      {/* ── Settings section ───────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5, paddingLeft: 4, marginBottom: 4 }}>
          {lang === 'kg' ? 'Жөндөөлөр' : 'Настройки'}
        </div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.bell, { style: { width: 18, height: 18, color: T.accent } })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{lang === 'kg' ? 'Билдирүүлөр' : 'Уведомления'}</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{lang === 'kg' ? 'Заказ статусу жөнүндө' : 'О статусах заказа'}</div>
          </div>
          {React.cloneElement(IC.chevron, { style: { width: 16, height: 16, color: T.textMuted, flexShrink: 0 } })}
        </motion.div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => { haptic('light'); setLangSheetOpen(true); }}
          style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.settings, { style: { width: 18, height: 18, color: T.accent } })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{lang === 'kg' ? 'Тил' : 'Язык'}</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{lang === 'ru' ? 'Русский' : 'Кыргызча'}</div>
          </div>
          {React.cloneElement(IC.chevron, { style: { width: 16, height: 16, color: T.textMuted, flexShrink: 0 } })}
        </motion.div>
      </div>

      {/* ── Support section ────────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5, paddingLeft: 4, marginBottom: 4 }}>
          {lang === 'kg' ? 'Колдоо' : 'Поддержка'}
        </div>
        {settings?.whatsappPhone && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              haptic('light');
              const num = String(settings.whatsappPhone).replace(/\D/g, '');
              if (num) window.open(`https://wa.me/${num}`, '_blank');
            }}
            style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {React.cloneElement(IC.chat, { style: { width: 18, height: 18, color: T.accent } })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>WhatsApp</div>
              <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{settings.whatsappPhone}</div>
            </div>
            {React.cloneElement(IC.chevron, { style: { width: 16, height: 16, color: T.textMuted, flexShrink: 0 } })}
          </motion.div>
        )}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            haptic('light');
            const num = String(settings?.supportPhone || settings?.whatsappPhone || '').replace(/\D/g, '');
            if (num) window.open(`tel:+${num}`, '_self');
          }}
          style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.phone, { style: { width: 18, height: 18, color: T.accent } })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{lang === 'kg' ? 'Колдоо борбору' : 'Связаться с поддержкой'}</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{lang === 'kg' ? 'Чалуу' : 'Позвонить'}</div>
          </div>
          {React.cloneElement(IC.chevron, { style: { width: 16, height: 16, color: T.textMuted, flexShrink: 0 } })}
        </motion.div>
      </div>

      {/* ── Language selection sheet — iOS Settings list with checkmark ── */}
      <AnimatePresence>
        {langSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLangSheetOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          >
            <motion.div
              initial={{ y: 280 }}
              animate={{ y: 0 }}
              exit={{ y: 280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: T.card,
                width: "100%",
                maxWidth: 520,
                borderRadius: "24px 24px 0 0",
                padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
                boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
              }}
            >
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 2, margin: "0 auto 14px" }} />
              {/* Sheet title */}
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, padding: "0 4px 12px", letterSpacing: -0.2 }}>
                {lang === 'kg' ? 'Тил' : 'Язык'}
              </div>
              {/* List card with rows */}
              <div style={{ ...card({ padding: 0, overflow: "hidden" }) }}>
                {[
                  { id: 'ru', native: 'Русский' },
                  { id: 'kg', native: 'Кыргызча' },
                ].map((opt, idx, arr) => {
                  const selected = lang === opt.id;
                  return (
                    <motion.div
                      key={opt.id}
                      whileTap={{ background: T.bg }}
                      onClick={() => { haptic('light'); setLang(opt.id); setLangSheetOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "16px",
                        borderBottom: idx < arr.length - 1 ? `0.5px solid ${T.border}` : 'none',
                        cursor: "pointer",
                        background: T.card,
                      }}
                    >
                      <div style={{ color: T.text, fontSize: 16, fontWeight: selected ? 600 : 500, letterSpacing: -0.1 }}>
                        {opt.native}
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                          style={{ color: T.accent, display: "flex" }}
                        >
                          {React.cloneElement(IC.check, { style: { width: 20, height: 20 } })}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAdminModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: T.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 16, textAlign: "center" }}>{t.adminPanel}</div>
            <div style={{ marginBottom: 10 }}>
              <input type="email" autoComplete="username" value={adminEmail} onChange={e => { setAdminEmail(e.target.value); setAdminErr(""); }} placeholder="admin@kemalusman.kg" style={{ ...inputStyle }} autoFocus />
            </div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.lock}</div>
              <input type="password" autoComplete="current-password" value={adminPass} onChange={e => { setAdminPass(e.target.value); setAdminErr(""); }} placeholder={t.passwordLabel || "Пароль"} style={{ ...inputStyle, paddingLeft: 42 }} onKeyDown={e => { if (e.key === 'Enter') submitAdminLogin(); }} />
            </div>
            {adminErr && <div style={{ color: T.danger, fontSize: 13, marginBottom: 10, textAlign: "center" }}>{adminErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAdminModal(false)} style={{ ...btnOutline({ flex: 1, padding: "12px 0", borderRadius: 14 }) }}>Отмена</button>
              <button onClick={submitAdminLogin} disabled={adminLoading} style={{ ...btnGreen({ flex: 1, padding: "12px 0", borderRadius: 14, opacity: adminLoading ? 0.6 : 1 }) }}>{adminLoading ? '…' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN ORDERS ──────────────────────────────────────────────────────────────
function AdminOrdersScreen({ allOrders = [], onStatusChange, onDelete, onSendWhatsApp, onConfirmMBankPayment, onRefresh }) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");
  const [statusMap, setStatusMap] = useState({});
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    haptic('light');
    try { await onRefresh(); } catch { /* ignore */ }
    setRefreshing(false);
  };
  const orders = allOrders.map(o => ({ ...o, status: statusMap[o.id] || o.status }));
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const statuses = ["all", "new", "confirmed", "preparing", "delivering", "delivered", "cancelled"];
  const handleStatus = (id, st) => { haptic('medium'); setStatusMap(p => ({ ...p, [id]: st })); onStatusChange?.(id, st); };
  try {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      <div style={{ padding: "52px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: T.text }}>{t.orders}</div>
        {onRefresh && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={refresh}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999, border: "none",
              background: "rgba(0,0,0,0.06)", color: "#111",
              fontSize: 13, fontWeight: 600, cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.6 : 1, letterSpacing: -0.1,
            }}
          >
            <motion.svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.9, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
            >
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </motion.svg>
            {refreshing ? '...' : (lang === 'kg' ? 'Жаңыртуу' : 'Обновить')}
          </motion.button>
        )}
      </div>
      <div style={{ padding: "0 16px 14px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
          {statuses.map(s => (
            <button key={s} onClick={() => { haptic('light'); setFilter(s); }} style={{ padding: "10px 20px", borderRadius: 22, border: `1.5px solid ${filter === s ? T.accent : T.border}`, background: filter === s ? T.accent : T.card, color: filter === s ? "#fff" : T.textSecond, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", minHeight: 40, letterSpacing: -0.1 }}>
              {s === "all" ? t.allOrders : t["status_" + s] || s}
              {s !== "all" && (() => { const cnt = allOrders.filter(o => o.status === s).length; return cnt > 0 ? ` (${cnt})` : ''; })()}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!filtered.length && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center",
              padding: "56px 24px 64px",
              gap: 14,
            }}
          >
            {/* Icon — soft circle with box glyph */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 4,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            {/* Title */}
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              {t.noOrders}
            </div>
            {/* Description — secondary text */}
            <div style={{ fontSize: 13, color: "#8E8E93", lineHeight: 1.45, maxWidth: 260 }}>
              {lang === 'kg'
                ? 'Жаңы заказдар азырынча жок. Тизмени жаңыртыңыз.'
                : 'Новые заказы пока не поступали. Обновите список, чтобы проверить.'}
            </div>
            {/* Refresh button */}
            {onRefresh && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 460, damping: 24 }}
                onClick={refresh}
                disabled={refreshing}
                style={{
                  marginTop: 6,
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: "none",
                  background: "#111111",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: refreshing ? "default" : "pointer",
                  letterSpacing: -0.1,
                  opacity: refreshing ? 0.7 : 1,
                  boxShadow: "0 6px 16px rgba(17,17,17,0.20)",
                }}
              >
                <motion.svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 0.9, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                >
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </motion.svg>
                {refreshing
                  ? (lang === 'kg' ? 'Жаңылануу…' : 'Обновляем…')
                  : (lang === 'kg' ? 'Жаңыртуу' : 'Обновить')}
              </motion.button>
            )}
          </motion.div>
        )}
        {filtered.slice().reverse().map(order => (
          <div key={order.id} style={{ ...card({ padding: "16px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(open === order.id ? null : order.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: T.textMuted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>#{typeof order.id === 'string' ? order.id.slice(-6).toUpperCase() : order.id}</span>
                  <StatusChip status={order.status} />
                  {order.date && <span style={{ color: T.textMuted, fontSize: 10, marginLeft: 'auto' }}>{(() => { try { const d = new Date(order.date); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}</span>}
                </div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>{formatSum(order.total)}</div>
                <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  {order.clientName && <span style={{ fontWeight: 500 }}>{order.clientName}</span>}
                  {order.clientName && order.clientPhone && <span>·</span>}
                  {order.clientPhone && <span>{order.clientPhone}</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 8, paddingTop: 4, flexShrink: 0 }}>
                <motion.div animate={{ rotate: open === order.id ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </motion.div>
              </div>
            </div>
            {open === order.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`, overflow: 'hidden' }}
              >
                {/* PRO: live order tracker timeline visible to admin too */}
                <div style={{ marginBottom: 14 }}>
                  <OrderTimeline status={order.status} lang={lang} />
                </div>
                {(order.clientName || order.clientPhone) && (
                  <div style={{ background: T.bgSecond || '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {order.clientName && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                        👤 {order.clientName}
                      </div>
                    )}
                    {order.clientPhone && (
                      <div style={{ fontSize: 13, color: T.textSecond }}>
                        📞 {order.clientPhone}
                      </div>
                    )}
                    {order.payMethod && (
                      <div style={{ fontSize: 12, color: T.textMuted }}>
                        💳 {order.payMethod === 'mbank' ? 'M-Bank' : order.payMethod === 'obank' ? 'O!Bank' : 'Наличные'}
                      </div>
                    )}
                  </div>
                )}
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} × {item.qty}</span>
                    <span style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{formatSum(item.price * item.qty)}</span>
                  </div>
                ))}
                {order.address && <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{t.address}: {order.address}</div>}
                <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>{order.date}</div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: T.textSecond, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.changeStatus}:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["confirmed", "preparing", "delivering", "delivered", "cancelled"].map(s => (
                      <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => handleStatus(order.id, s)} style={{ padding: "9px 16px", borderRadius: 12, border: `1.5px solid ${order.status === s ? T.accent : T.border}`, background: order.status === s ? T.accentLight : T.bg, color: order.status === s ? T.accent : T.textSecond, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 38, letterSpacing: -0.1 }}>{t["status_" + s] || s}</motion.button>
                    ))}
                  </div>
                </div>
                {order.paymentMethod === 'mbank' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: order.paymentStatus === 'mbank_pending' ? '#FEF3C7' : '#D1FAE5', borderRadius: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: order.paymentStatus === 'mbank_pending' ? '#D97706' : '#059669' }}>
                      💳 M-Bank: {order.paymentStatus === 'mbank_pending' ? 'Ожидает подтверждения' : 'Оплачено'}
                    </span>
                    {order.paymentStatus === 'mbank_pending' && (
                      <button onClick={() => onConfirmMBankPayment?.(order.id)} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>Подтвердить</button>
                    )}
                  </div>
                )}
                {order.clientPhone && <button onClick={() => onSendWhatsApp?.(order)} style={{ ...btnOutline({ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", fontSize: 14 }) }}>{React.cloneElement(IC.chat, { style: { width: 16, height: 16 } })}{t.sendWhatsApp}</button>}
                {/* Delete order — safe placement at bottom with confirm */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { if (window.confirm(t.confirmDeleteOrder)) { haptic('medium'); onDelete?.(order.id); } }}
                  style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 12, border: "none", background: "rgba(229,57,53,0.08)", color: "#E53935", fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: -0.1, fontFamily: "inherit" }}
                >
                  {lang === 'kg' ? 'Заказды өчүрүү' : 'Удалить заказ'}
                </motion.button>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  } catch (err) {
    console.error('[Orders CRASH]', err);
    return <div style={{ padding: 32, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Orders crashed: {String(err?.message || err)}</div>;
  }
}
// ─── ADMIN PRODUCTS ────────────────────────────────────────────────────────────
function AdminProductsScreen({ products = [], setProducts, showToast }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  // Edit-form language switcher — drives which language fields are shown.
  // Reset to 'ru' whenever a different product is opened.
  const [editLang, setEditLang] = useState('ru');
  useEffect(() => { setEditLang('ru'); }, [editing]);
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));
  const editProd = products.find(p => p.id === editing);
  const upd = (id, f, v) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [f]: v } : p));
  const updVar = (pId, vId, f, v) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.map(vr => vr.id === vId ? { ...vr, [f]: v } : vr) } : p));
  const addProd = () => { const np = { id: Date.now(), name: "", brand: "", category: "Женские", img: null, images: [], desc: "", isPopular: false, featured: false, variants: [{ id: Date.now(), label: "5 мл", price: 0, type: "ml", inStock: true }] }; setProducts(p => [...p, np]); setEditing(np.id); };
  // Delete confirmation now handled by the in-app modal — no native confirm.
  const delProd = async (id) => {
    const prod = products.find(p => p.id === id);
    setProducts(p => p.filter(x => x.id !== id));
    if (editing === id) setEditing(null);
    if (prod?.collectionId) {
      try { await api.deleteProduct(prod.id); } catch (e) { console.warn("Delete error:", e); }
    }
  };
  // Pulls the most actionable message out of a PocketBase / network error.
  // Defensive against an ambient handler returning the unhelpful generic
  // string "Something went wrong" — we treat that as "no useful message"
  // and fall through to a localized Russian default.
  const isUseless = (s) => !s || /^something went wrong\.?$/i.test(String(s).trim());
  const extractError = (e) => {
    if (!e) return null;
    const topMsg =
      e?.response?.data?.message ||
      e?.data?.message;
    const fieldData =
      e?.response?.data?.data ||
      e?.response?.data ||
      e?.data?.data ||
      e?.data;
    const fieldErrs = (fieldData && typeof fieldData === "object")
      ? Object.entries(fieldData)
          .filter(([k, v]) => k !== "message" && v && (v.message || typeof v === "string"))
          .map(([k, v]) => `${k}: ${v.message || v}`)
      : [];
    if (!isUseless(topMsg) && fieldErrs.length) return `${topMsg} — ${fieldErrs.join(" · ")}`;
    if (!isUseless(topMsg)) return topMsg;
    if (fieldErrs.length) return fieldErrs.join(" · ");
    const fallback = e?.response?.message || e?.message;
    if (!isUseless(fallback)) return fallback;
    return null;
  };

  const saveProd = async (id) => {
    logger.step(1, "start save", { id });
    // ── Hard timeout — any PB call exceeding 15s rejects so the saving
    // spinner can't hang forever on a stuck network / ATS-blocked request.
    const withTimeout = (promise, ms = 15000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT: PB request stuck")), ms)
        ),
      ]);
    const prod = products.find(p => p.id === id);
    if (!prod) {
      logger.step("1.1", "aborted — product not found");
      return;
    }

    // Reset any stale error toast immediately — fresh save = fresh state.
    showToast?.(null);

    // ── Validation — surface specific field error before hitting backend ──
    // Multilingual name: pass when AT LEAST ONE of RU / KG is filled.
    // (Previously required RU specifically — admins who only typed the KG
    // form were blocked.) Both schema fields are still populated below via
    // cross-fill so neither column ends up empty in PB.
    const nameRuRaw = (prod.name || "").trim();
    const nameKgRaw = (prod.name_kg || "").trim();
    if (!nameRuRaw && !nameKgRaw) {
      showToast?.(t.nameRequired, "error");
      return;
    }
    if (!prod.brand || !prod.brand.trim()) {
      showToast?.(t.brandRequired, "error");
      return;
    }
    // ── Image presence — accept BOTH new uploads (data: URLs, become Files
    // and ride in the multipart body) AND existing PB-hosted URLs (kept by
    // the server when we omit the field). Save is only blocked when the
    // product genuinely has no image at all.
    const isNewUpload = (u) => typeof u === "string" && u.startsWith("data:");
    const isExistingUrl = (u) => typeof u === "string" && u.length > 0 && !u.startsWith("data:");

    const imgEntries = [
      prod.img,
      ...(Array.isArray(prod.images) ? prod.images : []),
    ];
    const hasNewImages = imgEntries.some(isNewUpload);
    const hasExistingImages = imgEntries.some(isExistingUrl);
    logger.log("[saveProd] image presence:", { hasNewImages, hasExistingImages });

    if (!hasNewImages && !hasExistingImages) {
      showToast?.(t.imageRequired, "error");
      return;
    }

    setSaving(true);
    // Outer safety — ANY synchronous error after this line (FormData construction,
    // diagnostic logs, etc.) MUST still release the saving spinner. The inner
    // try/catch/finally already covers the PB call itself; this wrapper covers
    // the rest of the function body. We re-throw so React's default unhandled-
    // rejection logging still surfaces the underlying bug.
    try {

    // ── PRE-SEND VALIDATION DIAGNOSTICS (spec audit) ─────────────────────────
    // These are READ-ONLY logs — no logic changes downstream.
    logger.log("CHECK:", {
      name: prod.name,
      brand: prod.brand,
      category: prod.category,
      variants: prod.variants,
      images: prod.images,
    });
    logger.log("VARIANTS TYPE:", typeof prod.variants, "isArray:", Array.isArray(prod.variants));

    // ── Build multipart FormData so file uploads ride alongside text fields ──
    // Data URLs (from FileReader in MultiImageUpload) are decoded back to Blobs;
    // already-hosted PB URLs are passed through as plain strings so the server
    // keeps the existing files. PB's SDK detects FormData and switches the
    // Content-Type to multipart/form-data automatically.
    const dataUrlToBlob = (dataUrl) => {
      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
      try {
        const [head, b64] = dataUrl.split(",");
        const mime = head.match(/:(.*?);/)?.[1] || "image/jpeg";
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new Blob([u8], { type: mime });
      } catch (err) {
        console.warn("[saveProd] dataUrlToBlob failed:", err);
        return null;
      }
    };
    const extOf = (blob) => (blob?.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");

    // Wrap a Blob as a File so it rides as a multipart file part. Defined here
    // (above the audio block) because the audio prep references it before the
    // image pipeline does — putting the const lower triggered a TDZ crash.
    const blobToFile = (blob, filename) => {
      if (!blob) return null;
      try {
        return new File([blob], filename, { type: blob.type || "image/jpeg" });
      } catch {
        // Older WKWebView bundles without the File ctor — fall back to Blob,
        // which still rides as a multipart file part with the explicit filename.
        return blob;
      }
    };

    // Cross-fill multilingual fields — if one language is missing, fall back
    // to the other so neither PB column ends up empty. Read side already
    // prefers the active language and falls back, but storing both keeps
    // search / external consumers happy.
    const finalName   = nameRuRaw || nameKgRaw;
    const finalNameKg = nameKgRaw || nameRuRaw;
    const descRuRaw   = (prod.desc || "").trim();
    const descKgRaw   = (prod.desc_kg || "").trim();
    const finalDesc   = descRuRaw   || descKgRaw;
    const finalDescKg = descKgRaw   || descRuRaw;

    // ── Variants — PB `json` field. MUST arrive as a JSON string in
    // multipart, never as a raw object (which serialises to "[object Object]"
    // and PB rejects with a validation error). Always coerce to an array
    // first so an undefined/null/object value can't poison the payload.
    let safeVariants = prod.variants;
    if (!Array.isArray(safeVariants)) {
      console.warn("[saveProd] variants was not an array — coerced to []. raw:", safeVariants);
      safeVariants = [];
    }
    const variantsJson = JSON.stringify(safeVariants);
    logger.log("[saveProd] VARIANTS JSON:", variantsJson);

    const fd = new FormData();
    fd.append("name", finalName);
    fd.append("name_kg", finalNameKg);
    fd.append("brand", prod.brand.trim());
    fd.append("category", prod.category || "Женские");
    if (finalDesc)   fd.append("desc", finalDesc);
    if (finalDescKg) fd.append("desc_kg", finalDescKg);
    fd.append("variants", variantsJson);
    fd.append("featured", String(!!prod.featured));
    fd.append("isPopular", String(!!prod.isPopular));
    fd.append("priority", String(Number.isFinite(+prod.priority) ? +prod.priority : 0));
    fd.append("salePercent", String(Number(prod.salePercent) || 0));
    fd.append("saleEnd", prod.saleEnd || '');
    fd.append("saleStart", prod.saleStart || '');

    // ── AUDIO (PB single-file field `audio`) ────────────────────────────────
    // The recorder writes a data URL into localStorage keyed by product id.
    // If one exists for this product, decode it to a Blob, wrap as a File
    // and ride along in this multipart save. PB stores the file; loadAll
    // reads `record.audio` filename; UI builds the URL via audioUrl(record).
    try {
      const audioKey = 'parfum_audio_' + (prod.id || prod.collectionId || '');
      const audioData = audioKey ? localStorage.getItem(audioKey) : null;
      if (audioData && typeof audioData === 'string' && audioData.startsWith('data:')) {
        const audioBlob = dataUrlToBlob(audioData);
        if (audioBlob) {
          const audioExt = (audioBlob.type?.split('/')[1] || 'm4a')
            .replace('mpeg', 'mp3').replace('mp4', 'm4a');
          const audioFile = blobToFile(audioBlob, `audio.${audioExt}`);
          if (audioFile instanceof File) {
            fd.append('audio', audioFile);
            logger.log('[saveProd] audio queued:', { size: audioBlob.size, type: audioBlob.type });
          }
        }
      }
    } catch (audioErr) {
      console.warn('[saveProd] audio prep skipped:', audioErr);
    }

    // ── IMAGE UPLOAD (PB multi-file field `images`) ────────────────────────
    // Field name MUST match the PB schema exactly: `images` (not "image" /
    // "img" / "files"). Cover is the same field — PB stores all image files
    // in one multi-file column and the read side treats `images[0]` as cover.
    //
    // Rules per spec:
    //   • Only append REAL `File` objects (never strings, null, undefined)
    //   • Existing PB-hosted URLs are skipped — PB keeps them server-side
    //     because we omit the field entirely when nothing new was uploaded.
    //   • Filter pipeline: data: URL → Blob → File → instanceof File ? append.
    //   (blobToFile is hoisted above the audio block — see earlier in saveProd.)

    // ── COMPRESSION ────────────────────────────────────────────────────────
    // iPhone photos are typically 4–8 MB / 4032×3024 — uploading several at
    // raw size over a multipart POST inside Capacitor's WKWebView freezes the
    // UI and stalls the request. We downscale to MAX 1600 px on the longest
    // edge and re-encode as JPEG @ 0.93 quality. Result is usually 400–700 KB
    // per image — UHD sharp on all Retina/ProMotion displays.
    const MAX = 2400;
    const JPEG_Q = 0.93;
    const compressImage = async (blob) => {
      if (!blob) return null;
      try {
        // createImageBitmap is supported on iOS Safari 15+ / WKWebView; if it
        // ever fails (corrupt blob, codec) we fall back to the original blob.
        const img = await createImageBitmap(blob);
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * (MAX / width)); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * (MAX / height)); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        // Sharper downscale — use high-quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        // Free the bitmap as soon as we're done with it.
        if (typeof img.close === "function") img.close();
        const out = await new Promise(resolve =>
          canvas.toBlob(resolve, "image/jpeg", JPEG_Q)
        );
        return out || blob;
      } catch (e) {
        console.warn("[saveProd] compressImage failed, sending original:", e);
        return blob;
      }
    };

    // Build the candidate list — cover first (so its file lands at index 0
    // server-side, becoming the de-facto cover on next read), then gallery.
    const candidateUrls = [];
    if (typeof prod.img === "string") candidateUrls.push(prod.img);
    if (Array.isArray(prod.images)) {
      for (const u of prod.images) {
        if (typeof u === "string" && u !== prod.img) candidateUrls.push(u);
      }
    }

    // data: URL → raw Blob → compressed Blob → File.
    // Compression runs in parallel via Promise.all so two big photos don't
    // wait on each other sequentially.
    const dataUrls = candidateUrls.filter(u => typeof u === "string" && u.startsWith("data:"));
    const t0 = performance.now();
    const newImageFiles = (await Promise.all(
      dataUrls.map(async (u, i) => {
        const raw = dataUrlToBlob(u);
        if (!raw) return null;
        const compressed = await compressImage(raw);
        const ext = (compressed?.type === "image/jpeg" ? "jpg" : extOf(compressed));
        return blobToFile(compressed, `image-${i}.${ext}`);
      })
    )).filter(f => f instanceof File || (f && typeof f === "object" && "size" in f));
    logger.log(`[saveProd] compression took ${Math.round(performance.now() - t0)}ms`);

    // Strict append — ONLY real `File` objects per spec. Strings, null,
    // undefined, plain objects, and Promises are explicitly excluded.
    if (newImageFiles.length > 0) {
      for (const file of newImageFiles) {
        if (file instanceof File) {
          fd.append("images", file);
        } else {
          logger.warn("[saveProd] skipping non-File image entry:", file);
        }
      }
    }

    // Spec-mandated debug — only the `images` entries actually queued for upload.
    logger.log("FORMDATA IMAGES:");
    for (const pair of fd.entries()) {
      if (pair[0] === "images") {
        const v = pair[1];
        logger.log({
          isFile: v instanceof File,
          name: v?.name,
          size: v?.size,
          type: v?.type,
        });
      }
    }
    logger.log("IMAGES SENT:", {
      newCount: newImageFiles.length,
      kind: newImageFiles.map(f => (f instanceof File ? "File" : typeof f)),
      field: newImageFiles.length > 0 ? "images (NEW)" : "images (omitted)",
    });

    // Wire-level summary (FormData isn't loggable directly). All values
    // referenced here are guaranteed in scope — no stale variable refs.
    logger.log("[saveProd] payload →", {
      id: prod.id,
      hasCollectionId: !!prod.collectionId,
      name: prod.name, name_kg: prod.name_kg,
      brand: prod.brand, category: prod.category,
      desc: prod.desc, desc_kg: prod.desc_kg,
      featured: !!prod.featured,
      isPopular: !!prod.isPopular,
      priority: prod.priority,
      variants: (prod.variants || []).length,
      newImageCount: newImageFiles.length,
      newImageBytes: newImageFiles.map(f => f?.size || 0),
    });
    logger.log("[saveProd] images before send →", {
      img: prod.img ? (prod.img.startsWith("data:") ? "[data URL]" : prod.img) : null,
      images: (prod.images || []).map(u => u ? (u.startsWith("data:") ? "[data URL]" : u) : null),
    });

    // ── FORM DATA ENUMERATION (spec audit) — every key/value the server sees.
    logger.log("FORMDATA ENTRIES:");
    for (const pair of fd.entries()) {
      const v = pair[1];
      // Blobs print as "[object Blob]"; show size + type for them.
      if (v && typeof v === "object" && "size" in v) {
        logger.log("  ", pair[0], "→ Blob", { size: v.size, type: v.type });
      } else {
        logger.log("  ", pair[0], "→", v);
      }
    }

    // ── FORMDATA pre-flight dump (spec) ───────────────────────────────────
    // Confirms exactly what's heading to PB. `instanceof File` distinguishes
    // real File parts from accidental string/null appends.
    logger.log("FORMDATA DEBUG START");
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) {
        logger.log(k, "FILE:", v.name, v.size, v.type);
      } else {
        logger.log(k, v);
      }
    }
    logger.log("FORMDATA DEBUG END");

    // Final safety log per spec — terse, single-line per entry.
    for (const [k, v] of fd.entries()) {
      logger.log("FD:", k, v instanceof File ? v.name : v);
    }

    // Demo / INITIAL_PRODUCTS rows have synthetic ids (numbers, short strings)
    // and no collectionId — sending them to update() returns 404 "missing".
    // Only treat as an update when BOTH a collectionId is present AND the id
    // matches PB's 15-char alphanumeric record-id format.
    const isPBRecord =
      !!prod.collectionId &&
      typeof prod.id === "string" &&
      prod.id.length === 15 &&
      /^[a-z0-9]+$/i.test(prod.id);

    try {
      logger.step(2, "sending to PB", { mode: isPBRecord ? "update" : "create", id: prod.id });
      let created;
      let res;
      if (isPBRecord) {
        // 15s hard timeout — beats the infinite-spinner failure mode.
        res = await withTimeout(api.updateProduct(prod.id, fd), 15000);
        logger.step(3, "PB response (update)", res);
        logger.log("SAVE SUCCESS (update):", res);
        // Refetch to get fresh file URLs after upload (also bounded).
        try {
          created = await withTimeout(
            pb.collection("products").getOne(prod.id, { requestKey: null }),
            10000,
          );
        } catch (refetchErr) {
          logger.warn("STEP 3.1: refetch failed (non-fatal):", refetchErr);
          // Fall back to the original update response so hydration still has
          // something to work with.
          created = res;
        }
        logger.log("SAVE REFETCH:", created);
      } else {
        created = await withTimeout(api.createProduct(fd), 15000);
        logger.step(3, "PB response (create)", created);
        logger.log("SAVE SUCCESS (create):", created);
      }
      // PB response is the SINGLE SOURCE OF TRUTH after save — drop any local
      // dataURL previews so the catalog card never shows a stale crop and
      // never holds onto base64 in memory.
      if (created) {
        const galleryUrls = Array.isArray(created?.images)
          ? created.images
              .filter(Boolean)
              .map(f => fileUrl("products", created, f))
              .filter(Boolean)
          : [];
        const coverUrl = galleryUrls[0] || null;
        setProducts(prev => prev.map(p => {
          if (p.id !== id) return p;
          // Start from the PB record (NOT from local `p`) so any dataURL
          // previews held in p.img / p.images are discarded entirely.
          return {
            ...created,
            id: created.id,
            collectionId: created.collectionId,
            img: coverUrl,
            images: galleryUrls,
            variants: Array.isArray(prod.variants) ? prod.variants : [],
            // Coerce booleans the same way loadAll does so downstream
            // strict checks (p.isPopular === true) still match.
            isPopular: created.isPopular ?? false,
            featured: created.featured ?? false,
            salePercent: Number(created.salePercent) || 0,
            saleEnd: created.saleEnd || '',
            saleStart: created.saleStart || '',
          };
        }));
      }
      logger.step(4, "state updated");
      logger.step(5, "showing success toast");
      showToast?.(t.save + "!");
      setEditing(null);
      logger.step(6, "editor closed — save flow complete");
      logger.log("SAVE FLOW COMPLETE");
    } catch (e) {
      // Sentry: capture once with the most useful context the SDK gives us.
      // `extractError` already runs below for the toast; the raw `e` is what
      // Sentry should breadcrumb against.
      captureError(e, { context: 'saveProd', productId: prod.id });
      logger.log("ERROR TRIGGER CHECK — entered catch block");
      console.error("REAL ERROR:", e);
      // Full backend response for debugging — single source of truth.
      console.error("SAVE ERROR FULL:", e);
      console.error("SAVE ERROR keys:", e ? Object.keys(e) : []);
      console.error("SAVE ERROR status:", e?.status, "url:", e?.url);
      if (e?.response) {
        console.error("PB ERROR:", e.response.data || e.response);
      }
      // Echo back the FormData that was sent so the failure side and the wire
      // side can be compared directly in the same console block.
      try {
        const sent = {};
        for (const [k, v] of fd.entries()) {
          sent[k] = v && typeof v === "object" && "size" in v
            ? `Blob(${v.size}B, ${v.type})`
            : v;
        }
        console.error("DATA SENT:", sent);
      } catch (logErr) {
        console.error("DATA SENT (failed to enumerate):", logErr);
      }
      logger.log("[saveProd] error:", e);
      logger.log("[saveProd] response.data:", e?.response?.data);
      // Every candidate must pass through `isUseless` because the PocketBase
      // SDK literally sets `e.message = "Something went wrong."` on network
      // failures (e.g. iOS ATS blocking http, server unreachable). We never
      // want that placeholder reaching the user.
      const useful = (s) => (isUseless(s) ? null : s);
      const fallback = lang === 'kg' ? 'Сактоодо ката' : 'Ошибка при сохранении';
      const msg =
        useful(e?.response?.data?.message) ||
        extractError(e) ||
        useful(e?.message) ||
        fallback;
      showToast?.(msg, "error");
    } finally {
      setSaving(false);
    }

    } catch (outerErr) {
      // Synchronous error somewhere outside the PB call (e.g. FormData build,
      // logging, compression). Surface it AND still release the spinner.
      captureError(outerErr, { context: 'saveProd:outer' });
      console.error("[saveProd] OUTER SYNC ERROR — spinner released:", outerErr);
      showToast?.(lang === 'kg' ? 'Күтүлбөгөн ката' : 'Неожиданная ошибка', "error");
    } finally {
      // Belt-and-suspenders — guarantees the saving flag is OFF even if the
      // inner finally somehow didn't run.
      setSaving(false);
    }
  };
  const addVar = (pId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: [...p.variants, { id: Date.now(), label: "", price: 0, type: "ml", inStock: true }] } : p));
  const delVar = (pId, vId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.filter(v => v.id !== vId) } : p));
  // Toggle "featured" — added as optional flag, persisted to PB on save.
  const toggleFeatured = async (e, prod) => {
    e.stopPropagation();
    haptic('light');
    const next = !prod.featured;
    setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, featured: next } : p));
    if (prod.collectionId) {
      try { await api.updateProduct(prod.id, { featured: next }); } catch (err) { console.warn('featured toggle:', err); }
    }
  };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* Sticky header — stays at top when scrolling the products list */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: T.bg,
        padding: "52px 16px 12px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>{t.products}</div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 460, damping: 24 }}
            onClick={addProd}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: -0.1,
              boxShadow: "0 6px 16px rgba(17,17,17,0.18), 0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t.add}
          </motion.button>
        </div>
        {/* Search — icon on left, clear (×) on right */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#F2F2F7", borderRadius: 12, padding: "0 12px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search || "Поиск"}
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent",
              fontSize: 14, fontWeight: 500, color: "#111",
              padding: "10px 8px",
              fontFamily: "inherit",
              letterSpacing: -0.1,
            }}
          />
          <AnimatePresence>
            {search && (
              <motion.button
                key="clear"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                onClick={() => setSearch("")}
                aria-label="clear"
                style={{
                  background: "rgba(0,0,0,0.18)",
                  color: "#fff",
                  border: "none",
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0,
                  padding: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
      {editProd && (() => {
        // Section card — bold title + light grouped surface, generous spacing.
        const Section = ({ title, hint, children, last, padded = true }) => (
          <div style={{ marginBottom: last ? 0 : 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.25 }}>{title}</div>
              {hint && <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500 }}>{hint}</div>}
            </div>
            <div style={{ background: "#FAFAFA", borderRadius: 14, padding: padded ? 14 : 0, border: "0.5px solid rgba(0,0,0,0.04)" }}>
              {children}
            </div>
          </div>
        );

        const baseInput = {
          width: "100%",
          padding: "12px 14px",
          background: "#F5F5F7",
          border: "0.5px solid transparent",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 500,
          color: "#111",
          outline: "none",
          fontFamily: "inherit",
          letterSpacing: -0.1,
          boxSizing: "border-box",
          transition: "background 0.18s, border-color 0.18s, box-shadow 0.22s",
        };

        // Inline language segmented control — single source for which RU/KG field shows.
        const LangSeg = () => (
          <div style={{ display: "inline-flex", background: "rgba(120,120,128,0.14)", borderRadius: 9, padding: 2, position: "relative" }}>
            {['ru','kg'].map(l => {
              const active = editLang === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => { haptic('light'); setEditLang(l); }}
                  style={{
                    position: "relative",
                    padding: "5px 16px",
                    minWidth: 44,
                    border: "none",
                    background: "transparent",
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? "#111" : "#8E8E93",
                    cursor: "pointer",
                    zIndex: 1,
                    letterSpacing: 0.5,
                    fontFamily: "inherit",
                  }}
                >
                  {l.toUpperCase()}
                  {active && (
                    <motion.div
                      layoutId="edit-lang-pill"
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      style={{
                        position: "absolute", inset: 0,
                        background: "#fff",
                        borderRadius: 7,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)",
                        zIndex: -1,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        );

        const CATEGORIES = ["Женские", "Мужские", "Унисекс", "Премиум", "Новинки"];
        const nameField = editLang === 'ru' ? 'name' : 'name_kg';
        const descField = editLang === 'ru' ? 'desc' : 'desc_kg';
        const namePlaceholder = editLang === 'ru' ? (t.productName || "Название") : "Аталышы";
        const descPlaceholder = editLang === 'ru' ? (t.description || "Описание") : "Сүрөттөмөсү";

        return (
        <div style={{ margin: "12px 16px 16px", background: "#FFFFFF", borderRadius: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)", border: "0.5px solid rgba(0,0,0,0.05)" }}>
          {/* ── Sticky header — back · title · save ── */}
          <div style={{
            position: "sticky", top: 96, zIndex: 5,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            padding: "12px 14px",
            borderBottom: "0.5px solid rgba(0,0,0,0.06)",
            borderRadius: "20px 20px 0 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              onClick={() => setEditing(null)}
              aria-label="back"
              style={{ background: "rgba(0,0,0,0.05)", border: "none", color: "#111", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </motion.button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#111", fontWeight: 700, fontSize: 16, letterSpacing: -0.3, lineHeight: 1.15 }}>
                {editProd.collectionId ? "Редактирование" : t.newProduct}
              </div>
              {editProd.name && (
                <div style={{ color: "#8E8E93", fontWeight: 500, fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: -0.1 }}>
                  {editProd.name}
                </div>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 24 }}
              onClick={() => saveProd(editProd.id)}
              disabled={saving}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                borderRadius: 999,
                border: "none",
                background: "#111",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.85 : 1,
                letterSpacing: -0.1,
                boxShadow: "0 4px 12px rgba(17,17,17,0.18)",
                flexShrink: 0,
                fontFamily: "inherit",
              }}
            >
              {saving && (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 12, height: 12, border: "1.6px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }}
                />
              )}
              {saving ? "Сохранение" : t.save}
            </motion.button>
          </div>

          <div style={{ padding: "20px 14px 22px" }}>
            {/* ── LIVE PREVIEW ─────────────────────────────────────────────
                Renders the SAME ProductCard component the catalog uses, fed by
                the editor's form state. Any change (name, brand, image, popular
                toggle, variants, in-stock) is reflected here instantly — no
                save round-trip. WYSIWYG: admin sees what client sees. */}
            <Section title="Превью" hint="вид на витрине">
              <div style={{ maxWidth: 280, margin: "0 auto" }}>
                <ProductCard p={editProd} preview />
              </div>
            </Section>

            {/* ── Изображения ── */}
            <Section title="Изображения" hint="до 3 фото">
              <MultiImageUpload
                images={editProd.images || []}
                coverImg={editProd.img}
                onImagesChange={imgs => upd(editProd.id, "images", imgs)}
                onCoverChange={url => upd(editProd.id, "img", url)}
              />
            </Section>

            {/* ── Основная информация ── */}
            <Section title="Основная информация">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Language toggle row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Язык</div>
                  <LangSeg />
                </div>

                {/* Name input — single field, swaps via lang toggle */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>Название</div>
                  <motion.input
                    key={`name-${editLang}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    style={baseInput}
                    placeholder={namePlaceholder}
                    value={editProd[nameField] || ""}
                    onChange={e => upd(editProd.id, nameField, e.target.value)}
                    onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(10,132,255,0.35)"; e.target.style.boxShadow = "0 0 0 3px rgba(10,132,255,0.12)"; }}
                    onBlur={e => { e.target.style.background = "#F5F5F7"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Brand */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>Бренд</div>
                  <input
                    style={baseInput}
                    placeholder={t.brand}
                    value={editProd.brand || ""}
                    onChange={e => upd(editProd.id, "brand", e.target.value)}
                    onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(10,132,255,0.35)"; e.target.style.boxShadow = "0 0 0 3px rgba(10,132,255,0.12)"; }}
                    onBlur={e => { e.target.style.background = "#F5F5F7"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Category — chip selector */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 8, marginLeft: 2, letterSpacing: 0.3 }}>Категория</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CATEGORIES.map(c => {
                      const active = (editProd.category || "Женские") === c;
                      return (
                        <motion.button
                          key={c}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 500, damping: 26 }}
                          onClick={() => { haptic('light'); upd(editProd.id, "category", c); }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            letterSpacing: -0.1,
                            background: active ? "#111" : "rgba(120,120,128,0.12)",
                            color: active ? "#fff" : "#3A3A3C",
                            fontFamily: "inherit",
                            transition: "background 0.18s, color 0.18s",
                          }}
                        >
                          {c}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Описание ── */}
            <Section title="Описание">
              <motion.textarea
                key={`desc-${editLang}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ ...baseInput, minHeight: 84, resize: "vertical", lineHeight: 1.45 }}
                placeholder={descPlaceholder}
                value={editProd[descField] || ""}
                onChange={e => upd(editProd.id, descField, e.target.value)}
                onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(10,132,255,0.35)"; e.target.style.boxShadow = "0 0 0 3px rgba(10,132,255,0.12)"; }}
                onBlur={e => { e.target.style.background = "#F5F5F7"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
              />
            </Section>

            {/* ── Аудио ── */}
            <Section title="🎧 Аромат" hint="10 сек">
              <ProductAudioRecorder productId={editProd.id} />
            </Section>

            {/* ── Варианты ── */}
            <Section title="Варианты" hint={`${editProd.variants?.length || 0}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Column headers — only show when variants exist */}
                {(editProd.variants || []).length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 2px" }}>
                    <div style={{ flex: 2, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Размер</div>
                    <div style={{ flex: 2, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Цена</div>
                    <div style={{ width: 42, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", flexShrink: 0 }}>Есть</div>
                    <div style={{ width: 32, flexShrink: 0 }} />
                  </div>
                )}
                {(editProd.variants || []).map(v => (
                  <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", background: "#fff", borderRadius: 12, padding: "8px 10px", border: "0.5px solid rgba(0,0,0,0.04)" }}>
                    <input style={{ ...baseInput, flex: 2, padding: "10px 12px", fontSize: 14, background: "#F5F5F7" }} placeholder="5 мл / Полный" value={v.label} onChange={e => updVar(editProd.id, v.id, "label", e.target.value)} />
                    <div style={{ flex: 2, position: "relative", display: "flex", alignItems: "center" }}>
                      <input style={{ ...baseInput, padding: "10px 40px 10px 12px", fontSize: 14, background: "#F5F5F7" }} type="number" min={0} placeholder="0" value={v.price} onChange={e => updVar(editProd.id, v.id, "price", Math.max(0, +e.target.value))} />
                      <span style={{ position: "absolute", right: 10, fontSize: 12, color: "#8E8E93", fontWeight: 500, pointerEvents: "none" }}>сом</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { haptic('light'); updVar(editProd.id, v.id, "inStock", !v.inStock); }}
                      aria-label="in stock"
                      style={{
                        position: "relative",
                        width: 42, height: 26,
                        borderRadius: 13,
                        background: v.inStock ? "#34C759" : "rgba(120,120,128,0.32)",
                        border: "none", padding: 0,
                        cursor: "pointer", flexShrink: 0,
                        transition: "background 0.22s",
                      }}
                    >
                      <motion.div
                        animate={{ x: v.inStock ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 540, damping: 32 }}
                        style={{
                          position: "absolute", top: 2,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#fff",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      />
                    </button>
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => delVar(editProd.id, v.id)} aria-label="delete variant"
                      style={{ background: "rgba(229,57,53,0.10)", border: "none", color: "#E53935", cursor: "pointer", width: 32, height: 32, borderRadius: 10, padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </motion.button>
                  </div>
                ))}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 460, damping: 24 }}
                  onClick={() => addVar(editProd.id)}
                  style={{
                    background: "rgba(0,0,0,0.04)",
                    border: "0.5px dashed rgba(0,0,0,0.18)",
                    borderRadius: 10, padding: "10px",
                    color: "#3A3A3C", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", letterSpacing: -0.1,
                    fontFamily: "inherit",
                  }}
                >
                  + Добавить вариант
                </motion.button>
              </div>
            </Section>

            {/* ── Акция / скидка ── */}
            <Section title="🏷 Акция">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Sale toggle + percent */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>Скидка %</div>
                    <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>0 = нет скидки</div>
                  </div>
                  <input
                    type="number"
                    min="0" max="90" step="5"
                    style={{ ...baseInput, width: 80, textAlign: "center", flexShrink: 0, padding: "8px 10px" }}
                    placeholder="0"
                    value={editProd.salePercent || ''}
                    onChange={e => upd(editProd.id, "salePercent", e.target.value === "" ? "" : Math.min(90, Math.max(0, +e.target.value)))}
                  />
                </div>
                {/* Sale end — datetime picker */}
                {(editProd.salePercent > 0) && (
                  <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1, marginBottom: 8 }}>Окончание акции</div>
                    <input
                      type="datetime-local"
                      style={{ ...baseInput, width: "100%", padding: "10px 12px", fontSize: 14 }}
                      value={editProd.saleEnd ? editProd.saleEnd.slice(0, 16) : ''}
                      onChange={e => upd(editProd.id, "saleEnd", e.target.value ? new Date(e.target.value).toISOString() : '')}
                    />
                    {/* Quick buttons */}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "1 соат", hours: 1 },
                        { label: "3 соат", hours: 3 },
                        { label: "6 соат", hours: 6 },
                        { label: "12 соат", hours: 12 },
                        { label: "1 кун", hours: 24 },
                        { label: "3 кун", hours: 72 },
                        { label: "7 кун", hours: 168 },
                      ].map(q => (
                        <motion.button
                          key={q.label}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            haptic('light');
                            const end = new Date(Date.now() + q.hours * 3600000).toISOString();
                            upd(editProd.id, "saleEnd", end);
                            upd(editProd.id, "saleStart", new Date().toISOString());
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: 20, border: "none",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                            background: "rgba(255,59,48,0.08)", color: "#FF3B30",
                            fontFamily: "inherit",
                          }}
                        >
                          {q.label}
                        </motion.button>
                      ))}
                    </div>
                    {editProd.saleEnd && (() => {
                      const info = getSaleInfo(editProd);
                      if (!info) return <div style={{ fontSize: 11, color: "#FF3B30", marginTop: 8 }}>Акция истекла — выберите новое время</div>;
                      const pad = n => String(n).padStart(2, '0');
                      return <div style={{ fontSize: 12, color: "#34C759", marginTop: 8, fontWeight: 600 }}>Осталось: {pad(info.remaining.h)}ч {pad(info.remaining.m)}м {pad(info.remaining.s)}с</div>;
                    })()}
                  </div>
                )}
              </div>
            </Section>

            {/* ── Топ-товар ── */}
            <Section title="Топ-товар" last>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* 🔥 Популярно — independent of sort order; controls only the badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>🔥 Популярно</div>
                    <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>Бейдж на карточке товара</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { haptic('light'); upd(editProd.id, "isPopular", !editProd.isPopular); }}
                    style={{
                      position: "relative",
                      width: 48, height: 28,
                      borderRadius: 14,
                      background: editProd.isPopular ? "#FF3B30" : "rgba(120,120,128,0.32)",
                      border: "none", padding: 0,
                      cursor: "pointer", flexShrink: 0,
                      transition: "background 0.22s",
                    }}
                  >
                    <motion.div
                      animate={{ x: editProd.isPopular ? 22 : 2 }}
                      transition={{ type: "spring", stiffness: 540, damping: 32 }}
                      style={{
                        position: "absolute", top: 2,
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.06)",
                      }}
                    />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>Показывать первым</div>
                    <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>Закрепить в начале каталога</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { haptic('light'); upd(editProd.id, "featured", !editProd.featured); }}
                    style={{
                      position: "relative",
                      width: 48, height: 28,
                      borderRadius: 14,
                      background: editProd.featured ? "#34C759" : "rgba(120,120,128,0.32)",
                      border: "none", padding: 0,
                      cursor: "pointer", flexShrink: 0,
                      transition: "background 0.22s",
                    }}
                  >
                    <motion.div
                      animate={{ x: editProd.featured ? 22 : 2 }}
                      transition={{ type: "spring", stiffness: 540, damping: 32 }}
                      style={{
                        position: "absolute", top: 2,
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.06)",
                      }}
                    />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>Приоритет</div>
                    <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>Чем выше — тем раньше в списке</div>
                  </div>
                  <input
                    type="number"
                    style={{ ...baseInput, width: 80, textAlign: "center", flexShrink: 0, padding: "8px 10px" }}
                    placeholder="0"
                    value={editProd.priority ?? 0}
                    onChange={e => upd(editProd.id, "priority", e.target.value === "" ? "" : +e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* Delete */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setDeleteConfirmId(editProd.id)}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "13px",
                borderRadius: 12,
                border: "none",
                background: "rgba(229,57,53,0.10)",
                color: "#E53935",
                fontWeight: 600, fontSize: 14,
                cursor: "pointer",
                letterSpacing: -0.1,
                fontFamily: "inherit",
              }}
            >
              {t.delete}
            </motion.button>
          </div>
        </div>
        );
      })()}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            key="del-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              key="del-card"
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.30)" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(229,57,53,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E53935" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111", textAlign: "center", letterSpacing: -0.2, marginBottom: 6 }}>{t.confirmDelete}</div>
              <div style={{ fontSize: 13, color: "#8E8E93", textAlign: "center", lineHeight: 1.45, marginBottom: 18 }}>
                {lang === 'kg' ? 'Бул иш-аракет кайтарылбайт.' : 'Это действие нельзя отменить.'}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDeleteConfirmId(null)}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#F2F2F7", color: "#111", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  {lang === 'kg' ? 'Жокко чыгаруу' : 'Отмена'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => { const id = deleteConfirmId; setDeleteConfirmId(null); haptic('medium'); await delProd(id); }}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#E53935", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  {t.delete}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => {
          const stockPrices = (p.variants || []).filter(v => v.inStock).map(v => v.price).filter(Boolean);
          const minPrice = stockPrices.length ? Math.min(...stockPrices) : null;
          const inStockCount = (p.variants || []).filter(v => v.inStock).length;
          const totalVariants = (p.variants || []).length;
          const isFeatured = !!p.featured;
          return (
            <motion.div
              key={p.id}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 460, damping: 30 }}
              onClick={() => setEditing(editing === p.id ? null : p.id)}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.05)",
                border: "0.5px solid rgba(0,0,0,0.05)",
              }}
            >
              {/* Image */}
              <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: p.img ? "#fff" : T.accentPale,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0,
                border: "0.5px solid rgba(0,0,0,0.04)",
              }}>
                {p.img
                  ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
                  : React.cloneElement(IC.bottle, { style: { width: 22, height: 22, color: T.accent, opacity: 0.5 } })}
              </div>

              {/* Info — brand · name · price + variant counts */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>{p.brand || '—'}</div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 14, letterSpacing: -0.2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name || t.newProduct}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  {minPrice !== null ? (
                    <span style={{ color: "#111", fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>
                      {t.fromPrice} {formatSum(minPrice)}
                    </span>
                  ) : (
                    <span style={{ color: T.danger, fontSize: 11, fontWeight: 600 }}>Нет в наличии</span>
                  )}
                  <span style={{ color: T.textMuted, fontSize: 11 }}>·</span>
                  <span style={{ color: T.textSecond, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                    {inStockCount}/{totalVariants} {totalVariants === 1 ? 'вар.' : 'вар.'}
                  </span>
                </div>
              </div>

              {/* Action buttons — featured / edit / delete — 36px for better tap targets */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 460, damping: 22 }}
                  onClick={(e) => toggleFeatured(e, p)}
                  aria-label="featured"
                  style={{
                    width: 36, height: 36, borderRadius: 11, padding: 0,
                    border: "none",
                    background: isFeatured ? "rgba(255,184,0,0.16)" : "rgba(0,0,0,0.04)",
                    color: isFeatured ? "#E5A100" : "#9A9AA0",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={isFeatured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 460, damping: 22 }}
                  onClick={(e) => { e.stopPropagation(); haptic('light'); setEditing(p.id); }}
                  aria-label="edit"
                  style={{
                    width: 36, height: 36, borderRadius: 11, padding: 0,
                    border: "none",
                    background: "rgba(10,132,255,0.10)",
                    color: "#0A84FF",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 460, damping: 22 }}
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                  aria-label="delete"
                  style={{
                    width: 36, height: 36, borderRadius: 11, padding: 0,
                    border: "none",
                    background: "rgba(229,57,53,0.10)",
                    color: "#E53935",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ADMIN STATS ───────────────────────────────────────────────────────────────
function AdminStatsScreen({ orders = [], products = [], registeredUsers = [], visitCount = 0 }) {
  const { t } = useLang();
  const delivered = orders.filter(o => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);

  // Today stats
  const todayOrdersCount = orders.filter(o => {
    try { return new Date(o.date).toDateString() === new Date().toDateString(); } catch { return false; }
  }).length;
  const todayRevenue = orders.filter(o => {
    try { return new Date(o.date).toDateString() === new Date().toDateString() && o.status === "delivered"; } catch { return false; }
  }).reduce((s, o) => s + (o.total || 0), 0);

  // Status counts
  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  // Top products
  const topProds = {};
  orders.forEach(o => (o.items || []).forEach(it => { topProds[it.name] = (topProds[it.name] || 0) + it.qty; }));
  const topList = Object.entries(topProds).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Last 7 days chart data
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayData = days.map(d => ({
    label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    count: orders.filter(o => {
      try { return new Date(o.date).toDateString() === d.toDateString(); } catch { return false; }
    }).length,
  }));
  const maxCount = Math.max(...dayData.map(d => d.count), 1);

  const stats = [
    { label: t.totalRevenue, val: formatSum(totalRevenue), color: T.accent, bg: T.accentLight },
    { label: t.totalOrders, val: orders.length, color: "#3B82F6", bg: "#EFF6FF" },
    { label: t.registeredCount, val: registeredUsers.length, color: T.referral, bg: "#F5F3FF" },
    { label: t.visits, val: visitCount, color: T.bonus, bg: "#FFF7ED" },
  ];

  const recentUsers = registeredUsers.slice(-5).reverse();

  try {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.stats}</div>

      {/* Top 4 cards — PRO: spring entrance + count-up where numeric */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {stats.map((s, i) => {
          // s.val may be string ("123 456 сом") or number — count up only when number
          const numericVal = typeof s.val === 'number' ? s.val : null;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
              style={{ ...card({ padding: "16px" }) }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                {React.cloneElement(IC.stats, { style: { width: 18, height: 18, color: s.color } })}
              </div>
              <div style={{ color: s.color, fontSize: 20, fontWeight: 900 }}>
                {numericVal !== null ? <NumberCounter value={numericVal} duration={1.0} /> : s.val}
              </div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>{s.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Today stats */}
      <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: T.accentPale, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ color: T.textMuted, fontSize: 11 }}>{t.todayOrders}</div>
            <div style={{ color: T.accent, fontSize: 22, fontWeight: 900 }}>{todayOrdersCount}</div>
          </div>
          <div style={{ background: T.accentPale, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ color: T.textMuted, fontSize: 11 }}>{t.todayRevenue}</div>
            <div style={{ color: T.accent, fontSize: 18, fontWeight: 900 }}>{formatSum(todayRevenue)}</div>
          </div>
        </div>
      </div>

      {/* Last 7 days chart */}
      <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t.last7days}</div>
        <svg width="100%" viewBox="0 0 280 120" style={{ display: "block" }}>
          {dayData.map((d, i) => {
            const barH = Math.max((d.count / maxCount) * 80, d.count > 0 ? 4 : 0);
            const x = i * 40 + 10;
            return (
              <g key={i}>
                <rect x={x} y={100 - barH} width={24} height={barH} rx={4} fill={T.accent} opacity={0.85} />
                <text x={x + 12} y={115} textAnchor="middle" fontSize="8" fill={T.textMuted}>{d.label}</text>
                {d.count > 0 && <text x={x + 12} y={96 - barH} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>{d.count}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Status distribution */}
      {Object.keys(statusCounts).length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.ordersByStatus}</div>
          {Object.entries(statusCounts).map(([s, cnt]) => {
            const pct = orders.length ? Math.round(cnt / orders.length * 100) : 0;
            return (
              <div key={s} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: T.textSecond, fontSize: 13 }}>{t["status_" + s] || s}</span>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{cnt} ({pct}%)</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: T.bg }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: T.accent, transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top 5 products */}
      {topList.length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.topProducts}</div>
          {topList.map(([name, qty], i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 10, background: i === 0 ? T.accent : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#fff" : T.accent, fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, color: T.text, fontSize: 13 }}>{name}</div>
              <div style={{ color: T.accent, fontWeight: 700 }}>{qty} {t.pcs}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent registered users */}
      {recentUsers.length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.recentUsers}</div>
          {recentUsers.map((u, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: i < recentUsers.length - 1 ? 10 : 0, borderBottom: i < recentUsers.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {React.cloneElement(IC.user, { style: { width: 16, height: 16, color: T.accent } })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{u.name || u.phone}</div>
                <div style={{ color: T.textMuted, fontSize: 11 }}>{u.phone} · {u.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  } catch (err) {
    console.error('[Stats CRASH]', err);
    return <div style={{ padding: 32, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Stats crashed: {String(err?.message || err)}</div>;
  }
}
// ─── ADMIN BANNERS ─────────────────────────────────────────────────────────────
function AdminBannersScreen({ banners = [], setBanners, products = [] }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(null);
  const bannerFileRef = useRef(null);
  const [bannerCropSrc, setBannerCropSrc] = useState(null);
  const addBanner = () => { const nb = { id: Date.now(), title: "", subtitle: "", img: null, bg: BG_PRESETS[0], active: true, textX: 50, textY: 50, textAlign: 'center', btnText: '', linkedProductId: '', overlayTop: 0.08, overlayBottom: 0.45 }; setBanners(p => [...p, nb]); setEditing(nb.id); };
  const textDragRef = useRef(null);
  const previewRef = useRef(null);
  const upd = (id, f, v) => setBanners(prev => prev.map(b => b.id === id ? { ...b, [f]: v } : b));
  const del = (id) => { setBanners(p => p.filter(b => b.id !== id)); if (editing === id) setEditing(null); };
  const editB = banners.find(b => b.id === editing);
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      <div style={{ padding: "52px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.banners}</div>
        <button onClick={addBanner} style={{ ...btnGreen({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>
      <div style={{ margin: "0 16px 16px", background: '#FFFBF0', borderRadius: 12, padding: 14, border: '1px solid #FFE0B2' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#FF6B00', marginBottom: 6 }}>
          {lang === 'kg' ? 'Фото боюнча сунуштар' : 'Рекомендации по фото'}
        </div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
          • {lang === 'kg' ? 'Өлчөмү' : 'Размер'}: 1400 × 540 px ({lang === 'kg' ? 'идеалдуу' : 'идеально'})<br/>
          • {lang === 'kg' ? 'Формат' : 'Формат'}: JPG {lang === 'kg' ? 'же' : 'или'} PNG<br/>
          • {lang === 'kg' ? 'Файл өлчөмү' : 'Размер файла'}: {lang === 'kg' ? '2MB чейин' : 'до 2MB'}<br/>
          • {lang === 'kg' ? 'Затемнение слайдерлери менен жарыкты тууралаңыз' : 'Настройте затемнение слайдерами ниже'}<br/>
          • {lang === "ru" ? "Создайте на Canva.com" : "Canva.com'до жасаңыз"}
        </div>
      </div>
      {editB && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "20px" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{t.editBanner}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
          {/* Banner Preview — haqiqiy banner ko'rinishi */}
          <div style={{ marginBottom: 14 }}>
            {/* Preview label */}
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              {lang === 'kg' ? 'Баннер алдын ала көрүнүшү' : 'Предпросмотр баннера'}
            </div>

            {/* Banner shablon — haqiqiy o'lchamda */}
            <div style={{
              width: "100%",
              height: 160,
              borderRadius: 14,
              overflow: "hidden",
              position: "relative",
              background: editB.img ? "transparent" : editB.bg || "#111",
              border: `2px dashed ${T.border}`,
              cursor: "pointer"
            }}
              onClick={() => bannerFileRef.current?.click()}
            >
              {/* Rasm */}
              {editB.img && (
                <img
                  src={editB.img}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top"
                  }}
                />
              )}

              {/* Gradient overlay — real-time preview with admin overlay settings */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: editB.img
                  ? `linear-gradient(to bottom, rgba(0,0,0,${editB.overlayTop ?? 0.08}) 0%, rgba(0,0,0,${editB.overlayBottom ?? 0.45}) 100%)`
                  : "transparent",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "0 22px"
              }}>
                {editB.img ? (
                  <>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>{lang === 'kg' ? 'АКЦИЯ' : 'АКЦИЯ'}</div>
                    <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{editB.title || "Kemal Usman"}</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>{editB.subtitle || ""}</div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "rgba(255,255,255,0.6)" }}>
                    {React.cloneElement(IC.camera, { style: { width: 28, height: 28 } })}
                    <span style={{ fontSize: 12 }}>{lang === 'kg' ? 'Сүрөт жүктөө' : 'Загрузить фото'}</span>
                  </div>
                )}
              </div>

              {/* Rasm bor bo'lsa — ustiga bosib almashtirish belgisi */}
              {editB.img && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.5)", borderRadius: 8,
                  padding: "4px 8px", color: "#fff", fontSize: 11, fontWeight: 600,
                  cursor: "pointer"
                }}>
                  {lang === 'kg' ? '↑ Алмаштыруу' : '↑ Заменить'}
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = ev => setBannerCropSrc(ev.target.result);
                r.readAsDataURL(f);
                e.target.value = '';
              }}
            />

            {/* Crop modal — BannerCropModal exports 1200×480 for desktop quality */}
            {bannerCropSrc && (
              <BannerCropModal
                src={bannerCropSrc}
                onDone={v => { upd(editB.id, "img", v); setBannerCropSrc(null); }}
                onCancel={() => setBannerCropSrc(null)}
              />
            )}

            {/* O'chirish tugmasi — rasm bor bo'lsa */}
            {editB.img && (
              <button
                onClick={() => upd(editB.id, "img", null)}
                style={{ marginTop: 6, width: "100%", padding: "8px 0", borderRadius: 10, border: `1px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {lang === 'kg' ? 'Сүрөттү өчүрүү' : 'Удалить фото'}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input style={inputStyle} placeholder={t.bannerTitle} value={editB.title} onChange={e => upd(editB.id, "title", e.target.value)} />
            <input style={inputStyle} placeholder={t.bannerSubtitle} value={editB.subtitle} onChange={e => upd(editB.id, "subtitle", e.target.value)} />
          </div>

          {/* ── TEXT POSITION — drag label around mini preview ── */}
          {(editB.title || editB.subtitle) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8 }}>
                Позиция текста — перетащите метку:
              </div>
              {/* Mini 16:5 preview with draggable text dot */}
              <div
                ref={previewRef}
                style={{ position: 'relative', width: '100%', height: 100,
                  borderRadius: 10, overflow: 'hidden', background: editB.bg || '#111',
                  border: `1px solid ${T.border}`, cursor: 'crosshair', touchAction: 'none' }}
                onMouseDown={e => {
                  const rect = previewRef.current.getBoundingClientRect();
                  const move = (ev) => {
                    const x = Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100));
                    const y = Math.min(100, Math.max(0, ((ev.clientY - rect.top) / rect.height) * 100));
                    upd(editB.id, 'textX', Math.round(x));
                    upd(editB.id, 'textY', Math.round(y));
                  };
                  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', up);
                  move(e);
                }}
                onTouchStart={e => {
                  e.preventDefault();
                  const rect = previewRef.current.getBoundingClientRect();
                  const move = (ev) => {
                    const t = ev.touches[0];
                    const x = Math.min(100, Math.max(0, ((t.clientX - rect.left) / rect.width) * 100));
                    const y = Math.min(100, Math.max(0, ((t.clientY - rect.top) / rect.height) * 100));
                    upd(editB.id, 'textX', Math.round(x));
                    upd(editB.id, 'textY', Math.round(y));
                  };
                  const up = () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
                  window.addEventListener('touchmove', move, { passive: false });
                  window.addEventListener('touchend', up);
                  move(e);
                }}
              >
                {editB.img && (
                  <img src={editB.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                {/* Grid lines */}
                {[33,66].map(p => (
                  <React.Fragment key={p}>
                    <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                  </React.Fragment>
                ))}
                {/* Draggable text label */}
                <div style={{
                  position: 'absolute',
                  left: `${editB.textX ?? 50}%`, top: `${editB.textY ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  textAlign: editB.textAlign || 'center',
                  maxWidth: '80%',
                }}>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1, textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                    {editB.title || 'Заголовок'}
                  </div>
                  {editB.subtitle && (
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 8, textShadow: '0 1px 2px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                      {editB.subtitle}
                    </div>
                  )}
                  {/* Drag handle dot */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', border: '2px solid #C9A84C', background: 'rgba(201,168,76,0.2)', zIndex: -1 }} />
                </div>
              </div>
              {/* Text alignment buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {[['left','←'], ['center','↔'], ['right','→']].map(([a, icon]) => (
                  <button key={a} onClick={() => upd(editB.id, 'textAlign', a)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${editB.textAlign === a ? T.text : T.border}`,
                      background: editB.textAlign === a ? T.text : 'transparent', color: editB.textAlign === a ? '#fff' : T.textSecond,
                      fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── OVERLAY CONTROL — затемнение баннера ── */}
          {editB.img && (
            <div style={{ marginTop: 14, background: '#F9F8F6', borderRadius: 12, padding: 14 }}>
              <div style={{ color: T.textSecond, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                {lang === 'kg' ? 'Караңгылатуу деңгээли' : 'Затемнение фото'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: T.textMuted, minWidth: 40 }}>Верх</span>
                <input
                  type="range" min="0" max="80" step="5"
                  value={Math.round((editB.overlayTop ?? 0.08) * 100)}
                  onChange={e => upd(editB.id, 'overlayTop', parseInt(e.target.value) / 100)}
                  style={{ flex: 1, accentColor: '#111' }}
                />
                <span style={{ fontSize: 11, color: T.text, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                  {Math.round((editB.overlayTop ?? 0.08) * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: T.textMuted, minWidth: 40 }}>Низ</span>
                <input
                  type="range" min="0" max="80" step="5"
                  value={Math.round((editB.overlayBottom ?? 0.45) * 100)}
                  onChange={e => upd(editB.id, 'overlayBottom', parseInt(e.target.value) / 100)}
                  style={{ flex: 1, accentColor: '#111' }}
                />
                <span style={{ fontSize: 11, color: T.text, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                  {Math.round((editB.overlayBottom ?? 0.45) * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                {lang === 'kg' ? '0% = караңгылатуусуз, 80% = максимум' : '0% = без затемнения, 80% = максимум'}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8 }}>{t.background}:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BG_PRESETS.map(bg => <div key={bg} onClick={() => upd(editB.id, "bg", bg)} style={{ width: 40, height: 40, borderRadius: 12, background: bg, cursor: "pointer", border: `3px solid ${editB.bg === bg ? T.text : "transparent"}` }} />)}
            </div>
          </div>
          {/* ── CTA BUTTON & PRODUCT LINK ── */}
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
              Кнопка «Выбрать аромат»
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Текст кнопки (напр. ВЫБРАТЬ АРОМАТ)"
              value={editB.btnText || ''}
              onChange={e => upd(editB.id, 'btnText', e.target.value)}
            />
            {/* Product selector */}
            <div style={{ color: T.textSecond, fontSize: 11, marginBottom: 6 }}>
              Открыть товар при нажатии (необязательно):
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 10, border: `1px solid ${T.border}` }}>
              {/* Clear selection */}
              <div
                onClick={() => upd(editB.id, 'linkedProductId', '')}
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  background: !editB.linkedProductId ? T.accent : 'transparent',
                  color: !editB.linkedProductId ? '#fff' : T.text, fontSize: 13, fontWeight: 600 }}>
                <span>↓ Перейти в каталог (по умолчанию)</span>
              </div>
              {products.map(p => (
                <div
                  key={p.id}
                  onClick={() => upd(editB.id, 'linkedProductId', p.id)}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    borderTop: `1px solid ${T.border}`,
                    background: editB.linkedProductId === p.id ? T.accent : 'transparent',
                    color: editB.linkedProductId === p.id ? '#fff' : T.text }}>
                  {(p.img || p.images?.[0]) && (
                    <img src={p.img || p.images?.[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{p.brand}</div>
                  </div>
                  {editB.linkedProductId === p.id && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 14 }}>{t.active}</div>
            <div onClick={() => upd(editB.id, "active", !editB.active)} style={{ width: 48, height: 28, borderRadius: 14, background: editB.active ? T.accent : T.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: editB.active ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditing(null)} style={btnGreen({ flex: 1, padding: "13px 0", borderRadius: 14 })}>{t.save}</button>
            <button onClick={() => del(editB.id)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontWeight: 700, cursor: "pointer" }}>{t.delete}</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {banners.map(b => (
          <div key={b.id} style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setEditing(editing === b.id ? null : b.id)}>
            <div style={{ width: 56, height: 40, borderRadius: 10, background: b.img ? "transparent" : b.bg, overflow: "hidden", flexShrink: 0 }}>
              {b.img && <img src={b.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.text, fontWeight: 700 }}>{b.title || t.noTitle}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{b.subtitle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.active ? T.accent : T.border }} />
              <span style={{ color: T.textMuted }}>{editing === b.id ? "▲" : "▼"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN BONUS ───────────────────────────────────────────────────────────────
function AdminBonusScreen({ settings = {}, setSettings, showToast }) {
  const { t, lang } = useLang();
  const [local, setLocal] = useState({ ...settings });
  const upd = (f, v) => setLocal(p => ({ ...p, [f]: v }));

  const BonusField = ({ field, label, suffix, hint }) => (
    <div style={{ padding: "12px 16px", background: SETTINGS_CARD_BG, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#000", letterSpacing: -0.2, fontFamily: SETTINGS_FONT }}>{label}</div>
          {hint && <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>{hint}</div>}
        </div>
        <div style={{ position: "relative", width: 100, flexShrink: 0 }}>
          <input
            type="number"
            style={{
              width: "100%", padding: "10px 36px 10px 14px",
              background: "#F5F5F7", border: "0.5px solid transparent",
              borderRadius: 10, fontSize: 16, fontWeight: 600,
              color: "#111", outline: "none", textAlign: "right",
              fontFamily: SETTINGS_FONT, boxSizing: "border-box",
            }}
            value={local[field] || 0}
            onChange={e => upd(field, +e.target.value)}
            onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(10,132,255,0.35)"; }}
            onBlur={e => { e.target.style.background = "#F5F5F7"; e.target.style.borderColor = "transparent"; }}
          />
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#8E8E93", fontWeight: 500, pointerEvents: "none" }}>{suffix}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: SETTINGS_PAGE_BG, minHeight: "100vh", paddingBottom: "var(--nav-height)", fontFamily: SETTINGS_FONT }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 700, color: "#000", letterSpacing: -0.5 }}>{t.bonusSettings}</div>

      {/* ── Бонус система ── */}
      <SettingsSection header="Бонус система" footer={lang === 'kg' ? 'Кардар заказ берген сайын бонус алат' : 'Клиент получает бонус с каждого заказа'}>
        <BonusField field="bonusPercent" label={t.bonusPercent} suffix="%" hint={lang === 'kg' ? 'Заказдан бонус пайызы' : 'Процент от суммы заказа'} />
        <div style={{ height: 0.5, background: SETTINGS_SEPARATOR, marginLeft: 16 }} />
        <BonusField field="useBonusPercent" label={t.useBonusPercent} suffix="%" hint={lang === 'kg' ? 'Макс. бонус менен төлөө пайызы' : 'Макс. % оплаты бонусами'} />
      </SettingsSection>

      {/* ── Приветственный бонус ── */}
      <SettingsSection header={lang === 'kg' ? 'Кош келүү бонусу' : 'Приветственный бонус'}>
        <div style={{ padding: "12px 16px", background: SETTINGS_CARD_BG, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#000", letterSpacing: -0.2 }}>{t.welcomeBonusEnabled}</div>
            <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>{lang === 'kg' ? 'Жаңы кардарга бонус' : 'Бонус при первом заказе'}</div>
          </div>
          <div onClick={() => upd("welcomeBonusEnabled", !local.welcomeBonusEnabled)} style={{ width: 51, height: 31, borderRadius: 16, background: local.welcomeBonusEnabled ? '#34C759' : '#E9E9EA', cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: local.welcomeBonusEnabled ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.06)', transition: "left 0.2s" }} />
          </div>
        </div>
        {local.welcomeBonusEnabled && (
          <>
            <div style={{ height: 0.5, background: SETTINGS_SEPARATOR, marginLeft: 16 }} />
            <BonusField field="welcomeBonus" label={t.welcomeBonus} suffix="сом" />
          </>
        )}
      </SettingsSection>

      {/* ── Реферальная программа ── */}
      <SettingsSection header={lang === 'kg' ? 'Реферал программасы' : 'Реферальная программа'} footer={lang === 'kg' ? 'Кардар досторуна код жөнөтөт, экөө тең бонус алат' : 'Клиент делится кодом — оба получают бонус'}>
        <BonusField field="referralBonus" label={t.referralBonus} suffix="сом" hint={lang === 'kg' ? 'Чакырган кардарга' : 'Тому, кто пригласил'} />
        <div style={{ height: 0.5, background: SETTINGS_SEPARATOR, marginLeft: 16 }} />
        <BonusField field="referralFriendBonus" label={t.referralFriendBonus} suffix="сом" hint={lang === 'kg' ? 'Жаңы кардарга' : 'Новому клиенту'} />
      </SettingsSection>

      {/* ── Доставка ── */}
      <SettingsSection header={lang === 'kg' ? 'Жеткирүү' : 'Доставка'} footer={lang === 'kg' ? 'Заказ суммасы жетишкен болсо доставка бесплатно' : 'Бесплатная доставка при заказе от указанной суммы'}>
        <BonusField field="deliveryCost" label={t.deliveryCost} suffix="сом" hint={lang === 'kg' ? 'Бүт Кыргызстан боюнча' : 'По всему Кыргызстану'} />
        <div style={{ height: 0.5, background: SETTINGS_SEPARATOR, marginLeft: 16 }} />
        <BonusField field="minOrderForFreeDelivery" label={t.minOrderForFreeDelivery} suffix="сом" hint={lang === 'kg' ? 'Бесплатно доставка суммасы' : 'Минимум для бесплатной доставки'} />
      </SettingsSection>

      <div style={{ padding: "0 16px" }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { setSettings(local); showToast?.('Сохранено'); }}
          style={{
            width: "100%", padding: 16, marginTop: 4,
            background: '#007AFF', color: '#fff',
            border: 'none', borderRadius: 14,
            fontSize: 17, fontWeight: 600,
            cursor: 'pointer', fontFamily: SETTINGS_FONT,
            letterSpacing: -0.2,
          }}
        >
          {t.saveSettings}
        </motion.button>
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS — iOS Settings style ───────────────────────────────────────
// Grouped sections with rounded white cards, colored icon squares, chevrons,
// and right-pushing sub-screens for editors. Banners and Bonus are sub-screens
// here (no longer separate admin tabs).
const SETTINGS_PAGE_BG  = '#F2F2F7';
const SETTINGS_CARD_BG  = '#FFFFFF';
const SETTINGS_SEPARATOR = 'rgba(60, 60, 67, 0.18)';
const SETTINGS_SECTION_HEADER = '#6E6E73';
const SETTINGS_LABEL_COLOR = '#000000';
const SETTINGS_VALUE_COLOR = '#8E8E93';
const SETTINGS_DANGER = '#FF3B30';
const SETTINGS_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',sans-serif";

const SET_ICON = {
  photo: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" fill="#fff" stroke="none" /><path d="M21 15l-5-5L5 21" /></svg>,
  gift:  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" rx="1" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>,
  chat:  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  card:  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  store: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11a1 1 0 001 1h14a1 1 0 001-1V9" /><path d="M3 9c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3s3-1.5 3-3" /></svg>,
  pin:   <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  clock: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>,
  info:  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="17" /><circle cx="12" cy="7.5" r="0.6" fill="#fff" stroke="none" /></svg>,
  lock:  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>,
  logout:<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  loginBg: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>,
};

function SettingsIcon({ children, color }) {
  return (
    <div style={{
      width: 29, height: 29, borderRadius: 7,
      background: color, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{children}</div>
  );
}

function SettingsRow({ icon, color, label, value, onClick, last, danger, isToggle, toggleValue, onToggle }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', minHeight: 44,
        cursor: onClick ? 'pointer' : 'default',
        background: SETTINGS_CARD_BG,
        position: 'relative',
      }}
    >
      {icon && <SettingsIcon color={color}>{icon}</SettingsIcon>}
      <div style={{
        flex: 1, fontSize: 17,
        color: danger ? SETTINGS_DANGER : SETTINGS_LABEL_COLOR,
        fontWeight: danger ? 500 : 400,
        fontFamily: SETTINGS_FONT,
      }}>{label}</div>
      {value !== undefined && value !== null && value !== '' && (
        <div style={{ fontSize: 17, color: SETTINGS_VALUE_COLOR, fontFamily: SETTINGS_FONT, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      )}
      {isToggle && (
        <div onClick={(e) => { e.stopPropagation(); onToggle?.(!toggleValue); }} style={{ width: 51, height: 31, borderRadius: 16, background: toggleValue ? '#34C759' : '#E9E9EA', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 2, left: toggleValue ? 22 : 2, width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.06)', transition: 'left 0.2s' }} />
        </div>
      )}
      {onClick && !isToggle && (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#C7C7CC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
      )}
      {!last && (
        <div style={{ position: 'absolute', left: icon ? 57 : 16, right: 0, bottom: 0, height: 0.5, background: SETTINGS_SEPARATOR }} />
      )}
    </div>
  );
}

function SettingsSection({ header, footer, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {header && (
        <div style={{
          padding: '0 16px 6px', fontSize: 13,
          color: SETTINGS_SECTION_HEADER, textTransform: 'uppercase',
          fontFamily: SETTINGS_FONT, letterSpacing: -0.08,
        }}>{header}</div>
      )}
      <div style={{ background: SETTINGS_CARD_BG, borderRadius: 10, overflow: 'hidden', marginInline: 16 }}>{children}</div>
      {footer && (
        <div style={{ padding: '6px 16px 0', fontSize: 13, color: SETTINGS_SECTION_HEADER, fontFamily: SETTINGS_FONT, lineHeight: 1.35 }}>{footer}</div>
      )}
    </div>
  );
}

function SettingsSubScreen({ title, onBack, children }) {
  return (
    <div style={{ background: SETTINGS_PAGE_BG, minHeight: '100vh' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(247,247,247,0.92)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '0.5px solid ' + SETTINGS_SEPARATOR,
        padding: '52px 8px 10px',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#007AFF', fontSize: 17, fontFamily: SETTINGS_FONT, padding: '4px 10px', justifySelf: 'start' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Настройки
        </button>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#000', fontFamily: SETTINGS_FONT }}>{title}</div>
        <div />
      </div>
      <div style={{ paddingTop: 16, paddingBottom: 'var(--nav-height)' }}>{children}</div>
    </div>
  );
}

function SettingsTextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ padding: '8px 16px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, background: SETTINGS_CARD_BG, position: 'relative' }}>
      {label && <div style={{ fontSize: 17, color: SETTINGS_LABEL_COLOR, fontFamily: SETTINGS_FONT, minWidth: 110 }}>{label}</div>}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent', fontSize: 17, fontFamily: SETTINGS_FONT,
          color: SETTINGS_LABEL_COLOR, textAlign: label ? 'right' : 'left',
          padding: 0, minWidth: 0,
        }}
      />
    </div>
  );
}

function AdminSettingsScreen({ banners = [], setBanners, products = [], settings = {}, setSettings, onLogout, showToast, lang }) {
  const { t, setLang } = useLang();
  const [sub, setSub] = useState(null); // null | 'banners' | 'bonus' | 'whatsapp' | 'mbank' | 'obank' | 'shop' | 'loginBg'

  // localStorage-backed credentials
  const [mbankPhone, setMbankPhone]         = useState(() => localStorage.getItem('mbank_phone')     || '');
  const [obankPhone, setObankPhone]         = useState(() => localStorage.getItem('obank_phone')     || '');
  // The merchant's own WhatsApp number is the recipient for admin order
  // notifications — not a credential, so it can stay in localStorage.
  // GREEN_API_INSTANCE / GREEN_API_TOKEN are now PB env vars (see
  // pb_hooks/whatsapp.pb.js); they no longer exist on the client at all.
  const [whatsappAdmin, setWhatsappAdmin]   = useState(() => localStorage.getItem('whatsapp_admin')  || '');
  // adminPassword state removed — admin credentials are now managed in the
  // PocketBase admin UI at PB_URL/_/, not from inside the client app.

  const loginBgRef = useRef();
  const instaScreenRef = useRef();

  const saveAndPop = (saver, msg = 'Сохранено') => {
    saver();
    showToast?.(msg);
    setSub(null);
  };

  const saveWhatsapp = () => {
    localStorage.setItem('whatsapp_admin', whatsappAdmin);
    // green_instance / green_token deliberately NOT saved here — they are
    // managed by the PB host (env vars), never by the client.
  };
  const saveMbank = () => localStorage.setItem('mbank_phone', mbankPhone);
  const saveObank = () => localStorage.setItem('obank_phone', obankPhone);

  const handleLoginBgUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setSettings(p => ({ ...p, loginBg: dataUrl }));
      localStorage.setItem('parfum_login_bg', dataUrl);
      showToast?.('Фон сохранён');
    };
    reader.readAsDataURL(file);
  };

  const handleInstaScreenUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 1) Upload to PocketBase (shared with ALL users)
    const rec = await api.uploadSiteMedia('instagramScreen', file);
    if (rec && rec.id && rec.file) {
      const url = `${PB_URL}/api/files/site_media/${rec.id}/${rec.file}`;
      setSettings(p => ({ ...p, instagramScreen: url }));
      localStorage.setItem('parfum_insta_screen', url);
      showToast?.('Instagram скриншот сохранён');
    } else {
      // Fallback to localStorage base64 if PB upload fails
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        setSettings(p => ({ ...p, instagramScreen: dataUrl }));
        localStorage.setItem('parfum_insta_screen', dataUrl);
        showToast?.('Сохранено локально (PB недоступен)');
      };
      reader.readAsDataURL(file);
    }
  };

  // Sub-screen renderers ────────────────────────────────────────────────────────

  const renderBanners = () => (
    <SettingsSubScreen title="Баннеры" onBack={() => setSub(null)}>
      <AdminBannersScreen banners={banners} setBanners={setBanners} products={products} />
    </SettingsSubScreen>
  );

  const renderBonus = () => (
    <SettingsSubScreen title="Бонусы" onBack={() => setSub(null)}>
      <AdminBonusScreen settings={settings} setSettings={setSettings} showToast={showToast} />
    </SettingsSubScreen>
  );

  const renderWhatsapp = () => (
    <SettingsSubScreen title="WhatsApp" onBack={() => setSub(null)}>
      <SettingsSection
        header="Уведомления"
        footer="На этот номер приходят уведомления о новых заказах."
      >
        <SettingsTextField label="Ваш номер" value={whatsappAdmin} onChange={setWhatsappAdmin} placeholder="+996 700 000 000" />
      </SettingsSection>
      {/* Static info card — Instance ID + API Token are no longer client-
          editable. They live on the PB host as GREEN_API_INSTANCE +
          GREEN_API_TOKEN env vars and are wrapped by the server hook
          /api/custom/whatsapp/send (pb_hooks/whatsapp.pb.js). */}
      <SettingsSection header="Green API">
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: SETTINGS_LABEL_COLOR, fontWeight: 600, marginBottom: 6, fontFamily: SETTINGS_FONT, letterSpacing: -0.1 }}>
            Настройки на сервере
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5, fontFamily: SETTINGS_FONT, letterSpacing: -0.05 }}>
            Параметры <b>GREEN_API_INSTANCE</b> и <b>GREEN_API_TOKEN</b> задаются в переменных окружения PocketBase. Это исключает утечку токена через приложение. Обратитесь к разработчику для изменения.
          </div>
        </div>
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => saveAndPop(saveWhatsapp)} style={primarySaveBtn}>Сохранить</button>
      </div>
    </SettingsSubScreen>
  );

  const renderMbank = () => (
    <SettingsSubScreen title="M-Bank" onBack={() => setSub(null)}>
      <SettingsSection
        header="Реквизиты"
        footer="Клиенты переводят оплату на этот номер через M-Bank. Введите номер с кодом страны."
      >
        <SettingsTextField label="Телефон" value={mbankPhone} onChange={setMbankPhone} placeholder="+996 700 000 000" />
      </SettingsSection>
      <SettingsSection header="QR-код для оплаты" footer="Клиент отсканирует QR прямо из корзины на сайте">
        {settings?.mbankQr && (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={settings.mbankQr} alt="QR M-Bank"
              style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #E5E5E5' }} />
            <div onClick={() => setSettings(p => ({ ...p, mbankQr: '' }))}
              style={{ fontSize: 12, color: SETTINGS_DANGER, cursor: 'pointer', letterSpacing: 0.5 }}>
              Удалить QR
            </div>
          </div>
        )}
        <div style={{ padding: '12px 16px' }}>
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setSettings(p => ({ ...p, mbankQr: ev.target.result }));
              reader.readAsDataURL(file);
            }}
            style={{ fontSize: 13 }}
          />
        </div>
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => saveAndPop(saveMbank)} style={primarySaveBtn}>Сохранить</button>
      </div>
    </SettingsSubScreen>
  );

  const renderObank = () => (
    <SettingsSubScreen title="O!Bank" onBack={() => setSub(null)}>
      <SettingsSection
        header="Реквизиты"
        footer="Клиенты переводят оплату на этот номер через O!Bank."
      >
        <SettingsTextField label="Телефон" value={obankPhone} onChange={setObankPhone} placeholder="+996 700 000 000" />
      </SettingsSection>
      <SettingsSection header="QR-код для оплаты" footer="Клиент отсканирует QR прямо из корзины на сайте">
        {settings?.obankQr && (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={settings.obankQr} alt="QR O!Bank"
              style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #E5E5E5' }} />
            <div onClick={() => setSettings(p => ({ ...p, obankQr: '' }))}
              style={{ fontSize: 12, color: SETTINGS_DANGER, cursor: 'pointer', letterSpacing: 0.5 }}>
              Удалить QR
            </div>
          </div>
        )}
        <div style={{ padding: '12px 16px' }}>
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setSettings(p => ({ ...p, obankQr: ev.target.result }));
              reader.readAsDataURL(file);
            }}
            style={{ fontSize: 13 }}
          />
        </div>
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => saveAndPop(saveObank)} style={primarySaveBtn}>Сохранить</button>
      </div>
    </SettingsSubScreen>
  );

  const renderShop = () => (
    <SettingsSubScreen title="Магазин" onBack={() => setSub(null)}>
      <SettingsSection header="Информация">
        <SettingsTextField label="Название" value={settings?.shopName || ''} onChange={v => setSettings(p => ({ ...p, shopName: v }))} placeholder="Kemal Usman" />
        <SettingsTextField label="Адрес"    value={settings?.shopAddress || ''} onChange={v => setSettings(p => ({ ...p, shopAddress: v }))} placeholder="ул. Ленина, 45" />
        <SettingsTextField label="Часы"     value={settings?.workingHours || ''} onChange={v => setSettings(p => ({ ...p, workingHours: v }))} placeholder="Пн–Вс: 10:00–21:00" />
      </SettingsSection>
      <SettingsSection header="Карта" footer="Координаты используются для отображения магазина на карте.">
        <SettingsTextField label="Широта"  value={settings?.shopLat || ''} onChange={v => setSettings(p => ({ ...p, shopLat: v }))} placeholder="42.8746" />
        <SettingsTextField label="Долгота" value={settings?.shopLng || ''} onChange={v => setSettings(p => ({ ...p, shopLng: v }))} placeholder="74.5698" />
      </SettingsSection>
      <SettingsSection header="О нас">
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG }}>
          <textarea
            value={settings?.aboutText || ''}
            onChange={e => setSettings(p => ({ ...p, aboutText: e.target.value }))}
            placeholder="Расскажите о магазине..."
            rows={4}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 17, fontFamily: SETTINGS_FONT, color: SETTINGS_LABEL_COLOR, padding: 0, boxSizing: 'border-box' }}
          />
        </div>
      </SettingsSection>
      <SettingsSection header="Desktop — Hero баннер" footer="Тексты, отображаемые в главном баннере на десктопе.">
        <SettingsTextField
          label="Подзаголовок (золотой текст)"
          value={settings?.heroSubtitle || ''}
          onChange={v => setSettings(p => ({ ...p, heroSubtitle: v }))}
          placeholder="Bishkek · Parfum na razliv"
        />
        <SettingsTextField
          label="Описание под заголовком"
          value={settings?.heroTagline || ''}
          onChange={v => setSettings(p => ({ ...p, heroTagline: v }))}
          placeholder="Оригинальные ароматы · Лучшие бренды"
        />
        <SettingsTextField
          label="Текст кнопки"
          value={settings?.heroButtonText || ''}
          onChange={v => setSettings(p => ({ ...p, heroButtonText: v }))}
          placeholder="ВЫБРАТЬ АРОМАТ"
        />
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: SETTINGS_SECTION_HEADER, letterSpacing: 0.3 }}>
            Announcement Bar — каждая строка = новое объявление
          </div>
          <textarea
            value={settings?.announcementTexts || ''}
            onChange={e => setSettings(p => ({ ...p, announcementTexts: e.target.value }))}
            placeholder={'Бесплатная доставка от 1000 сом\nСкидка 15% на Премиум'}
            rows={3}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', fontSize: 14,
              fontFamily: SETTINGS_FONT,
              color: SETTINGS_LABEL_COLOR,
              padding: 0, boxSizing: 'border-box' }}
          />
        </div>
      </SettingsSection>
      <SettingsSection header="Соцсети" footer="Ссылки на страницы в соцсетях. Иконки без ссылки станут неактивными.">
        <SettingsTextField
          label="Instagram"
          value={settings?.instagramUrl || ''}
          onChange={v => setSettings(p => ({ ...p, instagramUrl: v }))}
          placeholder="https://instagram.com/kemalusman"
        />
        <SettingsTextField
          label="IG Token"
          value={settings?.instagramToken || ''}
          onChange={v => setSettings(p => ({ ...p, instagramToken: v }))}
          placeholder="IGQ..."
        />
        <SettingsTextField
          label="TikTok"
          value={settings?.tiktokUrl || ''}
          onChange={v => setSettings(p => ({ ...p, tiktokUrl: v }))}
          placeholder="https://tiktok.com/@kemalusman"
        />
        <SettingsTextField
          label="YouTube"
          value={settings?.youtubeUrl || ''}
          onChange={v => setSettings(p => ({ ...p, youtubeUrl: v }))}
          placeholder="https://youtube.com/@kemalusman"
        />
      </SettingsSection>
      <SettingsSection header="Футер — Компания" footer="Каждая строка — отдельная ссылка в колонке «Компания».">
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG }}>
          <textarea
            value={settings?.footerCompanyLinks || ''}
            onChange={e => setSettings(p => ({ ...p, footerCompanyLinks: e.target.value }))}
            placeholder={'О нас\nДоставка и оплата\nВозврат товара\nКонтакты\nУсловия'}
            rows={5}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', fontSize: 14, fontFamily: SETTINGS_FONT,
              color: SETTINGS_LABEL_COLOR, padding: 0, boxSizing: 'border-box' }}
          />
        </div>
      </SettingsSection>
      <SettingsSection header="Футер — Помощь" footer="Каждая строка — отдельная ссылка в колонке «Помощь».">
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG }}>
          <textarea
            value={settings?.footerHelpLinks || ''}
            onChange={e => setSettings(p => ({ ...p, footerHelpLinks: e.target.value }))}
            placeholder={'Как сделать заказ\nОтследить заказ\nFAQ'}
            rows={3}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', fontSize: 14, fontFamily: SETTINGS_FONT,
              color: SETTINGS_LABEL_COLOR, padding: 0, boxSizing: 'border-box' }}
          />
        </div>
      </SettingsSection>
      <SettingsSection header="Копирайт">
        <SettingsTextField
          label="Текст внизу сайта"
          value={settings?.copyrightText || ''}
          onChange={v => setSettings(p => ({ ...p, copyrightText: v }))}
          placeholder="© 2026 Kemal Usman · All Rights Reserved"
        />
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { showToast?.('Сохранено'); setSub(null); }} style={primarySaveBtn}>Готово</button>
      </div>
    </SettingsSubScreen>
  );

  // renderPassword removed — admin password is now managed in PocketBase
  // (PB_URL/_/), never in the client bundle. See task 1/8 of audit fixes.

  const renderLoginBg = () => (
    <SettingsSubScreen title="Фон входа" onBack={() => setSub(null)}>
      <div style={{ padding: '0 16px' }}>
        {/* Live preview */}
        <div style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', background: '#111', position: 'relative', marginBottom: 20, border: '0.5px solid ' + SETTINGS_SEPARATOR }}>
          <img
            src={settings?.loginBg || '/login-bg.jpeg'}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.78) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 20 }}>
            {/* Live text preview */}
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 26, color: '#f5f0e8', textShadow: '0 2px 20px rgba(0,0,0,0.8)', lineHeight: 1.2, textAlign: 'center' }}>
              {settings?.loginBrandName || 'Kemal Usman'}
            </div>
            <div style={{ width: 36, height: 1, background: 'linear-gradient(90deg, transparent, #c9a96e, transparent)', margin: '8px auto 6px' }} />
            <div style={{ fontSize: 11, color: '#c9a96e', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 500 }}>
              {settings?.loginBrandTagline || 'Parfum'}
            </div>
          </div>
          {/* "Preview" badge */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>
            PREVIEW
          </div>
        </div>

        {/* Editable text fields */}
        <SettingsSection header="Текст на экране входа">
          <SettingsTextField
            label="Название"
            value={settings?.loginBrandName || ''}
            onChange={v => setSettings(p => ({ ...p, loginBrandName: v }))}
            placeholder="Kemal Usman"
          />
          <SettingsTextField
            label="Подпись"
            value={settings?.loginBrandTagline || ''}
            onChange={v => setSettings(p => ({ ...p, loginBrandTagline: v }))}
            placeholder="Parfum"
          />
        </SettingsSection>

        {/* Photo controls */}
        <SettingsSection header="Фоновое фото">
          <input ref={loginBgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLoginBgUpload} />
          <div style={{ padding: '4px 0' }}>
            <button onClick={() => loginBgRef.current?.click()} style={primarySaveBtn}>
              {settings?.loginBg ? '↑ Заменить фото' : '+ Загрузить фото'}
            </button>
            {settings?.loginBg && (
              <button
                onClick={() => { setSettings(p => ({ ...p, loginBg: null })); localStorage.removeItem('parfum_login_bg'); showToast?.('Сброшено'); }}
                style={{ ...primarySaveBtn, background: 'transparent', color: SETTINGS_DANGER, marginTop: 10 }}>
                Сбросить к стандартному
              </button>
            )}
          </div>
        </SettingsSection>
      </div>
    </SettingsSubScreen>
  );

  const renderInstaScreen = () => {
    const stories = settings?.instaStories || [];
    const handleStoryImgUpload = (idx) => (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const updated = [...(settings?.instaStories || [{},{},{},{},{}])];
        while (updated.length < 5) updated.push({});
        updated[idx] = { ...updated[idx], img: ev.target.result };
        setSettings(p => ({ ...p, instaStories: updated }));
        localStorage.setItem('parfum_insta_stories', JSON.stringify(updated));
        showToast?.('Фото сохранено');
      };
      reader.readAsDataURL(file);
    };
    const handleStoryLabel = (idx, label) => {
      const updated = [...(settings?.instaStories || [{},{},{},{},{}])];
      while (updated.length < 5) updated.push({});
      updated[idx] = { ...updated[idx], label };
      setSettings(p => ({ ...p, instaStories: updated }));
      localStorage.setItem('parfum_insta_stories', JSON.stringify(updated));
    };
    const handleStoryDelete = (idx) => {
      const updated = [...(settings?.instaStories || [{},{},{},{},{}])];
      updated[idx] = {};
      setSettings(p => ({ ...p, instaStories: updated }));
      localStorage.setItem('parfum_insta_stories', JSON.stringify(updated));
      showToast?.('Удалено');
    };
    return (
    <SettingsSubScreen title="Instagram" onBack={() => setSub(null)}>
      <div style={{ padding: '0 16px' }}>
        {/* Live preview — iPhone mockup */}
        <div style={{
          width: '100%', display: 'flex', justifyContent: 'center',
          marginBottom: 20, padding: '20px 0',
          background: '#F5F5F5', borderRadius: 16,
        }}>
          <div style={{ width: 160, height: 330, position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden',
              background: 'linear-gradient(145deg, #3A3A3C, #1C1C1E)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}>
              <div style={{
                position: 'absolute', top: 5, left: 5, right: 5, bottom: 5,
                borderRadius: 23, background: '#000', overflow: 'hidden',
              }}>
                {settings?.instagramScreen ? (
                  <img src={settings.instagramScreen} alt="Instagram" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                    <div style={{ textAlign: 'center', color: '#999', fontSize: 11 }}>Нет фото</div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 6px', fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, zIndex: 5 }}>PREVIEW</div>
          </div>
        </div>

        <SettingsSection header="Скриншот профиля" footer="Скриншот Instagram профиля, показывается внутри iPhone на сайте.">
          <input ref={instaScreenRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInstaScreenUpload} />
          <div style={{ padding: '4px 0' }}>
            <button onClick={() => instaScreenRef.current?.click()} style={primarySaveBtn}>
              {settings?.instagramScreen ? '↑ Заменить скриншот' : '+ Загрузить скриншот'}
            </button>
            {settings?.instagramScreen && (
              <button
                onClick={async () => { setSettings(p => ({ ...p, instagramScreen: null })); localStorage.removeItem('parfum_insta_screen'); await api.deleteSiteMedia('instagramScreen').catch(() => {}); showToast?.('Сброшено'); }}
                style={{ ...primarySaveBtn, background: 'transparent', color: SETTINGS_DANGER, marginTop: 10 }}>
                Удалить скриншот
              </button>
            )}
          </div>
        </SettingsSection>

        {/* Stories highlights */}
        <SettingsSection header="Stories (кружочки)" footer="До 5 кружочков, как highlights в Instagram. Показываются между текстом и iPhone на сайте.">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2,3,4].map(idx => {
              const s = stories[idx] || {};
              const fileRef = React.createRef();
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: idx < 4 ? `0.5px solid ${SETTINGS_SEPARATOR}` : 'none' }}>
                  {/* Story circle preview */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: 52, height: 52, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                      background: s.img ? 'none' : 'linear-gradient(135deg, #FFDC80, #F56040, #833AB4)',
                      padding: s.img ? 0 : 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {s.img ? (
                      <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: '2px solid', borderImage: 'linear-gradient(135deg, #FFDC80, #F56040, #833AB4) 1' }}>
                        <img src={s.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
                      </div>
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 18, color: '#ccc' }}>+</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleStoryImgUpload(idx)} />
                  {/* Label input */}
                  <div style={{ flex: 1 }}>
                    <input
                      value={s.label || ''}
                      onChange={e => handleStoryLabel(idx, e.target.value)}
                      placeholder={`Story ${idx + 1}`}
                      style={{
                        width: '100%', border: 'none', outline: 'none',
                        background: 'transparent', fontSize: 15, fontFamily: SETTINGS_FONT,
                        color: SETTINGS_LABEL_COLOR, padding: '4px 0',
                      }}
                    />
                  </div>
                  {/* Delete */}
                  {(s.img || s.label) && (
                    <div onClick={() => handleStoryDelete(idx)} style={{ cursor: 'pointer', padding: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SETTINGS_DANGER} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsSection>
      </div>
    </SettingsSubScreen>
    );
  };

  // Root view ────────────────────────────────────────────────────────────────────

  // ─── Premium row — status badge + chevron, scale-tap, soft divider ─────────
  // STATUS keys map to (color, dot, label) — kept centralised so meaning stays
  // consistent across the screen.
  const STATUS_STYLES = {
    connected: { color: '#34C759', label: 'Подключено' },
    pending:   { color: '#FF9500', label: 'Не настроено' },
    inactive:  { color: '#8E8E93', label: 'Не активно' },
  };

  const PremiumRow = ({ icon, iconBg, label, status, hint, onClick, isFirst, isLast, danger }) => {
    const sty = status ? STATUS_STYLES[status] : null;
    return (
      <motion.div
        whileTap={onClick ? { scale: 0.985 } : undefined}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', minHeight: 52,
          cursor: onClick ? 'pointer' : 'default',
          background: SETTINGS_CARD_BG,
          position: 'relative',
          borderRadius: isFirst && isLast ? 16 : isFirst ? '16px 16px 0 0' : isLast ? '0 0 16px 16px' : 0,
        }}
      >
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: iconBg || '#8E8E93',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 500,
            color: danger ? SETTINGS_DANGER : '#000',
            fontFamily: SETTINGS_FONT,
            letterSpacing: -0.2,
          }}>{label}</div>
          {hint && (
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1, fontFamily: SETTINGS_FONT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</div>
          )}
        </div>
        {sty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sty.color, boxShadow: `0 0 0 3px ${sty.color}22` }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: sty.color, fontFamily: SETTINGS_FONT, letterSpacing: -0.1 }}>{sty.label}</span>
          </div>
        )}
        {onClick && (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#C7C7CC" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 4 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        {!isLast && (
          <div style={{ position: 'absolute', left: icon ? 58 : 14, right: 14, bottom: 0, height: 0.5, background: 'rgba(60,60,67,0.10)' }} />
        )}
      </motion.div>
    );
  };

  // Section card — bold title outside, white grouped surface.
  const Card = ({ title, children }) => (
    <div style={{ marginBottom: 22 }}>
      {title && (
        <div style={{
          padding: '0 18px 8px',
          fontSize: 11, fontWeight: 600,
          color: SETTINGS_SECTION_HEADER,
          textTransform: 'uppercase',
          fontFamily: SETTINGS_FONT,
          letterSpacing: 0.6,
        }}>{title}</div>
      )}
      <div style={{
        background: SETTINGS_CARD_BG,
        borderRadius: 16,
        marginInline: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 16px rgba(0,0,0,0.04)',
        border: '0.5px solid rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );

  // Status derivation
  // The client can only see the merchant's own WA recipient phone — the
  // green-api creds are server-side now. "connected" here means the merchant
  // has supplied a destination number; whether the server can actually send
  // depends on the env vars on the PB host (verified via the hook itself).
  const whatsappStatus = whatsappAdmin ? 'connected' : 'pending';
  const mbankStatus = mbankPhone ? 'connected' : 'pending';
  const obankStatus = obankPhone ? 'connected' : 'pending';
  const bannerCount = (banners || []).length;
  const adminInitial = (settings?.shopName || 'Admin').trim().charAt(0).toUpperCase() || 'A';

  const renderRoot = () => (
    <div style={{ background: SETTINGS_PAGE_BG, minHeight: '100vh', paddingBottom: 'var(--nav-height)', fontFamily: SETTINGS_FONT }}>
      {/* ── Compact header — title + admin avatar ── */}
      <div style={{
        padding: 'calc(var(--header-top, 44px) + 6px) 16px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#000', letterSpacing: -0.5, fontFamily: SETTINGS_FONT }}>Настройки</div>
          {settings?.shopName && (
            <div style={{ fontSize: 12, color: SETTINGS_SECTION_HEADER, marginTop: 2, fontWeight: 500, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {settings.shopName}
            </div>
          )}
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1f1f22 0%, #111111 100%)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 14, letterSpacing: -0.2,
          boxShadow: '0 4px 12px rgba(17,17,17,0.20), 0 1px 2px rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>{adminInitial}</div>
      </div>

      {/* ── Контент ── */}
      <Card title="Контент">
        <PremiumRow
          icon={SET_ICON.photo} iconBg="#FF9500"
          label="Баннеры" hint={bannerCount ? `${bannerCount} активн.` : 'Не настроено'}
          onClick={() => setSub('banners')} isFirst
        />
        <PremiumRow
          icon={SET_ICON.gift} iconBg="#AF52DE"
          label="Бонусы" hint={settings?.bonusPercent ? `${settings.bonusPercent}% начисление` : 'Стандарт'}
          onClick={() => setSub('bonus')} isLast
        />
      </Card>

      {/* ── Интеграции ── */}
      <Card title="Интеграции">
        <PremiumRow
          icon={SET_ICON.chat} iconBg="#34C759"
          label="WhatsApp" status={whatsappStatus}
          onClick={() => setSub('whatsapp')} isFirst
        />
        <PremiumRow
          icon={SET_ICON.card} iconBg="#FF3B30"
          label="M-Bank" status={mbankStatus}
          onClick={() => setSub('mbank')}
        />
        <PremiumRow
          icon={SET_ICON.card} iconBg="#FF2D92"
          label="O!Bank" status={obankStatus}
          onClick={() => setSub('obank')} isLast
        />
      </Card>

      {/* ── Магазин ── */}
      <Card title="Магазин">
        <PremiumRow
          icon={SET_ICON.store} iconBg="#007AFF"
          label="О магазине" hint={settings?.shopName || 'Не указан'}
          onClick={() => setSub('shop')} isFirst
        />
        <PremiumRow
          icon={SET_ICON.loginBg} iconBg="#5AC8FA"
          label="Фон экрана входа" hint={settings?.loginBg ? 'Кастомный' : 'Стандартный'}
          onClick={() => setSub('loginBg')}
        />
        <PremiumRow
          icon={SET_ICON.photo} iconBg="#C13584"
          label="Instagram скриншот" hint={settings?.instagramScreen ? 'Загружен' : 'Не загружен'}
          onClick={() => setSub('instaScreen')} isLast
        />
      </Card>

      {/* ── Язык ── */}
      <Card title="Язык интерфейса">
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, background: SETTINGS_CARD_BG, borderRadius: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: '#5856D6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 16,
          }}>🌐</div>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#000', letterSpacing: -0.2 }}>Язык</div>
          <div style={{ display: 'inline-flex', background: 'rgba(120,120,128,0.14)', borderRadius: 9, padding: 2, position: 'relative' }}>
            {[{ id: 'ru', label: 'Русский' }, { id: 'kg', label: 'Кыргызча' }].map(opt => {
              const active = lang === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { haptic('light'); setLang(opt.id); }}
                  style={{
                    position: 'relative',
                    padding: '6px 14px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 12,
                    fontWeight: 600,
                    color: active ? '#111' : '#8E8E93',
                    cursor: 'pointer',
                    zIndex: 1,
                    letterSpacing: -0.1,
                    fontFamily: SETTINGS_FONT,
                  }}
                >
                  {opt.label}
                  {active && (
                    <motion.div
                      layoutId="settings-lang-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      style={{
                        position: 'absolute', inset: 0,
                        background: '#fff',
                        borderRadius: 7,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)',
                        zIndex: -1,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* The "Безопасность → Пароль администратора" card was removed — admin
          credentials live exclusively in the PocketBase admin panel now
          (PB_URL/_/). The client must not be able to read or change them. */}

      {/* ── Logout — standalone ── */}
      <div style={{ padding: '0 14px', marginTop: 12 }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          onClick={onLogout}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14,
            background: SETTINGS_CARD_BG,
            color: SETTINGS_DANGER,
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer', fontFamily: SETTINGS_FONT,
            letterSpacing: -0.2,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 16px rgba(0,0,0,0.04)',
            border: '0.5px solid rgba(0,0,0,0.04)',
          }}
        >
          {t.logout}
        </motion.button>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '24px 16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, letterSpacing: 0.1, fontFamily: SETTINGS_FONT }}>Версия 1.0</div>
        <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 3, fontFamily: SETTINGS_FONT, letterSpacing: 0.1 }}>Смарт Центр</div>
      </div>
    </div>
  );

  try {
  return (
    <div style={{
      background: SETTINGS_PAGE_BG || '#F2F2F7',
      // Belt-and-suspenders viewport sizing — `100dvh` accounts for iOS
      // toolbar collapse, `100vh` is the WKWebView fallback.
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      // Was `overflow: hidden` to clip the sub-screen slide-in animations.
      // Removed because, combined with the outer MotionScreen's
      // `AnimatePresence mode="wait"`, the nested AnimatePresence below
      // could stall the root motion.div at its `initial: { opacity: 0 }`
      // state — the DOM rendered but stayed invisible (the white screen).
      zIndex: 1,
      paddingBottom: 'calc(var(--nav-height, 80px) + 20px)',
    }}>
      <AnimatePresence mode="wait" initial={false}>
        {sub === null && (
          <motion.div
            key="root"
            // No `initial: { opacity: 0 }` — keeps the root visible even if
            // framer-motion's spring never fires (e.g. when nested inside
            // another `AnimatePresence mode="wait"`). The slide-in for
            // sub-screens below is unaffected.
            initial={false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            {renderRoot()}
          </motion.div>
        )}
        {sub !== null && (
          <motion.div
            key={sub}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {sub === 'banners'  && renderBanners()}
            {sub === 'bonus'    && renderBonus()}
            {sub === 'whatsapp' && renderWhatsapp()}
            {sub === 'mbank'    && renderMbank()}
            {sub === 'obank'    && renderObank()}
            {sub === 'shop'     && renderShop()}
            {sub === 'loginBg'  && renderLoginBg()}
            {sub === 'instaScreen' && renderInstaScreen()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  } catch (err) {
    console.error('[AdminSettings CRASH]', err);
    return <div style={{ padding: 32, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Settings crashed: {String(err?.message || err)}</div>;
  }
}

const primarySaveBtn = {
  width: '100%', padding: 16, marginTop: 8,
  background: '#007AFF', color: '#fff',
  border: 'none', borderRadius: 12,
  fontSize: 17, fontWeight: 600,
  cursor: 'pointer', fontFamily: SETTINGS_FONT,
};

// ─── ADMIN REVIEWS SCREEN — moderation panel ─────────────────────────────────
function AdminReviewsScreen({ reviews = [], setReviews, showToast }) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'all'
  const [deleting, setDeleting] = useState(null);
  const [approving, setApproving] = useState(null);

  // Manual review form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addText, setAddText] = useState('');
  const [addRating, setAddRating] = useState(5);
  const [addSending, setAddSending] = useState(false);

  const filtered = reviews.filter(r => {
    if (filter === 'pending') return !r.approved;
    if (filter === 'approved') return r.approved;
    return true;
  });

  const pendingCount = reviews.filter(r => !r.approved).length;
  const approvedCount = reviews.filter(r => r.approved).length;

  const handleApprove = async (id) => {
    setApproving(id);
    try {
      await api.updateReview(id, { approved: true });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
      showToast?.(lang === 'kg' ? 'Пикир бекитилди' : 'Отзыв одобрен');
    } catch (e) {
      console.warn('Approve error:', e);
      showToast?.(lang === 'kg' ? 'Ката кетти' : 'Ошибка');
    } finally { setApproving(null); }
  };

  const handleReject = async (id) => {
    setApproving(id);
    try {
      await api.updateReview(id, { approved: false });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
      showToast?.(lang === 'kg' ? 'Пикир жашырылды' : 'Отзыв скрыт');
    } catch (e) {
      console.warn('Reject error:', e);
      showToast?.(lang === 'kg' ? 'Ката кетти' : 'Ошибка');
    } finally { setApproving(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'kg' ? 'Пикирди өчүрүү?' : 'Удалить отзыв?')) return;
    setDeleting(id);
    try {
      await api.deleteReview(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      showToast?.(lang === 'kg' ? 'Пикир өчүрүлдү' : 'Отзыв удалён');
    } catch (e) {
      console.warn('Delete error:', e);
      showToast?.(lang === 'kg' ? 'Ката кетти' : 'Ошибка');
    } finally { setDeleting(null); }
  };

  const handleAddReview = async () => {
    if (!addText.trim() || !addName.trim()) return;
    setAddSending(true);
    try {
      const created = await api.createReview({
        name: addName.trim(),
        city: addCity.trim(),
        text: addText.trim(),
        rating: addRating,
        approved: true, // admin-created = auto-approved
      });
      setReviews(prev => [created, ...prev]);
      setAddName(''); setAddCity(''); setAddText(''); setAddRating(5);
      setShowAdd(false);
      showToast?.(lang === 'kg' ? 'Пикир кошулду' : 'Отзыв добавлен');
    } catch (e) {
      console.warn('Add review error:', e);
      showToast?.(lang === 'kg' ? 'Ката кетти' : 'Ошибка');
    } finally { setAddSending(false); }
  };

  const stars = (rating) => '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(5 - Math.max(0, Math.min(5, rating)));

  const filterTabs = [
    { id: 'pending', label: lang === 'kg' ? 'Күтүүдө' : 'Ожидают', count: pendingCount },
    { id: 'approved', label: lang === 'kg' ? 'Бекитилген' : 'Одобрены', count: approvedCount },
    { id: 'all', label: lang === 'kg' ? 'Баары' : 'Все', count: reviews.length },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 'var(--nav-height)' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>
          {lang === 'kg' ? 'Пикирлер' : 'Отзывы'}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAdd(!showAdd)}
          style={{
            ...btnGreen({ padding: '8px 16px', borderRadius: 12, fontSize: 13 }),
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{showAdd ? '×' : '+'}</span>
          {lang === 'kg' ? 'Кошуу' : 'Добавить'}
        </motion.button>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 10,
              border: 'none',
              background: filter === tab.id ? T.accent : T.cardBg,
              color: filter === tab.id ? '#fff' : T.textSecond,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: filter === tab.id ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Add review form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ padding: '0 16px 16px', overflow: 'hidden' }}
        >
          <div style={{ ...card({ padding: 16 }), display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>
              {lang === 'kg' ? 'Жаңы пикир кошуу' : 'Добавить отзыв вручную'}
            </div>
            <input
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder={lang === 'kg' ? 'Аты-жөнү' : 'Имя'}
              style={{ ...inputStyle, padding: '10px 12px' }}
            />
            <input
              value={addCity}
              onChange={e => setAddCity(e.target.value)}
              placeholder={lang === 'kg' ? 'Шаар' : 'Город'}
              style={{ ...inputStyle, padding: '10px 12px' }}
            />
            <textarea
              value={addText}
              onChange={e => setAddText(e.target.value)}
              placeholder={lang === 'kg' ? 'Пикир тексти' : 'Текст отзыва'}
              rows={3}
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical', padding: '10px 12px' }}
            />
            {/* Star rating selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: T.textSecond, marginRight: 6 }}>
                {lang === 'kg' ? 'Баалоо:' : 'Оценка:'}
              </span>
              {[1, 2, 3, 4, 5].map(s => (
                <span
                  key={s}
                  onClick={() => setAddRating(s)}
                  style={{
                    fontSize: 22,
                    cursor: 'pointer',
                    color: s <= addRating ? '#F5A623' : '#E0E0E0',
                    transition: 'color 0.15s',
                  }}
                >★</span>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={addSending || !addName.trim() || !addText.trim()}
              onClick={handleAddReview}
              style={{
                ...btnGreen({ padding: '12px 0', borderRadius: 12 }),
                opacity: (addSending || !addName.trim() || !addText.trim()) ? 0.5 : 1,
              }}
            >
              {addSending
                ? (lang === 'kg' ? 'Жөнөтүлүүдө...' : 'Отправка...')
                : (lang === 'kg' ? 'Кошуу' : 'Добавить')}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Reviews list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted, fontSize: 14 }}>
            {filter === 'pending'
              ? (lang === 'kg' ? 'Күтүп жаткан пикирлер жок' : 'Нет ожидающих отзывов')
              : (lang === 'kg' ? 'Пикирлер жок' : 'Отзывов нет')}
          </div>
        )}

        {filtered.map(review => {
          const isProcessing = approving === review.id || deleting === review.id;
          return (
            <motion.div
              key={review.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isProcessing ? 0.5 : 1, y: 0 }}
              style={{
                ...card({ padding: 14 }),
                borderLeft: `3px solid ${review.approved ? '#34C759' : '#FF9500'}`,
              }}
            >
              {/* Top: name + stars + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: review.approved ? '#34C75920' : '#FF950020',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    color: review.approved ? '#34C759' : '#FF9500',
                    flexShrink: 0,
                  }}>
                    {(review.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {review.name || (lang === 'kg' ? 'Белгисиз' : 'Аноним')}
                    </div>
                    {review.city && (
                      <div style={{ fontSize: 11, color: T.textMuted }}>{review.city}</div>
                    )}
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: review.approved ? '#34C75915' : '#FF950015',
                  color: review.approved ? '#34C759' : '#FF9500',
                  flexShrink: 0,
                }}>
                  {review.approved
                    ? (lang === 'kg' ? 'Бекитилген' : 'Одобрен')
                    : (lang === 'kg' ? 'Күтүүдө' : 'На модерации')}
                </div>
              </div>

              {/* Stars */}
              <div style={{ color: '#F5A623', fontSize: 14, letterSpacing: 1, marginBottom: 6 }}>
                {stars(review.rating || 5)}
              </div>

              {/* Text */}
              <div style={{ fontSize: 13, color: T.textSecond, lineHeight: 1.45, marginBottom: 8 }}>
                {review.text}
              </div>

              {/* Date + order ID */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
                <span>{review.created ? new Date(review.created).toLocaleDateString('ru-RU') : ''}</span>
                {review.orderId && (
                  <span style={{ background: T.bg, padding: '2px 6px', borderRadius: 4 }}>
                    {lang === 'kg' ? 'Заказ' : 'Заказ'}: {review.orderId.slice(-6)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {!review.approved ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={isProcessing}
                    onClick={() => handleApprove(review.id)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                      background: '#34C759', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    {lang === 'kg' ? 'Бекитүү ✓' : 'Одобрить ✓'}
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={isProcessing}
                    onClick={() => handleReject(review.id)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #FF9500',
                      background: 'transparent', color: '#FF9500', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    {lang === 'kg' ? 'Жашыруу' : 'Скрыть'}
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isProcessing}
                  onClick={() => handleDelete(review.id)}
                  style={{
                    padding: '9px 14px', borderRadius: 10, border: '1px solid #FF3B30',
                    background: 'transparent', color: '#FF3B30', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', opacity: isProcessing ? 0.5 : 1,
                  }}
                >
                  {lang === 'kg' ? 'Өчүрүү' : 'Удалить'}
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MBANK PAYMENT ────────────────────────────────────────────────────────────
// FIX (CRITICAL): the original used `window.location.href = 'mbank://...'` which
// silently fails inside Capacitor's WKWebView on iOS for non-http URL schemes.
// Now uses Capacitor App.openUrl via the openPaymentApp helper, with proper
// fallbacks (copy details / dial admin).
function MBankPayment({ total, orderId, onConfirm, onCancel }) {
  const phone = localStorage.getItem('mbank_phone') || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const [step, setStep] = React.useState('pay');
  const [opening, setOpening] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const openMBank = async () => {
    if (!cleanPhone) {
      // Admin hasn't configured a payment phone yet — show details step.
      setStep('confirm');
      return;
    }
    setOpening(true);
    haptic('light');
    const result = await openPaymentApp('mbank', {
      phone: cleanPhone,
      amount: total,
      comment: `Kemal Usman ${orderId}`,
    });
    setOpening(false);
    // Whether the OS reported success or not, advance to the confirm step
    // so the user can mark the payment as done.
    setTimeout(() => setStep('confirm'), result.ok ? 1800 : 400);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(`${phone}\n${total.toLocaleString()} сом\nKemal Usman #${orderId}`);
    if (ok) {
      haptic('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDial = async () => {
    haptic('light');
    await dialPhone(cleanPhone);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0))', width: '100%', maxWidth: 460 }}
      >
        {/* drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 4, background: '#E5E5E5', margin: '0 auto 16px' }} />

        {step === 'pay' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <MBankLogo size={36} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Оплата M-Bank</div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: -0.5 }}>{total.toLocaleString()} сом</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Заказ #{orderId}</div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openMBank}
            disabled={opening}
            style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, #00B0AA 0%, #0E7A6E 100%)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: opening ? 0.7 : 1, boxShadow: '0 8px 20px rgba(14,122,110,0.3)' }}>
            {opening ? 'Открываем M-Bank…' : `Открыть M-Bank · ${total.toLocaleString()} сом`}
          </motion.button>
          <div style={{ background: '#f5f5f5', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Нет M-Bank? Переведите вручную:</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 0.5 }}>{phone || 'Не указан'}</div>
              {phone && <button onClick={handleCopy} style={{ padding: '6px 12px', borderRadius: 8, background: copied ? '#34C759' : '#111', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{copied ? '✓ Скопир.' : 'Копировать'}</button>}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>Сумма: <b>{total.toLocaleString()} сом</b></div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Комментарий: Kemal Usman #{orderId}</div>
            {phone && (
              <button onClick={handleDial} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, background: 'transparent', color: '#0E7A6E', border: '1.5px solid #0E7A6E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📞 Позвонить администратору
              </button>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setStep('confirm')}
            style={{ width: '100%', padding: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
            ✓ Я оплатил
          </motion.button>
          <button onClick={onCancel} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#aaa', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
        </>}
        {step === 'confirm' && <>
          <div style={{ textAlign: 'center', padding: '12px 0 0' }}>
            <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{ width: 72, height: 72, margin: '0 auto 16px', borderRadius: 22, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 38 }}>⏳</div>
            </motion.div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 8 }}>Ожидаем подтверждение</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>Администратор проверит оплату и подтвердит заказ. Вы получите уведомление в WhatsApp.</div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onConfirm('mbank_pending')} style={{ width: '100%', padding: 16, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Готово
            </motion.button>
          </div>
        </>}
      </motion.div>
    </div>
  );
}

// ─── OBANK PAYMENT ────────────────────────────────────────────────────────────
// Same robust deep-link handling as MBankPayment (Capacitor App.openUrl + fallbacks).
function OBankPayment({ total, orderId, onConfirm, onCancel }) {
  const phone = localStorage.getItem('obank_phone') || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const [step, setStep] = React.useState('pay');
  const [opening, setOpening] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const openOBank = async () => {
    if (!cleanPhone) { setStep('confirm'); return; }
    setOpening(true);
    haptic('light');
    const result = await openPaymentApp('obank', {
      phone: cleanPhone,
      amount: total,
      comment: `Kemal Usman ${orderId}`,
    });
    setOpening(false);
    setTimeout(() => setStep('confirm'), result.ok ? 1800 : 400);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(`${phone}\n${total.toLocaleString()} сом\nKemal Usman #${orderId}`);
    if (ok) { haptic('success'); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  const handleDial = async () => { haptic('light'); await dialPhone(cleanPhone); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0))', width: '100%', maxWidth: 460 }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 4, background: '#E5E5E5', margin: '0 auto 16px' }} />
        {step === 'pay' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <OBankLogo size={36} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Оплата O!Bank</div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: -0.5 }}>{total.toLocaleString()} сом</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Заказ #{orderId}</div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openOBank} disabled={opening}
            style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, #FF5BAA 0%, #E5007E 100%)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: opening ? 0.7 : 1, boxShadow: '0 8px 20px rgba(229,0,126,0.3)' }}>
            {opening ? 'Открываем O!Bank…' : `Открыть O!Bank · ${total.toLocaleString()} сом`}
          </motion.button>
          <div style={{ background: '#f5f5f5', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Нет O!Bank? Переведите вручную:</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 0.5 }}>{phone || 'Не указан'}</div>
              {phone && <button onClick={handleCopy} style={{ padding: '6px 12px', borderRadius: 8, background: copied ? '#34C759' : '#111', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{copied ? '✓ Скопир.' : 'Копировать'}</button>}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>Сумма: <b>{total.toLocaleString()} сом</b></div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Комментарий: Kemal Usman #{orderId}</div>
            {phone && (
              <button onClick={handleDial} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, background: 'transparent', color: '#E5007E', border: '1.5px solid #E5007E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📞 Позвонить администратору
              </button>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep('confirm')} style={{ width: '100%', padding: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
            ✓ Я оплатил
          </motion.button>
          <button onClick={onCancel} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#aaa', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
        </>}
        {step === 'confirm' && <>
          <div style={{ textAlign: 'center', padding: '12px 0 0' }}>
            <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{ width: 72, height: 72, margin: '0 auto 16px', borderRadius: 22, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 38 }}>⏳</div>
            </motion.div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 8 }}>Ожидаем подтверждение</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>Администратор проверит оплату и подтвердит заказ. Вы получите уведомление в WhatsApp.</div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onConfirm('obank_pending')} style={{ width: '100%', padding: 16, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Готово
            </motion.button>
          </div>
        </>}
      </motion.div>
    </div>
  );
}

// ─── ORDER RECEIPT ────────────────────────────────────────────────────────────
// Chiroyli chek ekran — buyurtma tasdiqlangandan keyin ko'rsatiladi.
// "Adminga yuborish" tugmasi WhatsApp deeplink orqali chek matnini yuboradi.
function OrderReceipt({ order, settings, onClose }) {
  if (!order) return null;
  const items = order.items || [];
  const payLabel = order.payMethod === 'mbank' ? 'M-Bank' : order.payMethod === 'obank' ? 'O!Bank' : 'Наличные';
  const deliveryLabel = order.deliveryType === 'pickup' ? 'Самовывоз' : (order.address || 'Доставка');
  const adminPhone = (settings?.whatsappPhone || localStorage.getItem('whatsapp_admin') || localStorage.getItem('mbank_phone') || '').replace(/\D/g, '');

  const receiptText = [
    `Чек заказа №${order.id}`,
    `Дата: ${order.date}`,
    ``,
    ...items.map(i => `• ${i.name} × ${i.qty} — ${(i.price * i.qty).toLocaleString()} сом`),
    ``,
    `Оплата: ${payLabel}`,
    `Доставка: ${deliveryLabel}`,
    order.bonusDiscount > 0 ? `Бонус: −${order.bonusDiscount.toLocaleString()} сом` : null,
    `Итого: ${(order.total || 0).toLocaleString()} сом`,
    ``,
    `Клиент: ${order.clientName}`,
    `Тел: ${order.clientPhone}`,
  ].filter(Boolean).join('\n');

  const shareToAdmin = () => {
    const msg = `📋 ${receiptText}\n\n✅ Оплата совершена. Пожалуйста, подтвердите заказ.`;
    if (adminPhone) {
      window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      // Fallback: share via native share API or copy
      if (navigator.share) {
        navigator.share({ title: `Заказ №${order.id}`, text: msg }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(msg);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0))', width: '100%', maxWidth: 460 }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 4, background: '#E5E5E5', margin: '0 auto 16px' }} />

        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
            style={{ width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 4 }}>Заказ оформлен!</div>
          <div style={{ fontSize: 13, color: '#888' }}>Заказ №{order.id}</div>
        </div>

        {/* Receipt card */}
        <div style={{ background: '#FAFAFA', borderRadius: 14, padding: '16px', marginBottom: 16, border: '1px solid #F0F0F0' }}>
          {/* Dashed top border for receipt feel */}
          <div style={{ borderBottom: '1px dashed #E0E0E0', paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#BBB', fontWeight: 700, textAlign: 'center' }}>Kemal Usman Parfum</div>
            <div style={{ fontSize: 10, color: '#CCC', textAlign: 'center', marginTop: 2 }}>{order.date}</div>
          </div>

          {/* Items */}
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{item.qty} шт. × {item.price.toLocaleString()} сом</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', flexShrink: 0, marginLeft: 8 }}>{(item.price * item.qty).toLocaleString()} сом</div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #E0E0E0', paddingTop: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Оплата</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{payLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Доставка</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{deliveryLabel}</span>
            </div>
            {order.bonusDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#C9A84C' }}>Бонус</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C' }}>−{order.bonusDiscount.toLocaleString()} сом</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1.5px solid #DDD', paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>Итого</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>{(order.total || 0).toLocaleString()} сом</span>
          </div>
        </div>

        {/* WhatsApp share button */}
        {(order.payMethod === 'mbank' || order.payMethod === 'obank') && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={shareToAdmin}
            style={{
              width: '100%', padding: 15, marginBottom: 10,
              background: '#25D366', color: '#fff', border: 'none', borderRadius: 14,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.005 21.785a9.674 9.674 0 01-4.93-1.35l-.354-.21-3.67.963.98-3.577-.231-.367A9.67 9.67 0 012.22 12.01C2.222 6.61 6.607 2.226 12.01 2.226c2.613 0 5.068 1.019 6.914 2.867a9.715 9.715 0 012.862 6.918c-.003 5.4-4.388 9.784-9.78 9.784z"/></svg>
            Отправить чек администратору
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          style={{ width: '100%', padding: 15, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          Готово
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── AUDIO COMPONENTS ─────────────────────────────────────────────────────────
// Picks the best MIME the browser/iOS WKWebView can record. Safari/iOS
// 14.3+ records `audio/mp4` (AAC in MP4 container — i.e. .m4a content).
// Chrome/Android prefers `audio/webm`. Returns null if MediaRecorder
// can't honour any of them.
function pickAudioMime() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2', // AAC-LC (preferred on iOS — .m4a content)
    'audio/mp4',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return '';
}

function ProductAudioRecorder({ productId }) {
  const { lang } = useLang();
  const key = 'parfum_audio_' + productId;

  // status: idle | requesting | recording | encoding | done | error
  const [status, setStatus] = React.useState(localStorage.getItem(key) ? 'done' : 'idle');
  const [error, setError] = React.useState(null);
  const [countdown, setCountdown] = React.useState(10);
  const [duration, setDuration] = React.useState(0); // seconds, set when recording finishes
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0); // 0..1 playback progress

  const audioRef = React.useRef(null);
  const recorderRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const startTimeRef = React.useRef(0);
  const tickRef = React.useRef(null);
  const stopTimerRef = React.useRef(null);
  const rafRef = React.useRef(null);

  const T_RU = lang === 'ru';

  const errMsg = (kind) => {
    const map = {
      ru: {
        unsupported: 'Запись не поддерживается в этом браузере',
        permission: 'Нет доступа к микрофону. Разрешите доступ в настройках.',
        record: 'Не удалось записать аудио',
        play: 'Не удалось воспроизвести аудио',
      },
      kg: {
        unsupported: 'Жазуу бул браузерде колдоого алынбайт',
        permission: 'Микрофонго мүмкүнчүлүк жок. Тууралоодон уруксат бер.',
        record: 'Аудио жазуу мүмкүн болбоду',
        play: 'Аудиону угуу мүмкүн болбоду',
      },
    };
    return (lang === 'kg' ? map.kg : map.ru)[kind];
  };

  // ── cleanup ──────────────────────────────────────────────────────────────
  const cleanupRecorder = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  React.useEffect(() => () => {
    cleanupRecorder();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Re-sync status if the underlying audio in localStorage changes (e.g. on edit)
  React.useEffect(() => {
    if (localStorage.getItem(key)) setStatus(s => (s === 'idle' ? 'done' : s));
  }, [key]);

  // ── record ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('error'); setError(errMsg('unsupported')); return;
    }
    cleanupRecorder();
    setStatus('requesting');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
      setStatus('error');
      setError(denied ? errMsg('permission') : errMsg('record'));
      return;
    }

    streamRef.current = stream;
    const mime = pickAudioMime();
    let rec;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setStatus('error'); setError(errMsg('record'));
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onerror = () => { setStatus('error'); setError(errMsg('record')); cleanupRecorder(); };
    rec.onstop = () => {
      const elapsedMs = Date.now() - startTimeRef.current;
      cleanupRecorder();
      if (chunks.length === 0) { setStatus('error'); setError(errMsg('record')); return; }
      setStatus('encoding');
      const recordedMime = rec.mimeType || mime || 'audio/webm';
      // For iOS playback compatibility: store as data URL with the original
      // mime type. Safari will treat audio/mp4 as .m4a (AAC) and play it back
      // through `new Audio()` without transcoding.
      const blob = new Blob(chunks, { type: recordedMime });
      const reader = new FileReader();
      reader.onerror = () => { setStatus('error'); setError(errMsg('record')); };
      reader.onloadend = () => {
        try {
          localStorage.setItem(key, reader.result);
          setDuration(Math.min(10, Math.round(elapsedMs / 1000)));
          setStatus('done');
        } catch {
          setStatus('error'); setError(errMsg('record'));
        }
      };
      reader.readAsDataURL(blob);
    };

    recorderRef.current = rec;
    setStatus('recording');
    setCountdown(10);
    startTimeRef.current = Date.now();
    try { haptic('light'); } catch {}

    let c = 10;
    tickRef.current = setInterval(() => {
      c -= 1;
      setCountdown(Math.max(0, c));
      if (c <= 0) { clearInterval(tickRef.current); tickRef.current = null; }
    }, 1000);

    try { rec.start(100); } catch {
      setStatus('error'); setError(errMsg('record')); cleanupRecorder(); return;
    }
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
    }, 10000);
  };

  const stopRecordingEarly = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { haptic('medium'); } catch {}
      try { recorderRef.current.stop(); } catch {}
    }
  };

  // ── playback (preview) ───────────────────────────────────────────────────
  const togglePlay = () => {
    if (playing) {
      if (audioRef.current) audioRef.current.pause();
      setPlaying(false);
      return;
    }
    const data = localStorage.getItem(key);
    if (!data) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(data);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setProgress(0); };
    audio.onerror = () => { setPlaying(false); setError(errMsg('play')); setStatus('done'); };
    audio.play().then(() => {
      setPlaying(true);
      const tick = () => {
        if (!audioRef.current) return;
        const d = audioRef.current.duration || duration || 10;
        setProgress(d ? audioRef.current.currentTime / d : 0);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => { setPlaying(false); setError(errMsg('play')); });
  };

  const handleDelete = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    cleanupRecorder();
    localStorage.removeItem(key);
    setStatus('idle');
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(null);
  };

  // ── render ───────────────────────────────────────────────────────────────
  const fmtTime = (s) => `0:${String(Math.max(0, Math.floor(s))).padStart(2, '0')}`;

  // Error banner — shown above any state, dismissed when next action succeeds.
  const errorBanner = error && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#FEF2F2', border: '1px solid #FECACA',
      borderRadius: 10, padding: '8px 12px', marginTop: 8,
      fontSize: 12, color: '#B91C1C', fontWeight: 500,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={() => setError(null)} aria-label="dismiss" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#B91C1C', display: 'flex' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );

  // ── recording state ──────────────────────────────────────────────────────
  if (status === 'recording' || status === 'requesting') {
    const elapsed = 10 - countdown;
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 14, padding: '14px 16px', marginTop: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [1, 0.55, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 10, height: 10, borderRadius: 5, background: '#E53935', boxShadow: '0 0 0 4px rgba(229,57,53,0.18)' }}
              />
              <span style={{ color: '#B91C1C', fontWeight: 700, fontSize: 14, letterSpacing: -0.1 }}>
                {status === 'requesting'
                  ? (T_RU ? 'Доступ к микрофону…' : 'Микрофонго мүмкүнчүлүк…')
                  : (T_RU ? `Запись · ${fmtTime(elapsed)}` : `Жазуу · ${fmtTime(elapsed)}`)}
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={stopRecordingEarly}
              disabled={status === 'requesting'}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', background: '#E53935', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(229,57,53,0.30)' }}
            >
              {T_RU ? 'Стоп' : 'Стоп'}
            </motion.button>
          </div>
          {/* Animated red waveform */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20, marginBottom: 10 }}>
            <style>{`@keyframes recBar{0%,100%{transform:scaleY(0.30)}50%{transform:scaleY(1)}}`}</style>
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 18, borderRadius: 2,
                background: '#E53935',
                transformOrigin: 'center',
                animation: 'recBar 0.85s ease-in-out infinite',
                animationDelay: `${(i % 7) * 0.08}s`,
                opacity: 0.85,
              }} />
            ))}
          </div>
          {/* Linear progress 0 → 10s */}
          <div style={{ height: 4, background: '#FECACA', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#E53935', borderRadius: 4, width: `${(elapsed / 10) * 100}%`, transition: 'width 1s linear' }} />
          </div>
        </motion.div>
      </div>
    );
  }

  // ── encoding state ───────────────────────────────────────────────────────
  if (status === 'encoding') {
    return (
      <div>
        <div style={{ background: '#f5f5f7', borderRadius: 14, padding: '14px 16px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.12)', borderTopColor: '#111', borderRadius: '50%' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            {T_RU ? 'Сохраняем…' : 'Сактоодо…'}
          </span>
        </div>
      </div>
    );
  }

  // ── done state — premium preview player ─────────────────────────────────
  if (status === 'done') {
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            background: 'linear-gradient(180deg,#fafafa 0%,#f4f4f6 100%)',
            border: '0.5px solid #ececef',
            borderRadius: 14, padding: '12px 12px', marginTop: 8,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {/* Player row: play btn · progress · duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                background: '#111', color: '#fff', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
              }}
            >
              {playing ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}>
                  <polygon points="6 4 20 12 6 20 6 4"/>
                </svg>
              )}
            </motion.button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 500 }}>
                {T_RU ? 'Аудио готово' : 'Аудио даяр'}
              </div>
              <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${Math.min(100, progress * 100)}%` }}
                  transition={{ ease: 'linear', duration: 0.05 }}
                  style={{ height: '100%', background: '#111', borderRadius: 4 }}
                />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#666', fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>
              {fmtTime(duration || 10)}
            </div>
          </div>
          {/* Action row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={startRecording}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid #e2e2e6', background: '#fff', color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {T_RU ? 'Перезаписать' : 'Кайра жаз'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleDelete}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {T_RU ? 'Удалить' : 'Өчүрүү'}
            </motion.button>
          </div>
        </motion.div>
        {errorBanner}
      </div>
    );
  }

  // ── idle / error — record CTA ────────────────────────────────────────────
  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={startRecording}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '13px',
          borderRadius: 12, border: '1.5px dashed #d4d4d8',
          background: '#fff', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#111',
          marginTop: 8,
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: '#E53935', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
        </span>
        {T_RU ? 'Записать аромат · 10 сек' : 'Жыт жаз · 10 с'}
      </motion.button>
      {errorBanner}
    </div>
  );
}

function AudioRecordBtn({ productId }) {
  const [status, setStatus] = React.useState(
    localStorage.getItem('parfum_audio_' + productId) ? 'done' : 'idle'
  );
  const [countdown, setCountdown] = React.useState(10);

  const handleRecord = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('idle'); return; }
    if (!window.MediaRecorder) { setStatus('idle'); return; }
    setStatus('recording');
    setCountdown(10);
    let currentCount = 10;
    const interval = setInterval(() => {
      currentCount -= 1;
      if (currentCount <= 0) {
        clearInterval(interval);
        setCountdown(0);
      } else {
        setCountdown(currentCount);
      }
    }, 1000);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        clearInterval(interval);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem('parfum_audio_' + productId, reader.result);
          stream.getTracks().forEach(t => t.stop());
          setStatus('done');
          setCountdown(10);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 10000);
    });
  };

  const handleDelete = () => {
    localStorage.removeItem('parfum_audio_' + productId);
    setStatus('idle');
  };

  if (status === 'recording') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(229,57,53,0.10)', borderRadius: 20, fontSize: 12, color: '#E53935' }}>
      Запись... {countdown}с
    </div>
  );
  if (status === 'done') return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={() => { const a = new Audio(localStorage.getItem('parfum_audio_' + productId)); a.play(); }}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #111111', background: 'none', fontSize: 12, color: '#111111', cursor: 'pointer' }}>
        Слушать
      </button>
      <button onClick={handleRecord}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #F59E0B', background: 'none', fontSize: 12, color: '#F59E0B', cursor: 'pointer' }}>
        Перезаписать
      </button>
      <button onClick={handleDelete}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #EF4444', background: 'none', fontSize: 12, color: '#EF4444', cursor: 'pointer' }}>
        Удалить
      </button>
    </div>
  );
  return (
    <button onClick={handleRecord}
      style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid #AAAAAA', background: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>
      Записать аромат (10с)
    </button>
  );
}

function ClientAudioBtn({ product, productId, compact = false }) {
  const { t, lang } = useLang();
  // Resolve source URL: prefer PB-served audio (production); fall back to a
  // local recording cached during admin recording sessions for instant
  // preview before the product is saved.
  const pid = product?.id || productId;
  const localKey = pid ? 'parfum_audio_' + pid : null;
  const localData = (typeof window !== 'undefined' && localKey) ? localStorage.getItem(localKey) : null;
  const pbAudio = product ? audioUrl(product) : null;
  const src = pbAudio || localData || null;

  const player = useAudioPlayer();
  const isMine = !!src && player.currentSrc === src;
  const isPlaying = isMine && player.isPlaying;
  const isLoading = isMine && player.isLoading;
  const isError   = isMine && player.error;
  const currentTime = isMine ? player.currentTime : 0;
  const duration = isMine ? (player.duration || 10) : 10;

  const handleToggle = () => {
    if (!src) return;
    try { haptic('light'); } catch {}
    player.toggle(src);
  };

  if (!src) return null;
  const isActive = isPlaying || (isMine && currentTime > 0);

  // ── Compact pill (catalog card) ──────────────────────────────────────────────
  if (compact) {
    return (
      <div onClick={e => { e.stopPropagation(); handleToggle(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px 7px',
          borderRadius: 20,
          background: isActive ? '#111' : 'rgba(0,0,0,0.06)',
          cursor: 'pointer',
          transition: 'background 0.2s',
          marginTop: 8,
          userSelect: 'none',
          alignSelf: 'flex-start',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? '#fff' : '#555', flexShrink: 0,
        }}>
          {isPlaying
            ? <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </div>
        {isPlaying ? (
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
            <style>{`@keyframes audioBar{0%,100%{height:3px}50%{height:10px}}`}</style>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 2.5, borderRadius: 1.5, background: 'rgba(255,255,255,0.75)', animation: 'audioBar 0.7s ease-in-out infinite', animationDelay: `${i*0.13}s`, height: 3 }}/>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#fff' : '#555', whiteSpace: 'nowrap' }}>
            {isActive ? t.continueBtn : t.listenBtn}
          </span>
        )}
      </div>
    );
  }

  // ── Full player (detail screen) — light, soft glass, slim ───────────────────
  const icPlay = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}>
      <polygon points="6 4 20 12 6 20 6 4"/>
    </svg>
  );
  const icPause = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1.2"/>
      <rect x="14" y="4" width="4" height="16" rx="1.2"/>
    </svg>
  );

  const fmt = (s) => `0:${String(Math.max(0, Math.floor(s))).padStart(2, '0')}`;
  const totalDur = Math.max(1, duration || 10);
  const progress = Math.min(1, currentTime / totalDur);

  // State-aware title
  let titleText;
  if (isError)        titleText = lang === 'kg' ? 'Угуу мүмкүн болбоду' : 'Не удалось воспроизвести';
  else if (isLoading) titleText = lang === 'kg' ? 'Жүктөлүүдө...' : 'Загрузка...';
  else if (isPlaying) titleText = lang === 'kg' ? 'Атыр азыр ойноп жатат' : 'Сейчас играет аромат';
  else                titleText = lang === 'kg' ? 'Атырды угуу' : 'Послушать аромат';

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, marginBottom: 4 }}>
      <motion.div
        onClick={handleToggle}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,0,0,0.04)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: '0.5px solid rgba(0,0,0,0.06)',
          borderRadius: 14,
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Play / Pause / Loading / Error button */}
        <motion.div
          animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={isPlaying ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 420, damping: 24 }}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: isError ? '#E53935' : '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.16)',
            opacity: isLoading ? 0.85 : 1,
          }}
        >
          {isLoading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              style={{ width: 12, height: 12, border: '1.6px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }}
            />
          ) : isError ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
          ) : isPlaying ? icPause : icPlay}
        </motion.div>

        {/* Title + progress + time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: isError ? '#E53935' : '#111',
            letterSpacing: -0.1,
            marginBottom: isActive ? 6 : 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {titleText}
          </div>
          {isActive && !isError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, height: 3,
                background: 'rgba(0,0,0,0.08)',
                borderRadius: 2, overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                // Click anywhere on the track to seek.
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                player.seek(ratio * totalDur);
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  background: '#111',
                  borderRadius: 2,
                  transition: 'width 0.12s linear',
                }} />
              </div>
              <span style={{
                fontSize: 10, color: '#888',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500, flexShrink: 0,
              }}>
                {fmt(currentTime)} / {fmt(totalDur)}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── DESKTOP LAYOUT (≥1024px) ─────────────────────────────────────────────────
// Full premium desktop store. Mobile layout (<1024px) is untouched and lives
// inside App()'s existing return tree. All styles are inline; no Tailwind / CSS
// frameworks. Colors are intentionally hard-coded to the desktop's monochrome
// luxury palette (#111 / #fff / #C9A84C accent) — the rest of the app uses the
// `T` token system, but the desktop site is its own visual language.
function DesktopLayout({
  products, cart, setCart, addToCart,
  banners, settings, showToast,
  user, onLogout, guestMode, setGuestMode,
  bonusBalance, bonusHistory, referralCode, handleCopyReferral,
  orders, onOrder,
  reviews,
  instaPosts, instaProfile,
  pbLoading, toast, dismissToast,
  lang, setLang, t,
  welcomeCelebration, setWelcomeCelebration,
  windowWidth,
  onAdminLogin,
}) {
  const [desktopSearch, setDesktopSearch] = useState('');
  const [desktopCategory, setDesktopCategory] = useState('all');
  const [desktopSort, setDesktopSort] = useState('default');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const deskAdminTapRef = React.useRef(0);
  const deskAdminTimerRef = React.useRef(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConditionsModal, setShowConditionsModal] = useState(false);
  const [showHowToOrderModal, setShowHowToOrderModal] = useState(false);
  const [showTrackOrderModal, setShowTrackOrderModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const handleDeskSecretTap = () => {
    if (deskAdminTimerRef.current) clearTimeout(deskAdminTimerRef.current);
    deskAdminTapRef.current += 1;
    if (deskAdminTapRef.current >= 5) {
      deskAdminTapRef.current = 0;
      onAdminLogin?.();
    } else {
      deskAdminTimerRef.current = setTimeout(() => { deskAdminTapRef.current = 0; }, 2000);
    }
  };
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [heroBannerIndex, setHeroBannerIndex] = useState(0);
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [useBonus, setUseBonus] = useState(false);
  const [modalVariantId, setModalVariantId] = useState(null);
  const [modalImgIndex, setModalImgIndex] = useState(0);

  const minPrice = (p) => {
    const prices = (p.variants || []).map(v => v.price || 0).filter(Boolean);
    return prices.length ? Math.min(...prices) : 0;
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, ci) => {
    const prod = products.find(p => String(p.id) === String(ci.productId));
    const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
    return s + (variant?.price || 0) * ci.qty;
  }, 0);

  const announcements = settings?.announcementTexts?.split('\n').filter(Boolean) || [
    'Бесплатная доставка по Бишкеку от 1 000 сом',
    'Скидка 15% на Премиум коллекцию',
    'Новые ароматы каждую неделю',
  ];

  const heroButtonText = settings?.heroButtonText || 'ВЫБРАТЬ АРОМАТ';

  const gridColumns = windowWidth >= 1600 ? 'repeat(5, 1fr)' : windowWidth >= 1200 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';

  const filteredProducts = products
    .filter(p => desktopCategory === 'all' || p.category === desktopCategory)
    .filter(p => !desktopSearch ||
      p.name?.toLowerCase().includes(desktopSearch.toLowerCase()) ||
      p.brand?.toLowerCase().includes(desktopSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (desktopSort === 'price_asc') return minPrice(a) - minPrice(b);
      if (desktopSort === 'price_desc') return minPrice(b) - minPrice(a);
      if (desktopSort === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  // Announcement bar auto-rotate
  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setAnnouncementIndex(i => (i + 1) % announcements.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  // Hero banner auto-slide
  const activeHeroBanners = banners.filter(b => b.active);
  useEffect(() => {
    if (activeHeroBanners.length <= 1) return;
    const timer = setInterval(() => {
      setHeroBannerIndex(i => (i + 1) % activeHeroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeHeroBanners.length]);

  // Escape closes overlays
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setSearchOpen(false); setUserMenuOpen(false); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const NAV_ITEMS = [
    { id: 'all',      label: 'Все' },
    { id: 'female',   label: 'Женские' },
    { id: 'male',     label: 'Мужские' },
    { id: 'unisex',   label: 'Унисекс' },
    { id: 'premium',  label: 'Премиум' },
  ];

  const CAT_TABS = [
    { id: 'all', label: 'Все' },
    { id: 'female', label: 'Женские' },
    { id: 'male', label: 'Мужские' },
    { id: 'unisex', label: 'Унисекс' },
    { id: 'premium', label: 'Премиум' },
  ];

  const currentBanner = activeHeroBanners[heroBannerIndex];

  const isNewProduct = (product) => {
    if (!product.created) return false;
    const created = new Date(product.created);
    const now = new Date();
    return (now - created) < 7 * 24 * 60 * 60 * 1000; // 7 days
  };

  const renderProductCard = (product, index) => {
    const allOutOfStock = (product.variants || []).every(v => v.inStock === false);
    const _saleInfo = getSaleInfo(product);
    const _minP = minPrice(product);
    const _saleMinP = _saleInfo && _minP ? salePrice(_minP, _saleInfo.percent) : null;
    const _isNew = isNewProduct(product);
    return (
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.035, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.10), 0 8px 16px rgba(0,0,0,0.06)' }}
        onClick={() => {
          setSelectedProduct(product);
          setModalVariantId(product.variants?.[0]?.id || null);
          setModalImgIndex(0);
        }}
        style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          cursor: 'pointer', position: 'relative',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.35s ease, transform 0.35s ease',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1 / 1.05', overflow: 'hidden', background: '#F5F3EF' }}>
          {(product.img || product.images?.[0]) ? (
            <motion.img
              src={product.img || product.images[0]}
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              alt={product.name}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="48" height="100" viewBox="0 0 60 140" fill="none" opacity="0.3">
                <rect x="20" y="0" width="20" height="16" rx="2" fill="#C5C0B6"/>
                <rect x="8" y="16" width="44" height="110" rx="4" fill="#D5D0C8"/>
                <rect x="16" y="24" width="28" height="2" rx="1" fill="#C5C0B6"/>
              </svg>
            </div>
          )}
          <AudioPlayerOverlay product={product} />
          <SaleCountdownBadge product={product} />
          {_saleInfo && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#FF3B30', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, zIndex: 4 }}>
              −{_saleInfo.percent}%
            </div>
          )}
          {/* Category badge */}
          {!_saleInfo && product.category === 'premium' && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(17,17,17,0.85)',
              backdropFilter: 'blur(8px)', color: '#fff', fontSize: 8, fontWeight: 600,
              letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px',
              borderRadius: 20 }}>
              Premium
            </div>
          )}
          {/* NEW badge — last 7 days */}
          {_isNew && !_saleInfo && product.category !== 'premium' && !allOutOfStock && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,122,255,0.9)',
              backdropFilter: 'blur(8px)', color: '#fff', fontSize: 8, fontWeight: 700,
              letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px',
              borderRadius: 20 }}>
              NEW
            </div>
          )}
          {allOutOfStock && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(180,0,0,0.8)',
              backdropFilter: 'blur(8px)', color: '#fff', fontSize: 8, fontWeight: 600,
              letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px',
              borderRadius: 20 }}>
              Нет в наличии
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa', marginBottom: 4, fontWeight: 500 }}>
            {product.brand}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 3, lineHeight: 1.3,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12, lineHeight: 1.5, height: 33,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {product.description}
          </div>
          <SaleProgressBar product={product} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            {_saleMinP ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FF3B30' }}>от {_saleMinP} <span style={{ fontSize: 11, fontWeight: 500 }}>сом</span></span>
                <span style={{ fontSize: 12, color: '#BBB', textDecoration: 'line-through' }}>{_minP}</span>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
                от {_minP} <span style={{ fontSize: 11, fontWeight: 500, color: '#999' }}>сом</span>
              </div>
            )}
            <div onClick={e => e.stopPropagation()}>
              <ClientAudioBtn product={product} compact />
            </div>
          </div>

          {/* Variant + Cart row */}
          <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            <select
              value={selectedVariants[product.id] || product.variants?.[0]?.id || ''}
              onChange={e => { e.stopPropagation(); setSelectedVariants(p => ({ ...p, [product.id]: e.target.value })); }}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, minWidth: 0, border: '1px solid #EBEBEB', borderRadius: 10, padding: '9px 10px',
                fontSize: 10, letterSpacing: 0.5, color: '#555', background: '#FAFAF8',
                cursor: 'pointer', outline: 'none', WebkitAppearance: 'none', appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                paddingRight: 28 }}
            >
              {(product.variants || []).filter(v => v.inStock !== false).map(v => (
                <option key={v.id} value={v.id}>{v.label} — {v.price} с</option>
              ))}
            </select>
            {allOutOfStock ? (
              <div style={{ width: 42, height: 38, borderRadius: 10, background: '#F0EFED',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={e => {
                  e.stopPropagation();
                  const varId = selectedVariants[product.id] || product.variants?.[0]?.id;
                  if (varId) { addToCart(product.id, varId); setCartOpen(true); }
                }}
                style={{ width: 42, height: 38, borderRadius: 10, background: '#111', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", background: '#FAF6EE', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ── ANNOUNCEMENT BAR ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        height: 38, background: '#111', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        overflow: 'hidden' }}>
        <motion.div
          whileHover={{ scale: 1.2 }}
          onClick={() => setAnnouncementIndex(i => (i - 1 + announcements.length) % announcements.length)}
          style={{ cursor: 'pointer', padding: '0 10px', display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.span
            key={announcementIndex}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', minWidth: 300, textAlign: 'center', fontWeight: 500 }}
          >
            {announcements[announcementIndex]}
          </motion.span>
        </AnimatePresence>
        <motion.div
          whileHover={{ scale: 1.2 }}
          onClick={() => setAnnouncementIndex(i => (i + 1) % announcements.length)}
          style={{ cursor: 'pointer', padding: '0 10px', display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </motion.div>
        {/* Progress dots */}
        {announcements.length > 1 && (
          <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4 }}>
            {announcements.map((_, i) => (
              <div key={i} style={{
                width: i === announcementIndex ? 12 : 3, height: 2,
                borderRadius: 2, background: i === announcementIndex ? '#fff' : 'rgba(255,255,255,0.25)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ── HEADER ── */}
      <div style={{ position: 'fixed', top: 38, left: 0, right: 0, zIndex: 1000,
        background: '#fff', borderBottom: '1px solid #E5E5E5' }}>
        {/* Row 1 — Logo + Icons */}
        <div style={{ height: 68, padding: '0 48px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: "'Georgia', 'Playfair Display', serif",
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 26,
              letterSpacing: -0.3,
              color: '#111',
              cursor: 'pointer',
              lineHeight: 1,
              userSelect: 'none',
            }}
            onClick={handleDeskSecretTap}
          >
            Kemal Usman
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Search */}
            <div onClick={() => setSearchOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="#111" strokeWidth="1.5"/>
                <path d="M16.5 16.5L21 21" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            {/* User */}
            <div style={{ position: 'relative' }}>
              <div onClick={() => setUserMenuOpen(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="7" r="4" stroke="#111" strokeWidth="1.5"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    style={{ position: 'absolute', top: '100%', right: 0, width: 210,
                      background: '#fff', border: '1px solid #E5E5E5', zIndex: 1001, marginTop: 8 }}
                  >
                    {user ? (
                      <>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: '#BBB' }}>{user.phone}</div>
                        </div>
                        {[
                          { label: 'Мои заказы', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#555" strokeWidth="1.4"/><path d="M8 10h8M8 14h5" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                          { label: `Бонусы: ${bonusBalance} сом`, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#C9A84C" strokeWidth="1.4"/></svg> },
                          { label: 'Выйти', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { onLogout(); setUserMenuOpen(false); } },
                        ].map((item, i) => (
                          <div key={i} onClick={item.action || (() => setUserMenuOpen(false))}
                            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                              fontSize: 13, color: '#555', cursor: 'pointer', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {item.icon} {item.label}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ padding: '20px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Войти в аккаунт</div>
                        <div onClick={() => { setUserMenuOpen(false); setGuestMode(false); }}
                          style={{ width: '100%', background: '#111', color: '#fff', padding: '12px',
                            textAlign: 'center', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                            cursor: 'pointer', marginBottom: 8 }}>
                          Войти
                        </div>
                        <div onClick={() => { setGuestMode(true); setUserMenuOpen(false); }}
                          style={{ textAlign: 'center', fontSize: 11, color: '#BBB', cursor: 'pointer', letterSpacing: 1 }}>
                          Продолжить как гость
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Cart */}
            <div style={{ position: 'relative' }}>
              <div onClick={() => setCartOpen(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="#111" strokeWidth="1.5"/>
                  <path d="M16 10a4 4 0 01-8 0" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              {cartCount > 0 && (
                <motion.div
                  key={cartCount}
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 0.3 }}
                  style={{ position: 'absolute', top: -7, right: -9, background: '#111', color: '#fff',
                    borderRadius: '50%', width: 17, height: 17, fontSize: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                >
                  {cartCount}
                </motion.div>
              )}
            </div>
          </div>
        </div>
        {/* Row 2 — Navigation */}
        <div style={{ height: 44, padding: '0 48px', borderTop: '1px solid #F0F0F0',
          display: 'flex', alignItems: 'center', gap: 36, position: 'relative' }}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              onClick={() => {
                setDesktopCategory(item.id);
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer',
                color: desktopCategory === item.id ? '#111' : '#888',
                paddingBottom: 2, position: 'relative',
                borderBottom: desktopCategory === item.id ? '1.5px solid #111' : '1.5px solid transparent',
                transition: 'color 0.2s, border-color 0.2s' }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginTop: 38 + 68 + 44, background: '#FAF6EE', minHeight: '100vh' }}>
        {/* HERO BANNER */}
        <div style={{ position: 'relative', height: 540, background: currentBanner?.bg || '#0d0d0d', overflow: 'hidden' }}>
          {(currentBanner?.image || currentBanner?.img) && (
            <motion.img
              key={heroBannerIndex + '-img'}
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              src={currentBanner?.collectionId && currentBanner?.image
                ? fileUrl('banners', currentBanner, currentBanner.image)
                : (currentBanner?.image || currentBanner?.img)}
              alt=""
              onError={e => { e.target.style.display = 'none'; }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div style={{ position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, rgba(0,0,0,${currentBanner?.overlayTop ?? 0.08}) 0%, rgba(0,0,0,${currentBanner?.overlayBottom ?? 0.45}) 100%)` }} />
          {/* Text block — absolute positioned via textX/textY if set, else center */}
          {(() => {
            const tx = currentBanner?.textX ?? 50;
            const ty = currentBanner?.textY ?? 50;
            const ta = currentBanner?.textAlign || 'center';
            const hasPos = currentBanner?.textX !== undefined;
            const posStyle = hasPos
              ? { position: 'absolute', left: `${tx}%`, top: `${ty}%`, transform: 'translate(-50%,-50%)', textAlign: ta }
              : { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
            return (
              <div style={posStyle}>
                <motion.div
                  key={heroBannerIndex}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  style={hasPos ? { display: 'inline-block' } : {}}
                >
                  <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16, fontWeight: 500 }}>
                    {currentBanner?.subtitle || settings?.heroSubtitle || 'Bishkek · Parfum na razliv'}
                  </div>
                  <div style={{ fontSize: 56, fontWeight: 200, letterSpacing: 10, textTransform: 'uppercase', color: '#fff', lineHeight: 1.12, marginBottom: 8 }}>
                    {currentBanner?.title ? (
                      currentBanner.title
                    ) : (
                      <>{(settings?.shopName || 'KEMAL USMAN').split(' ')[0]}<br /><strong style={{ fontWeight: 800 }}>{(settings?.shopName || 'KEMAL USMAN').split(' ').slice(1).join(' ') || 'USMAN'}</strong></>
                    )}
                  </div>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 36, textTransform: 'uppercase' }}>
                    {settings?.heroTagline || 'Оригинальные ароматы · Лучшие бренды'}
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.03, boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const linkedId = currentBanner?.linkedProductId;
                      if (linkedId) {
                        const prod = products.find(p => String(p.id) === String(linkedId));
                        if (prod) { setSelectedProduct(prod); return; }
                      }
                      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{ display: 'inline-block', background: '#fff', color: '#111',
                      fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700,
                      padding: '18px 56px', cursor: 'pointer', borderRadius: 2,
                      boxShadow: '0 6px 24px rgba(0,0,0,0.25)', transition: 'all 0.35s ease',
                      border: '2px solid rgba(255,255,255,0.9)',
                      backdropFilter: 'none' }}
                  >
                    {currentBanner?.btnText || heroButtonText}
                  </motion.div>
                </motion.div>
              </div>
            );
          })()}
          {activeHeroBanners.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0,
              display: 'flex', gap: 8, justifyContent: 'center' }}>
              {activeHeroBanners.map((_, i) => (
                <div key={i} onClick={() => setHeroBannerIndex(i)}
                  style={{ width: i === heroBannerIndex ? 24 : 8, height: 3,
                    background: i === heroBannerIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', transition: 'all 0.3s' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── TRUST BADGES ────────────────────────────────────────── */}
        <div style={{ padding: '40px 48px 0', display: 'flex', justifyContent: 'center', gap: 0 }}>
          {[
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>, title: lang === 'kg' ? '100% Оригинал' : '100% Оригинал', sub: lang === 'kg' ? 'Түп нуска гарантиясы' : 'Гарантия подлинности' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="22" height="12" rx="2"/><path d="M1 10h22"/><path d="M6 14h2"/></svg>, title: lang === 'kg' ? 'Акысыз жеткирүү' : 'Бесплатная доставка', sub: lang === 'kg' ? '1 000 сомдон жогору' : 'По Бишкеку от 1 000 сом' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, title: lang === 'kg' ? '500+ жыпар суу' : '500+ ароматов', sub: lang === 'kg' ? 'Дүйнөлүк бренддер' : 'Мировые бренды' },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, title: lang === 'kg' ? 'Сапат кепилдиги' : 'Гарантия качества', sub: lang === 'kg' ? 'Ар бир тамчы' : 'Каждая капля на вес золота' },
          ].map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 14,
                padding: '20px 28px',
                borderRight: i < 3 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#F8F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {b.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111', letterSpacing: -0.1, marginBottom: 2 }}>{b.title}</div>
                <div style={{ fontSize: 10.5, color: '#999', letterSpacing: 0.1 }}>{b.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── INSTAGRAM SOCIAL PROOF — iPhone 17 Pro Max ────────── */}
        <div style={{ margin: '0 48px', padding: '48px 0', display: 'flex', alignItems: 'center', gap: 40, minHeight: 520, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          {/* Left — text + stats */}
          <div style={{ flex: '0 0 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <defs><linearGradient id="igGradTop" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FFDC80"/><stop offset="25%" stopColor="#F77737"/><stop offset="50%" stopColor="#F56040"/><stop offset="75%" stopColor="#C13584"/><stop offset="100%" stopColor="#833AB4"/></linearGradient></defs>
                <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#igGradTop)" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4.5" stroke="url(#igGradTop)" strokeWidth="2"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="url(#igGradTop)"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)' }}>Instagram</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 400, color: '#0a0a0a', fontFamily: "'Georgia', serif", fontStyle: 'italic', lineHeight: 1.2, marginBottom: 14 }}>
              {lang === 'kg' ? 'Бизди ээрчиңиз' : 'Следите за нами'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', lineHeight: 1.7, marginBottom: 28 }}>
              {lang === 'kg'
                ? 'Жаңы коллекциялар, акциялар жана сулуулук сырлары'
                : 'Новые коллекции, акции и секреты красоты'}
            </div>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { num: '27.8K', label: lang === 'kg' ? 'жазылуучу' : 'подписчиков' },
                { num: '295', label: lang === 'kg' ? 'жарыя' : 'публикаций' },
                { num: '283', label: lang === 'kg' ? 'жазылган' : 'подписки' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 2 }}>{s.num}</div>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Center — stories + subscribe button */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
            {/* Stories circles */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              {(() => {
                const adminStories = settings?.instaStories?.filter(s => s && s.img);
                if (adminStories && adminStories.length > 0) {
                  return adminStories.slice(0, 5).map((s, i) => (
                    <motion.div
                      key={`st-${i}`}
                      whileHover={{ scale: 1.1, y: -5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      onClick={() => window.open(settings?.instagramUrl || 'https://www.instagram.com/kemal.ussman', '_blank')}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    >
                      <div style={{
                        width: 66, height: 66, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFDC80, #F77737, #F56040, #C13584, #833AB4)',
                        padding: 2.5, flexShrink: 0,
                      }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #fff', background: '#eee' }}>
                          <img src={s.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', fontWeight: 500, maxWidth: 64, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.label || ''}
                      </span>
                    </motion.div>
                  ));
                }
                const withImg = products.filter(p => p.img || p.images?.[0]);
                const labels = lang === 'kg'
                  ? ['Жаңы', 'Хит', 'Акция', 'Каталог', 'Жеткирүү']
                  : ['Новинки', 'Хиты', 'Акции', 'Каталог', 'Доставка'];
                const items = withImg.length >= 5
                  ? withImg.slice(0, 5)
                  : [...withImg, ...withImg, ...withImg, ...withImg, ...withImg].slice(0, 5);
                return items.map((p, i) => (
                  <motion.div
                    key={`st-${i}`}
                    whileHover={{ scale: 1.1, y: -5 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); setModalVariantId(p.variants?.[0]?.id || null); setModalImgIndex(0); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: 66, height: 66, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FFDC80, #F77737, #F56040, #C13584, #833AB4)',
                      padding: 2.5, flexShrink: 0,
                    }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #fff', background: '#eee' }}>
                        <img src={p.img || p.images?.[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', fontWeight: 500, maxWidth: 64, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {labels[i]}
                    </span>
                  </motion.div>
                ));
              })()}
            </div>

            {/* Gradient subscribe button */}
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 12px 32px rgba(193,53,132,0.4)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => window.open(settings?.instagramUrl || 'https://www.instagram.com/kemal.ussman', '_blank')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 36px', borderRadius: 50,
                background: 'linear-gradient(135deg, #833AB4, #C13584, #F56040, #F77737, #FFDC80)',
                color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(193,53,132,0.25)',
                transition: 'box-shadow 0.3s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="6" stroke="#fff" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4.5" stroke="#fff" strokeWidth="2"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
              </svg>
              {lang === 'kg' ? 'Жазылуу' : 'Подписаться'}
            </motion.button>

            {/* Verified badge + handle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="12" fill="#0095F6"/>
                <path d="M17 20l2.5 2.5L23 17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 6l2.5 1.5L25.5 6l1.5 3h3l.5 3 2.5 1.5-1.5 2.5L33 19l-1.5 2.5 1.5 2.5-2.5 1.5-.5 3h-3L25.5 34l-3-1.5L20 34l-2.5 1.5L14.5 34l-1.5-3h-3l-.5-3L7 26.5 8.5 24 7 21.5l2.5-1.5.5-3h3L14.5 14l3 1.5z" fill="#0095F6"/>
                <path d="M17 20l2.5 2.5L23 17" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>@kemal.ussman</span>
            </div>
          </div>

          {/* Right — iPhone 17 Pro Max mockup (Space Black) with hover QR */}
          {(() => {
            const [phoneHover, setPhoneHover] = React.useState(false);
            const igUrl = settings?.instagramUrl || 'https://www.instagram.com/kemal.ussman?igsh=djFyZGhtd2t3dzd5';
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(igUrl)}&color=111111&bgcolor=ffffff&margin=10`;
            return (
              <div
                style={{ flexShrink: 0, position: 'relative', width: 280, height: 570, cursor: 'pointer' }}
                onMouseEnter={() => setPhoneHover(true)}
                onMouseLeave={() => setPhoneHover(false)}
                onClick={() => window.open(igUrl, '_blank')}
              >
                {/* Phone body — Space Black titanium */}
                <motion.div
                  animate={{ y: phoneHover ? -8 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: 46,
                    background: 'linear-gradient(145deg, #3A3A3C 0%, #2C2C2E 30%, #1C1C1E 60%, #161618 100%)',
                    boxShadow: phoneHover
                      ? '0 40px 80px rgba(0,0,0,0.35), 0 12px 28px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 30px 60px rgba(0,0,0,0.28), 0 8px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
                    transition: 'box-shadow 0.4s ease',
                  }}
                >
                  <div style={{ position: 'absolute', right: -2.5, top: 140, width: 3, height: 60, borderRadius: '0 2px 2px 0', background: 'linear-gradient(to bottom, #3A3A3C, #2A2A2C)', boxShadow: '1px 0 3px rgba(0,0,0,0.2)' }}/>
                  <div style={{ position: 'absolute', left: -2.5, top: 120, width: 3, height: 32, borderRadius: '2px 0 0 2px', background: 'linear-gradient(to bottom, #3A3A3C, #2A2A2C)', boxShadow: '-1px 0 3px rgba(0,0,0,0.2)' }}/>
                  <div style={{ position: 'absolute', left: -2.5, top: 162, width: 3, height: 32, borderRadius: '2px 0 0 2px', background: 'linear-gradient(to bottom, #3A3A3C, #2A2A2C)', boxShadow: '-1px 0 3px rgba(0,0,0,0.2)' }}/>

                  <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 38, background: '#000', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 100, height: 28, borderRadius: 20, background: '#000', zIndex: 20 }}/>
                    <div style={{ position: 'absolute', inset: 0, background: '#fafafa', overflow: 'hidden' }}>
                      {settings?.instagramScreen ? (
                        <img src={settings.instagramScreen} alt="Instagram profile" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #833AB4, #F56040, #FFDC80)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>KU</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>kemal.ussman</div>
                          <div style={{ fontSize: 8, color: '#999', textAlign: 'center' }}>{lang === 'kg' ? 'Скриншотту жүктөңүз' : 'Загрузите скриншот'}</div>
                        </div>
                      )}
                    </div>

                    {/* HOVER QR OVERLAY */}
                    <motion.div
                      initial={false}
                      animate={{
                        opacity: phoneHover ? 1 : 0,
                        backdropFilter: phoneHover ? 'blur(20px)' : 'blur(0px)',
                        WebkitBackdropFilter: phoneHover ? 'blur(20px)' : 'blur(0px)',
                      }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.78)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 16, zIndex: 25, borderRadius: 38,
                        pointerEvents: phoneHover ? 'auto' : 'none',
                      }}
                    >
                      <motion.div
                        animate={{ scale: phoneHover ? 1 : 0.6, opacity: phoneHover ? 1 : 0, rotateY: phoneHover ? 0 : 15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22, delay: phoneHover ? 0.08 : 0 }}
                        style={{ width: 140, height: 140, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                      >
                        <img src={qrSrc} alt="QR" width="120" height="120" style={{ borderRadius: 8, display: 'block' }} />
                      </motion.div>
                      <motion.div
                        animate={{ opacity: phoneHover ? 1 : 0, y: phoneHover ? 0 : 12 }}
                        transition={{ duration: 0.3, delay: phoneHover ? 0.15 : 0 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="2" y="2" width="20" height="20" rx="6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8"/>
                          <circle cx="12" cy="12" r="4.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8"/>
                          <circle cx="17.5" cy="6.5" r="1.2" fill="rgba(255,255,255,0.7)"/>
                        </svg>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
                          {lang === 'kg' ? 'Instagram ачуу' : 'Перейти в Instagram'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>@kemal.ussman</div>
                      </motion.div>
                      <motion.div animate={{ opacity: phoneHover ? 1 : 0, y: phoneHover ? 0 : 6 }} transition={{ duration: 0.25, delay: phoneHover ? 0.22 : 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                      </motion.div>
                    </motion.div>

                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 100, height: 4, borderRadius: 2, background: phoneHover ? 'rgba(255,255,255,0.4)' : '#000', transition: 'background 0.3s', zIndex: 30 }}/>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ width: phoneHover ? 220 : 200, opacity: phoneHover ? 1 : 0.7, y: phoneHover ? 4 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', height: 60, background: 'radial-gradient(ellipse, rgba(0,0,0,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}
                />
              </div>
            );
          })()}
        </div>

        {/* ── BESTSELLERS / ХИТЫ ПРОДАЖ ────────────────────────── */}
        {(() => {
          // Top sellers: products that appear most in completed orders
          const orderCounts = {};
          (orders || []).filter(o => o.status === 'delivered').forEach(o => {
            (o.items || []).forEach(item => {
              orderCounts[item.productId] = (orderCounts[item.productId] || 0) + item.qty;
            });
          });
          const bestsellerIds = Object.entries(orderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(e => e[0]);
          const bestsellers = bestsellerIds
            .map(id => products.find(p => String(p.id) === String(id)))
            .filter(Boolean);
          // If not enough orders, show first 6 products as featured
          const displayItems = bestsellers.length >= 3 ? bestsellers : products.slice(0, 6);
          if (displayItems.length === 0) return null;
          return (
            <div style={{ padding: '48px 48px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginBottom: 6, fontWeight: 600 }}>
                    {bestsellers.length >= 3 ? (lang === 'kg' ? 'Эң популярдуу' : 'Хиты продаж') : (lang === 'kg' ? 'Тандалган' : 'Рекомендуемые')}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 400, color: '#0a0a0a', fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                    {bestsellers.length >= 3 ? (lang === 'kg' ? 'Бестселлерлер' : 'Бестселлеры') : (lang === 'kg' ? 'Сиз үчүн' : 'Для вас')}
                  </div>
                </div>
                <motion.div
                  whileHover={{ x: 4 }}
                  onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ fontSize: 11, color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 0.5 }}
                >
                  {lang === 'kg' ? 'Баарын көрүү' : 'Смотреть все'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </motion.div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: windowWidth >= 1400 ? 'repeat(6, 1fr)' : windowWidth >= 1000 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 16 }}>
                {displayItems.map((product, i) => {
                  const _mp = minPrice(product);
                  const _si = getSaleInfo(product);
                  const _sp = _si && _mp ? salePrice(_mp, _si.percent) : null;
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.45 }}
                      whileHover={{ y: -5, boxShadow: '0 16px 36px rgba(0,0,0,0.09)' }}
                      onClick={() => { setSelectedProduct(product); setModalVariantId(product.variants?.[0]?.id || null); setModalImgIndex(0); }}
                      style={{
                        background: '#fff', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)',
                        transition: 'all 0.35s ease', position: 'relative',
                      }}
                    >
                      {/* Bestseller rank badge */}
                      {bestsellers.length >= 3 && i < 3 && (
                        <div style={{
                          position: 'absolute', top: 10, left: 10, zIndex: 2,
                          background: i === 0 ? '#111' : 'rgba(0,0,0,0.6)', color: '#fff',
                          fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          letterSpacing: 0.5, backdropFilter: 'blur(8px)',
                        }}>
                          TOP {i + 1}
                        </div>
                      )}
                      {_si && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10, zIndex: 2,
                          background: '#E53935', color: '#fff', fontSize: 9, fontWeight: 700,
                          padding: '3px 8px', borderRadius: 6,
                        }}>
                          -{_si.percent}%
                        </div>
                      )}
                      <div style={{ aspectRatio: '1/1.1', overflow: 'hidden', background: '#F5F3EF' }}>
                        {(product.img || product.images?.[0]) ? (
                          <motion.img
                            src={product.img || product.images[0]}
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            alt={product.name}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                            <svg width="40" height="80" viewBox="0 0 60 140" fill="none"><rect x="20" y="0" width="20" height="16" rx="2" fill="#C5C0B6"/><rect x="8" y="16" width="44" height="110" rx="4" fill="#D5D0C8"/></svg>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px 14px' }}>
                        <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontWeight: 500 }}>{product.brand || ''}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {_sp ? (
                            <>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#E53935' }}>{_sp.toLocaleString()} сом</span>
                              <span style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through' }}>{_mp.toLocaleString()}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{_mp ? `${_mp.toLocaleString()} сом` : ''}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* CATALOG */}
        <div id="catalog" style={{ padding: '52px 48px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginBottom: 6, fontWeight: 600 }}>
                {lang === 'kg' ? 'Каталог' : 'Каталог'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 400, color: '#0a0a0a', fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                {lang === 'kg' ? 'Жыпар суулар' : 'Ароматы'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <select value={desktopSort} onChange={e => setDesktopSort(e.target.value)}
                style={{ border: '1px solid #E8E6E2', borderRadius: 10, padding: '9px 32px 9px 14px',
                  fontSize: 11, color: '#777', background: '#FAFAF8', outline: 'none', cursor: 'pointer',
                  WebkitAppearance: 'none', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                <option value="default">По умолчанию</option>
                <option value="price_asc">Цена ↑</option>
                <option value="price_desc">Цена ↓</option>
                <option value="name">По названию</option>
              </select>
            </div>
          </div>
          {/* Pill category tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
            {CAT_TABS.map(tab => (
              <motion.div
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                whileHover={desktopCategory !== tab.id ? { background: '#EDEAE6', borderColor: 'rgba(0,0,0,0.12)' } : {}}
                onClick={() => setDesktopCategory(tab.id)}
                style={{
                  fontSize: 11, letterSpacing: 0.5, fontWeight: 600,
                  cursor: 'pointer', padding: '10px 24px', borderRadius: 50,
                  background: desktopCategory === tab.id ? '#111' : '#F5F3EF',
                  color: desktopCategory === tab.id ? '#fff' : '#666',
                  border: desktopCategory === tab.id ? '1px solid #111' : '1px solid rgba(0,0,0,0.06)',
                  transition: 'all 0.25s ease',
                }}>
                {tab.label}
              </motion.div>
            ))}
          </div>
        </div>

        {/* PRODUCT GRID */}
        <div style={{ padding: '0 48px' }}>
          {pbLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 18 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ aspectRatio: '1/1.05', background: '#F5F3EF',
                    animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ padding: '14px 16px 16px' }}>
                    <div style={{ height: 8, background: '#F0EFED', marginBottom: 8, width: '40%', borderRadius: 4,
                      animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ height: 12, background: '#F0EFED', marginBottom: 6, width: '70%', borderRadius: 4,
                      animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ height: 8, background: '#F0EFED', marginBottom: 14, width: '90%', borderRadius: 4,
                      animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, height: 38, background: '#F0EFED', borderRadius: 10,
                        animation: 'pulse 1.5s ease-in-out infinite' }} />
                      <div style={{ width: 42, height: 38, background: '#F0EFED', borderRadius: 10,
                        animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 18 }}>
              {filteredProducts.map((product, index) => renderProductCard(product, index))}
            </div>
          )}
        </div>

        {/* PROMO BANNERS */}
        <div style={{ margin: '52px 48px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {[
            { bg: 'linear-gradient(135deg, #111 0%, #2a1f0e 100%)', eye: 'НОВАЯ КОЛЛЕКЦИЯ', title: 'ЖЕНСКИЕ\nАРОМАТЫ', cat: 'female' },
            { bg: 'linear-gradient(135deg, #0d1f3c 0%, #111 100%)', eye: 'ПРЕМИУМ ЛИНЕЙКА', title: 'МУЖСКИЕ\nАРОМАТЫ', cat: 'male' },
          ].map((b, i) => (
            <motion.div key={i} whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}
              onClick={() => { setDesktopCategory(b.cat); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ height: 220, background: b.bg, display: 'flex', alignItems: 'flex-end',
                padding: '28px 32px', cursor: 'pointer', overflow: 'hidden' }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6 }}>{b.eye}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', marginBottom: 12, whiteSpace: 'pre-line' }}>{b.title}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 1, display: 'inline-block' }}>
                  СМОТРЕТЬ КАТАЛОГ →
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── 1. ОТЗЫВЫ КЛИЕНТОВ (real PB data) ── */}
        {(() => {
          const approved = reviews.filter(r => r.approved);
          if (approved.length === 0) return null;
          return (
            <div style={{ margin: '64px 48px 0' }}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginBottom: 10, fontWeight: 600 }}>
                {lang === 'kg' ? 'Кардарлардын пикири' : 'Отзывы клиентов'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 400, color: '#0a0a0a', marginBottom: 32, fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                {lang === 'kg' ? 'Алар биз жөнүндө эмне дейт' : 'Что говорят о нас'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(approved.length, 3)}, 1fr)`, gap: 16 }}>
                {approved.slice(0, 6).map((r, i) => (
                  <div key={r.id || i} style={{ background: '#f7f7f5', borderRadius: 14, padding: '24px 22px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s <= (r.rating || 5) ? '#111' : '#ddd'}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.65, marginBottom: 14 }}>"{r.text}"</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                        {(r.name || '?').charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{r.name}</div>
                        {r.city && <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.city}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 2. НОВИНКИ / SO'NGI MAHSULOTLAR ── */}
        <div style={{ margin: '52px 48px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginBottom: 10, fontWeight: 600 }}>
                {lang === 'kg' ? 'Жаңы келгендер' : 'Новинки'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 400, color: '#0a0a0a', fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                {lang === 'kg' ? 'Жаңы ароматтар' : 'Свежие поступления'}
              </div>
            </div>
            <div onClick={() => { setDesktopCategory('all'); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#111', cursor: 'pointer', borderBottom: '1px solid #111', paddingBottom: 2 }}>
              {lang === 'kg' ? 'Баарын көрүү' : 'Смотреть все'} →
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 18 }}>
            {products.slice(-8).reverse().slice(0, windowWidth >= 1600 ? 5 : 4).map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.10), 0 8px 16px rgba(0,0,0,0.06)' }}
                onClick={() => { setSelectedProduct(p); setModalVariantId(p.variants?.[0]?.id || null); setModalImgIndex(0); }}
                style={{ cursor: 'pointer', background: '#fff', borderRadius: 16, overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.05)', transition: 'box-shadow 0.35s ease, transform 0.35s ease' }}>
                <div style={{ aspectRatio: '1/1.05', overflow: 'hidden', background: '#F5F3EF' }}>
                  {(p.img || p.images?.[0]) ? (
                    <motion.img src={p.img || p.images[0]} alt={p.name}
                      whileHover={{ scale: 1.06 }}
                      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="48" height="100" viewBox="0 0 60 140" fill="none" opacity="0.3">
                        <rect x="20" y="0" width="20" height="16" rx="2" fill="#C5C0B6"/>
                        <rect x="8" y="16" width="44" height="110" rx="4" fill="#D5D0C8"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa', marginBottom: 4, fontWeight: 500 }}>{p.brand}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                    {lang === 'kg' ? '' : 'от '}{minPrice(p)} <span style={{ fontSize: 11, fontWeight: 500, color: '#999' }}>{lang === 'kg' ? 'сомдон' : 'сом'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── 3. BONUS PROGRAM — 3 premium cards ── */}
        <div style={{ margin: '64px 48px 0' }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #c9a96e 0%, #e8d5a8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>
                {lang === 'kg' ? 'Бонус система' : 'Бонусная программа'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 400, color: '#0a0a0a', fontFamily: "'Georgia', serif", fontStyle: 'italic', lineHeight: 1.2, marginTop: 2 }}>
                {lang === 'kg' ? 'Сатып алыңыз — бонус алыңыз' : 'Покупайте — получайте бонусы'}
              </div>
            </div>
          </div>

          {/* 3 cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* Card 1 — Cashback */}
            <motion.div
              whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.12)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                background: '#111', borderRadius: 20, padding: '36px 32px',
                position: 'relative', overflow: 'hidden', cursor: 'default',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              }}
            >
              {/* Background decorative % */}
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 120, fontWeight: 200, color: 'rgba(255,255,255,0.04)', fontFamily: "'Georgia', serif", fontStyle: 'italic', lineHeight: 1, pointerEvents: 'none' }}>
                {settings?.bonusPercent || 5}%
              </div>
              {/* Icon */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #c9a96e, #e8d5a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              {/* Percentage */}
              <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', fontFamily: "-apple-system, sans-serif", letterSpacing: -2, lineHeight: 1, marginBottom: 6 }}>
                {settings?.bonusPercent || 5}%
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 8, letterSpacing: -0.3 }}>
                {lang === 'kg' ? 'Кэшбэк' : 'Кэшбэк'}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 24 }}>
                {lang === 'kg'
                  ? `Ар бир буйрутмадан ${settings?.bonusPercent || 5}% бонус алыңыз. Бонустарды кийинки сатып алууда ${settings?.useBonusPercent || 30}% чейин колдонуңуз.`
                  : `Получайте ${settings?.bonusPercent || 5}% бонусов с каждого заказа. Используйте до ${settings?.useBonusPercent || 30}% суммы при следующей покупке.`}
              </div>
              {/* Subtle divider */}
              <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, #c9a96e, transparent)', marginBottom: 16 }} />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                {lang === 'kg' ? 'Автоматтык түрдө' : 'Автоматически'}
              </div>
            </motion.div>

            {/* Card 2 — Referral */}
            <motion.div
              whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.12)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                background: '#fff', borderRadius: 20, padding: '36px 32px',
                position: 'relative', overflow: 'hidden', cursor: 'default',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
              }}
            >
              {/* Icon */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #E8E4FF, #D5CFFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              {/* Amount */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 700, color: '#111', fontFamily: "-apple-system, sans-serif", letterSpacing: -2, lineHeight: 1 }}>
                  {settings?.referralBonus || 200}
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#999', letterSpacing: -0.3 }}>
                  {lang === 'kg' ? 'сом' : 'сом'}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#111', marginBottom: 8, letterSpacing: -0.3 }}>
                {lang === 'kg' ? 'Досуңузду чакырыңыз' : 'Пригласите друга'}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.6, marginBottom: 24 }}>
                {lang === 'kg'
                  ? `Кодуңузду досуңузга жөнөтүңүз. Сиз ${settings?.referralBonus || 200} сом, досуңуз ${settings?.referralFriendBonus || 100} сом бонус алат.`
                  : `Поделитесь кодом с другом. Вы получите ${settings?.referralBonus || 200} сом, друг — ${settings?.referralFriendBonus || 100} сом бонусов.`}
              </div>
              {/* Visual: two user circles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6B5CE7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', zIndex: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#D5CFFA', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', marginLeft: -8, zIndex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B5CE7" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
                </div>
                <div style={{ marginLeft: 10, fontSize: 11, color: 'rgba(0,0,0,0.25)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                  {lang === 'kg' ? 'Экөөңүзгө тең' : 'Обоим бонусы'}
                </div>
              </div>
            </motion.div>

            {/* Card 3 — Welcome Bonus */}
            <motion.div
              whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.12)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                background: '#fff', borderRadius: 20, padding: '36px 32px',
                position: 'relative', overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
                cursor: user ? 'default' : 'pointer',
              }}
              onClick={() => { if (!user && !guestMode) { /* scroll to login or trigger login */ } }}
            >
              {/* Decorative sparkle */}
              <div style={{ position: 'absolute', top: 20, right: 24, opacity: 0.08, pointerEvents: 'none' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#c9a96e"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              {/* Icon */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #E6F9F0, #C3EDDA)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
              </div>
              {/* Amount */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 700, color: '#111', fontFamily: "-apple-system, sans-serif", letterSpacing: -2, lineHeight: 1 }}>
                  {settings?.welcomeBonus || 150}
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#999', letterSpacing: -0.3 }}>
                  {lang === 'kg' ? 'сом' : 'сом'}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#111', marginBottom: 8, letterSpacing: -0.3 }}>
                {lang === 'kg' ? 'Кош келүү бонусу' : 'Приветственный бонус'}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.6, marginBottom: 24 }}>
                {lang === 'kg'
                  ? 'Катталыңыз жана биринчи буйрутмага бонус алыңыз. Дароо колдонсоңуз болот!'
                  : 'Зарегистрируйтесь и получите бонус на первый заказ. Можно использовать сразу!'}
              </div>
              {/* CTA */}
              {!user && (
                <motion.div
                  whileHover={{ background: '#111', color: '#fff' }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#f5f5f5', color: '#111',
                    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
                    fontWeight: 600, padding: '12px 24px', borderRadius: 999,
                    cursor: 'pointer', transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  {lang === 'kg' ? 'Катталуу' : 'Зарегистрироваться'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </motion.div>
              )}
              {user && (
                <div style={{ fontSize: 11, color: '#1D9E75', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {lang === 'kg' ? 'Активдүү' : 'Активировано'}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ── 4. INSTAGRAM — moved above bestsellers (see trust badges section) ── */}

        {/* FOOTER */}
        <div id="footer" style={{ marginTop: 52, background: '#111', padding: '48px 48px 0' }}>
          {/* ── Top grid: 4 columns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1.3fr', gap: 40, marginBottom: 40 }}>
            {/* Brand + socials */}
            <div>
              <div style={{
                fontFamily: "'Georgia', 'Playfair Display', serif",
                fontStyle: 'italic', fontWeight: 400, fontSize: 20,
                letterSpacing: -0.2, color: '#fff', lineHeight: 1, marginBottom: 6,
              }}>Kemal Usman</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
                {lang === 'kg' ? 'Оригинал парфюмерия' : 'Оригинальная парфюмерия'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 20 }}>
                {lang === 'kg'
                  ? 'Ош шаарында 2021-жылдан бери иштейбиз. 2 филиал, бүт Кыргызстан боюнча жеткирүү.'
                  : 'Работаем в Оше с 2021 года. 2 филиала, доставка по всему Кыргызстану.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { url: settings?.instagramUrl, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/><circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.45)"/></svg> },
                  { url: settings?.tiktokUrl, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                  { url: settings?.youtubeUrl, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/><path d="M10 9l5 3-5 3V9z" fill="rgba(255,255,255,0.45)"/></svg> },
                  { url: 'https://wa.me/' + (settings?.whatsappPhone || '').replace(/\D/g,''), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/><path d="M8 12c0 2.2 1.8 4 4 4 .8 0 1.5-.2 2.1-.6l2 .6-.6-2C15.8 13.5 16 12.8 16 12c0-2.2-1.8-4-4-4S8 9.8 8 12z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3"/></svg> },
                ].map((s, i) => (
                  <div key={i}
                    onClick={() => s.url && window.open(s.url, '_blank')}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '0.5px solid rgba(255,255,255,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: s.url ? 'pointer' : 'default', opacity: s.url ? 1 : 0.35,
                      transition: 'border-color 0.2s' }}
                    onMouseEnter={e => { if (s.url) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  >{s.icon}</div>
                ))}
              </div>
            </div>

            {/* Kompaniya */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontWeight: 600 }}>
                {lang === 'kg' ? 'Компания' : 'Компания'}
              </div>
              {(settings?.footerCompanyLinks || (lang === 'kg'
                ? 'Биз жөнүндө\nЖеткирүү жана төлөм\nТоварды кайтаруу\nШарттар'
                : 'О нас\nДоставка и оплата\nВозврат товара\nУсловия'
              )).split('\n').filter(Boolean).map(link => (
                <div key={link} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  onClick={() => {
                    if (link === 'О нас' || link === 'Биз жөнүндө') setShowAboutModal(true);
                    if (link === 'Доставка и оплата' || link === 'Жеткирүү жана төлөм') setShowDeliveryModal(true);
                    if (link === 'Возврат товара' || link === 'Товарды кайтаруу') setShowReturnModal(true);
                    if (link === 'Условия' || link === 'Шарттар') setShowConditionsModal(true);
                  }}>
                  {link}
                </div>
              ))}
            </div>

            {/* Yordam */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontWeight: 600 }}>
                {lang === 'kg' ? 'Жардам' : 'Помощь'}
              </div>
              {(settings?.footerHelpLinks || (lang === 'kg'
                ? 'Буйрутма берүү\nБуйрутманы көзөмөлдөө\nFAQ'
                : 'Как сделать заказ\nОтследить заказ\nFAQ'
              )).split('\n').filter(Boolean).map(link => (
                <div key={link} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  onClick={() => {
                    if (link === 'Как сделать заказ' || link === 'Буйрутма берүү') setShowHowToOrderModal(true);
                    if (link === 'Отследить заказ' || link === 'Буйрутманы көзөмөлдөө') setShowTrackOrderModal(true);
                    if (link === 'FAQ') setShowFaqModal(true);
                  }}>
                  {link}
                </div>
              ))}
              <div onClick={() => window.open('https://wa.me/' + (settings?.whatsappPhone || '').replace(/\D/g,''), '_blank')}
                style={{ fontSize: 12, color: '#25D366', cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                WhatsApp
              </div>
            </div>

            {/* Kontaktlar + ish vaqti */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontWeight: 600 }}>
                {lang === 'kg' ? 'Байланыш' : 'Контакты'}
              </div>
              {[settings?.contactPhone1 || '+996 551 120 009', settings?.contactPhone2 || '+996 557 100 505'].map(ph => (
                <div key={ph}
                  onClick={() => window.open('tel:' + ph.replace(/\s/g, ''), '_blank')}
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, cursor: 'pointer', letterSpacing: 0.3, transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                  {ph}
                </div>
              ))}
              <div style={{ marginTop: 16, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 600 }}>
                {lang === 'kg' ? 'Иш убактысы' : 'Режим работы'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                {lang === 'kg' ? 'Дүй — Ишм: 09:00 – 20:00' : 'Пн — Сб: 09:00 – 20:00'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {lang === 'kg' ? 'Жекшемби: 10:00 – 18:00' : 'Вс: 10:00 – 18:00'}
              </div>
            </div>
          </div>

          {/* ── Do'konlar — lokatsiya ── */}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', padding: '24px 0' }}>
            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 14, fontWeight: 600 }}>
              {lang === 'kg' ? 'Биздин дүкөндөр' : 'Наши магазины'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { name: lang === 'kg' ? '1-филиал' : '1-й филиал', landmark: lang === 'kg' ? 'ТЦ Maxcom' : 'ТЦ Maxcom', addr: lang === 'kg' ? 'Ош, А. Шакирова к., 30' : 'Ош, ул. А. Шакирова 30' },
                { name: lang === 'kg' ? '2-филиал' : '2-й филиал', landmark: lang === 'kg' ? 'Араван' : 'Араван', addr: lang === 'kg' ? 'Ош обл., Ош-3000 к., 86' : 'Ош обл., ул. Ош-3000, 86' },
              ].map((store, i) => (
                <div key={i} style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.5)"/><circle cx="12" cy="9" r="2.5" fill="#111"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>{store.name} · {store.landmark}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{store.addr}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 }}>
              {settings?.copyrightText || '© 2021–2026 Kemal Usman'}
              <span style={{ marginLeft: 14, color: 'rgba(255,255,255,0.12)' }}>Design & Development by Donik</span>
            </div>
            <div onClick={() => setShowPrivacyModal(true)}
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
              {lang === 'kg' ? 'Купуялык саясаты' : 'Конфиденциальность'}
            </div>
          </div>
        </div>
      </div>

      {/* ── ABOUT US MODAL ── */}
      {showAboutModal && (
        <div onClick={() => setShowAboutModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>
                {lang === 'kg' ? 'Биз жөнүндө' : 'О нас'}
              </div>
              <div onClick={() => setShowAboutModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              {lang === 'kg' ? (<>
                <p style={{ marginBottom: 14 }}>Менин атым Усманов Камолиддин. 2021-жылдан бери биз кардарларыбыз үчүн ийгиликтүү иштеп келебиз жана бул убакыт ичинде 100 000 ден ашык сатып алуучуларга кызмат көрсөттүк.</p>
                <p style={{ marginBottom: 14 }}>Биздин компания оригинал парфюмерия, куюлуп сатылуучу парфюм, ошондой эле үй үчүн тиричилик техникасын сатуу менен алектенет. Биз сапаттуу продукцияны, жеткиликтүү бааларды жана жогорку деңгээлдеги тейлөөнү сунуштоого аракет кылабыз.</p>
                <p style={{ marginBottom: 14 }}>Биздин жерден сиз сүйүктүү жыттарды, заманбап тиричилик техникасын таба аласыз жана сатып алуудан мурун профессионалдуу кеңеш ала аласыз.</p>
                <p style={{ marginBottom: 14 }}>Бүгүнкү күндө биздин 2 филиал иштейт, ар бир кардарды көрүүгө дайыма кубанычтабыз. Биздин команданын негизги максаты — сатып алууларды ыңгайлуу, жагымдуу жана баарына жеткиликтүү кылуу.</p>
                <p style={{ marginBottom: 0 }}>Ишенимиңиз үчүн рахмат. Биз өнүгүүнү улантабыз жана күн сайын сиздер үчүн иштейбиз.</p>
              </>) : (<>
                <p style={{ marginBottom: 14 }}>Меня зовут Усманов Камолиддин. С 2021 года мы успешно работаем для наших клиентов и за это время обслужили более 100 000 покупателей.</p>
                <p style={{ marginBottom: 14 }}>Наша компания занимается продажей оригинальной парфюмерии, парфюма на разлив, а также бытовой техники для дома. Мы стараемся предлагать только качественную продукцию, доступные цены и высокий уровень обслуживания.</p>
                <p style={{ marginBottom: 14 }}>У нас вы можете найти любимые ароматы, современную бытовую технику и получить профессиональную консультацию перед покупкой.</p>
                <p style={{ marginBottom: 14 }}>На сегодняшний день у нас работают 2 филиала, где мы всегда рады видеть каждого клиента. Главная цель нашей команды — сделать покупки удобными, приятными и доступными для всех.</p>
                <p style={{ marginBottom: 0 }}>Спасибо за ваше доверие. Мы продолжаем развиваться и каждый день работаем для вас.</p>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── CONDITIONS / УСЛОВИЯ MODAL ── */}
      {showConditionsModal && (
        <div onClick={() => setShowConditionsModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>
                {lang === 'kg' ? 'Колдонуу шарттары' : 'Условия использования'}
              </div>
              <div onClick={() => setShowConditionsModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              {lang === 'kg' ? (<>
                <p style={{ marginBottom: 14 }}>Биздин сайтка кош келиңиз. Бул сайтты колдонуу менен сиз колдонуу шарттарына автоматтык түрдө макул болосуз.</p>
                <p style={{ marginBottom: 14 }}>Биз товарлар, баалар жана продукциянын болушу жөнүндө актуалдуу маалымат берүүгө аракет кылабыз. Бирок кээ бир учурларда маалымат кечигүү менен жаңыртылышы мүмкүн.</p>
                <p style={{ marginBottom: 14 }}>Товарлардын бардык сүрөттөрү жана сыпаттамалары таанышуу максатында жайгаштырылган жана чыныгы товардан бир аз айырмаланышы мүмкүн.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Колдонуучу милдеттенет:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                  <li style={{ marginBottom: 4 }}>сайтты мыйзамсыз максаттарда колдонбоого;</li>
                  <li style={{ marginBottom: 4 }}>сайттын ишин бузбоого;</li>
                  <li style={{ marginBottom: 4 }}>компаниянын атынан жалган маалымат таратпоого.</li>
                </ul>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Сайт администрациясы укукту калтырат:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                  <li style={{ marginBottom: 4 }}>товарлардын ассортиментин жана бааларды өзгөртүү;</li>
                  <li style={{ marginBottom: 4 }}>сайттагы маалыматты жаңыртуу;</li>
                  <li style={{ marginBottom: 4 }}>бул шарттарды алдын ала эскертүүсүз өзгөртүү.</li>
                </ul>
                <p style={{ marginBottom: 14 }}>Сайттан буйрутма берүү менен, кардар байланыш жана жеткирүү үчүн берилген маалыматтардын тууралыгын тастыктайт.</p>
                <p style={{ marginBottom: 0 }}>Суроолоруңуз болсо, көрсөтүлгөн байланыш аркылуу биз менен байланышсаңыз болот.</p>
              </>) : (<>
                <p style={{ marginBottom: 14 }}>Добро пожаловать на наш сайт. Используя данный сайт, вы автоматически соглашаетесь с настоящими условиями использования.</p>
                <p style={{ marginBottom: 14 }}>Мы стараемся предоставлять только актуальную информацию о товарах, ценах и наличии продукции. Однако в некоторых случаях информация может обновляться с задержкой.</p>
                <p style={{ marginBottom: 14 }}>Все изображения и описания товаров размещены исключительно в ознакомительных целях и могут незначительно отличаться от фактического товара.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Пользователь обязуется:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                  <li style={{ marginBottom: 4 }}>не использовать сайт в незаконных целях;</li>
                  <li style={{ marginBottom: 4 }}>не нарушать работу сайта;</li>
                  <li style={{ marginBottom: 4 }}>не распространять ложную информацию от имени компании.</li>
                </ul>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Администрация сайта оставляет за собой право:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                  <li style={{ marginBottom: 4 }}>изменять ассортимент товаров и цены;</li>
                  <li style={{ marginBottom: 4 }}>обновлять информацию на сайте;</li>
                  <li style={{ marginBottom: 4 }}>изменять настоящие условия без предварительного уведомления.</li>
                </ul>
                <p style={{ marginBottom: 14 }}>Оформляя заказ на сайте, клиент подтверждает правильность предоставленных данных для связи и доставки.</p>
                <p style={{ marginBottom: 0 }}>Если у вас возникли вопросы, вы всегда можете связаться с нами через указанные контакты.</p>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── HOW TO ORDER MODAL ── */}
      {showHowToOrderModal && (
        <div onClick={() => setShowHowToOrderModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>
                {lang === 'kg' ? 'Буйрутма кантип берүү керек' : 'Как сделать заказ'}
              </div>
              <div onClick={() => setShowHowToOrderModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              {lang === 'kg' ? (<>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>1. Товар тандаңыз</p>
                <p style={{ marginBottom: 14 }}>Каталогдон жаккан парфюмду же техниканы тандаңыз. Көлөмүн (мл) же түрүн тандап, «Себетке» баскычын басыңыз.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>2. Себетти текшериңиз</p>
                <p style={{ marginBottom: 14 }}>Себетте товарлардын санын өзгөртө аласыз же керексиздерин өчүрө аласыз.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>3. Жеткирүү ыкмасын тандаңыз</p>
                <p style={{ marginBottom: 14 }}>«Өзү алуу» (филиалдан) же «Жеткирүү» (дарегиңизге). Жеткирүүнү тандасаңыз, дарегиңизди жазыңыз.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>4. Төлөм ыкмасын тандаңыз</p>
                <p style={{ marginBottom: 14 }}>M Bank, O!Bank же накталай төлөм. Банк тиркемеси аркылуу QR-код менен да төлөй аласыз.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>5. Буйрутманы тастыктаңыз</p>
                <p style={{ marginBottom: 14 }}>«Заказ берүү» баскычын басыңыз. Сиздин буйрутма кабыл алынат жана биз сиз менен тез арада байланышабыз.</p>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Бонус балдарыңыз болсо — себетте колдоно аласыз!</p>
              </>) : (<>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>1. Выберите товар</p>
                <p style={{ marginBottom: 14 }}>В каталоге выберите понравившийся парфюм или технику. Выберите объём (мл) или вариант и нажмите «В корзину».</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>2. Проверьте корзину</p>
                <p style={{ marginBottom: 14 }}>В корзине вы можете изменить количество товаров или удалить ненужные позиции.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>3. Выберите способ доставки</p>
                <p style={{ marginBottom: 14 }}>«Самовывоз» (из филиала) или «Доставка» (по вашему адресу). При доставке укажите адрес.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>4. Выберите способ оплаты</p>
                <p style={{ marginBottom: 14 }}>M Bank, O!Bank или наличные. Также можно оплатить через QR-код в приложении банка.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>5. Подтвердите заказ</p>
                <p style={{ marginBottom: 14 }}>Нажмите «Оформить заказ». Ваш заказ будет принят, и мы свяжемся с вами в ближайшее время.</p>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Если у вас есть бонусные баллы — вы можете использовать их в корзине!</p>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── TRACK ORDER MODAL ── */}
      {showTrackOrderModal && (
        <div onClick={() => setShowTrackOrderModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>
                {lang === 'kg' ? 'Буйрутманы көзөмөлдөө' : 'Отследить заказ'}
              </div>
              <div onClick={() => setShowTrackOrderModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              {lang === 'kg' ? (<>
                <p style={{ marginBottom: 14 }}>Буйрутмаңыздын абалын «Заказдар» бөлүмүнөн көрө аласыз. Аккаунтуңузга кирип, ылдыйкы менюдан «Заказдар» баскычын басыңыз.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Буйрутма статустары:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {[
                    { color: '#FF6B00', label: lang === 'kg' ? 'Жаңы' : 'Новый', desc: lang === 'kg' ? 'Буйрутма кабыл алынды' : 'Заказ принят' },
                    { color: '#1976D2', label: lang === 'kg' ? 'Тастыкталды' : 'Подтверждён', desc: lang === 'kg' ? 'Оператор тастыктады' : 'Оператор подтвердил' },
                    { color: '#388E3C', label: lang === 'kg' ? 'Даярдалууда' : 'Готовится', desc: lang === 'kg' ? 'Заказ чогултулууда' : 'Заказ собирается' },
                    { color: '#7C5CBF', label: lang === 'kg' ? 'Жеткирилүүдө' : 'Доставляется', desc: lang === 'kg' ? 'Курьер жолдо' : 'Курьер в пути' },
                    { color: '#388E3C', label: lang === 'kg' ? 'Жеткирилди' : 'Доставлен', desc: lang === 'kg' ? 'Буйрутма тапшырылды' : 'Заказ вручён' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, minWidth: 100 }}>{s.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>— {s.desc}</span>
                    </div>
                  ))}
                </div>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Суроолор болсо WhatsApp аркылуу байланышыңыз.</p>
              </>) : (<>
                <p style={{ marginBottom: 14 }}>Статус вашего заказа вы можете отслеживать в разделе «Заказы». Войдите в свой аккаунт и нажмите «Заказы» в нижнем меню.</p>
                <p style={{ marginBottom: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Статусы заказа:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {[
                    { color: '#FF6B00', label: 'Новый', desc: 'Заказ принят' },
                    { color: '#1976D2', label: 'Подтверждён', desc: 'Оператор подтвердил' },
                    { color: '#388E3C', label: 'Готовится', desc: 'Заказ собирается' },
                    { color: '#7C5CBF', label: 'Доставляется', desc: 'Курьер в пути' },
                    { color: '#388E3C', label: 'Доставлен', desc: 'Заказ вручён' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, minWidth: 100 }}>{s.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>— {s.desc}</span>
                    </div>
                  ))}
                </div>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Есть вопросы? Свяжитесь с нами через WhatsApp.</p>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ MODAL ── */}
      {showFaqModal && (
        <div onClick={() => setShowFaqModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>FAQ</div>
              <div onClick={() => setShowFaqModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              {(lang === 'kg' ? [
                { q: 'Парфюмериңиз оригиналбы?', a: 'Ооба, биз сапаттуу оригинал парфюмерия жана разлив парфюмдарды сатабыз.' },
                { q: 'Жеткирүү канча турат?', a: `Жеткирүү баасы — ${settings?.deliveryCost || 0} сом. ${settings?.minOrderForFreeDelivery ? settings.minOrderForFreeDelivery + ' сомдон жогору буйрутмаларга акысыз.' : ''}` },
                { q: 'Кайсы төлөм ыкмалары бар?', a: 'M Bank, O!Bank же накталай акча. Банк тиркемеси аркылуу QR-код менен да төлөй аласыз.' },
                { q: 'Буйрутма канча убакытта жеткирилет?', a: 'Ош шаары боюнча буйрутмалар адатта ошол эле күнү же кийинки күнү жеткирилет.' },
                { q: 'Бонус система кантип иштейт?', a: `Ар бир буйрутмадан ${settings?.bonusPercent || 5}% бонус балл аласыз. Кийинки сатып алууда буйрутма суммасынын ${settings?.useBonusPercent || 30}% чейин колдоно аласыз.` },
                { q: 'Товарды кайтарса болобу?', a: 'Ооба, товарды 3 күндүн ичинде кайтара аласыз, эгер ал ачылбаган жана баштапкы көрүнүшүн сактаган болсо.' },
                { q: 'Самовывоз кайдан алса болот?', a: 'Биздин 2 филиалдын каалаганынан: Ош, А. Шакирова к., 30 (ТЦ Maxcom) же Араван, Ош-3000 к., 86.' },
              ] : [
                { q: 'Ваша парфюмерия оригинальная?', a: 'Да, мы продаём качественную оригинальную парфюмерию и парфюм на разлив.' },
                { q: 'Сколько стоит доставка?', a: `Стоимость доставки — ${settings?.deliveryCost || 0} сом. ${settings?.minOrderForFreeDelivery ? 'Бесплатно при заказе от ' + settings.minOrderForFreeDelivery + ' сом.' : ''}` },
                { q: 'Какие способы оплаты доступны?', a: 'M Bank, O!Bank или наличные. Также можно оплатить по QR-коду через приложение банка.' },
                { q: 'Как быстро доставляется заказ?', a: 'По Ошу заказы обычно доставляются в тот же день или на следующий.' },
                { q: 'Как работает бонусная система?', a: `С каждого заказа вы получаете ${settings?.bonusPercent || 5}% бонусных баллов. При следующей покупке можно использовать до ${settings?.useBonusPercent || 30}% от суммы заказа.` },
                { q: 'Можно ли вернуть товар?', a: 'Да, вы можете вернуть товар в течение 3 дней, если он не был вскрыт и сохранил товарный вид.' },
                { q: 'Где можно забрать самовывозом?', a: 'В любом из наших 2 филиалов: Ош, ул. А. Шакирова 30 (ТЦ Maxcom) или Араван, ул. Ош-3000, 86.' },
              ]).map((item, i) => (
                <div key={i} style={{ marginBottom: i < 6 ? 16 : 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 4 }}>{item.q}</div>
                  <div>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PRIVACY POLICY MODAL ── */}
      {showPrivacyModal && (
        <div onClick={() => setShowPrivacyModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', letterSpacing: 0.2 }}>Политика конфиденциальности</div>
              <div onClick={() => setShowPrivacyModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                ×
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              <p style={{ marginBottom: 14 }}>Мы уважаем вашу конфиденциальность и заботимся о безопасности ваших персональных данных.</p>
              <p style={{ marginBottom: 8 }}>При использовании нашего сайта мы можем собирать минимальную информацию, необходимую для обработки заказов:</p>
              <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                {['имя', 'номер телефона', 'адрес доставки', 'данные для связи'].map(i => (
                  <li key={i} style={{ marginBottom: 4 }}>{i}</li>
                ))}
              </ul>
              <p style={{ marginBottom: 8 }}>Вся предоставленная информация используется исключительно для:</p>
              <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                {['оформления и доставки заказов', 'связи с клиентом', 'улучшения качества обслуживания'].map(i => (
                  <li key={i} style={{ marginBottom: 4 }}>{i}</li>
                ))}
              </ul>
              <p style={{ marginBottom: 14 }}>Мы не передаём персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством или необходимых для выполнения заказа.</p>
              <p style={{ marginBottom: 14 }}>Наш сайт принимает необходимые меры для защиты информации пользователей от утраты, неправомерного доступа и распространения.</p>
              <p style={{ marginBottom: 20 }}>Используя сайт, вы соглашаетесь с условиями данной Политики конфиденциальности.</p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  По вопросам конфиденциальности:
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  {settings?.contactPhone1 || '+996551120009'} · {settings?.contactPhone2 || '+996557100505'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVERY MODAL ── */}
      {showDeliveryModal && (
        <div onClick={() => setShowDeliveryModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 580, width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>Доставка и оплата</div>
              <div onClick={() => setShowDeliveryModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>×</div>
            </div>
            <div style={{ padding: '24px 28px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              <p style={{ marginBottom: 14 }}>Мы осуществляем доставку <span style={{ color: 'rgba(255,255,255,0.8)' }}>по Ошу и в другие регионы</span>. Доступны удобные способы оплаты наличными и переводом.</p>
              <p style={{ marginBottom: 20 }}>После оформления заказа наш менеджер свяжется с вами для подтверждения деталей.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="1" y="3" width="15" height="13" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><path d="M16 8h3l3 3v5h-6V8z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="5.5" cy="18.5" r="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><circle cx="18.5" cy="18.5" r="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/></svg>, label: 'Доставка', desc: 'Ош и регионы' },
                  { svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="3" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><path d="M2 10h20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><path d="M6 15h4" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: 'Наличные', desc: 'При получении' },
                  { svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><path d="M9 18h6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 6v6l3 2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: 'Перевод', desc: 'MBank, O!Bank' },
                  { svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 01.01 2.82 2 2 0 012 .67h3a2 2 0 012 1.72c.12.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L6.09 8.47a16 16 0 006.29 6.29l1.16-1.16a2 2 0 012.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0122 16.92z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/></svg>, label: 'Подтверждение', desc: 'Менеджер позвонит' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ marginBottom: 8 }}>{item.svg}</div>
                    <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RETURN MODAL ── */}
      {showReturnModal && (
        <div onClick={() => setShowReturnModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#111', borderRadius: 16, maxWidth: 520, width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>Гарантия и возврат</div>
              <div onClick={() => setShowReturnModal(false)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>×</div>
            </div>
            <div style={{ padding: '24px 28px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85 }}>
              <p style={{ marginBottom: 14 }}>Мы ценим доверие наших клиентов и стараемся предоставлять только <span style={{ color: 'rgba(255,255,255,0.8)' }}>качественную продукцию</span>.</p>
              <p style={{ marginBottom: 20 }}>Если у вас возникли вопросы по товару, вы всегда можете связаться с нами для решения ситуации.</p>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 10, flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 01.01 2.82 2 2 0 012 .67h3a2 2 0 012 1.72c.12.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L6.09 8.47a16 16 0 006.29 6.29l1.16-1.16a2 2 0 012.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0122 16.92z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, marginBottom: 4 }}>Связаться с нами</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{settings?.contactPhone1 || '+996551120009'} · {settings?.contactPhone2 || '+996557100505'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedProduct(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 2000,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{ width: 860, maxWidth: '90vw', background: '#fff',
                maxHeight: '85vh', overflow: 'hidden',
                display: 'grid', gridTemplateColumns: '1fr 1fr' }}
            >
              {/* Left side */}
              <div style={{ background: '#FAFAFA', display: 'flex',
                alignItems: 'center', justifyContent: 'center', minHeight: 460,
                flexDirection: 'column', gap: 12, padding: 20 }}>
                {(selectedProduct.img || selectedProduct.images?.[modalImgIndex]) ? (
                  <img
                    src={selectedProduct.images?.[modalImgIndex] || selectedProduct.img}
                    alt={selectedProduct.name}
                    style={{ maxHeight: 380, maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <svg width="80" height="180" viewBox="0 0 60 140" fill="none">
                    <rect x="20" y="0" width="20" height="16" rx="2" fill="#E5E5E5"/>
                    <rect x="8" y="16" width="44" height="110" rx="4" fill="#EBEBEB"/>
                  </svg>
                )}
                {selectedProduct.images?.length > 1 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {selectedProduct.images.map((img, i) => (
                      <div key={i} onClick={() => setModalImgIndex(i)}
                        style={{ width: 56, height: 56, cursor: 'pointer',
                          outline: i === modalImgIndex ? '2px solid #111' : 'none',
                          background: '#fff' }}>
                        <img src={img}
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Right side */}
              <div style={{ padding: 48, overflowY: 'auto', position: 'relative' }}>
                <div onClick={() => setSelectedProduct(null)}
                  style={{ position: 'absolute', top: 20, right: 20, cursor: 'pointer' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#BBB', marginBottom: 8 }}>
                  {selectedProduct.brand}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#111', marginBottom: 12 }}>
                  {selectedProduct.name}
                </div>
                <div style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 24 }}>
                  {selectedProduct.description}
                </div>
                {(() => {
                  const selVariant = (selectedProduct.variants || []).find(v => v.id === modalVariantId);
                  return selVariant ? (
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 20 }}>
                      {Number(selVariant.price).toLocaleString()} сом
                    </div>
                  ) : null;
                })()}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {(selectedProduct.variants || []).map(v => (
                    <div key={v.id} onClick={() => v.inStock !== false && setModalVariantId(v.id)}
                      style={{ padding: '10px 16px', border: `1px solid ${modalVariantId === v.id ? '#111' : '#E5E5E5'}`,
                        background: modalVariantId === v.id ? '#111' : '#fff',
                        color: modalVariantId === v.id ? '#fff' : '#555',
                        fontSize: 12, cursor: v.inStock === false ? 'not-allowed' : 'pointer',
                        opacity: v.inStock === false ? 0.4 : 1 }}>
                      {v.label} — {v.price} сом
                    </div>
                  ))}
                </div>
                <ClientAudioBtn product={selectedProduct} />
                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (modalVariantId) { addToCart(selectedProduct.id, modalVariantId); setSelectedProduct(null); setCartOpen(true); }
                  }}
                  style={{ width: '100%', background: '#111', color: '#fff', border: 'none',
                    padding: '16px', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase',
                    cursor: 'pointer', fontWeight: 600, marginBottom: 16 }}>
                  В корзину
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CART SIDEBAR ── */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0,0,0,0.3)' }}
            />
            <motion.div
              initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
                background: '#fff', borderLeft: '1px solid #E5E5E5',
                zIndex: 1500, display: 'flex', flexDirection: 'column' }}
            >
              {/* Header */}
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0F0F0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#111' }}>
                    Корзина
                  </span>
                  {cartCount > 0 && (
                    <span style={{ background: '#111', color: '#fff', borderRadius: '50%',
                      width: 20, height: 20, fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cartCount}
                    </span>
                  )}
                </div>
                <div onClick={() => setCartOpen(false)} style={{ cursor: 'pointer', padding: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>

              {/* Items */}
              {cart.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 40 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#DDD" strokeWidth="1.3" strokeLinejoin="round"/>
                    <line x1="3" y1="6" x2="21" y2="6" stroke="#DDD" strokeWidth="1.3"/>
                  </svg>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#BBB' }}>Корзина пуста</div>
                  <div onClick={() => setCartOpen(false)}
                    style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#111',
                      borderBottom: '1px solid #111', cursor: 'pointer', paddingBottom: 2 }}>
                    Перейти в каталог
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
                  {cart.map(ci => {
                    const prod = products.find(p => String(p.id) === String(ci.productId));
                    const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
                    return (
                      <div key={`${ci.productId}-${ci.variantId}`}
                        style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: '1px solid #F5F5F5', alignItems: 'flex-start' }}>
                        <div style={{ width: 56, height: 56, background: '#F5F5F5', flexShrink: 0, overflow: 'hidden' }}>
                          {(prod?.img || prod?.images?.[0]) && <img src={prod.img || prod.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>{prod?.name}</div>
                          <div style={{ fontSize: 11, color: '#BBB', marginBottom: 8 }}>{variant?.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => {
                              setCart(prev => {
                                const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId
                                  ? { ...i, qty: Math.max(1, i.qty - 1) } : i);
                                localStorage.setItem('parfum_cart', JSON.stringify(next));
                                return next;
                              });
                            }} style={{ width: 28, height: 28, background: '#F5F5F5', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              −
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{ci.qty}</span>
                            <button onClick={() => {
                              setCart(prev => {
                                const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId
                                  ? { ...i, qty: i.qty + 1 } : i);
                                localStorage.setItem('parfum_cart', JSON.stringify(next));
                                return next;
                              });
                            }} style={{ width: 28, height: 28, background: '#111', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              +
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{(variant?.price || 0) * ci.qty} сом</div>
                          <div onClick={() => {
                            setCart(prev => {
                              const next = prev.filter(i => !(i.productId === ci.productId && i.variantId === ci.variantId));
                              localStorage.setItem('parfum_cart', JSON.stringify(next));
                              return next;
                            });
                          }} style={{ cursor: 'pointer' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#BBB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              {cart.length > 0 && (
                <div style={{ padding: '20px 28px', borderTop: '1px solid #F0F0F0' }}>
                  <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
                    {['pickup', 'delivery'].map(type => (
                      <div key={type} onClick={() => setDeliveryType(type)}
                        style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 11,
                          letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
                          background: deliveryType === type ? '#111' : '#F5F5F5',
                          color: deliveryType === type ? '#fff' : '#888' }}>
                        {type === 'pickup' ? 'Самовывоз' : 'Доставка'}
                      </div>
                    ))}
                  </div>
                  {deliveryType === 'delivery' && (
                    <input
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Улица, дом, квартира..."
                      style={{ width: '100%', border: '1px solid #E5E5E5', padding: '10px 12px',
                        fontSize: 13, color: '#111', background: '#fff', outline: 'none',
                        marginBottom: 10, boxSizing: 'border-box' }}
                    />
                  )}
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Комментарий к заказу..."
                    rows={2}
                    style={{ width: '100%', border: '1px solid #E5E5E5', padding: '10px 12px',
                      fontSize: 13, color: '#111', background: '#fff', outline: 'none',
                      resize: 'none', marginBottom: 14, boxSizing: 'border-box',
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {[
                      { id: 'mbank', label: 'M-Bank', logo: <MBankLogo size={22} /> },
                      { id: 'obank', label: 'O!Bank', logo: <OBankLogo size={22} /> },
                      { id: 'cash',  label: 'Наличные', logo: <CashLogo size={22} /> },
                    ].map(pm => (
                      <div key={pm.id} onClick={() => setPayMethod(pm.id)}
                        style={{ flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10,
                          letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
                          border: `1px solid ${payMethod === pm.id ? '#111' : '#E5E5E5'}`,
                          background: payMethod === pm.id ? '#111' : '#fff',
                          color: payMethod === pm.id ? '#fff' : '#888',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        {pm.logo}
                        {pm.label}
                      </div>
                    ))}
                  </div>
                  {(payMethod === 'mbank' || payMethod === 'obank') && (() => {
                    const pmPhone = localStorage.getItem(payMethod === 'mbank' ? 'mbank_phone' : 'obank_phone') || '';
                    const pmQr    = payMethod === 'mbank' ? settings?.mbankQr : settings?.obankQr;
                    const pmLabel = payMethod === 'mbank' ? 'M-Bank' : 'O!Bank';
                    return (
                      <div style={{ background: '#FAFAFA', border: '1px solid #F0F0F0', padding: '14px 16px', marginBottom: 12 }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#BBB', marginBottom: 8 }}>
                          Реквизиты {pmLabel}
                        </div>
                        {pmPhone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pmQr ? 12 : 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>{pmPhone}</div>
                            <div onClick={() => { navigator.clipboard?.writeText(pmPhone); showToast('Скопировано!'); }}
                              style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888',
                                border: '1px solid #E5E5E5', padding: '5px 10px', cursor: 'pointer' }}>
                              Копировать
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#BBB' }}>Номер не настроен — обратитесь к администратору</div>
                        )}
                        {pmQr && (
                          <img src={pmQr} alt={`QR ${pmLabel}`}
                            style={{ width: 200, height: 200, objectFit: 'contain', display: 'block', margin: '8px auto 0', borderRadius: 8 }} />
                        )}
                      </div>
                    );
                  })()}
                  {bonusBalance > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#FAFAFA' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          stroke="#C9A84C" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 11, color: '#888' }}>У вас {bonusBalance} бонусов</span>
                      <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555', cursor: 'pointer' }}>
                        <input type="checkbox" checked={useBonus} onChange={e => setUseBonus(e.target.checked)} />
                        Применить
                      </label>
                    </div>
                  )}
                  {(() => {
                    const minFree = settings?.minOrderForFreeDelivery || 0;
                    const dlvCost = deliveryType === 'pickup' ? 0 : (minFree > 0 && cartTotal >= minFree) ? 0 : (settings?.deliveryCost || 0);
                    const bnsDisc = useBonus ? Math.min(bonusBalance, Math.floor(cartTotal * (settings?.useBonusPercent || 30) / 100)) : 0;
                    const finalTotal = cartTotal + dlvCost - bnsDisc;
                    return (
                      <>
                        <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                          <span>Подытог</span><span>{cartTotal} сом</span>
                        </div>
                        {deliveryType === 'delivery' && (
                          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                            <span>Доставка</span>
                            <span style={{ color: dlvCost === 0 ? '#22a86e' : '#111' }}>
                              {dlvCost === 0 ? 'Бесплатно' : `${dlvCost} сом`}
                            </span>
                          </div>
                        )}
                        {deliveryType === 'pickup' && (
                          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                            <span>Доставка</span>
                            <span style={{ color: '#22a86e' }}>Самовывоз</span>
                          </div>
                        )}
                        {useBonus && bnsDisc > 0 && (
                          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#C9A84C' }}>
                            <span>Бонус</span><span>−{bnsDisc} сом</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#111', marginTop: 10, marginBottom: 16 }}>
                          <span>Итого</span><span>{finalTotal} сом</span>
                        </div>
                      </>
                    );
                  })()}
                  <motion.button whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (!user) { showToast('Войдите для оформления заказа', 'error'); return; }
                      if (deliveryType === 'delivery' && !address.trim()) { showToast('Укажите адрес доставки', 'error'); return; }
                      const minFree2 = settings?.minOrderForFreeDelivery || 0;
                      const dlv = deliveryType === 'pickup' ? 0 : (minFree2 > 0 && cartTotal >= minFree2) ? 0 : (settings?.deliveryCost || 0);
                      const bns = useBonus ? Math.min(bonusBalance, Math.floor(cartTotal * (settings?.useBonusPercent || 30) / 100)) : 0;
                      onOrder({ deliveryType, address, comment, payMethod, total: cartTotal + dlv - bns, bonusDiscount: bns });
                      if (payMethod === 'cash') {
                        setCartOpen(false);
                        setAddress(''); setComment('');
                      }
                    }}
                    style={{ width: '100%', background: '#111', color: '#fff', border: 'none',
                      padding: '16px', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase',
                      cursor: 'pointer', fontWeight: 600 }}>
                    Оформить заказ
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SEARCH OVERLAY ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'fixed', top: 38 + 68 + 44, left: 0, right: 0, zIndex: 1050,
              background: '#fff', borderBottom: '1px solid #E5E5E5', padding: '20px 48px',
              display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#BBB" strokeWidth="1.5"/>
              <path d="M16.5 16.5L21 21" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              autoFocus
              value={desktopSearch}
              onChange={e => setDesktopSearch(e.target.value)}
              placeholder="Поиск ароматов..."
              style={{ flex: 1, fontSize: 22, border: 'none', outline: 'none', color: '#111', background: 'transparent' }}
            />
            <div onClick={() => { setSearchOpen(false); setDesktopSearch(''); }} style={{ cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  // Language persists across launches.
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('parfum_lang') || 'ru'; } catch { return 'ru'; }
  });
  useEffect(() => {
    try { localStorage.setItem('parfum_lang', lang); } catch { /* ignore */ }
  }, [lang]);
  const [screen, setScreen] = useState("catalog");
  const [adminScreen, setAdminScreen] = useState("orders");
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [pbLoading, setPbLoading] = useState(true);
  const [banners, setBanners] = useState(() => {
    try {
      const stored = localStorage.getItem('parfum_banners');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_BANNERS;
  });
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('parfum_cart') || '[]'); } catch { return []; } });
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [instaPosts, setInstaPosts] = useState([]);
  const [instaProfile, setInstaProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('parfum_is_admin');
      if (saved === 'true') {
        // Verify PB token is still valid
        if (pb.authStore.isValid) return true;
        // Token expired — clean up
        localStorage.removeItem('parfum_is_admin');
      }
    } catch {}
    return false;
  });
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(() => {
    const loginBg = localStorage.getItem('parfum_login_bg') || null;
    const instagramScreen = localStorage.getItem('parfum_insta_screen') || null;
    let instaStories = null;
    try { instaStories = JSON.parse(localStorage.getItem('parfum_insta_stories') || 'null'); } catch { /* ignore */ }
    try {
      const stored = localStorage.getItem('parfum_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // If stored values are 0 but defaults are non-zero, prefer defaults
        // (handles migration from old 0-defaults to new real defaults)
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        if (parsed.deliveryCost === 0 && DEFAULT_SETTINGS.deliveryCost > 0) merged.deliveryCost = DEFAULT_SETTINGS.deliveryCost;
        if (parsed.minOrderForFreeDelivery === 0 && DEFAULT_SETTINGS.minOrderForFreeDelivery > 0) merged.minOrderForFreeDelivery = DEFAULT_SETTINGS.minOrderForFreeDelivery;
        return { ...merged, loginBg, instagramScreen, instaStories };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS, loginBg, instagramScreen, instaStories };
  });
  const [bonusBalance, setBonusBalance] = useState(() => { try { return parseInt(localStorage.getItem('parfum_bonus_balance') || '0'); } catch { return 0; } });
  const [bonusHistory, setBonusHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('parfum_bonus_history') || '[]'); } catch { return []; } });
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [visitCount, setVisitCount] = useState(() => { const v = parseInt(localStorage.getItem('parfum_visits') || '0'); return v; });
  const [welcomeBonusUsed, setWelcomeBonusUsed] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [showMBank, setShowMBank] = useState(false);
  const [showOBank, setShowOBank] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [referralCode, setReferralCode] = useState(() => {
    const saved = localStorage.getItem('parfum_ref_code');
    if (saved) return saved;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('parfum_ref_code', code);
    return code;
  });
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoginEmail, setAdminLoginEmail] = useState("");
  const [adminLoginPass, setAdminLoginPass] = useState("");
  const [adminLoginErr, setAdminLoginErr] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const submitTopAdminLogin = async () => {
    if (!adminLoginEmail || !adminLoginPass) { setAdminLoginErr(t.fillAll || "Заполните все поля"); return; }
    setAdminLoginLoading(true); setAdminLoginErr("");
    try {
      await adminLoginApi(adminLoginEmail, adminLoginPass);
      setShowAdminLogin(false);
      setAdminLoginEmail(""); setAdminLoginPass("");
      setIsAdmin(true);
      localStorage.setItem('parfum_is_admin', 'true');
      setAdminScreen("orders");
      showToast(t.welcomeAdmin);
    } catch (e) {
      setAdminLoginErr(t.wrongPassword || "Неверный email или пароль");
    } finally {
      setAdminLoginLoading(false);
    }
  };
  // PRO: welcome bonus celebration modal — shown once, after login awards welcome bonus
  const [welcomeCelebration, setWelcomeCelebration] = useState(null);

  // Desktop layout switch — ≥1024 renders the new desktop store, otherwise mobile
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const isDesktop = windowWidth >= 1024;

  const t = TRANSLATIONS[lang];
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  // Cart subtotal — used by the floating checkout bar to show live total.
  const cartTotal = cart.reduce((sum, i) => {
    const prod = products.find(p => String(p.id) === String(i.productId));
    const v = prod?.variants?.find(vv => String(vv.id) === String(i.variantId));
    return sum + ((v?.price || 0) * i.qty);
  }, 0);

  // Detect native iOS (Capacitor) — hides web tab bar, uses native glass bar instead
  const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

  // Native tab bar → React: listen for tab changes dispatched from Swift
  useEffect(() => {
    const userHandler = (e) => {
      const tab = e.detail;
      if (tab === 'catalog')  setScreen('catalog');
      else if (tab === 'cart')     setScreen('cart');
      else if (tab === 'myorders') setScreen('myorders');
      else if (tab === 'profile')  setScreen('profile');
    };
    const adminHandler = (e) => {
      const tab = e.detail;
      if (typeof tab === 'string' && tab.length > 0) setAdminScreen(tab);
    };
    window.addEventListener('__nativeTabChange', userHandler);
    window.addEventListener('__nativeAdminTabChange', adminHandler);
    return () => {
      window.removeEventListener('__nativeTabChange', userHandler);
      window.removeEventListener('__nativeAdminTabChange', adminHandler);
    };
  }, []);

  // React → Native: sync cart badge whenever cartCount changes
  useEffect(() => {
    if (isNative && window.__setCartBadge) window.__setCartBadge(cartCount);
  }, [cartCount, isNative]);

  // React → Native: sync active tab when screen changes from inside the web app.
  // Sends "login" when the LoginScreen is up, "admin"/"admin-…" while in the
  // admin panel, or the actual screen name otherwise. Swift uses these
  // strings to hide/show the floating Liquid Glass bar.
  useEffect(() => {
    if (!isNative || !window.__syncTab) return;
    const isLoggedOut = !user && !isAdmin && !guestMode;
    const tag = isLoggedOut ? 'login' : (isAdmin ? `admin-${adminScreen}` : screen);
    window.__syncTab(tag);

    // iOS status-bar tint follows the screen background:
    //   • Login (dark hero image) + Admin (dark header) → white text
    //   • Catalog / Cart / Orders / Profile (light bg)  → black text
    if (window.__setStatusBarStyle) {
      // Screens with a dark top region need white status-bar text.
      const screenHasDarkTop = isLoggedOut || isAdmin || screen === 'profile';
      window.__setStatusBarStyle(screenHasDarkTop ? 'light' : 'dark');
    }
  }, [screen, adminScreen, user, isAdmin, guestMode, isNative]);

  // Restore PB session on cold start. pb.authStore is hydrated from
  // localStorage by the SDK itself; we just need to mirror it into React
  // state so the UI doesn't bounce back to the login screen mid-session.
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    if (pb.authStore.isAdmin || localStorage.getItem('parfum_is_admin') === 'true') {
      setIsAdmin(true);
      localStorage.setItem('parfum_is_admin', 'true');
      setAdminScreen("orders");
      return;
    }
    const m = pb.authStore.model;
    if (m) {
      setUser({
        id: m.id,
        phone: m.phone,
        name: m.name || m.phone,
        registrationDate: m.created,
      });
      setSentryUser(m.id);
    }
  }, []);

  // Persist banners to localStorage on every change
  useEffect(() => {
    try {
      const fixed = banners.map(b => ({
        ...b,
        bg: b.bg && (b.bg.includes('green') || b.bg.includes('#4CAF') || b.bg.includes('#43A0') || b.bg.includes('#388E') || b.bg.includes('#2E7D'))
          ? "linear-gradient(135deg, #111111 0%, #000000 100%)"
          : b.bg,
      }));
      localStorage.setItem('parfum_banners', JSON.stringify(fixed));
    } catch { /* ignore */ }
  }, [banners]);

  // Persist settings to localStorage on every change (excluding loginBg — stored separately)
  useEffect(() => {
    try {
      const { loginBg, ...rest } = settings;
      localStorage.setItem('parfum_settings', JSON.stringify(rest));
    } catch { /* ignore */ }
  }, [settings]);

  // Load data from PocketBase. Extracted so PullToRefresh can call it.
  const loadAll = React.useCallback(async () => {
    try {
      const [pbProducts, pbOrders, pbClients, pbReviews] = await Promise.all([
        api.getProducts(),
        api.getOrders(),
        api.getClients(),
        api.getReviews().catch(() => []),
      ]);
      if (pbProducts.length > 0) {
        // Coerce to a real boolean per spec — `?? false` so missing/null/
        // undefined collapses to false, but real true/false pass through.
        const mapped = pbProducts.map(p => {
          // Build URLs only for truthy filenames AND when the record id exists.
          // Empty / null entries are filtered out so the UI never renders broken `<img src="">`.
          const safeImages = (Array.isArray(p?.images) ? p.images : []).filter(Boolean);
          const galleryUrls = (p?.id && safeImages.length > 0)
            ? safeImages.map(img => api.getImageUrl(p, img)).filter(Boolean)
            : [];
          const coverUrl = galleryUrls[0] || (FALLBACK_IMAGES[p.name] || null);
          return {
            ...p,
            img: coverUrl,
            images: galleryUrls.length > 0 ? galleryUrls : (FALLBACK_IMAGES[p.name] ? [FALLBACK_IMAGES[p.name]] : []),
            variants: Array.isArray(p.variants) ? p.variants : (p.variants ? JSON.parse(p.variants) : []),
            isPopular: p.isPopular ?? false,
            featured: p.featured ?? false,
            salePercent: Number(p.salePercent) || 0,
            saleEnd: p.saleEnd || '',
            saleStart: p.saleStart || '',
          };
        });
        setProducts(mapped);
      }
      if (pbOrders.length > 0) setOrders(pbOrders.map(o => ({
        ...o,
        items: Array.isArray(o.items) ? o.items : (o.items ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : []),
      })));
      if (pbClients.length > 0) setRegisteredUsers(pbClients);
      if (pbReviews.length > 0) setReviews(pbReviews);

      // Load shared media from PB (instagramScreen, etc.)
      const instaScreenUrl = await api.getSiteMedia('instagramScreen').catch(() => null);
      if (instaScreenUrl) {
        setSettings(prev => ({ ...prev, instagramScreen: instaScreenUrl }));
      }
    } catch (e) {
      console.warn("PocketBase load error:", e);
    } finally {
      setPbLoading(false);
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Instagram Graph API — load posts when token is available ──
  useEffect(() => {
    const token = settings?.instagramToken;
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [posts, profile] = await Promise.all([
        api.getInstagramPosts(token, 12),
        api.getInstagramProfile(token),
      ]);
      if (cancelled) return;
      if (posts.length > 0) setInstaPosts(posts);
      if (profile) setInstaProfile(profile);

      // Auto-refresh token if older than 50 days (token lasts 60 days)
      const lastRefresh = localStorage.getItem('ig_token_refreshed');
      const daysSince = lastRefresh
        ? (Date.now() - parseInt(lastRefresh)) / (1000 * 60 * 60 * 24)
        : 999;
      if (daysSince > 50) {
        const newToken = await api.refreshInstagramToken(token);
        if (newToken && newToken !== token) {
          setSettings(prev => ({ ...prev, instagramToken: newToken }));
          localStorage.setItem('ig_token_refreshed', String(Date.now()));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [settings?.instagramToken]);

  // Pull-to-refresh handler exposed to CatalogScreen via prop
  const handleRefresh = React.useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  // Persist bonus balance and history
  useEffect(() => {
    localStorage.setItem('parfum_bonus_balance', String(bonusBalance));
    localStorage.setItem('parfum_bonus_history', JSON.stringify(bonusHistory));
  }, [bonusBalance, bonusHistory]);

  // Count unique daily sessions
  useEffect(() => {
    const key = 'parfum_session_' + new Date().toDateString();
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      setVisitCount(prev => {
        const newCount = prev + 1;
        localStorage.setItem('parfum_visits', String(newCount));
        return newCount;
      });
    }
  }, []);

  // Single source of truth for the toast timer so back-to-back toasts don't
  // clobber each other. Calling showToast(null) clears immediately. Errors
  // auto-hide at 2500ms; success at 3000ms. The toast is also tap-to-dismiss
  // (handled inside the Toast component) so it can NEVER feel stuck.
  const toastTimerRef = useRef(null);
  const clearToastTimer = () => {
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
  };
  const showToast = (msg, type = "success") => {
    clearToastTimer();
    if (msg == null) { setToast(null); return; }
    setToast({ msg, type });
    const ttl = type === 'error' ? 2500 : 3000;
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, ttl);
  };
  // Expose dismissal so the Toast itself can wipe the timer when tapped.
  const dismissToast = () => { clearToastTimer(); setToast(null); };

  // Called by LoginScreen AFTER OTP has already been verified (auth.js
  // populates pb.authStore + secureStorage). The `record` arg is the freshly
  // returned PB clients record. No password compare lives in the client any
  // more — admin login goes through the dedicated modal + adminLoginApi().
  const handleLogin = async ({ phone, name, refCode, record, isNewClient }) => {
    const now = new Date().toLocaleDateString("ru-RU");

    // ── Bonus & referral are 100% server-side (otp.pb.js). ──────────────────
    // Server returns the final bonusBalance already written to PocketBase.
    // We just display what the server says — no client-side math, no
    // localStorage tricks, no api.updateClient calls for bonuses.

    // 1. Sync referral code
    if (record?.referralCode) {
      setReferralCode(record.referralCode);
      localStorage.setItem('parfum_ref_code', record.referralCode);
    }

    // 2. Sync balance & history — SERVER is the single source of truth
    const serverBalance = typeof record?.bonusBalance === 'number' ? record.bonusBalance : 0;
    const serverHistory = Array.isArray(record?.bonusHistory) ? record.bonusHistory : [];
    setBonusBalance(serverBalance);
    setBonusHistory(serverHistory);
    localStorage.setItem('parfum_bonus_balance', String(serverBalance));
    localStorage.setItem('parfum_bonus_history', JSON.stringify(serverHistory));

    // 3. Show welcome celebration modal for NEW clients (server already credited them)
    if (isNewClient && serverBalance > 0) {
      setWelcomeCelebration({ amount: serverBalance });
    }

    // 4. Set user state
    const verifiedPhone = record?.phone || phone || name;
    const verifiedName  = record?.name  || name  || phone;
    setUser({
      id: record?.id,
      phone: verifiedPhone,
      name: verifiedName,
      registrationDate: record?.created || now,
    });
    setSentryUser(record?.id);

    // 5. Keep registeredUsers list in sync (admin stats)
    setRegisteredUsers(prev => {
      const exists = prev.find(u => u.phone === verifiedPhone);
      if (!exists) return [...prev, { id: record?.id, phone: verifiedPhone, name: verifiedName, date: now }];
      return prev;
    });

    setScreen("catalog");
  };

  // Clear PB auth (token in pb.authStore + secureStorage) before resetting
  // local UI state — otherwise the next mount restores the old session.
  // `authLogout` is async (touches secureStorage) but failure here is benign;
  // we still want to drop the local state synchronously.
  const handleLogout = () => {
    authLogout().catch(() => {});
    clearSentryUser();
    setUser(null); setIsAdmin(false); setScreen("catalog"); setCart([]);
    localStorage.removeItem('parfum_is_admin');
    localStorage.removeItem('parfum_bonus_balance');
    localStorage.removeItem('parfum_bonus_history');
    localStorage.removeItem('parfum_ref_code');
    setBonusBalance(0);
    setBonusHistory([]);
    setReferralCode('');
  };

  const addToCart = (productId, variantId) => {
    // PRO: native haptic feedback on iOS / Android (no-op on web).
    haptic('light');
    setCart(prev => {
      const ex = prev.find(i => i.productId === productId && i.variantId === variantId);
      const next = ex
        ? prev.map(i => i.productId === productId && i.variantId === variantId ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { productId, variantId, qty: 1 }];
      localStorage.setItem('parfum_cart', JSON.stringify(next));
      return next;
    });
    showToast(t.addedToCart);
  };

  const handleOrder = async (orderData) => {
    if (!user) { setGuestMode(false); showToast(lang === 'kg' ? 'Заказ берүү үчүн кириңиз' : 'Войдите для оформления заказа', 'error'); return; }
    const now = new Date().toLocaleString("ru-RU");
    const items = cart.map(ci => {
      const prod = products.find(p => String(p.id) === String(ci.productId));
      const variant = prod?.variants.find(v => String(v.id) === String(ci.variantId));
      return { productId: ci.productId, variantId: ci.variantId, name: `${prod?.name || ci.name || 'Товар'} ${variant?.label || ci.variantLabel || ''}`.trim(), qty: ci.qty, price: variant?.price || 0 };
    });
    const localId = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(0, 8);
    const newOrder = { id: localId, clientName: user?.name || "", clientPhone: user?.phone || "", items, date: now, status: "new", ...orderData };
    if (orderData.payMethod === 'mbank') {
      setPendingOrder(newOrder);
      setShowMBank(true);
      return;
    }
    if (orderData.payMethod === 'obank') {
      setPendingOrder(newOrder);
      setShowOBank(true);
      return;
    }
    // Save to PocketBase
    try {
      const pbData = {
        clientName: newOrder.clientName,
        clientPhone: newOrder.clientPhone,
        items: JSON.stringify(newOrder.items),
        date: now,
        status: "new",
        total: orderData.total || 0,
        payMethod: orderData.payMethod || "cash",
        address: orderData.address || "",
        comment: orderData.comment || "",
        bonusDiscount: orderData.bonusDiscount || 0,
      };
      const created = await api.createOrder(pbData);
      setOrders(p => [...p, { ...newOrder, id: created.id, collectionId: created.collectionId }]);
    } catch (e) {
      console.warn("PocketBase order error:", e);
      setOrders(p => [...p, newOrder]);
    }
    const earned = Math.floor((orderData.total || 0) * (settings.bonusPercent || 0) / 100);
    if (earned > 0) { setBonusBalance(p => p - (orderData.bonusDiscount || 0) + earned); setBonusHistory(p => [...p, ...(orderData.bonusDiscount ? [{ type: "spent", amount: -orderData.bonusDiscount, label: "Бонус потрачен", date: now }] : []), { type: "earned", amount: earned, label: "Бонус за заказ", date: now }]); }
    else if (orderData.bonusDiscount) { setBonusBalance(p => p - orderData.bonusDiscount); setBonusHistory(p => [...p, { type: "spent", amount: -orderData.bonusDiscount, label: "Бонус потрачен", date: now }]); }
    setCart([]); localStorage.removeItem('parfum_cart');
    haptic('success'); // PRO: success haptic on order placement
    setCompletedOrder(newOrder);
    const itemsList = (newOrder.items || []).map(i => `  • ${i.name} × ${i.qty} шт. — ${(i.price * i.qty).toLocaleString()} сом`).join('\n');
    const deliveryLine = orderData.deliveryType === 'pickup' ? 'Самовывоз' : (orderData.address || 'Доставка');
    const bonusLine = orderData.bonusDiscount > 0 ? `\nБонус: −${orderData.bonusDiscount.toLocaleString()} сом` : '';
    const clientMsg = `Здравствуйте, ${newOrder.clientName}!\n\nВаш заказ №${newOrder.id} успешно оформлен.\n\n${itemsList}\n\nСпособ оплаты: наличные\nДоставка: ${deliveryLine}${bonusLine}\n💰 Итого: ${newOrder.total.toLocaleString()} сом\n\nМы свяжемся с вами для подтверждения.\nСпасибо за покупку!\n\n— Kemal Usman Parfum`;
    const adminPhone = localStorage.getItem('whatsapp_admin') || localStorage.getItem('mbank_phone') || '';
    const adminMsg = `📦 Новый заказ №${newOrder.id}\n\n👤 ${newOrder.clientName}\n📞 ${newOrder.clientPhone}\n\n${itemsList}\n\n💳 Оплата: наличные\n📍 ${deliveryLine}${bonusLine}\n💰 Итого: ${newOrder.total.toLocaleString()} сом`;
    // Server-side WhatsApp dispatch — `sendWhatsApp` now lives in
    // src/api/whatsapp.js and only forwards { chatId, message, orderId }
    // to /api/custom/whatsapp/send. Tokens stay on the PB host.
    if (newOrder.clientPhone) {
      sendWhatsApp({ phone: newOrder.clientPhone, message: clientMsg, orderId: newOrder.id })
        .then(r => { if (!r.ok) console.warn('[order] whatsapp client notify failed:', r.error); });
    }
    if (adminPhone) {
      sendWhatsApp({ phone: adminPhone, message: adminMsg, orderId: newOrder.id })
        .then(r => { if (!r.ok) console.warn('[order] whatsapp admin notify failed:', r.error); });
    }
  };

  // The previous local sendWhatsApp() helper was removed — see import at the
  // top of the file. The client must never know GREEN_API_INSTANCE / TOKEN.

  const handleSendWhatsApp = (order) => {
    const msg = `Заказ #${order.id} статус: ${t["status_" + order.status] || order.status}`;
    window.open(`https://wa.me/${order.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCopyReferral = () => { navigator.clipboard.writeText(referralCode).then(() => showToast(t.copied)); };

  const t_ctx = { lang, setLang, t };

  const USER_NAV = [
    { id: "catalog", icon: IC.home, label: t.catalog },
    { id: "cart", icon: IC.cart, label: t.cart, badge: cartCount },
    { id: "myorders", icon: IC.orders, label: t.myOrders },
    { id: "profile", icon: IC.profile, label: t.profile },
  ];

  const ADMIN_NAV = [
    { id: "orders",   icon: IC.orders,   label: t.orders },
    { id: "products", icon: IC.bottle,   label: t.products },
    { id: "reviews",  icon: IC.star || IC.orders, label: lang === 'kg' ? 'Пикирлер' : 'Отзывы' },
    { id: "stats",    icon: IC.stats,    label: t.stats },
    { id: "settings", icon: IC.settings, label: t.settings },
  ];

  if (!user && !isAdmin && !guestMode) return (
    <LangContext.Provider value={t_ctx}>
      <Toast toast={toast} onDismiss={dismissToast} />
      {welcomeCelebration && (
        <BonusCelebration
          amount={welcomeCelebration.amount}
          lang={lang}
          onClose={() => setWelcomeCelebration(null)}
        />
      )}
      {windowWidth >= 1024 ? (
        /* ── DESKTOP LOGIN — split layout ── */
        <div style={{
          display: 'flex', width: '100vw', height: '100vh',
          fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
          overflow: 'hidden',
        }}>
          {/* Left — full-bleed photo + branding */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0d0d' }}>
            <img
              src={settings.loginBg || '/login-bg.jpeg'}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
                opacity: 0.75,
              }}
            />
            {/* Dark gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 100%)',
            }} />
            {/* Branding */}
            <div style={{ position: 'absolute', bottom: 52, left: 52 }}>
              <div style={{ fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 12, fontWeight: 500 }}>
                Бишкек · Парфюм на разлив
              </div>
              <div style={{ fontFamily: "'Georgia', serif", fontStyle: 'italic', fontSize: 48, fontWeight: 400, color: '#fff', letterSpacing: -1, lineHeight: 1.1 }}>
                Kemal Usman
              </div>
              <div style={{ fontSize: 10, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 10, fontWeight: 500 }}>
                Parfum
              </div>
            </div>
          </div>

          {/* Right — white login card */}
          <div style={{
            width: 480, flexShrink: 0,
            background: '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 52px',
            overflowY: 'auto',
            position: 'relative',
          }}>
            {/* Language toggle */}
            <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 6 }}>
              {['ru', 'kg'].map(l => (
                <div key={l} onClick={() => setLang(l)}
                  style={{
                    padding: '5px 12px', fontSize: 10, letterSpacing: 2,
                    textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                    background: lang === l ? '#111' : '#F5F5F5',
                    color: lang === l ? '#fff' : '#888',
                  }}>
                  {l === 'ru' ? 'РУС' : 'КЫР'}
                </div>
              ))}
            </div>

            {/* Logo mark */}
            <div style={{ marginBottom: 36, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 5, textTransform: 'uppercase', color: '#111' }}>
                Kemal Usman
              </div>
              <div style={{ fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#BBB', marginTop: 4 }}>
                Parfum
              </div>
            </div>

            {/* Form — desktop mode (white bg, no background image) */}
            <div style={{ width: '100%' }}>
              <LoginScreen
                onLogin={handleLogin}
                welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }}
                onGuest={() => setGuestMode(true)}
                loginBg={null}
                showToast={showToast}
                desktopMode={true}
                loginBrandName={settings.loginBrandName}
                loginBrandTagline={settings.loginBrandTagline}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── MOBILE LOGIN — unchanged ── */
        <div style={{ width: "100vw", maxWidth: "100vw", minHeight: "100vh", overflow: "hidden", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
          <LoginScreen
            onLogin={handleLogin}
            welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }}
            onGuest={() => setGuestMode(true)}
            loginBg={settings.loginBg}
            showToast={showToast}
            loginBrandName={settings.loginBrandName}
            loginBrandTagline={settings.loginBrandTagline}
          />
        </div>
      )}
    </LangContext.Provider>
  );

  return (
    <LangContext.Provider value={t_ctx}>
      <Toast toast={toast} onDismiss={dismissToast} />
      {welcomeCelebration && (
        <BonusCelebration
          amount={welcomeCelebration.amount}
          lang={lang}
          onClose={() => setWelcomeCelebration(null)}
        />
      )}
      {/* Payment modals — rendered OUTSIDE the desktop/mobile ternary so they
          appear on both layouts. The handlers are the same as before; they
          create a PocketBase order, clear cart, fire WhatsApp notifications. */}
      {showMBank && pendingOrder && (
        <MBankPayment
          total={pendingOrder.total}
          orderId={pendingOrder.id}
          onConfirm={async (status) => {
            const finalOrder = { ...pendingOrder, paymentStatus: status, paymentMethod: 'mbank' };
            try {
              const pbData = {
                clientName: finalOrder.clientName,
                clientPhone: finalOrder.clientPhone,
                items: JSON.stringify(finalOrder.items),
                date: finalOrder.date,
                status: "new",
                total: finalOrder.total || 0,
                payMethod: finalOrder.payMethod || 'mbank',
                address: finalOrder.address || "",
                comment: finalOrder.comment || "",
                bonusDiscount: finalOrder.bonusDiscount || 0,
              };
              const created = await api.createOrder(pbData);
              setOrders(prev => [...prev, { ...finalOrder, id: created.id, collectionId: created.collectionId }]);
            } catch (e) {
              console.warn("PocketBase order error:", e);
              showToast('Ошибка сохранения заказа', 'error');
              setOrders(prev => [...prev, finalOrder]);
            }
            setCart([]); localStorage.removeItem('parfum_cart');
            setShowMBank(false);
            setCompletedOrder({ ...pendingOrder, paymentStatus: status, paymentMethod: 'mbank' });
            setPendingOrder(null);
            const itemsList2 = (pendingOrder.items || []).map(i => `  • ${i.name} × ${i.qty} шт. — ${(i.price * i.qty).toLocaleString()} сом`).join('\n');
            const deliveryLine2 = pendingOrder.deliveryType === 'pickup' ? 'Самовывоз' : (pendingOrder.address || 'Доставка');
            const bonusLine2 = pendingOrder.bonusDiscount > 0 ? `\nБонус: −${pendingOrder.bonusDiscount.toLocaleString()} сом` : '';
            const clientMsg2 = `Здравствуйте, ${pendingOrder.clientName}!\n\nВаш заказ №${pendingOrder.id} успешно оформлен.\n\n${itemsList2}\n\n💳 Оплата: M-Bank\n📍 ${deliveryLine2}${bonusLine2}\n💰 Итого: ${pendingOrder.total.toLocaleString()} сом\n\nОжидайте подтверждения оплаты.\nСпасибо за покупку!\n\n— Kemal Usman Parfum`;
            const adminMsg2 = `📦 Новый заказ №${pendingOrder.id} (M-Bank)\n\n👤 ${pendingOrder.clientName}\n📞 ${pendingOrder.clientPhone}\n\n${itemsList2}\n\n💳 Оплата: M-Bank (ожидает подтверждения)\n📍 ${deliveryLine2}${bonusLine2}\n💰 Итого: ${pendingOrder.total.toLocaleString()} сом`;
            const adm2 = localStorage.getItem('whatsapp_admin') || localStorage.getItem('mbank_phone') || '';
            if (pendingOrder.clientPhone) {
              sendWhatsApp({ phone: pendingOrder.clientPhone, message: clientMsg2, orderId: pendingOrder.id })
                .then(r => { if (!r.ok) console.warn('[mbank] whatsapp client notify failed:', r.error); });
            }
            if (adm2) {
              sendWhatsApp({ phone: adm2, message: adminMsg2, orderId: pendingOrder.id })
                .then(r => { if (!r.ok) console.warn('[mbank] whatsapp admin notify failed:', r.error); });
            }
          }}
          onCancel={() => { setShowMBank(false); setPendingOrder(null); }}
        />
      )}
      {showOBank && pendingOrder && (
        <OBankPayment
          total={pendingOrder.total}
          orderId={pendingOrder.id}
          onConfirm={async (status) => {
            const finalOrder = { ...pendingOrder, paymentStatus: status, paymentMethod: 'obank' };
            try {
              const pbData = {
                clientName: finalOrder.clientName,
                clientPhone: finalOrder.clientPhone,
                items: JSON.stringify(finalOrder.items),
                date: finalOrder.date,
                status: "new",
                total: finalOrder.total || 0,
                payMethod: finalOrder.payMethod || 'obank',
                address: finalOrder.address || "",
                comment: finalOrder.comment || "",
                bonusDiscount: finalOrder.bonusDiscount || 0,
              };
              const created = await api.createOrder(pbData);
              setOrders(prev => [...prev, { ...finalOrder, id: created.id, collectionId: created.collectionId }]);
            } catch (e) {
              console.warn("PocketBase order error:", e);
              showToast('Ошибка сохранения заказа', 'error');
              setOrders(prev => [...prev, finalOrder]);
            }
            setCart([]); localStorage.removeItem('parfum_cart');
            setShowOBank(false);
            setCompletedOrder({ ...pendingOrder, paymentStatus: status, paymentMethod: 'obank' });
            setPendingOrder(null);
            const adm3 = localStorage.getItem('whatsapp_admin') || localStorage.getItem('mbank_phone') || '';
            const itemsList3 = (pendingOrder.items || []).map(i => `  • ${i.name} × ${i.qty} шт. — ${(i.price * i.qty).toLocaleString()} сом`).join('\n');
            const deliveryLine3 = pendingOrder.deliveryType === 'pickup' ? 'Самовывоз' : (pendingOrder.address || 'Доставка');
            const bonusLine3 = pendingOrder.bonusDiscount > 0 ? `\nБонус: −${pendingOrder.bonusDiscount.toLocaleString()} сом` : '';
            const clientMsg3 = `Здравствуйте, ${pendingOrder.clientName}!\n\nВаш заказ №${pendingOrder.id} успешно оформлен.\n\n${itemsList3}\n\n💳 Оплата: O!Bank\n📍 ${deliveryLine3}${bonusLine3}\n💰 Итого: ${pendingOrder.total.toLocaleString()} сом\n\nОжидайте подтверждения оплаты.\nСпасибо за покупку!\n\n— Kemal Usman Parfum`;
            const adminMsg3 = `📦 Новый заказ №${pendingOrder.id} (O!Bank)\n\n👤 ${pendingOrder.clientName}\n📞 ${pendingOrder.clientPhone}\n\n${itemsList3}\n\n💳 Оплата: O!Bank (ожидает подтверждения)\n📍 ${deliveryLine3}${bonusLine3}\n💰 Итого: ${pendingOrder.total.toLocaleString()} сом`;
            if (pendingOrder.clientPhone) {
              sendWhatsApp({ phone: pendingOrder.clientPhone, message: clientMsg3, orderId: pendingOrder.id })
                .then(r => { if (!r.ok) console.warn('[obank] whatsapp client notify failed:', r.error); });
            }
            if (adm3) {
              sendWhatsApp({ phone: adm3, message: adminMsg3, orderId: pendingOrder.id })
                .then(r => { if (!r.ok) console.warn('[obank] whatsapp admin notify failed:', r.error); });
            }
          }}
          onCancel={() => { setShowOBank(false); setPendingOrder(null); }}
        />
      )}
      {completedOrder && (
        <OrderReceipt
          order={completedOrder}
          settings={settings}
          onClose={() => { setCompletedOrder(null); setScreen('myorders'); }}
        />
      )}
      {isDesktop && !isAdmin ? (
        <DesktopLayout
          products={products}
          cart={cart}
          setCart={setCart}
          addToCart={addToCart}
          banners={banners.filter(b => b.active)}
          settings={settings}
          showToast={showToast}
          user={user}
          onLogout={handleLogout}
          guestMode={guestMode}
          setGuestMode={setGuestMode}
          bonusBalance={bonusBalance}
          bonusHistory={bonusHistory}
          referralCode={referralCode}
          handleCopyReferral={handleCopyReferral}
          orders={orders.filter(o => normalizePhone(o.clientPhone) === normalizePhone(user?.phone))}
          onOrder={handleOrder}
          reviews={reviews}
          instaPosts={instaPosts}
          instaProfile={instaProfile}
          pbLoading={pbLoading}
          toast={toast}
          dismissToast={dismissToast}
          lang={lang}
          setLang={setLang}
          t={t}
          welcomeCelebration={welcomeCelebration}
          setWelcomeCelebration={setWelcomeCelebration}
          windowWidth={windowWidth}
          onAdminLogin={() => { setShowAdminLogin(true); setAdminLoginPass(""); setAdminLoginErr(""); }}
        />
      ) : isDesktop && isAdmin ? (
        /* ── DESKTOP ADMIN WRAPPER — no mobile CSS vars, no NavBar ── */
        <div style={{
          width: '100%', minHeight: '100vh', background: '#fff',
          fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
          color: '#111',
        }}>
          {/* Sticky black top bar */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: '#111', padding: '0 48px',
            height: 56, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 3, textTransform: 'uppercase' }}>
              {t.adminPanel} — Kemal Usman
            </div>
            <button
              onClick={() => { setIsAdmin(false); localStorage.removeItem('parfum_is_admin'); setAdminScreen('orders'); }}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', padding: '6px 16px', fontSize: 11, letterSpacing: 2,
                textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
              }}>
              {t.exit || 'Выйти'}
            </button>
          </div>

          {/* Desktop admin tab nav */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid #EBEBEB',
            padding: '0 48px',
          }}>
            {[
              { id: 'orders',   label: t.orders   || 'Заказы'     },
              { id: 'products', label: t.products  || 'Товары'     },
              { id: 'reviews',  label: lang === 'kg' ? 'Пикирлер' : 'Отзывы' },
              { id: 'stats',    label: t.stats     || 'Статистика' },
              { id: 'settings', label: t.settings  || 'Настройки'  },
            ].map(tab => (
              <div key={tab.id} onClick={() => setAdminScreen(tab.id)}
                style={{
                  padding: '14px 20px', fontSize: 12, fontWeight: 600,
                  letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
                  color: adminScreen === tab.id ? '#111' : '#BBB',
                  borderBottom: adminScreen === tab.id ? '2px solid #111' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                {tab.label}
              </div>
            ))}
          </div>

          {/* Admin screen content */}
          <div style={{ padding: '32px 48px', minHeight: 'calc(100vh - 120px)' }}>
            {(() => {
              const VALID_ADMIN_TABS = ['orders', 'products', 'reviews', 'stats', 'settings'];
              const safeAdminScreen = VALID_ADMIN_TABS.includes(adminScreen) ? adminScreen : 'orders';
              return (
                <ErrorBoundary key={safeAdminScreen}>
                  {safeAdminScreen === 'orders' && (
                    <AdminOrdersScreen
                      allOrders={orders}
                      onRefresh={handleRefresh}
                      onStatusChange={async (id, st) => {
                        setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o));
                        try { await api.updateOrder(id, { status: st }); } catch (e) { console.warn(e); }
                      }}
                      onDelete={async (id) => {
                        setOrders(p => p.filter(o => o.id !== id));
                        try { await api.deleteOrder(id); } catch (e) { console.warn(e); }
                      }}
                      onSendWhatsApp={handleSendWhatsApp}
                      onConfirmMBankPayment={(id) => {
                        setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o));
                        showToast(t.orderPlaced);
                      }}
                    />
                  )}
                  {safeAdminScreen === 'products' && (
                    <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />
                  )}
                  {safeAdminScreen === 'reviews' && (
                    <AdminReviewsScreen reviews={reviews} setReviews={setReviews} showToast={showToast} />
                  )}
                  {safeAdminScreen === 'stats' && (
                    <AdminStatsScreen orders={orders} products={products} registeredUsers={registeredUsers} visitCount={visitCount} />
                  )}
                  {safeAdminScreen === 'settings' && (
                    <AdminSettingsScreen banners={banners} setBanners={setBanners} products={products} settings={settings} setSettings={setSettings} onLogout={handleLogout} showToast={showToast} lang={lang} />
                  )}
                </ErrorBoundary>
              );
            })()}
          </div>
        </div>
      ) : (
      <div style={{ width: "100%", minHeight: "100vh", background: T.bg, position: "relative", overflowX: "hidden", color: T.text, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
        <div style={{ paddingBottom: 'calc(var(--nav-height) + 16px)', background: T.bg }}>
          {isAdmin ? (
            <>
              <div style={{ padding: "16px 16px 0", paddingTop: "max(52px, calc(env(safe-area-inset-top, 44px) + 8px))", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#000000", borderBottom: "0.5px solid rgba(255,255,255,0.15)", paddingBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: 2, textTransform: "uppercase" }}>{t.adminPanel}</div>
              </div>
              {/* PRO: animate admin tab transitions — fade-up between tabs.
                  `safeAdminScreen` clamps to a valid tab id so an unexpected
                  string from the native iOS tab bar (e.g. legacy 'banners' /
                  'bonus' from older Swift) doesn't blank every render branch
                  and leave the user stuck on a white screen. */}
              {(() => {
                const VALID_ADMIN_TABS = ["orders", "products", "reviews", "stats", "settings"];
                const safeAdminScreen = VALID_ADMIN_TABS.includes(adminScreen) ? adminScreen : "orders";
                // Per-tab ErrorBoundary — if any admin screen throws during
                // render (undefined prop, missing field on a fresh PB record,
                // legacy editor state etc.), the user sees a recoverable
                // "reload" UI instead of a true white screen, AND the stack
                // trace lands in console / Sentry so the real bug is findable.
                // ErrorBoundary's `key` is bound to the tab id so switching
                // tabs always remounts a fresh boundary, clearing prior errors.
                return (
                  <ErrorBoundary key={safeAdminScreen}>
                    {safeAdminScreen === "orders" && <AdminOrdersScreen allOrders={orders} onRefresh={handleRefresh} onStatusChange={async (id, st) => { setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o)); try { await api.updateOrder(id, { status: st }); } catch (e) { console.warn("Status update error:", e); } }} onDelete={async (id) => { setOrders(p => p.filter(o => o.id !== id)); try { await api.deleteOrder(id); } catch (e) { console.warn("Delete order error:", e); } }} onSendWhatsApp={handleSendWhatsApp} onConfirmMBankPayment={(id) => { setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o)); showToast(t.orderPlaced); }} />}
                    {safeAdminScreen === "products" && <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />}
                    {safeAdminScreen === "reviews" && <AdminReviewsScreen reviews={reviews} setReviews={setReviews} showToast={showToast} />}
                    {safeAdminScreen === "stats" && <AdminStatsScreen orders={orders} products={products} registeredUsers={registeredUsers} visitCount={visitCount} />}
                    {safeAdminScreen === "settings" && <AdminSettingsScreen banners={banners} setBanners={setBanners} products={products} settings={settings} setSettings={setSettings} onLogout={handleLogout} showToast={showToast} lang={lang} />}
                  </ErrorBoundary>
                );
              })()}
            </>
          ) : (
            // FIX (white flash): keep ALL user screens mounted; toggle visibility
            // via `display: none/block` instead of conditional rendering.
            // - lazy: false (every screen mounts on first session frame)
            // - unmountOnBlur: false (display:none keeps DOM + React state alive)
            // - freezeOnBlur: true (hidden subtree gets `aria-hidden` + `inert`
            //   so it doesn't paint or steal focus while inactive)
            // MotionScreen still does the initial pbLoading→ready fade once;
            // afterwards screenKey is constant so tab swaps trigger ZERO
            // unmount / animation gap = no white frame.
            <MotionScreen screenKey={pbLoading ? 'pb-loading' : 'pb-ready'}>
              {pbLoading ? (
                <div style={{ paddingTop: 100 }}><CatalogGridSkeleton count={6} /></div>
              ) : (
                <>
                  <div
                    style={{ display: screen === 'catalog' ? 'block' : 'none' }}
                    aria-hidden={screen !== 'catalog'}
                    inert={screen !== 'catalog' ? '' : undefined}
                  >
                    <CatalogScreen products={products} addToCart={addToCart} banners={banners.filter(b => b.active)} showToast={showToast} onAdminLogin={() => { setShowAdminLogin(true); setAdminLoginPass(""); setAdminLoginErr(""); }} onRefresh={handleRefresh} setIsDetailOpen={setIsDetailOpen} />
                  </div>
                  <div
                    style={{ display: screen === 'cart' ? 'block' : 'none' }}
                    aria-hidden={screen !== 'cart'}
                    inert={screen !== 'cart' ? '' : undefined}
                  >
                    <CartScreen cart={cart} setCart={setCart} products={products} onOrder={handleOrder} bonusBalance={bonusBalance} useBonusPercent={settings.useBonusPercent || 30} settings={settings} showToast={showToast} goToCatalog={() => setScreen("catalog")} />
                  </div>
                  <div
                    style={{ display: screen === 'myorders' ? 'block' : 'none' }}
                    aria-hidden={screen !== 'myorders'}
                    inert={screen !== 'myorders' ? '' : undefined}
                  >
                    {/* FIX: normalize both sides so '+996 700 123 456' matches '996700123456' */}
                    <MyOrdersScreen orders={orders.filter(o => normalizePhone(o.clientPhone) === normalizePhone(user?.phone))} goToCatalog={() => setScreen("catalog")} reviews={reviews} user={user} showToast={showToast} />
                  </div>
                  <div
                    style={{ display: screen === 'profile' ? 'block' : 'none' }}
                    aria-hidden={screen !== 'profile'}
                    inert={screen !== 'profile' ? '' : undefined}
                  >
                    <ProfileScreen user={user} onLogout={handleLogout} bonusBalance={bonusBalance} bonusHistory={bonusHistory} referralCode={referralCode} settings={settings} onCopyReferral={handleCopyReferral} onAdminLogin={() => { setIsAdmin(true); localStorage.setItem('parfum_is_admin', 'true'); setAdminScreen("orders"); }} goToOrders={() => setScreen("myorders")} />
                  </div>
                </>
              )}
            </MotionScreen>
          )}
        </div>
        {/* Floating checkout bar — rendered into document.body via portal so
            no ancestor transform / will-change / filter can ever capture
            its `position: fixed` containing block. Always resolves against
            the viewport, never moves with scroll. */}
        {createPortal(
        <AnimatePresence>
          {/* Show ONLY on shopping context (catalog or cart) when items exist.
              Hidden on profile / orders / admin / login — single contextual CTA. */}
          {!isAdmin && !isDetailOpen && cartCount > 0 && screen === "catalog" && (() => {
            // RU plural: 1 товар / 2-4 товара / 5+ товаров. KG keeps singular form.
            const ruPlural = (n) => {
              const m100 = n % 100;
              if (m100 >= 11 && m100 <= 14) return 'товаров';
              const m10 = n % 10;
              if (m10 === 1) return 'товар';
              if (m10 >= 2 && m10 <= 4) return 'товара';
              return 'товаров';
            };
            const itemsWord = lang === 'kg' ? 'товар' : ruPlural(cartCount);
            // Label adapts to context: navigate vs. submit. On cart screen
            // tapping the bar dispatches `cart:checkout` which CartScreen
            // listens for and runs onOrder with current form state.
            const onCart = screen === 'cart';
            const ctaLabel = onCart
              ? (lang === 'kg' ? 'Заказ берүү' : 'Оформить заказ')
              : (lang === 'kg' ? 'Заказга өтүү' : 'Перейти к оформлению');
            const handleTap = () => {
              haptic('medium');
              if (onCart) {
                window.dispatchEvent(new CustomEvent('cart:checkout'));
              } else {
                setScreen('cart');
              }
            };

            return (
              <motion.div
                key="floating-cart-cta"
                // Entry: slide up + fade + slight scale. Exit: reverse, smooth.
                initial={{ y: 80, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 80, opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.85 }}
                style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 6px)", left: 16, right: 16, zIndex: 100, pointerEvents: "none" }}
              >
                <motion.button
                  onClick={handleTap}
                  // Press: slight shrink + stronger shadow.
                  whileTap={{
                    scale: 0.97,
                    boxShadow: "0 6px 22px rgba(0,0,0,0.20)",
                  }}
                  // Bounce on every cartTotal change + soft idle breathing
                  // (opacity 1 ↔ 0.96 over 3.6s, infinite, easeInOut).
                  key={`cta-${cartTotal}`}
                  initial={{ scale: 0.985 }}
                  animate={{ scale: 1, opacity: [1, 0.96, 1] }}
                  transition={{
                    scale: { type: 'spring', stiffness: 520, damping: 22 },
                    opacity: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  style={{
                    width: "100%",
                    background: "linear-gradient(180deg, #1f1f22 0%, #111111 100%)",
                    borderRadius: 18,
                    padding: "12px 16px",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", gap: 12,
                    pointerEvents: "all",
                    boxSizing: "border-box",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    cursor: "pointer",
                  }}
                >
                  {/* Cart icon — circle on left */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(255,255,255,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", flexShrink: 0,
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}>
                    {React.cloneElement(IC.cart, { style: { width: 18, height: 18 } })}
                  </div>

                  {/* Stacked label: CTA + count·total */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                    <span style={{
                      color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                    }}>
                      {ctaLabel}
                    </span>
                    {/* Sub-line — small pulse on cartTotal change; price counts
                        smoothly between old and new total via AnimatedSum. */}
                    <motion.span
                      key={`count-${cartCount}`}
                      initial={{ scale: 0.92, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                      style={{
                        color: "rgba(255,255,255,0.62)",
                        fontSize: 12, fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: -0.05,
                        transformOrigin: 'left center',
                      }}
                    >
                      {cartCount} {itemsWord} · <AnimatedSum value={cartTotal} duration={0.55} />
                    </motion.span>
                  </div>

                  {/* Right chevron — minimal, no red */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(255,255,255,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", flexShrink: 0,
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 6 15 12 9 18"/>
                    </svg>
                  </div>
                </motion.button>
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body
        )}
        {/* Web navbar — hidden on native iOS (native glass bar used instead) */}
        {/* On native iOS the SwiftUI Liquid Glass bar is shown for the user
            tabs (4 fixed cases). The admin panel has 6 items so it doesn't
            fit the native bar — we render the same iOS 26 styled
            GlassNavBar in React for admin even on native. On web we always
            render GlassNavBar. */}
        {isAdmin
          ? (<GlassNavBar items={ADMIN_NAV} active={adminScreen} onSelect={setAdminScreen} />)
          : (!isNative && <GlassNavBar items={USER_NAV} active={screen} onSelect={setScreen} />)}
        {showAdminLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 16, textAlign: "center" }}>{t.adminPanel}</div>
              <div style={{ marginBottom: 10 }}>
                <input type="email" autoComplete="username" value={adminLoginEmail} onChange={e => { setAdminLoginEmail(e.target.value); setAdminLoginErr(""); }} placeholder="admin@kemalusman.kg" style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 15, outline: "none", boxSizing: "border-box" }} autoFocus />
              </div>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <input type="password" autoComplete="current-password" value={adminLoginPass} onChange={e => { setAdminLoginPass(e.target.value); setAdminLoginErr(""); }} placeholder={t.passwordLabel || "Пароль"} style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 15, outline: "none", boxSizing: "border-box" }} onKeyDown={e => { if (e.key === 'Enter') submitTopAdminLogin(); }} />
              </div>
              {adminLoginErr && <div style={{ color: "#E53935", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{adminLoginErr}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Отмена</button>
                <button onClick={submitTopAdminLogin} disabled={adminLoginLoading} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 700, cursor: adminLoginLoading ? "default" : "pointer", opacity: adminLoginLoading ? 0.6 : 1 }}>{adminLoginLoading ? '…' : 'OK'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
      {/* ── DESKTOP ADMIN LOGIN MODAL — rendered at root level so it works on desktop too ── */}
      {showAdminLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 16, textAlign: "center" }}>{t.adminPanel}</div>
            <div style={{ marginBottom: 10 }}>
              <input type="email" autoComplete="username" value={adminLoginEmail} onChange={e => { setAdminLoginEmail(e.target.value); setAdminLoginErr(""); }} placeholder="admin@kemalusman.kg" style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 15, outline: "none", boxSizing: "border-box" }} autoFocus />
            </div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input type="password" autoComplete="current-password" value={adminLoginPass} onChange={e => { setAdminLoginPass(e.target.value); setAdminLoginErr(""); }} placeholder={t.passwordLabel || "Пароль"} style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 15, outline: "none", boxSizing: "border-box" }} onKeyDown={e => { if (e.key === 'Enter') submitTopAdminLogin(); }} />
            </div>
            {adminLoginErr && <div style={{ color: "#E53935", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{adminLoginErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Отмена</button>
              <button onClick={submitTopAdminLogin} disabled={adminLoginLoading} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 700, cursor: adminLoginLoading ? "default" : "pointer", opacity: adminLoginLoading ? 0.6 : 1 }}>{adminLoginLoading ? '…' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </LangContext.Provider>
  );
}
