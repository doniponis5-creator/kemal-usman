import React, { useState, useRef, useEffect, createContext, useContext } from "react";

// ─── TRANSLATIONS ──────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  ru: {
    appName: "Parfum Shop", appSubtitle: "Бишкек · Парфюм на разлив",
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
  },
  kg: {
    appName: "Parfum Shop", appSubtitle: "Бишкек · Атир куюп жана упаковка",
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
  },
  uz: {
    appName: "Parfum Shop", appSubtitle: "Bishkek · Atir do'koni",
    login: "Kirish", logout: "Chiqish", loginLabel: "Login", passwordLabel: "Parol",
    loginPlaceholder: "user yoki admin", passwordPlaceholder: "Parol",
    loginError: "Login yoki parol noto'g'ri!", demoHint: "Demo: admin / admin123",
    register: "Ro'yxatdan o'tish", getStarted: "Boshlash",
    catalog: "Katalog", cart: "Savat", myOrders: "Buyurtmalar", profile: "Profil",
    orders: "Buyurtmalar", products: "Mahsulotlar", stats: "Statistika", settings: "Sozlamalar",
    banners: "Bannerlar", bonus: "Bonus", adminPanel: "Administrator",
    search: "Atir qidirish...", allCategories: "Barchasi",
    fromPrice: "dan", variants: "var.", selectVariant: "Hajmni tanlang",
    addToCart: "Savatga", addedToCart: "Qo'shildi!", outOfStock: "Mavjud emas",
    inStock: "Mavjud", available: "Bor",
    cartEmpty: "Savat bo'sh", cartEmptyHint: "Katalogdan mahsulot qo'shing",
    subtotal: "Summa", delivery: "Yetkazib berish", total: "Jami", free: "Bepul",
    placeOrder: "Buyurtma berish", deliveryType: "Yetkazish turi", pickup: "O'zi olish",
    address: "Yetkazish manzili", comment: "Izoh",
    paymentMethod: "To'lov usuli", useBonus: "Bonusdan foydalanish",
    maxDiscount: "Maks. chegirma", bonusDiscount: "Bonus chegirmasi",
    orderPlaced: "Buyurtma berildi!", enterAddress: "Manzilni kiriting",
    name: "Ism", phone: "Telefon",
    bonusBalance: "Bonus balansi", bonusHistory: "Tarix",
    bonusEarned: "Hisoblandi", bonusSpent: "Sarflandi",
    earned: "Yig'ildi", spent: "Sarflandi",
    noBonusHistory: "Tarix bo'sh", noOrders: "Buyurtmalar yo'q",
    myOrders: "Mening buyurtmalarim", accountInfo: "Hisob",
    referralCode: "Ref. kod", referralHint: "Ulashing va bonus oling:",
    copy: "Nusxalash", copied: "Nusxalandi!",
    registrationDate: "Ro'yxatdan o'tgan sana", guest: "Mehmon",
    totalRevenue: "Daromad", totalOrders: "Buyurtmalar", newOrders: "Yangilar",
    avgOrder: "O'rtacha chek", ordersByStatus: "Holat bo'yicha", topProducts: "Top mahsulotlar",
    pcs: "dona", allOrders: "Barchasi",
    changeStatus: "Holat o'zgartirish", sendWhatsApp: "WhatsApp yozish",
    client: "Mijoz", date: "Sana",
    add: "Qo'shish", save: "Saqlash", delete: "O'chirish", confirmDelete: "Mahsulot o'chirilsinmi?",
    newProduct: "Yangi mahsulot", productName: "Nomi", brand: "Brend",
    description: "Tavsif", addVariant: "Variant qo'shish",
    variantLabel: "Hajm / nomi", price: "Narx", outOfStock2: "Yo'q",
    editBanner: "Bannerni tahrirlash", bannerTitle: "Sarlavha",
    bannerSubtitle: "Kichik sarlavha", background: "Fon", active: "Faol",
    noTitle: "Nomsiz",
    bonusSettings: "Bonus sozlamalari", bonusPercent: "% hisoblash",
    useBonusPercent: "% sarflash", welcomeBonus: "Xush kelibsiz bonusi",
    referralBonus: "Refererga bonus", referralFriendBonus: "Do'stga bonus",
    deliveryCost: "Yetkazish narxi", minOrderForFreeDelivery: "Min. buyurtma (bepul)",
    welcomeBonusEnabled: "Xush kelibsiz bonusini yoqish",
    welcomeBonusOnlyFirst: "Faqat birinchi buyurtma",
    saveSettings: "Saqlash", shopName: "Do'kon nomi",
    adminPassword: "Administrator paroli", whatsappPhone: "WhatsApp raqami",
    bonusAccrued: "bonus hisoblandi", welcomeAdmin: "Xush kelibsiz!",
    wrongPassword: "Parol noto'g'ri", fillAll: "Barcha maydonlarni to'ldiring",
    sum: "so'm", newStatus: "Yangi",
    status_new: "Yangi", status_confirmed: "Tasdiqlandi",
    status_preparing: "Tayyorlanmoqda", status_delivering: "Yetkazilmoqda",
    status_delivered: "Yetkazildi", status_cancelled: "Bekor qilindi",
    orderCount: "buyurtma", totalSpent: "sarflandi",
    variantsCount: "variant", chooseSize: "Hajm tanlang",
  },
};

const LangContext = createContext({ lang: "ru", setLang: () => { }, t: TRANSLATIONS.ru });
function useLang() { return useContext(LangContext); }

// ─── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const T = {
  bg: "#FDF6EE",
  bgSecond: "#FAF0E4",
  white: "#FFFCF8",
  accent: "#C47F5A",
  accentDark: "#A0623E",
  accentLight: "rgba(196,127,90,0.10)",
  accentPale: "rgba(196,127,90,0.06)",
  text: "#3D2B1F",
  textSecond: "#8B6650",
  textMuted: "#B09080",
  border: "#EAD8C8",
  card: "#FFFCF8",
  shadow: "0 2px 16px rgba(196,127,90,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  shadowSm: "0 1px 6px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 32px rgba(196,127,90,0.15)",
  danger: "#C0392B",
  success: "#5A8A6A",
  bonus: "#C47F5A",
  referral: "#9B7A6A",
  navH: 64,
};

// Card helper
const card = (extra = {}) => ({
  background: T.card,
  borderRadius: 20,
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  border: `1px solid ${T.border}`,
  ...extra,
});

const inputStyle = {
  background: T.bg,
  border: `1.5px solid ${T.border}`,
  borderRadius: 14,
  color: T.text,
  fontSize: 15,
  padding: "13px 16px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

const btnGreen = (extra = {}) => ({
  background: T.accent,
  color: "#fff",
  border: "none",
  borderRadius: 16,
  padding: "15px 20px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  boxShadow: T.shadowLg,
  fontFamily: "inherit",
  transition: "all 0.15s ease",
  ...extra,
});

const btnOutline = (extra = {}) => ({
  background: "transparent",
  color: T.accent,
  border: `1.5px solid ${T.accent}`,
  borderRadius: 16,
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
  { id: "cash", label: "Наличные / Нак. акча", color: "#C47F5A" },
];

const BG_PRESETS = [
  "linear-gradient(135deg,#C47F5A,#A0623E)",
  "linear-gradient(135deg,#3B82F6,#1D4ED8)",
  "linear-gradient(135deg,#F59E0B,#D97706)",
  "linear-gradient(135deg,#EF4444,#B91C1C)",
  "linear-gradient(135deg,#8B5CF6,#6D28D9)",
  "linear-gradient(135deg,#EC4899,#BE185D)",
  "linear-gradient(135deg,#06B6D4,#0E7490)",
  "linear-gradient(135deg,#3D2B1F,#C47F5A)",
];

const DEFAULT_SETTINGS = {
  shopName: "Parfum Shop", whatsappPhone: "996557100505",
  adminPassword: "admin123", bonusPercent: 5, useBonusPercent: 30,
  welcomeBonus: 150, welcomeBonusEnabled: true,
  referralBonus: 100, referralFriendBonus: 50,
  deliveryCost: 0, minOrderForFreeDelivery: 0,
};

const INITIAL_PRODUCTS = [
  { id: 1, name: "Chanel No. 5", brand: "Chanel", category: "Женские", img: null, desc: "Классический цветочный аромат.", variants: [{ id: "v1", label: "5 мл", price: 120, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 220, type: "ml", inStock: true }, { id: "v3", label: "20 мл", price: 400, type: "ml", inStock: true }, { id: "v4", label: "Упаковка 50 мл", price: 850, type: "package", inStock: true }] },
  { id: 2, name: "Sauvage", brand: "Dior", category: "Мужские", img: null, desc: "Свежий и сильный аромат.", variants: [{ id: "v1", label: "5 мл", price: 130, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 240, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 100 мл", price: 920, type: "package", inStock: true }] },
  { id: 3, name: "Black Orchid", brand: "Tom Ford", category: "Унисекс", img: null, desc: "Редкий и таинственный аромат.", variants: [{ id: "v1", label: "3 мл", price: 90, type: "ml", inStock: true }, { id: "v2", label: "5 мл", price: 140, type: "ml", inStock: true }, { id: "v3", label: "10 мл", price: 260, type: "ml", inStock: true }] },
  { id: 4, name: "Oud Wood", brand: "Tom Ford", category: "Премиум", img: null, desc: "Восточный аромат уда.", variants: [{ id: "v1", label: "5 мл", price: 200, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 380, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 50 мл", price: 1850, type: "package", inStock: true }] },
  { id: 5, name: "La Vie Est Belle", brand: "Lancôme", category: "Женские", img: null, desc: "Радостный и сладкий аромат.", variants: [{ id: "v1", label: "5 мл", price: 110, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 200, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 75 мл", price: 780, type: "package", inStock: true }] },
];

const DEFAULT_BANNERS = [
  { id: 1, active: true, bg: "linear-gradient(135deg,#C47F5A,#A0623E)", img: null, title: "Скидка 20%", subtitle: "На все ароматы Tom Ford", accent: "#fff" },
  { id: 2, active: true, bg: "linear-gradient(135deg,#F59E0B,#D97706)", img: null, title: "Бонусы 5%", subtitle: "С каждого заказа", accent: "#fff" },
  { id: 3, active: true, bg: "linear-gradient(135deg,#8B5CF6,#6D28D9)", img: null, title: "Приведи друга", subtitle: "Получи 100 сом бонус", accent: "#fff" },
];

function formatSum(n) { return Number(n).toLocaleString() + " сом"; }
function generateReferralCode(name) { return (name.slice(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000)); }
// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: toast.type === "error" ? T.danger : T.accent, color: "#fff", padding: "12px 24px", borderRadius: 30, fontSize: 14, fontWeight: 700, boxShadow: T.shadowLg, whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}

function StatusChip({ status }) {
  const map = { new: { bg: "rgba(196,127,90,0.12)", color: T.accent, label: "Новый" }, confirmed: { bg: "rgba(90,138,106,0.12)", color: T.success, label: "Подтверждён" }, preparing: { bg: "#FFF8E1", color: "#C8850A", label: "Готовится" }, delivering: { bg: "rgba(155,122,106,0.12)", color: T.referral, label: "Доставляется" }, delivered: { bg: "rgba(90,138,106,0.15)", color: T.success, label: "Доставлен" }, cancelled: { bg: "#FFEBEE", color: T.danger, label: "Отменён" } };
  const s = map[status] || { bg: "#F5F5F5", color: "#757575", label: status };
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
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-around", height: T.navH, zIndex: 100, boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}>
      {items.map((item, i) => {
        const isActive = item.id === active;
        const isCenter = item.center;
        if (isCenter) return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{ width: 52, height: 52, borderRadius: "50%", background: T.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: T.shadowLg, transform: "translateY(-12px)" }}>
            {React.cloneElement(item.icon, { style: { width: 24, height: 24 } })}
          </button>
        );
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: isActive ? T.accent : T.textMuted, position: "relative", paddingBottom: 4 }}>
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
  const canvasRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const SIZE = 280;
  const imgRef = useRef(new window.Image());

  useEffect(() => {
    imgRef.current.onload = () => { setOffset({ x: 0, y: 0 }); setScale(1); draw(0, 0, 1); };
    imgRef.current.src = src;
  }, [src]);

  function draw(ox = offset.x, oy = offset.y, sc = scale) {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const img = imgRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, SIZE, SIZE);
    const iw = img.width * sc, ih = img.height * sc;
    ctx.drawImage(img, ox + (SIZE - iw) / 2, oy + (SIZE - ih) / 2, iw, ih);
    ctx.strokeStyle = T.accent; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
  }

  useEffect(() => { draw(); }, [offset, scale]);

  const onMD = (e) => { setDragging(true); const p = e.touches?.[0] || e; setStart({ x: p.clientX - offset.x, y: p.clientY - offset.y }); };
  const onMM = (e) => { if (!dragging) return; const p = e.touches?.[0] || e; setOffset({ x: p.clientX - start.x, y: p.clientY - start.y }); };
  const onMU = () => setDragging(false);

  const handleDone = () => {
    const c = canvasRef.current;
    const out = document.createElement("canvas"); out.width = 400; out.height = 400;
    out.getContext("2d").drawImage(c, 0, 0, SIZE, SIZE, 0, 0, 400, 400);
    onDone(out.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: T.card, borderRadius: 24, padding: 24, width: SIZE + 48 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16, textAlign: "center" }}>Обрезать фото</div>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ borderRadius: 16, cursor: "move", display: "block", margin: "0 auto", border: `2px solid ${T.border}` }}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU}
          onTouchStart={onMD} onTouchMove={onMM} onTouchEnd={onMU} />
        <input type="range" min={0.5} max={3} step={0.05} value={scale} onChange={e => setScale(+e.target.value)} style={{ width: "100%", margin: "16px 0", accentColor: T.accent }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...btnOutline({ flex: 1, padding: "12px 0" }) }}>Отмена</button>
          <button onClick={handleDone} style={{ ...btnGreen({ flex: 1, padding: "12px 0" }) }}>Готово</button>
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

// ─── BANNER SLIDER ─────────────────────────────────────────────────────────────
function BannerSlider({ banners }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[idx];
  return (
    <div style={{ margin: "0 16px", borderRadius: 20, overflow: "hidden", boxShadow: T.shadowLg, position: "relative", height: 140 }}>
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
          {banners.map((_, i) => <div key={i} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", transition: "width 0.3s" }} />)}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, welcomeConfig = { enabled: false, amount: 0, expireDays: 0 }, onGuest }) {
  const { lang, t } = useLang();
  const [mode, setMode] = useState("splash");
  const [loginVal, setLoginVal] = useState("");
  const [pass, setPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPass, setRegPass] = useState("");
  const [err, setErr] = useState("");

  function doLogin() {
    if (!loginVal || !pass) { setErr(t.fillAll); return; }
    if (loginVal === "admin") { onLogin({ isAdminLogin: true, password: pass }); }
    else { onLogin({ phone: loginVal, name: loginVal, isAdminLogin: false }); }
  }
  function doRegister() {
    if (!regName || !regPhone) { setErr(t.fillAll); return; }
    const isValidPhone = (ph) => /^[0-9]{9,12}$/.test(ph.replace(/[\s\-\+\(\)]/g, ''));
    if (!isValidPhone(regPhone)) { setErr("Введите корректный номер телефона"); return; }
    onLogin({ phone: regPhone, name: regName, isAdminLogin: false });
  }

  // Splash screen
  if (mode === "splash") return (
    <div style={{ height: "100vh", background: T.accent, display: "flex", flexDirection: "column", padding: "60px 28px 48px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          {React.cloneElement(IC.bottle, { style: { color: "#fff" } })}
        </div>
        <div style={{ color: "#fff", fontSize: 32, fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>Parfum Shop{"\n"}Bishkek</div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.6, marginBottom: 48 }}>{lang === "kg" ? "Бишкектеги эң жакшы атир дүкөнү. Сапат жана жыт кепилдиги." : "Лучший парфюм Бишкека. Гарантия качества и аромата."}</div>
        <button onClick={() => setMode("login")} style={{ background: "#fff", color: T.accent, border: "none", borderRadius: 18, padding: "17px 20px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>{t.getStarted}</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ background: T.accent, padding: "48px 24px 32px", borderRadius: "0 0 32px 32px", marginBottom: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 16, right: 16 }}><LangToggle /></div>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          {React.cloneElement(IC.bottle, { style: { color: "#fff" } })}
        </div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Parfum Shop</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 3 }}>{t.appSubtitle}</div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", margin: "0 20px 20px", background: T.card, borderRadius: 16, padding: 4, gap: 4, border: `1px solid ${T.border}` }}>
        {[["login", "ru" === lang ? "Войти" : "Кирүү"], ["register", "ru" === lang ? "Регистрация" : "Катталуу"]].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: mode === m ? T.accent : "transparent", color: mode === m ? "#fff" : T.textMuted, fontSize: 14, fontWeight: mode === m ? 700 : 500, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      <div style={{ padding: "0 20px" }}>
        {mode === "login" ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.textSecond, marginBottom: 6, fontWeight: 600 }}>{t.loginLabel}</div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.user}</div>
                <input value={loginVal} onChange={e => { setLoginVal(e.target.value); setErr(""); }} placeholder={t.loginPlaceholder} style={{ ...inputStyle, paddingLeft: 42 }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.textSecond, marginBottom: 6, fontWeight: 600 }}>{t.passwordLabel}</div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.lock}</div>
                <input value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} type="password" placeholder={t.passwordPlaceholder} style={{ ...inputStyle, paddingLeft: 42 }} />
              </div>
            </div>
            {err && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "#FFF5F5", borderRadius: 12, border: "1px solid #FFE0E0" }}>{err}</div>}
            <button onClick={doLogin} style={btnGreen()}>{lang === "kg" ? "Кирүү" : "Войти"}</button>
            <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", marginTop: 14, padding: "10px", background: T.card, borderRadius: 12 }}>{t.demoHint}</div>
            {onGuest && <button onClick={onGuest} style={{ marginTop: 12, background: 'none', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', width: '100%' }}>Смотреть без регистрации</button>}
          </>
        ) : (
          <>
            {welcomeConfig.enabled && (
              <div style={{ background: T.accentLight, borderRadius: 16, padding: "14px 16px", marginBottom: 16, border: `1px solid ${T.accent}30` }}>
                <div style={{ color: T.accent, fontWeight: 800, fontSize: 16 }}>+{formatSum(welcomeConfig.amount)}</div>
                <div style={{ color: T.textSecond, fontSize: 13, marginTop: 2 }}>{lang === "kg" ? "Биринчи заказга бонус" : "Бонус на первый заказ"}</div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.textSecond, marginBottom: 6, fontWeight: 600 }}>{t.name}</div>
              <input value={regName} onChange={e => { setRegName(e.target.value); setErr(""); }} placeholder="Иванов Иван" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.textSecond, marginBottom: 6, fontWeight: 600 }}>{t.phone}</div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.phone}</div>
                <input value={regPhone} onChange={e => { setRegPhone(e.target.value); setErr(""); }} type="tel" placeholder="+996 700 000 000" style={{ ...inputStyle, paddingLeft: 42 }} />
              </div>
            </div>
            {err && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "#FFF5F5", borderRadius: 12 }}>{err}</div>}
            <button onClick={doRegister} style={btnGreen()}>{welcomeConfig.enabled ? (lang === "kg" ? "Катталуу + бонус алуу" : "Зарегистрироваться + бонус") : (lang === "kg" ? "Катталуу" : "Зарегистрироваться")}</button>
          </>
        )}
      </div>
    </div>
  );
}
// ─── CATALOG SCREEN ────────────────────────────────────────────────────────────
function CatalogScreen({ products, addToCart, banners, showToast }) {
  const { lang, t } = useLang();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [detail, setDetail] = useState(null);
  const [selVariant, setSelVariant] = useState(null);

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

  const openDetail = (p) => { setDetail(p); setSelVariant(p.variants.find(v => v.inStock) || p.variants[0]); };

  if (detail) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 100 }}>
        {/* Hero */}
        <div style={{ height: 260, background: detail.img ? "transparent" : `linear-gradient(160deg, ${T.accentLight} 0%, ${T.bg} 100%)`, position: "relative", overflow: "hidden" }}>
          {detail.img
            ? <img src={detail.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {React.cloneElement(IC.bottle, { style: { width: 100, height: 100, color: T.accent, opacity: 0.3 } })}
            </div>}
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
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Бишкек · Парфюм</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: "'Georgia','Times New Roman',serif" }}>Kemal Usman</div>
        </div>
        <LangToggle />
      </div>
      {/* Search */}
      <div style={{ position: "relative", margin: "0 16px 12px" }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.search}</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} style={{ width: "100%", boxSizing: "border-box", background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "13px 50px 13px 42px", fontSize: 15, color: T.text, outline: "none", fontFamily: "inherit" }} />
        <div onClick={() => document.querySelector('input[type="text"],input[placeholder]')?.focus()} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 10, background: "#C47F5A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>{IC.filter}</div>
      </div>
      {/* Banner */}
      {banners.length > 0 && <div style={{ marginBottom: 16 }}><BannerSlider banners={banners} /></div>}
      {/* Categories */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${cat === c ? T.accent : T.border}`, background: cat === c ? T.accent : T.card, color: cat === c ? "#fff" : T.textSecond, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {c === "all" ? t.allCategories : c}
            </button>
          ))}
        </div>
      </div>
      {/* Products grid */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
            <div key={p.id} onClick={() => openDetail(p)} style={{ ...card({ borderRadius: 20, overflow: "hidden", cursor: "pointer" }) }}>
              <div style={{ height: 140, background: `linear-gradient(160deg, ${T.accentPale}, ${T.bg})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {p.img
                  ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : React.cloneElement(IC.bottle, { style: { width: 60, height: 60, color: T.accent, opacity: 0.5 } })}
                {!stk && <div style={{ position: "absolute", top: 8, left: 8, background: T.danger, color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{t.outOfStock}</div>}
                {(p.variants || []).every(v => !v.inStock) && <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>Нет в наличии</div>}
              </div>
              <div style={{ padding: "12px 12px 14px" }}>
                <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{p.brand}</div>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>{p.name}</div>
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
                  <div style={{ color: T.text, fontWeight: 800, fontSize: 13 }}>{minPrice(p) !== null ? `${t.fromPrice} ${formatSum(minPrice(p))}` : <span style={{ color: T.danger, fontSize: 11 }}>Нет в наличии</span>}</div>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: stk ? T.accent : T.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
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
    const prod = products.find(p => p.id === ci.productId);
    const variant = prod?.variants.find(v => v.id === ci.variantId);
    return prod && variant ? { ...ci, prod, variant } : null;
  }).filter(Boolean);

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
      <div style={{ padding: "20px 16px 12px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.cart}</div>
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
        <button onClick={() => { if (deliveryType === "delivery" && !address.trim()) { showToast?.(t.enterAddress); return; } onOrder({ comment, useBonus, bonusDiscount, deliveryType, address, payMethod, subtotal, deliveryCost, total }); }} style={btnGreen({ fontSize: 16, padding: "16px 20px", borderRadius: 18 })}>{t.placeOrder}</button>
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
      <div style={{ padding: "20px 16px 12px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.myOrders}</div>
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
  const { t } = useLang();
  const [tab, setTab] = useState("bonus");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ background: T.accent, padding: "48px 20px 28px", borderRadius: "0 0 32px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {React.cloneElement(IC.user, { style: { width: 26, height: 26, color: "#fff" } })}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{user?.name || t.guest}</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{user?.phone}</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t.logout}</button>
        </div>
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{t.bonusBalance}</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>{formatSum(bonusBalance)}</div>
          </div>
          {React.cloneElement(IC.gift, { style: { width: 28, height: 28, color: "rgba(255,255,255,0.7)" } })}
        </div>
      </div>
      {referralCode && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }), borderLeft: `4px solid ${T.referral}` }}>
          <div style={{ color: T.referral, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t.referralCode}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: "10px 14px", color: T.referral, fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>{referralCode}</div>
            <button onClick={onCopyReferral} style={{ background: T.referral, border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t.copy}</button>
          </div>
          <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{t.referralHint} {settings?.referralBonus ? formatSum(settings.referralBonus) : ""}</div>
        </div>
      )}
      <div style={{ margin: "0 16px 14px", display: "flex", gap: 8 }}>
        {[{ id: "bonus", label: t.bonusHistory }, { id: "info", label: t.accountInfo }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${tab === tb.id ? T.accent : T.border}`, background: tab === tb.id ? T.accent : T.card, color: tab === tb.id ? "#fff" : T.textSecond, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{tb.label}</button>
        ))}
      </div>
      {tab === "bonus" ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!bonusHistory.length
            ? <div style={{ color: T.textMuted, textAlign: "center", padding: 40 }}>{t.noBonusHistory}</div>
            : bonusHistory.slice().reverse().map((h, i) => (
              <div key={i} style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: h.type === "spent" ? "#FFF5F5" : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
      {/* Admin access button */}
      <div style={{ padding: "8px 16px 24px" }}>
        <button onClick={() => { setShowAdminModal(true); setAdminPass(""); setAdminErr(""); }} style={{ ...btnOutline({ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 16, color: T.accentDark, border: `1.5px solid ${T.accentDark}` }) }}>
          {React.cloneElement(IC.lock, { style: { width: 16, height: 16, color: T.accentDark } })}
          {t.adminPanel}
        </button>
      </div>
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
function AdminOrdersScreen({ allOrders, onStatusChange, onSendWhatsApp, onConfirmMBankPayment }) {
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
      <div style={{ padding: "20px 16px 12px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.orders}</div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(open === order.id ? null : order.id)}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: T.textMuted, fontSize: 11 }}>#{order.id}</span>
                  <StatusChip status={order.status} />
                </div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{formatSum(order.total)}</div>
                <div style={{ color: T.textSecond, fontSize: 12, marginTop: 2 }}>{order.clientName} · {order.clientPhone}</div>
              </div>
              <span style={{ color: T.textMuted, fontSize: 18 }}>{open === order.id ? "▲" : "▼"}</span>
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
function AdminProductsScreen({ products, setProducts }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));
  const editProd = products.find(p => p.id === editing);
  const upd = (id, f, v) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [f]: v } : p));
  const updVar = (pId, vId, f, v) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.map(vr => vr.id === vId ? { ...vr, [f]: v } : vr) } : p));
  const addProd = () => { const np = { id: Date.now(), name: "", brand: "", category: "Женские", img: null, desc: "", variants: [{ id: Date.now(), label: "5 мл", price: 0, type: "ml", inStock: true }] }; setProducts(p => [...p, np]); setEditing(np.id); };
  const delProd = (id) => { if (window.confirm(t.confirmDelete)) { setProducts(p => p.filter(x => x.id !== id)); if (editing === id) setEditing(null); } };
  const addVar = (pId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: [...p.variants, { id: Date.now(), label: "", price: 0, type: "ml", inStock: true }] } : p));
  const delVar = (pId, vId) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.filter(v => v.id !== vId) } : p));
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          <ImageUpload value={editProd.img} onChange={v => upd(editProd.id, "img", v)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input style={inputStyle} placeholder={t.productName} value={editProd.name} onChange={e => upd(editProd.id, "name", e.target.value)} />
            <input style={inputStyle} placeholder={t.brand} value={editProd.brand} onChange={e => upd(editProd.id, "brand", e.target.value)} />
            <select style={{ ...inputStyle }} value={editProd.category} onChange={e => upd(editProd.id, "category", e.target.value)}>
              {["Женские", "Мужские", "Унисекс", "Премиум", "Новинки"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder={t.description} value={editProd.desc} onChange={e => upd(editProd.id, "desc", e.target.value)} />
          </div>
          <div style={{ marginBottom: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 8 }}>🎤 Аудио аромата</div>
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
            <button onClick={() => setEditing(null)} style={btnGreen({ flex: 1, padding: "13px 0", borderRadius: 14 })}>{t.save}</button>
            <button onClick={() => delProd(editProd.id)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t.delete}</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setEditing(editing === p.id ? null : p.id)}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: T.accentPale, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {p.img ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : React.cloneElement(IC.bottle, { style: { width: 24, height: 24, color: T.accent, opacity: 0.5 } })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{p.brand}</div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{p.name || t.newProduct}</div>
              <div style={{ color: T.textSecond, fontSize: 11 }}>{p.variants.length} вар. · {p.variants.filter(v => v.inStock).length} в наличии</div>
              <div style={{ marginTop: 6 }} onClick={e => e.stopPropagation()}><AudioRecordBtn productId={p.id} /></div>
            </div>
            <span style={{ color: T.textMuted }}>{editing === p.id ? "▲" : "▼"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN STATS ───────────────────────────────────────────────────────────────
function AdminStatsScreen({ orders, products }) {
  const { t } = useLang();
  const delivered = orders.filter(o => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = delivered.length ? Math.round(totalRevenue / delivered.length) : 0;
  const newOrders = orders.filter(o => o.status === "new").length;
  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const topProds = {};
  orders.forEach(o => (o.items || []).forEach(it => { topProds[it.name] = (topProds[it.name] || 0) + it.qty; }));
  const topList = Object.entries(topProds).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const stats = [
    { label: t.totalRevenue, val: formatSum(totalRevenue), color: T.accent, bg: T.accentLight },
    { label: t.totalOrders, val: orders.length, color: "#3B82F6", bg: "#EFF6FF" },
    { label: t.newOrders, val: newOrders, color: T.bonus, bg: "#FFFBEB" },
    { label: t.avgOrder, val: formatSum(avgOrder), color: T.referral, bg: "#F5F3FF" },
  ];
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.stats}</div>
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
      {topList.length > 0 && (
        <div style={{ margin: "0 16px", ...card({ padding: "16px" }) }}>
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
    </div>
  );
}
// ─── ADMIN BANNERS ─────────────────────────────────────────────────────────────
function AdminBannersScreen({ banners, setBanners }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(null);
  const addBanner = () => { const nb = { id: Date.now(), title: "", subtitle: "", img: null, bg: BG_PRESETS[0], active: true }; setBanners(p => [...p, nb]); setEditing(nb.id); };
  const upd = (id, f, v) => setBanners(prev => prev.map(b => b.id === id ? { ...b, [f]: v } : b));
  const del = (id) => { setBanners(p => p.filter(b => b.id !== id)); if (editing === id) setEditing(null); };
  const editB = banners.find(b => b.id === editing);
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.banners}</div>
        <button onClick={addBanner} style={{ ...btnGreen({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>
      {editB && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "20px" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{t.editBanner}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
          <ImageUpload value={editB.img} onChange={v => upd(editB.id, "img", v)} />
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
function AdminSettingsScreen({ settings, setSettings, onLogout }) {
  const { t } = useLang();
  const [local, setLocal] = useState({ ...settings });
  const upd = (f, v) => setLocal(p => ({ ...p, [f]: v }));
  const rows = [
    { f: "shopName", label: t.shopName, type: "text" },
    { f: "whatsappPhone", label: t.whatsappPhone, type: "tel" },
    { f: "adminPassword", label: t.adminPassword, type: "password" },
  ];
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.settings}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map(row => (
          <div key={row.f} style={{ ...card({ padding: "14px 16px" }) }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 6 }}>{row.label}</div>
            <input type={row.type} style={inputStyle} value={local[row.f] || ""} onChange={e => upd(row.f, e.target.value)} />
          </div>
        ))}
        <button onClick={() => setSettings(local)} style={btnGreen({ padding: "15px 0", borderRadius: 16 })}>{t.saveSettings}</button>
        <button onClick={onLogout} style={{ padding: "15px 0", borderRadius: 16, border: `1.5px solid ${T.danger}`, background: "#FFF5F5", color: T.danger, fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" }}>{t.logout}</button>
      </div>
    </div>
  );
}
// ─── MBANK PAYMENT ────────────────────────────────────────────────────────────
function MBankPayment({ total, orderId, onConfirm, onCancel }) {
  const [step, setStep] = React.useState('qr');
  const phone = '0700000000';
  const qrData = `mbank://pay?phone=${phone}&amount=${total}&comment=Order_${orderId}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, maxWidth: 340, width: '100%', textAlign: 'center' }}>
        {step === 'qr' && <>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>Оплата через M-Bank</div>
          <div style={{ fontSize: 13, color: T.textSecond, marginBottom: 20 }}>Сумма: <b style={{ color: T.accent }}>{total.toLocaleString()} сом</b></div>
          <div style={{ background: T.bgSecond, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Отсканируйте QR или нажмите кнопку</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`} alt="M-Bank QR" style={{ width: 180, height: 180, borderRadius: 12 }} />
          </div>
          <a href={`tel:+996${phone.replace(/^0/, '')}`} style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ background: '#0066CC', color: '#fff', borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}>📱 Открыть M-Bank</div>
          </a>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>Номер получателя: <b>{phone}</b></div>
          <button onClick={() => setStep('waiting')} style={{ width: '100%', padding: '12px', borderRadius: 14, background: T.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>✅ Я оплатил</button>
          <button onClick={onCancel} style={{ width: '100%', padding: '12px', borderRadius: 14, background: 'none', color: T.textMuted, border: 'none', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
        </>}
        {step === 'waiting' && <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Ожидаем подтверждение</div>
          <div style={{ fontSize: 13, color: T.textSecond, marginBottom: 24 }}>Администратор проверит оплату и подтвердит заказ</div>
          <button onClick={() => { setStep('done'); onConfirm('mbank_pending'); }} style={{ width: '100%', padding: '12px', borderRadius: 14, background: T.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Готово</button>
        </>}
      </div>
    </div>
  );
}

// ─── AUDIO COMPONENTS ─────────────────────────────────────────────────────────
function ProductAudioRecorder({ productId }) {
  const key = 'parfum_audio_' + productId;
  const [status, setStatus] = React.useState(
    localStorage.getItem(key) ? 'done' : 'idle'
  );
  const [countdown, setCountdown] = React.useState(10);
  const [playing, setPlaying] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const audioRef = React.useRef(null);
  const recorderRef = React.useRef(null);

  const handleRecord = () => {
    if (recorderRef.current) return;
    setStatus('recording');
    setCountdown(10);
    let c = 10;
    const iv = setInterval(() => {
      c--;
      setCountdown(c > 0 ? c : 0);
      if (c <= 0) clearInterval(iv);
    }, 1000);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
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
      setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 10000);
    }).catch(() => {
      setStatus('idle');
      clearInterval(iv);
      recorderRef.current = null;
    });
  };

  const handleStop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handlePlay = () => {
    const data = localStorage.getItem(key);
    if (!data) return;
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(data);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setPaused(false); };
    audio.play();
    setPlaying(true);
    setPaused(false);
  };

  const handlePause = () => {
    if (audioRef.current) { audioRef.current.pause(); }
    setPlaying(false);
    setPaused(true);
  };

  const handleResume = () => {
    if (audioRef.current) { audioRef.current.play(); }
    setPlaying(true);
    setPaused(false);
  };

  const handleDelete = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    localStorage.removeItem(key);
    setStatus('idle');
    setPlaying(false);
    setPaused(false);
  };

  const Btn = ({ label, onClick, color }) => (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${color}`,
      background: 'none', fontSize: 13, color, cursor: 'pointer', fontWeight: 600
    }}>{label}</button>
  );

  if (status === 'recording') return (
    <div style={{ background: '#FEE2E2', borderRadius: 16, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#DC2626', fontWeight: 700, fontSize: 14 }}>🔴 Запись... {countdown}с</span>
        <Btn label="⏹ Стоп" onClick={handleStop} color="#DC2626" />
      </div>
      <div style={{ height: 6, background: '#FECACA', borderRadius: 4 }}>
        <div style={{ height: 6, background: '#DC2626', borderRadius: 4, transition: 'width 1s linear', width: `${((10 - countdown) / 10) * 100}%` }} />
      </div>
    </div>
  );

  if (status === 'done') return (
    <div style={{ background: T.accentPale, borderRadius: 16, padding: '12px 16px', border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 13, color: T.accent, fontWeight: 600, marginBottom: 10 }}>✅ Аудио готово</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!playing && !paused && <Btn label="▶ Играть" onClick={handlePlay} color={T.accent} />}
        {playing && <Btn label="⏸ Пауза" onClick={handlePause} color="#C8850A" />}
        {paused && <Btn label="▶ Продолжить" onClick={handleResume} color={T.accent} />}
        <Btn label="🔄 Перезаписать" onClick={handleRecord} color="#6B7280" />
        <Btn label="🗑 Удалить" onClick={handleDelete} color="#EF4444" />
      </div>
    </div>
  );

  return (
    <button onClick={handleRecord} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', padding: '14px', borderRadius: 16, border: `2px dashed ${T.border}`,
      background: 'none', cursor: 'pointer', fontSize: 14, color: T.textSecond
    }}>
      🎤 Записать описание аромата (10 сек)
    </button>
  );
}

function AudioRecordBtn({ productId }) {
  const [status, setStatus] = React.useState(
    localStorage.getItem('parfum_audio_' + productId) ? 'done' : 'idle'
  );
  const [countdown, setCountdown] = React.useState(10);

  const handleRecord = () => {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#FEE2E2', borderRadius: 20, fontSize: 12, color: '#DC2626' }}>
      🔴 Запись... {countdown}с
    </div>
  );
  if (status === 'done') return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={() => { const a = new Audio(localStorage.getItem('parfum_audio_' + productId)); a.play(); }}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #C47F5A', background: 'none', fontSize: 12, color: '#C47F5A', cursor: 'pointer' }}>
        ▶ Прослушать
      </button>
      <button onClick={handleRecord}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #F59E0B', background: 'none', fontSize: 12, color: '#F59E0B', cursor: 'pointer' }}>
        🔄 Перезаписать
      </button>
      <button onClick={handleDelete}
        style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #EF4444', background: 'none', fontSize: 12, color: '#EF4444', cursor: 'pointer' }}>
        🗑
      </button>
    </div>
  );
  return (
    <button onClick={handleRecord}
      style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid #6B7280', background: 'none', fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
      🎤 Записать аромат (10с)
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
        <button onClick={handlePlay} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid #C47F5A', background: 'none', fontSize: 12, color: '#C47F5A', cursor: 'pointer' }}>
          🎧 Послушайте аромат
        </button>
      )}
      {playing && (
        <button onClick={handlePause} style={{ flex: 1, padding: '6px 12px', borderRadius: 20, border: '1px solid #F59E0B', background: 'none', fontSize: 12, color: '#F59E0B', cursor: 'pointer' }}>
          ⏸ Пауза
        </button>
      )}
      {paused && (
        <button onClick={handleResume} style={{ flex: 1, padding: '6px 12px', borderRadius: 20, border: '1px solid #C47F5A', background: 'none', fontSize: 12, color: '#C47F5A', cursor: 'pointer' }}>
          ▶ Продолжить
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
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('parfum_cart') || '[]'); } catch { return []; } });
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [welcomeBonusUsed, setWelcomeBonusUsed] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [showMBank, setShowMBank] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [referralCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  const t = TRANSLATIONS[lang];
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleLogin = ({ phone, name, isAdminLogin, password }) => {
    if (isAdminLogin) {
      if (password === (settings.adminPassword || "admin123")) { setIsAdmin(true); setScreen("admin"); showToast(t.welcomeAdmin); }
      else showToast(t.wrongPassword, "error");
      return;
    }
    const now = new Date().toLocaleDateString("ru-RU");
    setUser({ phone: phone || name, name: name || phone, registrationDate: now });
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
    if (!user && guestMode) { showToast('Войдите для добавления в корзину'); return; }
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

  const handleOrder = (orderData) => {
    const now = new Date().toLocaleString("ru-RU");
    const items = cart.map(ci => {
      const prod = products.find(p => p.id === ci.productId);
      const variant = prod?.variants.find(v => v.id === ci.variantId);
      return { name: `${prod?.name} ${variant?.label}`, qty: ci.qty, price: variant?.price || 0 };
    });
    const newOrder = { id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(0, 8), clientName: user?.name || "", clientPhone: user?.phone || "", items, date: now, status: "new", ...orderData };
    if (orderData.payMethod === 'mbank') {
      setPendingOrder(newOrder);
      setShowMBank(true);
      return;
    }
    setOrders(p => [...p, newOrder]);
    const earned = Math.floor((orderData.total || 0) * (settings.bonusPercent || 0) / 100);
    if (earned > 0) { setBonusBalance(p => p - (orderData.bonusDiscount || 0) + earned); setBonusHistory(p => [...p, ...(orderData.bonusDiscount ? [{ type: "spent", amount: -orderData.bonusDiscount, label: "Бонус потрачен", date: now }] : []), { type: "earned", amount: earned, label: "Бонус за заказ", date: now }]); }
    else if (orderData.bonusDiscount) { setBonusBalance(p => p - orderData.bonusDiscount); setBonusHistory(p => [...p, { type: "spent", amount: -orderData.bonusDiscount, label: "Бонус потрачен", date: now }]); }
    setCart([]); localStorage.removeItem('parfum_cart'); setScreen("myorders"); showToast(t.orderPlaced);
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
        <LoginScreen onLogin={handleLogin} welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }} onGuest={() => setGuestMode(true)} />
      </div>
    </LangContext.Provider>
  );

  return (
    <LangContext.Provider value={t_ctx}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif", position: "relative" }}>
        <Toast toast={toast} />
        <div style={{ paddingBottom: T.navH + 16 }}>
          {isAdmin ? (
            <>
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>{t.adminPanel}</div>
                <LangToggle />
              </div>
              {adminScreen === "orders" && <AdminOrdersScreen allOrders={orders} onStatusChange={(id, st) => setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o))} onSendWhatsApp={handleSendWhatsApp} onConfirmMBankPayment={(id) => { setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o)); showToast('Оплата подтверждена'); }} />}
              {adminScreen === "products" && <AdminProductsScreen products={products} setProducts={setProducts} />}
              {adminScreen === "stats" && <AdminStatsScreen orders={orders} products={products} />}
              {adminScreen === "banners" && <AdminBannersScreen banners={banners} setBanners={setBanners} />}
              {adminScreen === "bonus" && <AdminBonusScreen settings={settings} setSettings={setSettings} />}
              {adminScreen === "settings" && <AdminSettingsScreen settings={settings} setSettings={setSettings} onLogout={handleLogout} />}
            </>
          ) : (
            <>
              {screen === "catalog" && <CatalogScreen products={products} addToCart={addToCart} banners={banners.filter(b => b.active)} showToast={showToast} />}
              {screen === "catalog" && <div style={{ textAlign: "center", paddingBottom: 8 }}><span onClick={() => { setIsAdmin(true); setAdminScreen("orders"); }} style={{ fontSize: 11, color: T.textMuted, cursor: "pointer" }}>Admin</span></div>}
              {screen === "cart" && <CartScreen cart={cart} setCart={setCart} products={products} onOrder={handleOrder} bonusBalance={bonusBalance} useBonusPercent={settings.useBonusPercent || 30} settings={settings} showToast={showToast} />}
              {screen === "myorders" && <MyOrdersScreen orders={orders.filter(o => o.clientPhone === user?.phone)} />}
              {screen === "profile" && <ProfileScreen user={user} onLogout={handleLogout} bonusBalance={bonusBalance} bonusHistory={bonusHistory} referralCode={referralCode} settings={settings} onCopyReferral={handleCopyReferral} onAdminLogin={() => { setIsAdmin(true); setAdminScreen("orders"); }} />}
            </>
          )}
        </div>
        <NavBar items={isAdmin ? ADMIN_NAV : USER_NAV} active={isAdmin ? adminScreen : screen} onSelect={isAdmin ? setAdminScreen : setScreen} />
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