import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import PocketBase from "pocketbase";

const PB_URL = "http://145.223.100.16:8090";
const pb = new PocketBase(PB_URL);

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
  shadow: "0 2px 8px rgba(0,0,0,0.06)",
  shadowSm: "0 2px 8px rgba(0,0,0,0.06)",
  shadowLg: "0 2px 8px rgba(0,0,0,0.06)",
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
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "none",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
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
  getImageUrl: (record, filename) => pb.files.getURL(record, filename),

  // Orders
  getOrders: () => pb.collection("orders").getFullList({ sort: "-created", requestKey: null }),
  createOrder: (data) => pb.collection("orders").create(data, { requestKey: null }),
  updateOrder: (id, data) => pb.collection("orders").update(id, data, { requestKey: null }),
  deleteOrder: (id) => pb.collection("orders").delete(id, { requestKey: null }),

  // Clients
  getClients: () => pb.collection("clients").getFullList({ sort: "-created", requestKey: null }),
  createClient: (data) => pb.collection("clients").create(data, { requestKey: null }),
  updateClient: (id, data) => pb.collection("clients").update(id, data, { requestKey: null }),
  findClientByPhone: async (phone) => {
    try {
      const res = await pb.collection("clients").getFirstListItem(`phone="${phone}"`, { requestKey: null });
      return res;
    } catch { return null; }
  },
};

const DEFAULT_SETTINGS = {
  shopName: "Kemal Usman", whatsappPhone: "996557100505",
  adminPassword: "admin123", bonusPercent: 5, useBonusPercent: 30,
  welcomeBonus: 150, welcomeBonusEnabled: true,
  referralBonus: 100, referralFriendBonus: 50,
  deliveryCost: 0, minOrderForFreeDelivery: 0,
  loginBg: null,
};

const INITIAL_PRODUCTS = [
  { id: 1, name: "Chanel No. 5", brand: "Chanel", category: "Женские", img: null, images: [], desc: "Классический цветочный аромат.", variants: [{ id: "v1", label: "5 мл", price: 120, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 220, type: "ml", inStock: true }, { id: "v3", label: "20 мл", price: 400, type: "ml", inStock: true }, { id: "v4", label: "Упаковка 50 мл", price: 850, type: "package", inStock: true }] },
  { id: 2, name: "Sauvage", brand: "Dior", category: "Мужские", img: null, images: [], desc: "Свежий и сильный аромат.", variants: [{ id: "v1", label: "5 мл", price: 130, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 240, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 100 мл", price: 920, type: "package", inStock: true }] },
  { id: 3, name: "Black Orchid", brand: "Tom Ford", category: "Унисекс", img: null, images: [], desc: "Редкий и таинственный аромат.", variants: [{ id: "v1", label: "3 мл", price: 90, type: "ml", inStock: true }, { id: "v2", label: "5 мл", price: 140, type: "ml", inStock: true }, { id: "v3", label: "10 мл", price: 260, type: "ml", inStock: true }] },
  { id: 4, name: "Oud Wood", brand: "Tom Ford", category: "Премиум", img: null, images: [], desc: "Восточный аромат уда.", variants: [{ id: "v1", label: "5 мл", price: 200, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 380, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 50 мл", price: 1850, type: "package", inStock: true }] },
  { id: 5, name: "La Vie Est Belle", brand: "Lancôme", category: "Женские", img: null, images: [], desc: "Радостный и сладкий аромат.", variants: [{ id: "v1", label: "5 мл", price: 110, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 200, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 75 мл", price: 780, type: "package", inStock: true }] },
];

const DEFAULT_BANNERS = [
  { id: 1, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner1.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 2, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner2.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 3, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner3.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
];

function formatSum(n) { return Number(n).toLocaleString() + " сом"; }
function generateReferralCode(name) { return (name.slice(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000)); }
// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#111111", color: "#F5F5F5", padding: "12px 24px", borderRadius: 30, fontSize: 14, fontWeight: 700, boxShadow: T.shadowLg, whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}

function StatusChip({ status }) {
  const map = { new: { bg: "#FFF3E0", color: "#FF6B00", label: "Новый" }, confirmed: { bg: "#E3F2FD", color: "#1976D2", label: "Подтверждён" }, preparing: { bg: "#E8F5E9", color: "#388E3C", label: "Готовится" }, delivering: { bg: "#EDE7F6", color: "#7C5CBF", label: "Доставляется" }, delivered: { bg: "#E8F5E9", color: "#388E3C", label: "Доставлен" }, cancelled: { bg: "#FFEBEE", color: "#E53935", label: "Отменён" } };
  const s = map[status] || { bg: "rgba(0,0,0,0.08)", color: T.textSecond, label: status };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
}

function LangToggle() {
  const { lang, setLang } = useLang();
  const LANGS = [{ id: "ru", label: "РУС" }, { id: "kg", label: "КЫР" }];
  return (
    <div style={{ display: "flex", background: T.bg, borderRadius: 20, padding: 3, border: `1px solid ${T.border}`, gap: 2 }}>
      {LANGS.map(({ id, label }) => (
        <button key={id} onClick={() => setLang(id)} style={{ padding: "5px 12px", borderRadius: 16, border: "none", background: lang === id ? T.accent : "transparent", color: lang === id ? "#fff" : T.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function NavBar({ items, active, onSelect }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", background: "#FFFFFF", borderTop: "0.5px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 1000, paddingTop: 8, paddingBottom: "env(safe-area-inset-bottom, 8px)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {items.map((item, i) => {
        const isActive = item.id === active;
        const isCenter = item.center;
        if (isCenter) return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{ width: 52, height: 52, borderRadius: "50%", background: "#111111", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", transform: "translateY(-12px)" }}>
            {React.cloneElement(item.icon, { style: { width: 24, height: 24 } })}
          </button>
        );
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{ flex: 1, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: isActive ? "#111111" : T.textMuted, position: "relative", paddingBottom: 4, fontSize: 11 }}>
            <div style={{ position: "relative" }}>
              {React.cloneElement(item.icon, { style: { width: 22, height: 22 } })}
              {item.badge > 0 && <div style={{ position: "absolute", top: -4, right: -6, background: T.danger, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{item.badge}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
            {isActive && <div style={{ position: "absolute", bottom: 0, width: 20, height: 3, background: T.accent, borderRadius: 2 }} />}
          </button>
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
    onDone(canvas.toDataURL('image/jpeg', 0.85));
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
        Rasmlar (max 3) · Oblojkani tanlash uchun ✓ bosing
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
                      <span style={{ fontSize: 11 }}>Rasm {i + 1}</span>
                    </div>
                }
                {isCover && (
                  <div style={{ position: "absolute", top: 5, left: 5, background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px" }}>
                    Oblojka
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
                      ✓ Oblojka
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
function LoginScreen({ onLogin, welcomeConfig = { enabled: false, amount: 0, expireDays: 0 }, onGuest, loginBg }) {
  const { lang, setLang, t } = useLang();
  const [phone, setPhone] = useState("+996");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loginHeroIdx, setLoginHeroIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLoginHeroIdx(i => (i + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, []);

  const formatPhone = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 12);
    if (digits.length <= 3) return '+' + digits;
    if (digits.length <= 6) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3);
    if (digits.length <= 9) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
    return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6, 9) + ' ' + digits.slice(9, 12);
  };

  function doLogin() {
    if (!phone || !name) { setErr(lang === "ru" ? "Заполните все поля" : "Бардык талааларды толтуруңуз"); return; }
    if (name.toLowerCase() === "admin") { onLogin({ isAdminLogin: true, password: phone }); return; }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 11) { setErr(lang === "ru" ? "Введите корректный номер" : "Туура номер жазыңыз"); return; }
    onLogin({ phone, name, isAdminLogin: false });
  }
  const setGuestMode = () => onGuest && onGuest();

  return (
    <div style={{
      width: "100%",
      minHeight: "100svh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
      boxSizing: "border-box"
    }}>
      {/* Full-screen background photo */}
      <img
        src={loginBg || "/login-bg.jpeg"}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          zIndex: 0
        }}
      />
      {/* Dark gradient overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.80) 68%, rgba(0,0,0,0.97) 100%)",
        zIndex: 1
      }} />

      {/* Lang toggle — top right */}
      <div style={{
        position: "absolute", top: 20, right: 16, zIndex: 10,
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

      {/* Branding */}
      <div style={{
        position: "relative", zIndex: 2,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 28,
        paddingTop: 60,
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden"
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "clamp(28px, 9vw, 38px)",
          color: "#f5f0e8",
          letterSpacing: 0.5,
          textAlign: "center",
          lineHeight: 1.2,
          textShadow: "0 2px 24px rgba(0,0,0,0.7)",
          width: "100%",
          paddingInline: 16,
          boxSizing: "border-box"
        }}>Kemal Usman</div>
        <div style={{
          width: 40, height: 1,
          background: "linear-gradient(90deg, transparent, #c9a96e, transparent)",
          margin: "10px auto 8px"
        }} />
        <div style={{
          fontSize: 10, color: "#c9a96e",
          letterSpacing: 4, textTransform: "uppercase"
        }}>Parfum</div>
      </div>

      {/* Glassmorphism form panel */}
      <div style={{
        position: "relative", zIndex: 2,
        width: "100%",
        background: "rgba(20,20,20,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px 24px 0 0",
        padding: "28px 20px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box"
      }}>

      {/* Phone input */}
      <div style={{ width: "100%", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1.5 }}>
          {lang === "ru" ? "НОМЕР ТЕЛЕФОНА" : "ТЕЛЕФОН НОМЕРИ"}
        </div>
        <input
          type="tel" value={phone} onChange={e => { setPhone(formatPhone(e.target.value)); setErr(""); }}
          placeholder="+996 700 123 456"
          style={{
            width: "100%", padding: "13px 16px", fontSize: 16,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12, color: "#fff", outline: "none",
            letterSpacing: 1, boxSizing: "border-box"
          }}
        />
      </div>

      {/* Name input */}
      <div style={{ width: "100%", marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: 1.5 }}>
          {lang === "ru" ? "ВАШЕ ИМЯ" : "АТЫҢЫЗ"}
        </div>
        <input
          type="text" value={name} onChange={e => { setName(e.target.value); setErr(""); }}
          placeholder={lang === "ru" ? "Введите имя" : "Атыңызды жазыңыз"}
          style={{
            width: "100%", padding: "13px 16px", fontSize: 16,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12, color: "#fff", outline: "none",
            boxSizing: "border-box"
          }}
        />
      </div>

      {err && (
        <div style={{ width: "100%", color: "#ff7b7b", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(255,80,80,0.15)", borderRadius: 10, border: "1px solid rgba(255,80,80,0.3)", textAlign: "center", boxSizing: "border-box" }}>{err}</div>
      )}

      {/* Login button */}
      <button onClick={doLogin} style={{
        width: "100%", padding: "15px",
        background: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, fontSize: 14, fontWeight: 700,
        color: "#fff", cursor: "pointer", letterSpacing: 2,
        marginBottom: 14, boxSizing: "border-box"
      }}>
        {lang === "ru" ? "ВОЙТИ" : "КИРҮҮ"}
      </button>

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
// ─── CATALOG SCREEN ────────────────────────────────────────────────────────────
function CatalogScreen({ products, addToCart, banners, showToast, onAdminLogin }) {
  const { lang, setLang, t } = useLang();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [detail, setDetail] = useState(null);
  const [selVariant, setSelVariant] = useState(null);
  const [adminTap, setAdminTap] = React.useState(0);
  const [adminTapTimer, setAdminTapTimer] = React.useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [touchStartX, setTouchStartX] = React.useState(null);

  useEffect(() => {
    const el = document.getElementById("catalog-scroll");
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 50);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
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
  const filteredProducts = products.filter(p => {
    const matchCat = cat === "all" || p.category === cat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const minPrice = (p) => {
    const inStock = (p.variants || []).filter(v => v.inStock).map(v => v.price);
    if (inStock.length === 0) return null;
    return Math.min(...inStock);
  };
  const hasStock = (p) => (p.variants || []).some(v => v.inStock);

  const openDetail = (p) => { setDetail(p); setSelVariant(p.variants.find(v => v.inStock) || p.variants[0]); setImgIndex(0); };

  if (detail) {
    const allImages = (detail.images && detail.images.length > 0) ? detail.images : (detail.img ? [detail.img] : []);
    return (
      <div style={{ minHeight: "100vh", background: "#fff", paddingBottom: 100 }}>
        {/* Hero */}
        <div
          style={{ position: "relative", width: "100%", background: "#fff", overflow: "hidden" }}
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
            <div style={{ background: "#fff", width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img
                src={allImages[imgIndex]}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  display: "block",
                  objectFit: "contain",
                  background: "#fff"
                }}
              />
              {allImages.length > 1 && (
                <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                  {allImages.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setImgIndex(i)}
                      style={{
                        width: i === imgIndex ? 20 : 7,
                        height: 7,
                        borderRadius: 4,
                        background: i === imgIndex ? T.accent : "rgba(180,180,180,0.7)",
                        transition: "width 0.25s",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {React.cloneElement(IC.bottle, { style: { width: 100, height: 100, color: T.accent, opacity: 0.3 } })}
            </div>
          )}
          <button onClick={() => setDetail(null)} style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.text, boxShadow: T.shadowSm }}>
            {IC.back}
          </button>
        </div>
        <div style={{ padding: "20px 16px" }}>
          <div style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{detail.brand}</div>
          <div style={{ color: T.text, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{detail.name}</div>
          <div style={{ color: T.textSecond, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{detail.desc}</div>
          {/* Variants */}
          <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t.chooseSize}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {detail.variants.map(v => {
              const isSel = selVariant?.id === v.id;
              return (
                <button key={v.id} onClick={() => v.inStock && setSelVariant(v)} style={{ padding: "10px 16px", borderRadius: 14, border: isSel ? `2px solid ${T.accent}` : `1.5px solid ${T.border}`, background: isSel ? T.accentLight : T.card, cursor: v.inStock ? "pointer" : "default", opacity: v.inStock ? 1 : 0.4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? T.accent : T.text }}>{v.label}</div>
                  <div style={{ fontSize: 12, color: isSel ? T.accent : T.textSecond, marginTop: 2 }}>{formatSum(v.price)}</div>
                  {!v.inStock && <div style={{ fontSize: 10, color: T.danger }}>{t.outOfStock}</div>}
                </button>
              );
            })}
          </div>
          {selVariant && (
            <div style={{ ...card({ padding: "16px 18px", marginBottom: 16 }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: T.textSecond, fontSize: 13 }}>{t.total}</div>
              <div style={{ color: T.accent, fontSize: 22, fontWeight: 900 }}>{formatSum(selVariant.price)}</div>
            </div>
          )}
          <button onClick={() => { if (!selVariant) return; addToCart(detail.id, selVariant.id); setDetail(null); }} disabled={!selVariant?.inStock} style={{ ...btnGreen({ opacity: selVariant?.inStock ? 1 : 0.5 }) }}>
            {React.cloneElement(IC.cart, { style: { width: 18, height: 18, display: "inline", marginRight: 8 } })}
            {t.addToCart}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="catalog-scroll" style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100, overflowY: "auto", height: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", paddingTop: 44, paddingBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px" }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 0.5 }}>{lang === "ru" ? "Добро пожаловать" : "Кош келиңиз"}</div>
            <div onClick={handleSecretTap} style={{ fontSize: 24, color: "#111", fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, letterSpacing: -0.3, cursor: "default", userSelect: "none" }}>Kemal Usman</div>
          </div>
          <div style={{ display: "flex", background: "#f5f5f5", borderRadius: 20, padding: 3 }}>
            {["ru", "kg"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding: "5px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: lang === l ? "#111" : "transparent", color: lang === l ? "#fff" : "#aaa", transition: "all 0.2s" }}>
                {l === "ru" ? "РУС" : "КЫР"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "0 16px 12px", overflow: "hidden", maxHeight: scrolled ? "60px" : "0px", opacity: scrolled ? 1 : 0, transition: "max-height 0.3s ease, opacity 0.2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: 10, padding: "10px 14px", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#aaa" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="#aaa" strokeWidth="2" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "ru" ? "Поиск парфюма..." : "Атыр издөө..."} style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, color: "#111", width: "100%", fontFamily: "inherit" }} />
          </div>
        </div>
      </div>
      {/* Banner */}
      {banners.length > 0 && <div style={{ marginTop: 14, marginBottom: 16 }}><BannerSlider banners={banners} /></div>}
      {/* Categories */}
      <div className="no-scrollbar" style={{ padding: "8px 16px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "6px 16px", minHeight: 36, borderRadius: 20, border: cat === c ? "none" : "0.5px solid #EEEEEE", background: cat === c ? "#111111" : "transparent", color: cat === c ? "#fff" : T.textSecond, fontSize: 13, fontWeight: cat === c ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {c === "all" ? t.allCategories : c}
            </button>
          ))}
        </div>
      </div>
      {/* Products grid */}
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: 'center', padding: '60px 20px', color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSecond, marginBottom: 6 }}>Ничего не найдено</div>
            <div style={{ fontSize: 13 }}>Попробуйте изменить запрос</div>
          </div>
        )}
        {filteredProducts.map(p => {
          const stk = hasStock(p);
          return (
            <div key={p.id} onClick={() => openDetail(p)} style={{ ...card({ borderRadius: 16, overflow: "hidden", cursor: "pointer", minHeight: 220 }) }}>
              <div style={{ width: "100%", height: 140, background: "#EEEEEE", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {p.img
                  ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : React.cloneElement(IC.bottle, { style: { width: 60, height: 60, color: T.accent, opacity: 0.5 } })}
                {!stk && <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#E53935", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{t.outOfStock}</div>}
                {(p.variants || []).every(v => !v.inStock) && <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#E53935", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>Нет в наличии</div>}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2, fontWeight: 300 }}>{p.brand}</div>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, letterSpacing: 0.5 }}>{p.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {(() => {
                    const sizes = (p.sizes || p.variants || []).slice(0, 2);
                    const extra = (p.sizes || p.variants || []).length - 2;
                    return <>
                      {sizes.map(v => (
                        <span key={v.id} style={{ fontSize: 10, padding: "2px 8px", background: T.accentPale, color: T.accent, borderRadius: 20, fontWeight: 600 }}>{v.label}</span>
                      ))}
                      {extra > 0 && (
                        <span style={{ fontSize: 11, color: T.textMuted, padding: "2px 8px", border: `1px solid ${T.border}`, borderRadius: 20 }}>+{extra}</span>
                      )}
                    </>;
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#111111", fontWeight: 700, fontSize: 14 }}>{minPrice(p) !== null ? `${t.fromPrice} ${formatSum(minPrice(p))}` : <span style={{ color: T.danger, fontSize: 11 }}>Нет в наличии</span>}</div>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: stk ? "#111111" : T.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>
                    {React.cloneElement(IC.plus, { style: { width: 16, height: 16 } })}
                  </div>
                </div>
                <ClientAudioBtn productId={p.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── CART SCREEN ───────────────────────────────────────────────────────────────
function CartScreen({ cart, setCart, products, onOrder, bonusBalance, useBonusPercent, settings, showToast }) {
  const { t } = useLang();
  const [comment, setComment] = useState("");
  const [useBonus, setUseBonus] = useState(false);
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [address, setAddress] = useState("");
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0].id);

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
  const deliveryCost = deliveryType === "delivery" ? (settings?.deliveryCost || 0) : 0;
  const bonusDiscount = useBonus ? Math.min(bonusBalance, Math.floor(subtotal * (useBonusPercent / 100))) : 0;
  const total = subtotal + deliveryCost - bonusDiscount;

  const updateQty = (ci, d) => setCart(prev => { const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId ? { ...i, qty: Math.max(1, i.qty + d) } : i); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });
  const remove = (ci) => setCart(prev => { const next = prev.filter(i => !(i.productId === ci.productId && i.variantId === ci.variantId)); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });

  if (!items.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 32, gap: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {React.cloneElement(IC.cart, { style: { width: 36, height: 36, color: T.accent } })}
      </div>
      <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>{t.cartEmpty}</div>
      <div style={{ color: T.textMuted, fontSize: 14, textAlign: "center" }}>{t.cartEmptyHint}</div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 120 }}>
      <div style={{ padding: "52px 16px 12px", fontSize: 26, fontWeight: 800, color: "#111", background: "#f5f5f5" }}>{t.cart}</div>
      {/* Items */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {items.map((item, i) => (
          <div key={i} style={{ ...card({ padding: "14px 16px" }), display: "flex", gap: 12, alignItems: "center" }}>
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
                <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center", color: T.text }}>{item.qty}</span>
                <button onClick={() => updateQty(item, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.accent, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#fff" }}>+</button>
              </div>
              <div style={{ color: T.accent, fontWeight: 800, fontSize: 14 }}>{formatSum(item.variant.price * item.qty)}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Delivery */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.deliveryType}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: deliveryType === "delivery" ? 12 : 0 }}>
            {[{ id: "delivery", label: t.delivery }, { id: "pickup", label: t.pickup }].map(opt => (
              <button key={opt.id} onClick={() => setDeliveryType(opt.id)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${deliveryType === opt.id ? T.accent : T.border}`, background: deliveryType === opt.id ? T.accentLight : T.card, color: deliveryType === opt.id ? T.accent : T.textSecond, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{opt.label}</button>
            ))}
          </div>
          {deliveryType === "delivery" && <input style={inputStyle} placeholder={t.address} value={address} onChange={e => setAddress(e.target.value)} />}
        </div>
      </div>
      {/* Comment */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder={t.comment} value={comment} onChange={e => setComment(e.target.value)} />
      </div>
      {/* Payment */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.paymentMethod}</div>
          {PAYMENT_METHODS.map(pm => (
            <button key={pm.id} onClick={() => setPayMethod(pm.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 12, border: `1.5px solid ${payMethod === pm.id ? T.accent : T.border}`, background: payMethod === pm.id ? T.accentLight : T.bg, cursor: "pointer", width: "100%", marginBottom: 8, textAlign: "left" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${payMethod === pm.id ? T.accent : T.border}`, background: payMethod === pm.id ? T.accent : "transparent", flexShrink: 0 }} />
              <span style={{ color: payMethod === pm.id ? T.accent : T.text, fontWeight: 600, fontSize: 14 }}>{pm.label}</span>
            </button>
          ))}
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
      {/* Summary */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <div style={{ ...card({ padding: "16px" }) }}>
          {[
            { label: t.subtotal, val: formatSum(subtotal) },
            deliveryType === "delivery" && { label: t.delivery, val: deliveryCost > 0 ? formatSum(deliveryCost) : t.free },
            useBonus && bonusDiscount > 0 && { label: t.bonusDiscount, val: `−${formatSum(bonusDiscount)}`, color: T.bonus },
          ].filter(Boolean).map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: T.textSecond, fontSize: 14 }}>{row.label}</span>
              <span style={{ color: row.color || T.text, fontWeight: 600, fontSize: 14 }}>{row.val}</span>
            </div>
          ))}
          <div style={{ height: 1, background: T.border, margin: "8px 0 12px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{t.total}</span>
            <span style={{ color: T.accent, fontSize: 20, fontWeight: 900 }}>{formatSum(total)}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        <button onClick={() => { if (deliveryType === "delivery" && !address.trim()) { showToast?.(t.enterAddress); return; } onOrder({ comment, useBonus, bonusDiscount, deliveryType, address, payMethod, subtotal, deliveryCost, total }); }} style={{ borderRadius: 50, padding: "6px 6px 6px 18px", background: "#111", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", cursor: "pointer", boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{t.placeOrder}</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{items.reduce((s, i) => s + i.qty, 0)} товар</span>
          </div>
          <div style={{ background: "#fff", borderRadius: 50, padding: "10px 20px", color: "#111", fontSize: 16, fontWeight: 700 }}>→</div>
        </button>
      </div>
    </div>
  );
}

// ─── MY ORDERS SCREEN ──────────────────────────────────────────────────────────
function MyOrdersScreen({ orders }) {
  const { t } = useLang();
  if (!orders?.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {React.cloneElement(IC.orders, { style: { width: 36, height: 36, color: T.accent } })}
      </div>
      <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>{t.noOrders}</div>
    </div>
  );
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "52px 16px 14px", fontSize: 26, fontWeight: 800, color: "#111" }}>{t.myOrders}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {orders.slice().reverse().map(order => (
          <div key={order.id} style={{ ...card({ padding: "16px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: 11 }}>#{order.id}</div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{formatSum(order.total)}</div>
              </div>
              <StatusChip status={order.status} />
            </div>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} × {item.qty}</span>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{formatSum(item.price * item.qty)}</span>
              </div>
            ))}
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 8 }}>{order.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── PROFILE SCREEN ────────────────────────────────────────────────────────────
function ProfileScreen({ user, onLogout, bonusBalance, bonusHistory, referralCode, settings, onCopyReferral, onAdminLogin }) {
  const { t, lang, setLang } = useLang();
  const [tab, setTab] = useState("bonus");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [copied, setCopied] = useState(false);
  const handleCopyReferralLocal = () => {
    onCopyReferral();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ background: "linear-gradient(160deg, #111111 0%, #000000 100%)", padding: "48px 20px 28px", borderRadius: "0 0 32px 32px", marginBottom: 20 }}>
        {/* Lang toggle row */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.15)", borderRadius: 30, padding: 3, border: "1px solid rgba(255,255,255,0.2)" }}>
            {["ru", "kg"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding: "5px 14px", borderRadius: 26, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, background: lang === l ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff", transition: "all 0.2s" }}>
                {l === "ru" ? "РУС" : "КЫР"}
              </button>
            ))}
          </div>
        </div>
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
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 300, letterSpacing: 1, textTransform: "uppercase" }}>{t.bonusBalance}</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>{formatSum(bonusBalance)}</div>
          </div>
          {React.cloneElement(IC.gift, { style: { width: 28, height: 28, color: "#fff" } })}
        </div>
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
              <div key={i} style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14 }}>
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
              </div>
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
      {showAdminModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: T.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 16, textAlign: "center" }}>{t.adminPanel}</div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.lock}</div>
              <input type="password" value={adminPass} onChange={e => { setAdminPass(e.target.value); setAdminErr(""); }} placeholder={t.adminPassword} style={{ ...inputStyle, paddingLeft: 42 }} autoFocus />
            </div>
            {adminErr && <div style={{ color: T.danger, fontSize: 13, marginBottom: 10, textAlign: "center" }}>{adminErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAdminModal(false)} style={{ ...btnOutline({ flex: 1, padding: "12px 0", borderRadius: 14 }) }}>Отмена</button>
              <button onClick={() => { if (adminPass === (settings?.adminPassword || "admin123")) { setShowAdminModal(false); onAdminLogin?.(); } else setAdminErr(t.wrongPassword); }} style={{ ...btnGreen({ flex: 1, padding: "12px 0", borderRadius: 14 }) }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN ORDERS ──────────────────────────────────────────────────────────────
function AdminOrdersScreen({ allOrders, onStatusChange, onDelete, onSendWhatsApp, onConfirmMBankPayment }) {
  const { t } = useLang();
  const [filter, setFilter] = useState("all");
  const [statusMap, setStatusMap] = useState({});
  const [open, setOpen] = useState(null);
  const orders = allOrders.map(o => ({ ...o, status: statusMap[o.id] || o.status }));
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const statuses = ["all", "new", "confirmed", "preparing", "delivering", "delivered", "cancelled"];
  const handleStatus = (id, st) => { setStatusMap(p => ({ ...p, [id]: st })); onStatusChange?.(id, st); };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "52px 16px 14px", fontSize: 18, fontWeight: 700, letterSpacing: 1, color: T.text }}>{t.orders}</div>
      <div style={{ padding: "0 16px 14px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filter === s ? T.accent : T.border}`, background: filter === s ? T.accent : T.card, color: filter === s ? "#fff" : T.textSecond, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {s === "all" ? t.allOrders : t["status_" + s] || s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!filtered.length && <div style={{ color: T.textMuted, textAlign: "center", padding: 40 }}>{t.noOrders}</div>}
        {filtered.slice().reverse().map(order => (
          <div key={order.id} style={{ ...card({ padding: "16px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setOpen(open === order.id ? null : order.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: T.textMuted, fontSize: 11 }}>#{order.id}</span>
                  <StatusChip status={order.status} />
                </div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{formatSum(order.total)}</div>
                <div style={{ color: T.textSecond, fontSize: 12, marginTop: 2 }}>{order.clientName} · {order.clientPhone}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => { if (window.confirm(t.confirmDeleteOrder)) onDelete?.(order.id); }} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 20, padding: 4, lineHeight: 1 }}>×</button>
                <span style={{ color: T.textMuted, fontSize: 18, cursor: "pointer" }} onClick={() => setOpen(open === order.id ? null : order.id)}>{open === order.id ? "▲" : "▼"}</span>
              </div>
            </div>
            {open === order.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} × {item.qty}</span>
                    <span style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{formatSum(item.price * item.qty)}</span>
                  </div>
                ))}
                {order.address && <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{t.address}: {order.address}</div>}
                <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>{order.date}</div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: T.textSecond, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t.changeStatus}:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["confirmed", "preparing", "delivering", "delivered", "cancelled"].map(s => (
                      <button key={s} onClick={() => handleStatus(order.id, s)} style={{ padding: "6px 12px", borderRadius: 10, border: `1.5px solid ${order.status === s ? T.accent : T.border}`, background: order.status === s ? T.accentLight : T.bg, color: order.status === s ? T.accent : T.textSecond, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t["status_" + s] || s}</button>
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
                {order.clientPhone && <button onClick={() => onSendWhatsApp?.(order)} style={{ ...btnOutline({ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", fontSize: 13 }) }}>{React.cloneElement(IC.chat, { style: { width: 16, height: 16 } })}{t.sendWhatsApp}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── ADMIN PRODUCTS ────────────────────────────────────────────────────────────
function AdminProductsScreen({ products, setProducts, showToast }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));
  const editProd = products.find(p => p.id === editing);
  const upd = (id, f, v) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [f]: v } : p));
  const updVar = (pId, vId, f, v) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.map(vr => vr.id === vId ? { ...vr, [f]: v } : vr) } : p));
  const addProd = () => { const np = { id: Date.now(), name: "", brand: "", category: "Женские", img: null, images: [], desc: "", variants: [{ id: Date.now(), label: "5 мл", price: 0, type: "ml", inStock: true }] }; setProducts(p => [...p, np]); setEditing(np.id); };
  const delProd = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;
    const prod = products.find(p => p.id === id);
    setProducts(p => p.filter(x => x.id !== id));
    if (editing === id) setEditing(null);
    if (prod?.collectionId) {
      try { await api.deleteProduct(prod.id); } catch (e) { console.warn("Delete error:", e); }
    }
  };
  const saveProd = async (id) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    setSaving(true);
    const data = {
      name: prod.name,
      brand: prod.brand,
      category: prod.category,
      desc: prod.desc,
      variants: JSON.stringify(prod.variants),
    };
    try {
      if (prod.collectionId) {
        await api.updateProduct(prod.id, data);
      } else {
        const created = await api.createProduct(data);
        setProducts(prev => prev.map(p => p.id === id ? { ...created, img: null, images: [], variants: prod.variants } : p));
      }
      showToast?.(t.save + "!");
      setEditing(null);
    } catch (e) {
      console.error("Save product error:", e);
      showToast?.("Ошибка: " + (e.message || "сохранение не удалось"), "error");
    } finally {
      setSaving(false);
    }
  };
  const addVar = (pId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: [...p.variants, { id: Date.now(), label: "", price: 0, type: "ml", inStock: true }] } : p));
  const delVar = (pId, vId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.filter(v => v.id !== vId) } : p));
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "52px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.products}</div>
        <button onClick={addProd} style={{ ...btnGreen({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>
      <div style={{ padding: "0 16px 12px" }}><input style={inputStyle} placeholder={t.search || "Поиск"} value={search} onChange={e => setSearch(e.target.value)} /></div>
      {editProd && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "20px" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{editProd.name || t.newProduct}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
          <MultiImageUpload
            images={editProd.images || []}
            coverImg={editProd.img}
            onImagesChange={imgs => upd(editProd.id, "images", imgs)}
            onCoverChange={url => upd(editProd.id, "img", url)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input style={inputStyle} placeholder={t.productName} value={editProd.name} onChange={e => upd(editProd.id, "name", e.target.value)} />
            <input style={inputStyle} placeholder={t.brand} value={editProd.brand} onChange={e => upd(editProd.id, "brand", e.target.value)} />
            <select style={{ ...inputStyle }} value={editProd.category} onChange={e => upd(editProd.id, "category", e.target.value)}>
              {["Женские", "Мужские", "Унисекс", "Премиум", "Новинки"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder={t.description} value={editProd.desc} onChange={e => upd(editProd.id, "desc", e.target.value)} />
          </div>
          <div style={{ marginBottom: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 8 }}>Аудио аромата</div>
            <ProductAudioRecorder productId={editProd.id} />
          </div>
          <div style={{ marginTop: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ color: T.text, fontWeight: 700 }}>Варианты</div>
              <button onClick={() => addVar(editProd.id)} style={{ background: T.accentLight, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "4px 12px", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Добавить</button>
            </div>
            {editProd.variants.map(v => (
              <div key={v.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="5 мл" value={v.label} onChange={e => updVar(editProd.id, v.id, "label", e.target.value)} />
                <input style={{ ...inputStyle, flex: 2 }} type="number" min={0} placeholder="0" value={v.price} onChange={e => updVar(editProd.id, v.id, "price", Math.max(0, +e.target.value))} />
                <button onClick={() => updVar(editProd.id, v.id, "inStock", !v.inStock)} style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${v.inStock ? T.accent : T.border}`, background: v.inStock ? T.accentLight : T.bg, color: v.inStock ? T.accent : T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  {v.inStock ? "Есть" : "Нет"}
                </button>
                <button onClick={() => delVar(editProd.id, v.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => saveProd(editProd.id)} disabled={saving} style={btnGreen({ flex: 1, padding: "13px 0", borderRadius: 14, opacity: saving ? 0.6 : 1 })}>{saving ? "..." : t.save}</button>
            <button onClick={() => delProd(editProd.id)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t.delete}</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setEditing(editing === p.id ? null : p.id)}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: p.img ? "#fff" : T.accentPale, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {p.img ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : React.cloneElement(IC.bottle, { style: { width: 24, height: 24, color: T.accent, opacity: 0.5 } })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{p.brand}</div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{p.name || t.newProduct}</div>
              <div style={{ color: T.textSecond, fontSize: 11 }}>{p.variants.length} вар. · {p.variants.filter(v => v.inStock).length} в наличии</div>
            </div>
            <span style={{ color: T.textMuted }}>{editing === p.id ? "▲" : "▼"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN STATS ───────────────────────────────────────────────────────────────
function AdminStatsScreen({ orders, products, registeredUsers = [], visitCount = 0 }) {
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

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.stats}</div>

      {/* Top 4 cards */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card({ padding: "16px" }) }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {React.cloneElement(IC.stats, { style: { width: 18, height: 18, color: s.color } })}
            </div>
            <div style={{ color: s.color, fontSize: 20, fontWeight: 900 }}>{s.val}</div>
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
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
}
// ─── ADMIN BANNERS ─────────────────────────────────────────────────────────────
function AdminBannersScreen({ banners, setBanners }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(null);
  const bannerFileRef = useRef(null);
  const [bannerCropSrc, setBannerCropSrc] = useState(null);
  const addBanner = () => { const nb = { id: Date.now(), title: "", subtitle: "", img: null, bg: BG_PRESETS[0], active: true }; setBanners(p => [...p, nb]); setEditing(nb.id); };
  const upd = (id, f, v) => setBanners(prev => prev.map(b => b.id === id ? { ...b, [f]: v } : b));
  const del = (id) => { setBanners(p => p.filter(b => b.id !== id)); if (editing === id) setEditing(null); };
  const editB = banners.find(b => b.id === editing);
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "52px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.banners}</div>
        <button onClick={addBanner} style={{ ...btnGreen({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>
      <div style={{ margin: "0 16px 16px", background: '#FFFBF0', borderRadius: 12, padding: 14, border: '1px solid #FFE0B2' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#FF6B00', marginBottom: 6 }}>Рекомендации по фото</div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
          • Размер: 1200 × 480 px<br/>
          • Формат: JPG или PNG<br/>
          • Размер файла: до 2MB<br/>
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

              {/* Gradient overlay (banner ichida matn ko'rinishi uchun) */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: editB.img ? "rgba(0,0,0,0.35)" : "transparent",
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

            {/* Crop modal */}
            {bannerCropSrc && (
              <CropModal
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
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8 }}>{t.background}:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BG_PRESETS.map(bg => <div key={bg} onClick={() => upd(editB.id, "bg", bg)} style={{ width: 40, height: 40, borderRadius: 12, background: bg, cursor: "pointer", border: `3px solid ${editB.bg === bg ? T.text : "transparent"}` }} />)}
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
function AdminBonusScreen({ settings, setSettings }) {
  const { t } = useLang();
  const [local, setLocal] = useState({ ...settings });
  const upd = (f, v) => setLocal(p => ({ ...p, [f]: v }));
  const rows = [
    { f: "bonusPercent", label: t.bonusPercent, suf: "%" },
    { f: "useBonusPercent", label: t.useBonusPercent, suf: "%" },
    { f: "welcomeBonus", label: t.welcomeBonus, suf: "сом" },
    { f: "referralBonus", label: t.referralBonus, suf: "сом" },
    { f: "referralFriendBonus", label: t.referralFriendBonus, suf: "сом" },
    { f: "deliveryCost", label: t.deliveryCost, suf: "сом" },
    { f: "minOrderForFreeDelivery", label: t.minOrderForFreeDelivery, suf: "сом" },
  ];
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.bonusSettings}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map(row => (
          <div key={row.f} style={{ ...card({ padding: "14px 16px" }) }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{row.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" style={{ ...inputStyle, flex: 1 }} value={local[row.f] || 0} onChange={e => upd(row.f, +e.target.value)} />
              <span style={{ color: T.textMuted, fontWeight: 600 }}>{row.suf}</span>
            </div>
          </div>
        ))}
        <div style={{ ...card({ padding: "14px 16px" }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{t.welcomeBonusEnabled}</div>
          <div onClick={() => upd("welcomeBonusEnabled", !local.welcomeBonusEnabled)} style={{ width: 48, height: 28, borderRadius: 14, background: local.welcomeBonusEnabled ? T.accent : T.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: local.welcomeBonusEnabled ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
        <button onClick={() => setSettings(local)} style={btnGreen({ padding: "15px 0", borderRadius: 16 })}>{t.saveSettings}</button>
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS ────────────────────────────────────────────────────────────
function AdminSettingsScreen({ settings, setSettings, onLogout, showToast, lang }) {
  const { t } = useLang();
  const [mbankPhone, setMbankPhone] = React.useState(localStorage.getItem('mbank_phone') || '');
  const [greenToken, setGreenToken] = React.useState(localStorage.getItem('green_token') || '');
  const [greenInstance, setGreenInstance] = React.useState(localStorage.getItem('green_instance') || '');
  const [welcomeBonus, setWelcomeBonus] = React.useState(Number(localStorage.getItem('bonus_welcome') || settings.welcomeBonus || 50));
  const [welcomeOn, setWelcomeOn] = React.useState(localStorage.getItem('bonus_welcome_on') !== 'false');
  const [orderBonus, setOrderBonus] = React.useState(Number(localStorage.getItem('bonus_order_pct') || settings.bonusPercent || 5));
  const [orderBonusOn, setOrderBonusOn] = React.useState(localStorage.getItem('bonus_order_on') !== 'false');
  const [referralBonus, setReferralBonus] = React.useState(Number(localStorage.getItem('bonus_referral') || settings.referralBonus || 100));
  const [referralOn, setReferralOn] = React.useState(localStorage.getItem('bonus_referral_on') !== 'false');
  const loginBgRef = React.useRef();

  const handleLoginBgUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setSettings(p => ({ ...p, loginBg: dataUrl }));
      localStorage.setItem('parfum_login_bg', dataUrl);
      showToast('Фон сохранён!');
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    localStorage.setItem('mbank_phone', mbankPhone);
    localStorage.setItem('green_token', greenToken);
    localStorage.setItem('green_instance', greenInstance);
    localStorage.setItem('bonus_welcome', welcomeBonus);
    localStorage.setItem('bonus_welcome_on', welcomeOn);
    localStorage.setItem('bonus_order_pct', orderBonus);
    localStorage.setItem('bonus_order_on', orderBonusOn);
    localStorage.setItem('bonus_referral', referralBonus);
    localStorage.setItem('bonus_referral_on', referralOn);
    setSettings(p => ({ ...p, welcomeBonus, bonusPercent: orderBonus, referralBonus }));
    showToast('Сохранено');
  };

  const Row = ({ label, children }) => (
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#666', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? '#111' : '#ddd', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
    </div>
  );

  const NumInput = ({ value, onChange, suffix }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: 70, padding: '6px 10px', border: '0.5px solid #eee', borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: 'center', outline: 'none', background: '#f5f5f5' }} />
      {suffix && <span style={{ fontSize: 12, color: '#aaa' }}>{suffix}</span>}
    </div>
  );

  const TextInput = ({ value, onChange, placeholder }) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ border: '0.5px solid #eee', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', width: 160, textAlign: 'right', background: '#f5f5f5' }} />
  );

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: '#111', padding: '52px 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Настройки</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f5f5f5' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1 }}>💳 M-BANK</span></div>
          <Row label="Номер телефона"><TextInput value={mbankPhone} onChange={setMbankPhone} placeholder="+996 700 000 000" /></Row>
          <div style={{ padding: '10px 16px', background: '#FFFBF0' }}>
            <div style={{ fontSize: 11, color: '#FF6B00' }}>* Клиент платит на этот номер через M-Bank</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f5f5f5' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1 }}>WHATSAPP (GREEN API)</span></div>
          <Row label="Instance ID"><TextInput value={greenInstance} onChange={setGreenInstance} placeholder="1234567890" /></Row>
          <Row label="API Token"><TextInput value={greenToken} onChange={setGreenToken} placeholder="token..." /></Row>
          <div style={{ padding: '10px 16px', background: '#F0FFF4' }}>
            <div style={{ fontSize: 11, color: '#388E3C' }}>* Получите на сайте green-api.com</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f5f5f5' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1 }}>БОНУСЫ</span></div>
          <Row label="Приветственный бонус">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NumInput value={welcomeBonus} onChange={setWelcomeBonus} suffix="сом" />
              <Toggle value={welcomeOn} onChange={setWelcomeOn} />
            </div>
          </Row>
          <Row label="С каждого заказа">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NumInput value={orderBonus} onChange={setOrderBonus} suffix="%" />
              <Toggle value={orderBonusOn} onChange={setOrderBonusOn} />
            </div>
          </Row>
          <Row label="Реферальный бонус">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NumInput value={referralBonus} onChange={setReferralBonus} suffix="сом" />
              <Toggle value={referralOn} onChange={setReferralOn} />
            </div>
          </Row>
        </div>

        {/* LOGIN ФОНА */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f5f5f5' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1 }}>🖼 ФОТО ЭКРАНА ВХОДА</span>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Preview */}
            <div style={{
              width: '100%', height: 180, borderRadius: 12, overflow: 'hidden',
              background: '#111', position: 'relative',
              border: '1px solid #eee'
            }}>
              <img
                src={settings.loginBg || '/login-bg.jpeg'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                padding: 14
              }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 22, color: '#f5f0e8' }}>Kemal Usman</div>
                <div style={{ fontSize: 10, color: '#c9a96e', letterSpacing: 3, marginTop: 4 }}>PARFUM</div>
              </div>
            </div>
            {/* Upload button */}
            <input ref={loginBgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLoginBgUpload} />
            <button onClick={() => loginBgRef.current?.click()} style={{
              width: '100%', padding: '12px', background: '#111', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>
              📷 Заменить фото
            </button>
            {settings.loginBg && (
              <button onClick={() => { setSettings(p => ({ ...p, loginBg: null })); localStorage.removeItem('parfum_login_bg'); showToast('Сброшено'); }} style={{
                width: '100%', padding: '10px', background: 'none',
                border: '1px solid #eee', borderRadius: 10, fontSize: 13, color: '#999', cursor: 'pointer'
              }}>
                Сбросить к стандартному
              </button>
            )}
            <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center' }}>
              Рекомендуется: вертикальное фото (портрет). Обрезка происходит автоматически.
            </div>
          </div>
        </div>

        <button onClick={save} style={{ width: '100%', padding: 16, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
          Сохранить
        </button>
        <button onClick={onLogout} style={{ width: '100%', padding: 14, background: 'none', border: '1.5px solid #E53935', borderRadius: 14, color: '#E53935', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t.logout}</button>
      </div>
    </div>
  );
}
// ─── MBANK PAYMENT ────────────────────────────────────────────────────────────
function MBankPayment({ total, orderId, onConfirm, onCancel }) {
  const phone = localStorage.getItem('mbank_phone') || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const [step, setStep] = React.useState('pay');

  const openMBank = () => {
    const deepLink = `mbank://transfer?phone=${cleanPhone}&amount=${total}&comment=Kemal_Usman_${orderId}`;
    window.location.href = deepLink;
    setTimeout(() => setStep('confirm'), 2000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 430 }}>
        {step === 'pay' && <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>Оплата M-Bank</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111' }}>{total.toLocaleString()} сом</div>
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Заказ #{orderId}</div>
          </div>
          <button onClick={openMBank} style={{ width: '100%', padding: 16, background: '#00AEEF', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Открыть M-Bank · {total.toLocaleString()} сом
          </button>
          <div style={{ background: '#f5f5f5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Нет M-Bank? Переведите вручную:</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{phone || 'Не указан'}</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Сумма: <b>{total.toLocaleString()} сом</b></div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Комментарий: Kemal Usman #{orderId}</div>
          </div>
          <button onClick={() => setStep('confirm')} style={{ width: '100%', padding: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
            + Я оплатил
          </button>
          <button onClick={onCancel} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#aaa', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
        </>}
        {step === 'confirm' && <>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8 }}>Ожидаем подтверждение</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Администратор проверит оплату и подтвердит заказ</div>
            <button onClick={() => onConfirm('mbank_pending')} style={{ width: '100%', padding: 16, background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Готово
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── AUDIO COMPONENTS ─────────────────────────────────────────────────────────
function ProductAudioRecorder({ productId }) {
  const { lang } = useLang();
  const key = 'parfum_audio_' + productId;
  const [status, setStatus] = React.useState(localStorage.getItem(key) ? 'done' : 'idle');
  const [countdown, setCountdown] = React.useState(10);
  const [playing, setPlaying] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const audioRef = React.useRef(null);
  const recorderRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const stopRecorder = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleRecord = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('idle');
      return;
    }
    if (!window.MediaRecorder) {
      setStatus('idle');
      return;
    }
    stopRecorder();
    setStatus('recording');
    setCountdown(10);
    let c = 10;
    const iv = setInterval(() => {
      c--;
      setCountdown(c > 0 ? c : 0);
      if (c <= 0) clearInterval(iv);
    }, 1000);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      streamRef.current = stream;
      const chunks = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        clearInterval(iv);
        stream.getTracks().forEach(t => t.stop());
        recorderRef.current = null;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem(key, reader.result);
          setCountdown(10);
          setStatus('done');
        };
        reader.readAsDataURL(blob);
      };
      rec.start(100);
      setTimeout(() => stopRecorder(), 10000);
    }).catch(() => { setStatus('idle'); clearInterval(iv); });
  };

  const handlePlay = () => {
    const data = localStorage.getItem(key);
    if (!data) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(data);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setPaused(false); };
    audio.play();
    setPlaying(true); setPaused(false);
  };

  const handlePause = () => {
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false); setPaused(true);
  };

  const handleResume = () => {
    if (audioRef.current) audioRef.current.play();
    setPlaying(true); setPaused(false);
  };

  const handleDelete = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    stopRecorder();
    localStorage.removeItem(key);
    setStatus('idle'); setPlaying(false); setPaused(false);
  };

  const Btn = ({ label, onClick, color = '#111', bg = 'transparent', border = '1px solid #eee' }) => (
    <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: 20, border, background: bg, fontSize: 12, color, cursor: 'pointer', fontWeight: 500 }}>{label}</button>
  );

  if (status === 'recording') return (
    <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#E53935', fontWeight: 700, fontSize: 13 }}>
          {lang === 'ru' ? `Запись... ${countdown}с` : `Жазуу... ${countdown}с`}
        </span>
        <button onClick={stopRecorder} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #E53935', background: '#fff', color: '#E53935', fontSize: 12, cursor: 'pointer' }}>
          {lang === 'ru' ? 'Стоп' : 'Стоп'}
        </button>
      </div>
      <div style={{ height: 4, background: '#FECACA', borderRadius: 4, marginTop: 8 }}>
        <div style={{ height: 4, background: '#E53935', borderRadius: 4, width: `${((10 - countdown) / 10) * 100}%`, transition: 'width 1s linear' }} />
      </div>
    </div>
  );

  if (status === 'done') return (
    <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        {lang === 'ru' ? 'Аудио записано' : 'Аудио жазылды'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!playing && !paused && (
          <button onClick={handlePlay} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
            {lang === 'ru' ? 'Слушать' : 'Укуу'}
          </button>
        )}
        {playing && (
          <button onClick={handlePause} style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #111', background: '#fff', color: '#111', fontSize: 13, cursor: 'pointer' }}>
            {lang === 'ru' ? 'Пауза' : 'Токто'}
          </button>
        )}
        {paused && (
          <button onClick={handleResume} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
            {lang === 'ru' ? 'Продолжить' : 'Улантуу'}
          </button>
        )}
        <button onClick={handleRecord} style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' }}>
          {lang === 'ru' ? 'Перезаписать' : 'Кайра жаз'}
        </button>
        <button onClick={handleDelete} style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #E53935', background: '#fff', color: '#E53935', fontSize: 13, cursor: 'pointer' }}>
          {lang === 'ru' ? 'Удалить' : 'Өчүрүү'}
        </button>
      </div>
    </div>
  );

  return (
    <button onClick={handleRecord} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed #ddd', background: 'none', cursor: 'pointer', fontSize: 13, color: '#888', marginTop: 8 }}>
      {lang === 'ru' ? 'Записать аромат (10 сек)' : 'Жыт жаз (10 с)'}
    </button>
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

function ClientAudioBtn({ productId }) {
  const key = 'parfum_audio_' + productId;
  const [hasAudio, setHasAudio] = React.useState(!!localStorage.getItem(key));
  const [playing, setPlaying] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const audioRef = React.useRef(null);

  React.useEffect(() => {
    setHasAudio(!!localStorage.getItem(key));
  }, [key]);

  if (!hasAudio) return null;

  const handlePlay = () => {
    const data = localStorage.getItem(key);
    if (!data) return;
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(data);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setPaused(false); };
    audio.play();
    setPlaying(true);
    setPaused(false);
  };
  const handlePause = () => {
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false); setPaused(true);
  };
  const handleResume = () => {
    if (audioRef.current) audioRef.current.play();
    setPlaying(true); setPaused(false);
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      {!playing && !paused && (
        <button onClick={handlePlay} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid #111111', background: 'none', fontSize: 12, color: '#111111', cursor: 'pointer' }}>
          Слушать аромат
        </button>
      )}
      {playing && (
        <button onClick={handlePause} style={{ flex: 1, padding: '6px 12px', borderRadius: 20, border: '1px solid #F59E0B', background: 'none', fontSize: 12, color: '#F59E0B', cursor: 'pointer' }}>
          Пауза
        </button>
      )}
      {paused && (
        <button onClick={handleResume} style={{ flex: 1, padding: '6px 12px', borderRadius: 20, border: '1px solid #111111', background: 'none', fontSize: 12, color: '#111111', cursor: 'pointer' }}>
          Продолжить
        </button>
      )}
    </div>
  );
}

// ─── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState("ru");
  const [screen, setScreen] = useState("catalog");
  const [adminScreen, setAdminScreen] = useState("orders");
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [pbLoading, setPbLoading] = useState(true);
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('parfum_cart') || '[]'); } catch { return []; } });
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(() => {
    const loginBg = localStorage.getItem('parfum_login_bg') || null;
    return { ...DEFAULT_SETTINGS, loginBg };
  });
  const [bonusBalance, setBonusBalance] = useState(() => { try { return parseInt(localStorage.getItem('parfum_bonus_balance') || '0'); } catch { return 0; } });
  const [bonusHistory, setBonusHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('parfum_bonus_history') || '[]'); } catch { return []; } });
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [visitCount, setVisitCount] = useState(() => { const v = parseInt(localStorage.getItem('parfum_visits') || '0'); return v; });
  const [welcomeBonusUsed, setWelcomeBonusUsed] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [showMBank, setShowMBank] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [referralCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoginPass, setAdminLoginPass] = useState("");
  const [adminLoginErr, setAdminLoginErr] = useState("");

  const t = TRANSLATIONS[lang];
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Clear stale localStorage banner data and ensure correct accent/bg colors
  useEffect(() => {
    try {
      const storedBanners = localStorage.getItem('parfum_banners');
      if (storedBanners) {
        const parsed = JSON.parse(storedBanners);
        const fixed = parsed.map(b => ({
          ...b,
          bg: b.bg && (b.bg.includes('green') || b.bg.includes('#4CAF') || b.bg.includes('#43A0') || b.bg.includes('#388E') || b.bg.includes('#2E7D'))
            ? "linear-gradient(135deg, #111111 0%, #000000 100%)"
            : b.bg,
        }));
        localStorage.setItem('parfum_banners', JSON.stringify(fixed));
      }
    } catch { /* ignore */ }
  }, []);

  // Load data from PocketBase on startup
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [pbProducts, pbOrders, pbClients] = await Promise.all([
          api.getProducts(),
          api.getOrders(),
          api.getClients(),
        ]);
        if (pbProducts.length > 0) {
          setProducts(pbProducts.map(p => ({
            ...p,
            img: p.images?.[0] ? api.getImageUrl(p, p.images[0]) : null,
            images: (p.images || []).map(img => api.getImageUrl(p, img)),
            variants: Array.isArray(p.variants) ? p.variants : (p.variants ? JSON.parse(p.variants) : []),
          })));
        }
        if (pbOrders.length > 0) setOrders(pbOrders.map(o => ({
          ...o,
          items: Array.isArray(o.items) ? o.items : (o.items ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : []),
        })));
        if (pbClients.length > 0) setRegisteredUsers(pbClients);
      } catch (e) {
        console.warn("PocketBase load error:", e);
      } finally {
        setPbLoading(false);
      }
    };
    loadAll();
  }, []);

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

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleLogin = async ({ phone, name, isAdminLogin, password }) => {
    if (isAdminLogin) {
      if (password === (settings.adminPassword || "admin123")) { setIsAdmin(true); setScreen("admin"); showToast(t.welcomeAdmin); }
      else showToast(t.wrongPassword, "error");
      return;
    }
    const now = new Date().toLocaleDateString("ru-RU");
    setUser({ phone: phone || name, name: name || phone, registrationDate: now });
    // Sync with PocketBase clients
    try {
      let client = await api.findClientByPhone(phone || name);
      if (!client) {
        client = await api.createClient({ phone: phone || name, name: name || phone, date: now });
      }
      setRegisteredUsers(prev => {
        const exists = prev.find(u => u.phone === (phone || name));
        if (!exists) return [...prev, client];
        return prev;
      });
    } catch (e) {
      console.warn("Client sync error:", e);
      setRegisteredUsers(prev => {
        const exists = prev.find(u => u.phone === (phone || name));
        if (!exists) return [...prev, { phone: phone || name, name: name || phone, date: now }];
        return prev;
      });
    }
    const bonusKey = 'parfum_welcome_' + (phone || name || "guest");
    if (settings.welcomeBonusEnabled && settings.welcomeBonus > 0 && !welcomeBonusUsed && !localStorage.getItem(bonusKey)) {
      localStorage.setItem(bonusKey, '1');
      setBonusBalance(p => p + settings.welcomeBonus);
      setBonusHistory(p => [...p, { type: "welcome", amount: settings.welcomeBonus, label: t.welcomeBonus || "Приветственный бонус", date: now }]);
      setWelcomeBonusUsed(true);
      showToast(`+${formatSum(settings.welcomeBonus)} ${t.bonusAccrued}`);
    }
    setScreen("catalog");
  };

  const handleLogout = () => { setUser(null); setIsAdmin(false); setScreen("catalog"); setCart([]); };

  const addToCart = (productId, variantId) => {
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
      return { name: `${prod?.name} ${variant?.label}`, qty: ci.qty, price: variant?.price || 0 };
    });
    const localId = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(0, 8);
    const newOrder = { id: localId, clientName: user?.name || "", clientPhone: user?.phone || "", items, date: now, status: "new", ...orderData };
    if (orderData.payMethod === 'mbank') {
      setPendingOrder(newOrder);
      setShowMBank(true);
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
    setCart([]); localStorage.removeItem('parfum_cart'); setScreen("myorders"); showToast(t.orderPlaced);
    const clientMsg = `Здравствуйте, ${newOrder.clientName}!\nВаш заказ принят!\n\n${(newOrder.items || []).map(i => `• ${i.name} — ${i.price} сом`).join('\n')}\n\nИтого: ${newOrder.total} сом\nСкоро свяжемся с вами!\n\n— Kemal Usman Parfum`;
    const adminPhone = localStorage.getItem('mbank_phone') || '';
    const adminMsg = `Новый заказ!\n\nКлиент: ${newOrder.clientName}\nТел: ${newOrder.clientPhone}\n\n${(newOrder.items || []).map(i => `• ${i.name} — ${i.price} сом`).join('\n')}\n\nИтого: ${newOrder.total} сом\nОплата: ${orderData.payMethod === 'mbank' ? 'M-Bank' : 'Наличные'}\nАдрес: ${orderData.address || 'Самовывоз'}`;
    if (newOrder.clientPhone) sendWhatsApp(newOrder.clientPhone, clientMsg);
    if (adminPhone) sendWhatsApp(adminPhone, adminMsg);
  };

  const sendWhatsApp = async (phone, message) => {
    const instance = localStorage.getItem('green_instance');
    const token = localStorage.getItem('green_token');
    if (!instance || !token) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = cleanPhone + '@c.us';
    try {
      await fetch(`https://api.green-api.com/waInstance${instance}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      });
    } catch (e) { console.log('WhatsApp error:', e); }
  };

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
    { id: "orders", icon: IC.orders, label: t.orders },
    { id: "products", icon: IC.bottle, label: t.products },
    { id: "stats", icon: IC.stats, label: t.stats },
    { id: "banners", icon: IC.image, label: t.banners },
    { id: "bonus", icon: IC.gift, label: t.bonus },
    { id: "settings", icon: IC.settings, label: t.settings },
  ];

  if (!user && !isAdmin && !guestMode) return (
    <LangContext.Provider value={t_ctx}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
        <Toast toast={toast} />
        <LoginScreen onLogin={handleLogin} welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }} onGuest={() => setGuestMode(true)} loginBg={settings.loginBg} />
      </div>
    </LangContext.Provider>
  );

  return (
    <LangContext.Provider value={t_ctx}>
      <div style={{ width: "100%", minHeight: "100vh", background: "#fff", position: "relative", overflow: "hidden", color: T.text, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
        <Toast toast={toast} />
        <div style={{ paddingBottom: T.navH + 16 }}>
          {isAdmin ? (
            <>
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#000000", borderBottom: "0.5px solid rgba(255,255,255,0.15)", paddingBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: 2, textTransform: "uppercase" }}>{t.adminPanel}</div>
                <LangToggle />
              </div>
              {adminScreen === "orders" && <AdminOrdersScreen allOrders={orders} onStatusChange={async (id, st) => { setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o)); try { await api.updateOrder(id, { status: st }); } catch (e) { console.warn("Status update error:", e); } }} onDelete={async (id) => { setOrders(p => p.filter(o => o.id !== id)); try { await api.deleteOrder(id); } catch (e) { console.warn("Delete order error:", e); } }} onSendWhatsApp={handleSendWhatsApp} onConfirmMBankPayment={(id) => { setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o)); showToast(t.orderPlaced); }} />}
              {adminScreen === "products" && <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />}
              {adminScreen === "stats" && <AdminStatsScreen orders={orders} products={products} registeredUsers={registeredUsers} visitCount={visitCount} />}
              {adminScreen === "banners" && <AdminBannersScreen banners={banners} setBanners={setBanners} />}
              {adminScreen === "bonus" && <AdminBonusScreen settings={settings} setSettings={setSettings} />}
              {adminScreen === "settings" && <AdminSettingsScreen settings={settings} setSettings={setSettings} onLogout={handleLogout} showToast={showToast} lang={lang} />}
            </>
          ) : (
            <>
              {screen === "catalog" && <CatalogScreen products={products} addToCart={addToCart} banners={banners.filter(b => b.active)} showToast={showToast} onAdminLogin={() => { setShowAdminLogin(true); setAdminLoginPass(""); setAdminLoginErr(""); }} />}
              {screen === "cart" && <CartScreen cart={cart} setCart={setCart} products={products} onOrder={handleOrder} bonusBalance={bonusBalance} useBonusPercent={settings.useBonusPercent || 30} settings={settings} showToast={showToast} />}
              {screen === "myorders" && <MyOrdersScreen orders={orders.filter(o => o.clientPhone === user?.phone)} />}
              {screen === "profile" && <ProfileScreen user={user} onLogout={handleLogout} bonusBalance={bonusBalance} bonusHistory={bonusHistory} referralCode={referralCode} settings={settings} onCopyReferral={handleCopyReferral} onAdminLogin={() => { setIsAdmin(true); setAdminScreen("orders"); }} />}
            </>
          )}
        </div>
        <NavBar items={isAdmin ? ADMIN_NAV : USER_NAV} active={isAdmin ? adminScreen : screen} onSelect={isAdmin ? setAdminScreen : setScreen} />
        {showAdminLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 16, textAlign: "center" }}>{t.adminPanel}</div>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <input type="password" value={adminLoginPass} onChange={e => { setAdminLoginPass(e.target.value); setAdminLoginErr(""); }} placeholder={t.adminPassword} style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 15, outline: "none", boxSizing: "border-box" }} autoFocus />
              </div>
              {adminLoginErr && <div style={{ color: "#E53935", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{adminLoginErr}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #eee", background: "#f5f5f5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Отмена</button>
                <button onClick={() => { if (adminLoginPass === (settings?.adminPassword || "admin123")) { setShowAdminLogin(false); setIsAdmin(true); setAdminScreen("orders"); } else setAdminLoginErr(t.wrongPassword); }} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>OK</button>
              </div>
            </div>
          </div>
        )}
        {showMBank && pendingOrder && (
          <MBankPayment
            total={pendingOrder.total}
            orderId={pendingOrder.id}
            onConfirm={(status) => {
              const finalOrder = { ...pendingOrder, paymentStatus: status, paymentMethod: 'mbank' };
              setOrders(prev => [...prev, finalOrder]);
              setCart([]); localStorage.removeItem('parfum_cart');
              setShowMBank(false); setPendingOrder(null);
              setScreen('myorders'); showToast('Заказ оформлен! Ожидайте подтверждения.');
            }}
            onCancel={() => { setShowMBank(false); setPendingOrder(null); }}
          />
        )}
      </div>
    </LangContext.Provider>
  );
}