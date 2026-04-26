import React, { useState, useRef, useEffect, createContext, useContext } from "react";

// ─── i18n ─────────────────────────────────────────────────
const TRANSLATIONS = {
  ru: {
    appSubtitle: "Бишкек · Парфюм на разлив и упаковка",
    login: "Войти", logout: "Выйти", loginLabel: "Логин", passwordLabel: "Пароль",
    loginPlaceholder: "user или admin", passwordPlaceholder: "Пароль",
    loginError: "Неверный логин или пароль!", demoHint: "Демо: admin/admin123 · user/1234",
    catalog: "Каталог", cart: "Корзина", myOrders: "Заказы", profile: "Профиль",
    orders: "Заказы", products: "Товары", stats: "Статистика",
    search: "Поиск по названию или бренду", allCategories: "Все",
    fromPrice: "от", variants: "вар.", selectVariant: "Выберите объём",
    selected: "Выбрано", readyPackage: "Упаковка", addToCart: "Добавить в корзину",
    outOfStock: "Нет", available: "Есть", unavailable: "Нет",
    cartEmpty: "Корзина пуста", cartTitle: "Корзина",
    name: "Имя", phone: "Телефон", address: "Адрес доставки",
    namePh: "Иванов Иван", phonePh: "+996 700 000 000", addressPh: "Бишкек, улица, дом",
    total: "Итого", placeOrder: "Оформить заказ", sending: "Отправка...",
    fillAll: "Заполните все поля",
    orderAccepted: "Заказ принят", orderSubtitle: "Выберите способ оплаты:",
    paymentSent: "Подтверждаю оплату", openApp: "Открыть",
    orderConfirmed: "Заказ подтверждён",
    myOrdersEmpty: "Заказов пока нет",
    adminOrders: "Заказы", adminProducts: "Товары", adminStats: "Статистика",
    addProduct: "Добавить", closeForm: "Закрыть",
    newProduct: "Новый товар", editProduct: "Редактировать",
    productName: "Название", brand: "Бренд", description: "Описание",
    category: "Категория", emoji: "Иконка",
    variants_label: "Варианты", variantPh: "10 мл", pricePh: "280",
    addVariant: "Добавить вариант", save: "Сохранить",
    byGram: "Разлив", package: "Упаковка",
    backBtn: "Назад", processing: "В работе", delivered: "Доставлен", cancelled: "Отменён",
    newStatus: "Новый", processingStatus: "В работе", deliveredStatus: "Доставлен", cancelledStatus: "Отменён",
    sendWhatsapp: "WhatsApp", whatsappSent: "Отправлено", whatsappDemo: "Демо режим",
    totalRevenue: "Выручка", totalOrders: "заказов",
    notConfigured: "Не настроен", connected: "Подключён", itemsCount: "шт.",
    bonusBalance: "Бонусный счёт", bonusHistory: "История бонусов",
    bonusEarned: "Начислено", bonusSpent: "Потрачено",
    useBonus: "Использовать бонусы", bonusMax: "Макс. списание",
    bonusSettings: "Настройки бонусов", bonusPercent: "% от заказа",
    bonusFixed: "Фикс. сумма (сом)", bonusMode: "Режим начисления",
    bonusModePercent: "Процент", bonusModeFixed: "Фиксированный",
    myReferral: "Мой реферальный код", referralShare: "Поделиться",
    referralCopied: "Скопировано", referralEnter: "Реферальный код друга",
    referralApplied: "Реф. код применён. Скидка активирована",
    referralInvalid: "Неверный реф. код",
    referralFriendDiscount: "Скидка для друга", referralYourBonus: "Ваш бонус",
    referralStats: "Приглашённых друзей", referralEarned: "Реф. бонусов заработано",
    referralSettings: "Настройки реферала",
    profileTitle: "Профиль", myBonus: "Мои бонусы",
    referralCode: "Реф. код", inviteFriend: "Пригласить друга",
    orderCount: "заказов", totalSpent: "потрачено",
    accountInfo: "Данные аккаунта", active: "Активен", add: "Добавить",
    addedToCart: "Добавлено в корзину!", adminPanel: "Панель администратора",
    adminPassword: "Пароль администратора", allOrders: "Все заказы",
    avgOrder: "Средний чек", background: "Фон баннера",
    bannerTitle: "Заголовок", bannerSubtitle: "Подзаголовок",
    banners: "Баннеры", bonusAccrued: "бонусов начислено",
    bonusDiscount: "Скидка бонусами", cartEmptyHint: "Добавьте товары из каталога",
    changeStatus: "Изменить статус", client: "Клиент", comment: "Комментарий",
    confirmDelete: "Удалить?", copied: "Скопировано!", copy: "Копировать",
    date: "Дата", delete: "Удалить", delivery: "Доставка",
    deliveryCost: "Стоимость доставки", deliveryType: "Тип доставки",
    earned: "Заработано", editBanner: "Редактировать баннер",
    enterAddress: "Укажите адрес доставки", free: "Бесплатно", guest: "Гость",
    inStock: "В наличии", maxDiscount: "Макс. скидка",
    minOrderForFreeDelivery: "Мин. заказ для бесплатной доставки",
    newOrder: "Новый заказ", newOrders: "Новых заказов",
    noBonusHistory: "История бонусов пуста", noOrders: "Заказов нет",
    noTitle: "Без названия", orderPlaced: "Заказ оформлен!",
    orderStatusUpdated: "Статус заказа обновлён",
    ordersByStatus: "Заказы по статусам", paymentMethod: "Способ оплаты",
    pcs: "шт.", pickup: "Самовывоз",
    referralBonus: "Бонус рефереру", referralFriendBonus: "Бонус другу",
    referralHint: "Поделитесь кодом и получите бонус:",
    registrationDate: "Дата регистрации", saveSettings: "Сохранить настройки",
    sendWhatsApp: "WhatsApp", settings: "Настройки",
    shopName: "Название магазина", spent: "Потрачено", subtotal: "Сумма товаров",
    sum: "сом", topProducts: "Топ товары",
    useBonusPercent: "% использования бонусов",
    welcomeAdmin: "Добро пожаловать, Администратор!",
    welcomeBonus: "Приветственный бонус", welcomeBonusEnabled: "Приветственный бонус",
    welcomeBonusOnlyFirst: "Только для первого заказа",
    whatsappPhone: "WhatsApp номер", wrongPassword: "Неверный пароль",
    variantLabel: "Объём/название", inStock2: "Есть",
    status_new: "Новый", status_confirmed: "Подтверждён",
    status_preparing: "Готовится", status_delivering: "Доставляется",
    status_delivered: "Доставлен", status_cancelled: "Отменён",
  },
  kg: {
    appSubtitle: "Бишкек · Атир куюп жана даяр упаковка",
    login: "Кирүү", logout: "Чыгуу", loginLabel: "Логин", passwordLabel: "Сыр сөз",
    loginPlaceholder: "user же admin", passwordPlaceholder: "Сыр сөз",
    loginError: "Логин же сыр сөз туура эмес!", demoHint: "Демо: admin/admin123 · user/1234",
    catalog: "Каталог", cart: "Себет", myOrders: "Заказдар", profile: "Профиль",
    orders: "Заказдар", products: "Товарлар", stats: "Статистика",
    search: "Аты же бренди боюнча издөө", allCategories: "Баары",
    fromPrice: "баштап", variants: "вар.", selectVariant: "Көлөмдү тандаңыз",
    selected: "Тандалды", readyPackage: "Упаковка", addToCart: "Себетке кошуу",
    outOfStock: "Жок", available: "Бар", unavailable: "Жок",
    cartEmpty: "Себет бош", cartTitle: "Себет",
    name: "Аты-жөнү", phone: "Телефон", address: "Жеткирүү дареги",
    namePh: "Иванов Иван", phonePh: "+996 700 000 000", addressPh: "Бишкек, көчө, үй",
    total: "Жыйынтык", placeOrder: "Заказ берүү", sending: "Жиберилууда...",
    fillAll: "Бардык талааларды толтуруңуз",
    orderAccepted: "Заказ кабыл алынды", orderSubtitle: "Төлөм ыкмасын тандаңыз:",
    paymentSent: "Төлөмдү ырастайм", openApp: "Ачуу",
    orderConfirmed: "Заказ ырасталды",
    myOrdersEmpty: "Заказдар азырынча жок",
    adminOrders: "Заказдар", adminProducts: "Товарлар", adminStats: "Статистика",
    addProduct: "Кошуу", closeForm: "Жабуу",
    newProduct: "Жаңы товар", editProduct: "Өзгөртүү",
    productName: "Аты", brand: "Бренд", description: "Сүрөттөмө",
    category: "Категория", emoji: "Сүрөтчө",
    variants_label: "Варианттар", variantPh: "10 мл", pricePh: "280",
    addVariant: "Вариант кошуу", save: "Сактоо",
    byGram: "Куюп", package: "Упаковка",
    backBtn: "Артка", processing: "Иштелүүдө", delivered: "Жеткирилди", cancelled: "Жокко чыгарылды",
    newStatus: "Жаңы", processingStatus: "Иштелүүдө", deliveredStatus: "Жеткирилди", cancelledStatus: "Жокко чыгарылды",
    sendWhatsapp: "WhatsApp", whatsappSent: "Жөнөтүлдү", whatsappDemo: "Демо режим",
    totalRevenue: "Киреше", totalOrders: "заказ",
    notConfigured: "Орнотулган эмес", connected: "Туташтырылган", itemsCount: "шт.",
    bonusBalance: "Бонус балансы", bonusHistory: "Бонус тарыхы",
    bonusEarned: "Эсептелди", bonusSpent: "Жумшалды",
    useBonus: "Бонус колдонуу", bonusMax: "Макс. эсептен чыгаруу",
    bonusSettings: "Бонус жөндөөлөрү", bonusPercent: "Заказдан %",
    bonusFixed: "Бекит. сумма (сом)", bonusMode: "Эсептөө режими",
    bonusModePercent: "Пайыз", bonusModeFixed: "Бекитилген",
    myReferral: "Менин реф. кодум", referralShare: "Бөлүшүү",
    referralCopied: "Көчүрүлдү", referralEnter: "Досуңуздун реф. коду",
    referralApplied: "Реф. код колдонулду. Арзандатуу активдештирилди",
    referralInvalid: "Реф. код туура эмес",
    referralFriendDiscount: "Досуңузга арзандатуу", referralYourBonus: "Сиздин бонус",
    referralStats: "Чакырылган досторуңуз", referralEarned: "Реф. бонус жыйылды",
    referralSettings: "Реферал жөндөөлөрү",
    profileTitle: "Менин профилим", myBonus: "Менин бонусум",
    referralCode: "Реф. код", inviteFriend: "Досту чакыруу",
    orderCount: "заказ", totalSpent: "жумшалды",
    accountInfo: "Аккаунт маалыматы", active: "Активдүү", add: "Кошуу",
    addedToCart: "Себетке кошулду!", adminPanel: "Администратор панели",
    adminPassword: "Администратор сыр сөзү", allOrders: "Бардык заказдар",
    avgOrder: "Орточо чек", background: "Баннер фону",
    bannerTitle: "Башлык", bannerSubtitle: "Кичи башлык",
    banners: "Баннерлер", bonusAccrued: "бонус эсептелди",
    bonusDiscount: "Бонус арзандатуусу", cartEmptyHint: "Каталогдон товар кошуңуз",
    changeStatus: "Статусту өзгөртүү", client: "Кардар", comment: "Комментарий",
    confirmDelete: "Өчүрүлсүнбү?", copied: "Көчүрүлдү!", copy: "Көчүрүү",
    date: "Күнү", delete: "Өчүрүү", delivery: "Жеткирүү",
    deliveryCost: "Жеткирүү баасы", deliveryType: "Жеткирүү түрү",
    earned: "Жыйылды", editBanner: "Баннерди өзгөртүү",
    enterAddress: "Жеткирүү дарегин жазыңыз", free: "Акысыз", guest: "Конок",
    inStock: "Барда", maxDiscount: "Макс. арзандатуу",
    minOrderForFreeDelivery: "Акысыз жеткирүү үчүн мин. заказ",
    newOrder: "Жаңы заказ", newOrders: "Жаңы заказдар",
    noBonusHistory: "Бонус тарыхы бош", noOrders: "Заказдар жок",
    noTitle: "Аталышы жок", orderPlaced: "Заказ берилди!",
    orderStatusUpdated: "Заказ статусу жаңыланды",
    ordersByStatus: "Статус боюнча заказдар", paymentMethod: "Төлөм ыкмасы",
    pcs: "дана", pickup: "Өзү алып кетүү",
    referralBonus: "Реферерге бонус", referralFriendBonus: "Досуңузга бонус",
    referralHint: "Коду бөлүшүп бонус алыңыз:",
    registrationDate: "Катталган күнү", saveSettings: "Жөндөөлөрдү сактоо",
    sendWhatsApp: "WhatsApp", settings: "Жөндөөлөр",
    shopName: "Дүкөн аты", spent: "Жумшалды", subtotal: "Товарлар суммасы",
    sum: "сом", topProducts: "Топ товарлар",
    useBonusPercent: "Бонус пайызы",
    welcomeAdmin: "Кош келиңиз, Администратор!",
    welcomeBonus: "Кош келүү бонусу", welcomeBonusEnabled: "Кош келүү бонусу",
    welcomeBonusOnlyFirst: "Биринчи заказ үчүн гана",
    whatsappPhone: "WhatsApp номери", wrongPassword: "Сыр сөз туура эмес",
    variantLabel: "Көлөм/аты", inStock2: "Бар",
    status_new: "Жаңы", status_confirmed: "Ырасталды",
    status_preparing: "Даярдалууда", status_delivering: "Жеткирилүүдө",
    status_delivered: "Жеткирилди", status_cancelled: "Жокко чыгарылды",
  },
};

const LangContext = createContext({ lang: "ru", t: TRANSLATIONS.ru });
function useLang() { return useContext(LangContext); }

// ─── DESIGN SYSTEM ────────────────────────────────────────
const T = {
  // Backgrounds
  bgSolid: "#08080F",
  bg: "#08080F",
  bgGrad: "linear-gradient(160deg, #0D0B16 0%, #08080F 50%, #0B0A14 100%)",
  // Glass surfaces
  glass: "rgba(255,255,255,0.06)",
  glassHover: "rgba(255,255,255,0.09)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassSpec: "inset 0 1px 0 rgba(255,255,255,0.13)",
  // Card
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  // Accent — Gold
  accent: "#C8963E",
  accentGrad: "linear-gradient(135deg, #E8C06A 0%, #C8963E 100%)",
  accentLight: "rgba(200,150,62,0.14)",
  accentDark: "#A37832",
  // Text
  text: "#FFFFFF",
  textSecond: "rgba(255,255,255,0.65)",
  textMuted: "rgba(255,255,255,0.38)",
  textLight: "rgba(255,255,255,0.22)",
  // Semantic
  danger: "#FF453A",
  success: "#30D158",
  whatsapp: "#25D366",
  bonus: "#FFD60A",
  bonusLight: "rgba(255,214,10,0.12)",
  referral: "#BF5AF2",
  referralLight: "rgba(191,90,242,0.12)",
  // Shadow
  shadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
  shadowCard: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)",
  shadowAccent: "0 4px 24px rgba(200,150,62,0.35)",
};

// ─── SVG ICONS ────────────────────────────────────────────
const IC = {
  catalog: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
  cart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>,
  orders: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
  profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  products: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>,
  gift: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" rx="1" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>,
  banner: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  stats: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  share: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
  star: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  wa: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  bottle: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v2l2 3v12a2 2 0 01-2 2H9a2 2 0 01-2-2V8l2-3V3z" /><line x1="7" y1="11" x2="17" y2="11" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  location: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  drop: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></svg>,
  pkg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>,
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  chart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  image: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  settings: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  bell: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
};

const PAYMENT_METHODS = [
  { id: "mbank", label: "M Bank", color: "#E4002B", bg: "rgba(228,0,43,0.12)", account: "+996557100505", deepLink: "mbank://transfer?phone=996557100505", fallback: "https://mbank.kg" },
  { id: "obank", label: "O!Bank", color: "#7B2D8B", bg: "rgba(123,45,139,0.12)", account: "0505000100", deepLink: "obank://pay?account=0505000100", fallback: "https://optima.kg" },
];

const GREEN_API = { instanceId: "YOUR_INSTANCE_ID", token: "YOUR_TOKEN", adminPhone: "996557100505" };
async function sendWhatsApp(phone, message) {
  if (GREEN_API.instanceId === "YOUR_INSTANCE_ID") { console.log("WA demo:", phone, message); return true; }
  try { await fetch(`https://api.green-api.com/waInstance${GREEN_API.instanceId}/sendMessage/${GREEN_API.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: `${phone}@c.us`, message }) }); return true; } catch { return false; }
}

const DEFAULT_BONUS_CONFIG = { mode: "percent", percent: 5, fixed: 50, maxSpendPercent: 30, minOrderForBonus: 200 };
const DEFAULT_REFERRAL_CONFIG = { friendDiscount: 10, referrerBonus: 100, bonusOnFirstOrder: true };
const DEFAULT_WELCOME_CONFIG = { enabled: true, amount: 150, onlyFirstOrder: true, expireDays: 30 };

const MOCK_USERS = {
  user: {
    id: "user1", name: "Азиза Каримова", phone: "+996700123456",
    bonusBalance: 350, referralCode: "AZIZA2024", referredBy: null, referredCount: 2,
    orders: [], bonusHistory: [
      { id: 1, type: "earned", amount: 200, desc: "Заказ ORD-1001", date: "20.04.2026" },
      { id: 2, type: "earned", amount: 150, desc: "Реф. бонус (Jasur)", date: "22.04.2026" },
    ],
  },
};
function generateReferralCode(name) { return (name.slice(0, 5).toUpperCase() + Math.floor(1000 + Math.random() * 9000)).replace(/\s/g, ""); }

const CATEGORIES_RU = ["Все", "Женские", "Мужские", "Унисекс", "Премиум", "Новинки"];
const CATEGORIES_KG = ["Баары", "Аялдар", "Эркектер", "Унисекс", "Премиум", "Жаңылар"];

const INITIAL_PRODUCTS = [
  { id: 1, name: "Chanel No. 5", brand: "Chanel", category: { ru: "Женские", kg: "Аялдар" }, emoji: "F", img: null, desc: { ru: "Классический цветочный аромат.", kg: "Классикалык гүл жыты." }, variants: [{ id: "v1", label: "5 мл", price: 120, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 220, type: "ml", inStock: true }, { id: "v3", label: "20 мл", price: 400, type: "ml", inStock: true }, { id: "v4", label: "Упаковка 50 мл", price: 850, type: "package", inStock: true }] },
  { id: 2, name: "Sauvage", brand: "Dior", category: { ru: "Мужские", kg: "Эркектер" }, emoji: "M", img: null, desc: { ru: "Свежий и сильный аромат.", kg: "Таза жана күчтүү жыт." }, variants: [{ id: "v1", label: "5 мл", price: 130, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 240, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 100 мл", price: 920, type: "package", inStock: true }] },
  { id: 3, name: "Black Orchid", brand: "Tom Ford", category: { ru: "Унисекс", kg: "Унисекс" }, emoji: "U", img: null, desc: { ru: "Редкий и таинственный аромат.", kg: "Сейрек жана сырдуу жыт." }, variants: [{ id: "v1", label: "3 мл", price: 90, type: "ml", inStock: true }, { id: "v2", label: "5 мл", price: 140, type: "ml", inStock: true }, { id: "v3", label: "10 мл", price: 260, type: "ml", inStock: true }] },
  { id: 4, name: "Oud Wood", brand: "Tom Ford", category: { ru: "Премиум", kg: "Премиум" }, emoji: "P", img: null, desc: { ru: "Восточный аромат уда.", kg: "Чыгыш удунун жыты." }, variants: [{ id: "v1", label: "5 мл", price: 200, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 380, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 50 мл", price: 1850, type: "package", inStock: true }] },
  { id: 5, name: "La Vie Est Belle", brand: "Lancôme", category: { ru: "Женские", kg: "Аялдар" }, emoji: "F", img: null, desc: { ru: "Радостный и сладкий аромат.", kg: "Кубанычтуу жана таттуу жыт." }, variants: [{ id: "v1", label: "5 мл", price: 110, type: "ml", inStock: true }, { id: "v2", label: "10 мл", price: 200, type: "ml", inStock: true }, { id: "v3", label: "Упаковка 75 мл", price: 780, type: "package", inStock: true }] },
];

const DEFAULT_BANNERS = [
  { id: 1, active: true, isAd: false, img: null, bg: "linear-gradient(135deg, #0D0D2E, #1A1A5E)", emoji: "S", badge: { ru: "АКЦИЯ", kg: "АРЗАНДАТУУ" }, title: { ru: "Скидка 20%", kg: "20% арзандатуу" }, subtitle: { ru: "На все ароматы Tom Ford", kg: "Бардык Tom Ford жыттарына" }, desc: { ru: "Только эту неделю", kg: "Бул жума гана" }, cta: { ru: "Выбрать", kg: "Тандоо" }, link: "", accent: "#E8C06A" },
  { id: 2, active: true, isAd: false, img: null, bg: "linear-gradient(135deg, #1A0D00, #3D2200)", emoji: "B", badge: { ru: "БОНУСЫ", kg: "БОНУСТАР" }, title: { ru: "Копи бонусы", kg: "Бонус жый" }, subtitle: { ru: "5% с каждого заказа", kg: "Ар бир заказдан 5%" }, desc: { ru: "Трать на следующий заказ", kg: "Кийинки заказга жумша" }, cta: { ru: "Подробнее", kg: "Көбүрөөк" }, link: "", accent: "#FFD60A" },
  { id: 3, active: true, isAd: false, img: null, bg: "linear-gradient(135deg, #120020, #2D0055)", emoji: "R", badge: { ru: "РЕФЕРАЛ", kg: "РЕФЕРАЛ" }, title: { ru: "Приведи друга", kg: "Досту чакыр" }, subtitle: { ru: "Друг получит скидку 10%", kg: "Досуңуз 10% алат" }, desc: { ru: "Ты получишь 100 сом бонус", kg: "Сен 100 сом бонус аласың" }, cta: { ru: "Мой код", kg: "Менин кодум" }, link: "", accent: "#BF5AF2" },
];

function formatSum(n) { return Number(n).toLocaleString() + " сом"; }
const DEFAULT_SETTINGS = {
  shopName: "ParfumShop",
  whatsappPhone: "996557100505",
  adminPassword: "admin123",
  bonusPercent: 5,
  useBonusPercent: 30,
  welcomeBonus: 150,
  welcomeBonusEnabled: true,
  referralBonus: 100,
  referralFriendBonus: 50,
  deliveryCost: 0,
  minOrderForFreeDelivery: 0,
  greenApiInstance: "",
  greenApiToken: "",
};

const BG_PRESETS = [
  "linear-gradient(135deg, #0D0D2E, #1A1A5E)",
  "linear-gradient(135deg, #1A0D00, #3D2200)",
  "linear-gradient(135deg, #120020, #2D0055)",
  "linear-gradient(135deg, #001A0D, #003D22)",
  "linear-gradient(135deg, #1A0010, #3D0025)",
  "linear-gradient(135deg, #0A0A0F, #1A1A2E)",
  "linear-gradient(135deg, #1a1a2e, #16213e)",
  "linear-gradient(135deg, #2d1b00, #5c3600)",
];


// ─── GLASS HELPERS ────────────────────────────────────────
const glass = (extra = {}) => ({
  background: T.glass,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  boxShadow: T.shadowCard,
  ...extra,
});
const glassInput = {
  background: "rgba(255,255,255,0.07)", border: `1px solid ${T.border}`,
  borderRadius: 14, color: T.text, outline: "none",
  fontSize: 15, padding: "13px 16px", width: "100%", boxSizing: "border-box",
};
const btnPrimary = (extra = {}) => ({
  background: T.accentGrad, color: "#0A0A0A", border: "none",
  borderRadius: 16, padding: "15px 20px", fontSize: 15, fontWeight: 700,
  cursor: "pointer", width: "100%", boxSizing: "border-box",
  boxShadow: T.shadowAccent, ...extra,
});
const btnGlass = (extra = {}) => ({
  background: T.glass, border: `1px solid ${T.border}`, color: T.textSecond,
  borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", boxShadow: T.glassSpec, ...extra,
});

// ─── TOAST ────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{ position: "absolute", top: 52, left: 12, right: 12, background: "rgba(30,30,40,0.95)", backdropFilter: "blur(20px)", color: T.text, borderRadius: 16, padding: "14px 16px", fontSize: 13, fontWeight: 600, zIndex: 999, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: T.textSecond, cursor: "pointer", fontSize: 14, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{IC.close}</button>
    </div>
  );
}

// ─── STATUS CHIP ──────────────────────────────────────────
function StatusChip({ status }) {
  const { t } = useLang();
  const map = {
    "new": [t.newStatus, "rgba(200,150,62,0.15)", T.accent],
    processing: [t.processingStatus, "rgba(10,132,255,0.15)", "#0A84FF"],
    delivered: [t.deliveredStatus, "rgba(48,209,88,0.15)", T.success],
    cancelled: [t.cancelledStatus, "rgba(255,69,58,0.15)", T.danger],
  };
  const [label, bg, color] = map[status] || map["new"];
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
      {label}
    </span>
  );
}

// ─── LANG TOGGLE ──────────────────────────────────────────
function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: 2, border: `1px solid ${T.border}` }}>
      {["ru", "kg"].map(l => (
        <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 12px", borderRadius: 18, border: "none", background: lang === l ? T.accentGrad : "transparent", color: lang === l ? "#0A0A0A" : T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
          {l === "ru" ? "RU" : "KG"}
        </button>
      ))}
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────
function NavBar({ active, setActive, cartCount, isAdmin }) {
  const { t } = useLang();
  const tabs = isAdmin
    ? [{ id: "orders", icon: IC.orders, label: t.adminOrders }, { id: "products", icon: IC.products, label: t.products }, { id: "bonusAdmin", icon: IC.gift, label: "Бонус" }, { id: "bannerAdmin", icon: IC.banner, label: "Баннер" }, { id: "stats", icon: IC.stats, label: t.stats }]
    : [{ id: "catalog", icon: IC.catalog, label: t.catalog }, { id: "cart", icon: IC.cart, label: t.cart }, { id: "myorders", icon: IC.orders, label: t.myOrders }, { id: "profile", icon: IC.profile, label: t.profile }];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(8,8,15,0.88)", backdropFilter: "blur(30px)", borderTop: `1px solid rgba(255,255,255,0.07)`, display: "flex", paddingBottom: 8, paddingTop: 4 }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => setActive(tab.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "8px 2px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: isActive ? T.accent : T.textMuted, position: "relative", transition: "color 0.2s" }}>
            {tab.id === "cart" && cartCount > 0 && (
              <div style={{ position: "absolute", top: 4, left: "50%", marginLeft: 6, background: T.danger, color: "#fff", borderRadius: "50%", width: 15, height: 15, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #08080F" }}>{cartCount}</div>
            )}
            <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? `${T.accentLight}` : "transparent", transition: "background 0.2s" }}>
              {tab.icon}
            </div>
            <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: 0.2 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── IMAGE UPLOAD + CROP MODAL ────────────────────────────
function CropModal({ imgSrc, onDone, onCancel }) {
  const containerRef = useRef();
  const imgRef = useRef();
  const canvasRef = useRef();
  const [crop, setCrop] = useState({ x: 15, y: 15, w: 70, h: 70 });
  const [ratio, setRatio] = useState("1:1");
  const [dragState, setDragState] = useState(null);
  const RATIOS = [{ label: "1:1", value: "1:1" }, { label: "4:3", value: "4:3" }, { label: "3:4", value: "3:4" }, { label: "16:9", value: "16:9" }];
  function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
  function applyRatio(r) {
    setRatio(r);
    const [rw, rh] = r.split(":").map(Number);
    const w = 70; const h = Math.min((w * rh) / rw, 85); const adjW = (h * rw) / rh;
    setCrop({ x: (100 - adjW) / 2, y: (100 - h) / 2, w: adjW, h });
  }
  function startDrag(e, type) {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragState({ type, startX: clientX, startY: clientY, rect, cropStart: { ...crop } });
  }
  useEffect(() => {
    function move(cx, cy) {
      if (!dragState) return;
      const { rect, cropStart, type, startX, startY } = dragState;
      const dx = ((cx - startX) / rect.width) * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      if (type === "move") setCrop({ ...cropStart, x: clamp(cropStart.x + dx, 0, 100 - cropStart.w), y: clamp(cropStart.y + dy, 0, 100 - cropStart.h) });
      else if (type === "se") { const [rw, rh] = ratio.split(":").map(Number); const nw = clamp(cropStart.w + dx, 15, 100 - cropStart.x); const nh = (nw * rh) / rw; if (cropStart.y + nh <= 100) setCrop({ ...cropStart, w: nw, h: nh }); }
    }
    const mm = e => move(e.clientX, e.clientY);
    const tm = e => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); };
    const up = () => setDragState(null);
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tm, { passive: false }); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", up); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", up); };
  }, [dragState, ratio]);
  function applyCrop() {
    const img = imgRef.current; if (!img) return;
    const canvas = canvasRef.current;
    const sx = img.naturalWidth / img.width, sy = img.naturalHeight / img.height;
    const [rw, rh] = ratio.split(":").map(Number);
    const outW = 600, outH = Math.round((outW * rh) / rw);
    canvas.width = outW; canvas.height = outH;
    canvas.getContext("2d").drawImage(img, (crop.x / 100) * img.width * sx, (crop.y / 100) * img.height * sy, (crop.w / 100) * img.width * sx, (crop.h / 100) * img.height * sy, 0, 0, outW, outH);
    onDone(canvas.toDataURL("image/jpeg", 0.92));
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ ...glass(), padding: 18, width: "100%", maxWidth: 360, background: "rgba(20,20,32,0.95)" }}>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 14, textAlign: "center", letterSpacing: -0.3 }}>Rasmni kesish</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {RATIOS.map(r => (
            <button key={r.value} onClick={() => applyRatio(r.value)} style={{ flex: 1, padding: "7px 4px", borderRadius: 10, border: `1.5px solid ${ratio === r.value ? T.accent : T.border}`, background: ratio === r.value ? T.accentLight : "rgba(255,255,255,0.04)", color: ratio === r.value ? T.accent : T.textMuted, fontSize: 11, fontWeight: ratio === r.value ? 700 : 400, cursor: "pointer" }}>{r.label}</button>
          ))}
        </div>
        <div ref={containerRef} style={{ position: "relative", background: "#000", borderRadius: 14, overflow: "hidden", userSelect: "none", touchAction: "none" }}>
          <img ref={imgRef} src={imgSrc} style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "contain" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${crop.y}%`, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${100 - crop.y - crop.h}%`, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", top: `${crop.y}%`, left: 0, width: `${crop.x}%`, height: `${crop.h}%`, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", top: `${crop.y}%`, right: 0, width: `${100 - crop.x - crop.w}%`, height: `${crop.h}%`, background: "rgba(0,0,0,0.6)" }} />
          </div>
          <div onMouseDown={e => startDrag(e, "move")} onTouchStart={e => startDrag(e, "move")} style={{ position: "absolute", left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%`, border: "1.5px solid rgba(255,255,255,0.8)", cursor: "move", boxSizing: "border-box" }}>
            {[33, 66].map(p => <div key={"v" + p} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)" }} />)}
            {[33, 66].map(p => <div key={"h" + p} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.25)" }} />)}
            <div onMouseDown={e => { e.stopPropagation(); startDrag(e, "se"); }} onTouchStart={e => { e.stopPropagation(); startDrag(e, "se"); }} style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, background: T.accent, borderRadius: "50%", cursor: "se-resize", border: "2px solid #fff" }} />
          </div>
        </div>
        <div style={{ color: T.textMuted, fontSize: 10, textAlign: "center", margin: "10px 0 14px" }}>Qutini suring · O'ng pastki nuqtani tortib o'lchamni o'zgartiring</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnGlass(), flex: 1 }}>Bekor</button>
          <button onClick={applyCrop} style={{ ...btnPrimary(), flex: 2 }}>Tasdiqlash</button>
        </div>
      </div>
    </div>
  );
}

function ImageUpload({ value, onChange, size = 72 }) {
  const ref = useRef();
  const [cropSrc, setCropSrc] = useState(null);
  return (
    <>
      {cropSrc && <CropModal imgSrc={cropSrc} onDone={img => { onChange(img); setCropSrc(null); }} onCancel={() => setCropSrc(null)} />}
      <div onClick={() => ref.current.click()} style={{ width: size, height: size, borderRadius: 16, border: `1.5px dashed ${value ? T.accent : T.border}`, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: value ? "transparent" : "rgba(255,255,255,0.04)", flexShrink: 0 }}>
        {value
          ? <img src={value} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ textAlign: "center", color: T.textMuted }}>{IC.camera}<div style={{ fontSize: 9, marginTop: 3 }}>Фото</div></div>}
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCropSrc(ev.target.result); r.readAsDataURL(f); }} />
      </div>
    </>
  );
}

// ─── BANNER SLIDER ────────────────────────────────────────
function BannerSlider({ banners, setTab }) {
  const { lang } = useLang();
  const active = banners.filter(b => b.active);
  const [cur, setCur] = useState(0);
  const [fade, setFade] = useState(true);
  const timer = useRef(null);
  useEffect(() => { setCur(0); }, [active.length]);
  useEffect(() => {
    timer.current = setInterval(() => { setFade(false); setTimeout(() => { setCur(p => (p + 1) % Math.max(active.length, 1)); setFade(true); }, 200); }, 4000);
    return () => clearInterval(timer.current);
  }, [active.length]);
  if (!active.length) return null;
  const b = active[cur % active.length];
  const title = typeof b.title === "object" ? b.title[lang] : b.title;
  const subtitle = typeof b.subtitle === "object" ? b.subtitle[lang] : b.subtitle;
  const desc = typeof b.desc === "object" ? b.desc[lang] : b.desc;
  const cta = typeof b.cta === "object" ? b.cta[lang] : b.cta;
  const badge = typeof b.badge === "object" ? b.badge[lang] : b.badge;
  function handleClick() {
    if (b.link) window.open(b.link, "_blank");
    else if (b.id === 3) setTab("profile");
    else { setFade(false); setTimeout(() => { setCur(p => (p + 1) % active.length); setFade(true); }, 150); }
  }
  return (
    <div style={{ padding: "0 16px", marginBottom: 6 }}>
      <div onClick={handleClick} style={{ borderRadius: 22, overflow: "hidden", cursor: "pointer", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", position: "relative", minHeight: 116, opacity: fade ? 1 : 0, transition: "opacity 0.2s" }}>
        {b.img ? (
          <div style={{ position: "relative", minHeight: 116 }}>
            <img src={b.img} style={{ width: "100%", height: 116, objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)" }} />
          </div>
        ) : (
          <div style={{ background: b.bg, minHeight: 116, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: (b.accent || "#fff") + "18" }} />
            <div style={{ position: "absolute", right: -30, bottom: -30, width: 80, height: 80, borderRadius: "50%", background: (b.accent || "#fff") + "10" }} />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignSelf: "flex-start", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "3px 10px", fontSize: 9, fontWeight: 800, color: b.accent || "#fff", marginBottom: 7, letterSpacing: 1.5, border: `1px solid rgba(255,255,255,0.15)` }}>{badge}</div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginBottom: 3, fontFamily: "-apple-system, sans-serif", letterSpacing: -0.5 }}>{title}</div>
          <div style={{ color: b.accent || "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{subtitle}</div>
          <div style={{ display: "inline-flex", alignSelf: "flex-start", background: b.accent || T.accent, color: b.accent === "#FFD60A" ? "#000" : "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 800 }}>{cta}</div>
        </div>
        <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 5 }}>
          {active.map((_, i) => (
            <div key={i} onClick={e => { e.stopPropagation(); setFade(false); setTimeout(() => { setCur(i); setFade(true); }, 150); }}
              style={{ width: i === cur % active.length ? 18 : 5, height: 5, borderRadius: 3, background: i === cur % active.length ? (b.accent || "#fff") : "rgba(255,255,255,0.3)", transition: "all 0.3s", cursor: "pointer" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────
function LoginScreen({ onLogin, lang, setLang, welcomeConfig }) {
  const { t } = useLang();
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPass, setRegPass] = useState("");
  const [err, setErr] = useState("");
  function doLogin() {
    if (login === "admin" && pass === "admin123") { onLogin("admin", null); return; }
    if (login === "user" && pass === "1234") { onLogin("client", null); return; }
    setErr(t.loginError);
  }
  function doRegister() {
    if (!regName || !regPhone || !regPass) { setErr(t.fillAll); return; }
    const newUser = {
      id: "user_" + Date.now(), name: regName, phone: regPhone,
      bonusBalance: welcomeConfig.enabled ? welcomeConfig.amount : 0,
      referralCode: generateReferralCode(regName), referredBy: null, referredCount: 0,
      isNew: true, welcomeBonusUsed: false,
      welcomeBonusExpire: welcomeConfig.expireDays > 0 ? new Date(Date.now() + welcomeConfig.expireDays * 86400000).toLocaleDateString("ru-RU") : null,
      bonusHistory: welcomeConfig.enabled ? [{ id: Date.now(), type: "welcome", amount: welcomeConfig.amount, desc: "Welcome bonus", date: new Date().toLocaleDateString("ru-RU") }] : [],
      orders: [],
    };
    onLogin("client", newUser);
  }
  const InputField = ({ label, value, set, type, ph, icon }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: T.textMuted, fontSize: 10, marginBottom: 5, letterSpacing: 1.2, textTransform: "uppercase", paddingLeft: 4 }}>{label}</div>
      <div style={{ position: "relative" }}>
        {icon && <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{icon}</div>}
        <input value={value} onChange={e => { set(e.target.value); setErr(""); }} type={type} placeholder={ph}
          style={{ ...glassInput, paddingLeft: icon ? 40 : 16 }} />
      </div>
    </div>
  );
  return (
    <div style={{ height: "100%", overflowY: "auto", background: T.bgGrad, position: "relative" }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${T.accentLight} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}><LangToggle lang={lang} setLang={setLang} /></div>
      {/* Logo */}
      <div style={{ textAlign: "center", padding: "56px 28px 28px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: T.accentGrad, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: T.shadowAccent }}>
          {IC.bottle}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Parfum Shop</div>
        <div style={{ color: T.textMuted, fontSize: 12, marginTop: 5 }}>{t.appSubtitle}</div>
      </div>
      {/* Welcome bonus banner */}
      {welcomeConfig.enabled && mode === "register" && (
        <div style={{ margin: "0 20px 20px", background: "linear-gradient(135deg, rgba(200,150,62,0.2), rgba(200,150,62,0.08))", borderRadius: 20, padding: "16px 18px", border: `1px solid ${T.accent}30`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -10, top: -10, width: 80, height: 80, borderRadius: "50%", background: `${T.accent}12` }} />
          <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, marginBottom: 6 }}>YANGI KLIENTGA</div>
          <div style={{ color: T.accent, fontSize: 24, fontWeight: 900, marginBottom: 2 }}>{formatSum(welcomeConfig.amount)}</div>
          <div style={{ color: T.textSecond, fontSize: 12 }}>{lang === "kg" ? "Birinchi zakazda bonus" : "Бонус на первый заказ"}</div>
        </div>
      )}
      {/* Mode tabs */}
      <div style={{ display: "flex", margin: "0 20px 20px", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 3, gap: 3, border: `1px solid ${T.border}` }}>
        {[["login", lang === "kg" ? "Кирүү" : "Войти"], ["register", lang === "kg" ? "Катталуу" : "Регистрация"]].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "10px", borderRadius: 13, border: "none", background: mode === m ? T.accentGrad : "transparent", color: mode === m ? "#0A0A0A" : T.textMuted, fontSize: 14, fontWeight: mode === m ? 700 : 400, cursor: "pointer", transition: "all 0.2s" }}>{label}</button>
        ))}
      </div>
      <div style={{ padding: "0 20px 40px" }}>
        {mode === "login" ? (
          <>
            <InputField label={t.loginLabel} value={login} set={setLogin} type="text" ph={t.loginPlaceholder} icon={IC.user} />
            <InputField label={t.passwordLabel} value={pass} set={setPass} type="password" ph={t.passwordPlaceholder} />
            {err && <div style={{ color: T.danger, fontSize: 12, textAlign: "center", marginBottom: 12, padding: "8px 12px", background: "rgba(255,69,58,0.1)", borderRadius: 10 }}>{err}</div>}
            <button onClick={doLogin} style={btnPrimary({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
              <span>{lang === "kg" ? "Кирүү" : "Войти"}</span>{IC.chevron}
            </button>
            <div style={{ color: T.textMuted, fontSize: 11, textAlign: "center", marginTop: 14 }}>{t.demoHint}</div>
          </>
        ) : (
          <>
            <InputField label={lang === "kg" ? "Аты-жөнү" : "Имя Фамилия"} value={regName} set={setRegName} type="text" ph="Иванов Иван" icon={IC.user} />
            <InputField label={t.phone} value={regPhone} set={setRegPhone} type="tel" ph="+996 700 000 000" icon={IC.phone} />
            <InputField label={lang === "kg" ? "Сыр сөз" : "Пароль"} value={regPass} set={setRegPass} type="password" ph="••••••" />
            {err && <div style={{ color: T.danger, fontSize: 12, textAlign: "center", marginBottom: 12, padding: "8px 12px", background: "rgba(255,69,58,0.1)", borderRadius: 10 }}>{err}</div>}
            <button onClick={doRegister} style={btnPrimary({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
              <span>{welcomeConfig.enabled ? (lang === "kg" ? "Катталуу + бонус алуу" : "Зарегистрироваться + бонус") : (lang === "kg" ? "Катталуу" : "Зарегистрироваться")}</span>
              {IC.chevron}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CATALOG ─────────────────────────────────────────────
function CatalogScreen({ cart, setCart, products, banners, setTab }) {
  const { t, lang } = useLang();
  const CATS = lang === "ru" ? CATEGORIES_RU : CATEGORIES_KG;
  const [cat, setCat] = useState(CATS[0]);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [selVariant, setSelVariant] = useState(null);
  const filtered = products.filter(p => {
    const cl = typeof p.category === "object" ? p.category[lang] : p.category;
    return (cat === CATS[0] || cl === cat) && (p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));
  });
  function addToCart(product, variant) {
    const key = `${product.id}_${variant.id}`;
    setCart(prev => { const ex = prev.find(i => i.key === key); if (ex) return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i); return [...prev, { key, productId: product.id, variantId: variant.id, name: product.name, emoji: product.emoji, img: product.img, variantLabel: variant.label, variantType: variant.type, price: variant.price, qty: 1 }]; });
  }
  function openDetail(p) { setDetail(p); setSelVariant(p.variants.find(v => v.inStock) || null); }
  const minPrice = p => Math.min(...p.variants.filter(v => v.inStock).map(v => v.price));
  if (detail) {
    const desc = typeof detail.desc === "object" ? detail.desc[lang] : detail.desc;
    return (
      <div style={{ height: "100%", overflowY: "auto", paddingBottom: 90, background: T.bg }}>
        {/* Hero */}
        <div style={{ position: "relative", background: "linear-gradient(180deg, rgba(200,150,62,0.12) 0%, transparent 100%)", padding: "24px 20px 20px", textAlign: "center", minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setDetail(null)} style={{ position: "absolute", left: 16, top: 20, ...btnGlass({ borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, color: T.textSecond }) }}>
            {IC.back} <span style={{ fontSize: 13 }}>{t.backBtn}</span>
          </button>
          {detail.img
            ? <img src={detail.img} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 24, marginBottom: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
            : <div style={{ width: 120, height: 120, borderRadius: 24, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 14, fontWeight: 900, color: T.accent, border: `1px solid ${T.accent}30` }}>{detail.emoji}</div>}
          <div style={{ color: T.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{detail.brand}</div>
          <div style={{ color: T.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{detail.name}</div>
        </div>
        <div style={{ padding: "16px 16px 0" }}>
          {desc && <p style={{ color: T.textSecond, fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>{desc}</p>}
          {/* Variants */}
          <div style={{ ...glass(), padding: 16, marginBottom: 16 }}>
            <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>{t.selectVariant}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {detail.variants.map(v => {
                const isSel = selVariant?.id === v.id;
                return (
                  <button key={v.id} onClick={() => v.inStock && setSelVariant(v)} style={{ padding: "10px 14px", borderRadius: 14, border: `1.5px solid ${isSel ? T.accent : T.border}`, background: isSel ? T.accentLight : v.inStock ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", color: isSel ? T.accent : v.inStock ? T.text : T.textLight, cursor: v.inStock ? "pointer" : "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative", minWidth: 76, boxShadow: isSel ? T.glassSpec : "none", transition: "all 0.2s" }}>
                    {v.type === "package" && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: T.accentGrad, color: "#000", borderRadius: 6, padding: "1px 7px", fontSize: 8, fontWeight: 800, whiteSpace: "nowrap" }}>BOX</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: v.type === "package" ? 4 : 0 }}>
                      <span style={{ color: isSel ? T.accent : T.textMuted, opacity: 0.7 }}>{v.type === "package" ? IC.pkg : IC.drop}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{v.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isSel ? T.accent : T.accentDark }}>{formatSum(v.price)}</span>
                    {!v.inStock && <span style={{ fontSize: 9, color: T.danger }}>{t.outOfStock}</span>}
                  </button>
                );
              })}
            </div>
            {selVariant && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: T.accentLight, borderRadius: 12, border: `1px solid ${T.accent}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: T.textSecond, fontSize: 13 }}>{selVariant.label}</div>
                <div style={{ color: T.accent, fontSize: 20, fontWeight: 900 }}>{formatSum(selVariant.price)}</div>
              </div>
            )}
          </div>
          <button onClick={() => { if (selVariant) { addToCart(detail, selVariant); setDetail(null); } }} disabled={!selVariant}
            style={{ ...btnPrimary({ opacity: selVariant ? 1 : 0.4, display: "flex", justifyContent: "space-between", alignItems: "center" }) }}>
            <span>{t.addToCart}</span>
            {selVariant && <span style={{ fontWeight: 900 }}>{formatSum(selVariant.price)}</span>}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: 90, background: T.bg }}>
      <div style={{ paddingTop: 12 }}><BannerSlider banners={banners} setTab={setTab} /></div>
      <div style={{ padding: "8px 16px 4px" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>{IC.search}</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            style={{ ...glassInput, paddingLeft: 40 }} />
        </div>
        {/* Categories */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${cat === c ? T.accent : T.border}`, cursor: "pointer", whiteSpace: "nowrap", background: cat === c ? T.accentGrad : "rgba(255,255,255,0.05)", color: cat === c ? "#0A0A0A" : T.textMuted, fontSize: 12, fontWeight: cat === c ? 700 : 400, transition: "all 0.2s" }}>{c}</button>
          ))}
        </div>
      </div>
      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "4px 16px" }}>
        {filtered.map(p => {
          const hasStock = p.variants.some(v => v.inStock);
          return (
            <div key={p.id} onClick={() => openDetail(p)} style={{ ...glass({ borderRadius: 18, overflow: "hidden", cursor: "pointer", transition: "transform 0.1s" }) }}>
              {/* Image */}
              <div style={{ height: 100, background: "linear-gradient(135deg, rgba(200,150,62,0.12), rgba(200,150,62,0.04))", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {p.img
                  ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ fontSize: 13, fontWeight: 900, color: T.accent, letterSpacing: 1 }}>{p.emoji}</div>}
                <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: T.textSecond }}>{p.variants.length} {t.variants}</div>
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ color: T.textMuted, fontSize: 9, letterSpacing: 1, marginBottom: 2, textTransform: "uppercase" }}>{p.brand}</div>
                <div style={{ color: T.text, fontSize: 12, fontWeight: 700, lineHeight: 1.35, marginBottom: 8 }}>{p.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                  {p.variants.slice(0, 3).map(v => (
                    <span key={v.id} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: v.inStock ? T.accentLight : "rgba(255,255,255,0.04)", color: v.inStock ? T.accent : T.textLight, fontWeight: 600 }}>{v.label}</span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: T.accent, fontSize: 13, fontWeight: 800 }}>{hasStock ? `${t.fromPrice} ${formatSum(minPrice(p))}` : "—"}</div>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: hasStock ? T.accentGrad : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: hasStock ? "#000" : T.textMuted, boxShadow: hasStock ? T.shadowAccent : "none" }}>
                    {hasStock ? IC.plus : IC.close}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── CART SCREEN ───────────────────────────────────────────────────────────────
function CartScreen({ cart, setCart, products, onOrder, bonusBalance, useBonusPercent, settings }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [comment, setComment] = React.useState("");
  const [useBonus, setUseBonus] = React.useState(false);
  const [deliveryType, setDeliveryType] = React.useState("delivery");
  const [address, setAddress] = React.useState("");
  const [payMethod, setPayMethod] = React.useState(PAYMENT_METHODS[0].id);

  const items = cart.map(ci => {
    const prod = products.find(p => p.id === ci.productId);
    if (!prod) return null;
    const variant = prod.variants.find(v => v.id === ci.variantId);
    if (!variant) return null;
    return { ...ci, prod, variant };
  }).filter(Boolean);

  const subtotal = items.reduce((s, i) => s + i.variant.price * i.qty, 0);
  const deliveryCost = deliveryType === "delivery" ? (settings?.deliveryCost || 0) : 0;
  const maxBonusDiscount = Math.floor(subtotal * (useBonusPercent / 100));
  const bonusDiscount = useBonus ? Math.min(bonusBalance, maxBonusDiscount) : 0;
  const total = subtotal + deliveryCost - bonusDiscount;

  const updateQty = (ci, delta) => {
    setCart(prev => prev.map(item =>
      item.productId === ci.productId && item.variantId === ci.variantId
        ? { ...item, qty: Math.max(1, item.qty + delta) }
        : item
    ));
  };
  const removeItem = (ci) => {
    setCart(prev => prev.filter(item =>
      !(item.productId === ci.productId && item.variantId === ci.variantId)
    ));
  };

  const handleOrder = () => {
    if (!address.trim() && deliveryType === "delivery") { alert(t.enterAddress); return; }
    onOrder({ comment, useBonus, bonusDiscount, deliveryType, address, payMethod, subtotal, deliveryCost, total });
  };

  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, padding: 32 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(200,150,62,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {React.cloneElement(IC.cart, { style: { width: 36, height: 36, color: T.accent } })}
        </div>
        <div style={{ color: T.textSecond, fontSize: 17, fontWeight: 600 }}>{t.cartEmpty}</div>
        <div style={{ color: T.textMuted, fontSize: 14, textAlign: "center" }}>{t.cartEmptyHint}</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ padding: "20px 16px 8px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.cart}</div>

      {/* Items */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ ...glass({ borderRadius: 18, padding: "14px 16px" }), display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", background: "rgba(200,150,62,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.prod.img
                ? <img src={item.prod.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ fontSize: 22 }}>{item.prod.emoji}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{item.prod.brand}</div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{item.prod.name}</div>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>{item.variant.label}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <button onClick={() => removeItem(item)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, padding: 4 }}>
                {IC.close}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => updateQty(item, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, cursor: "pointer", color: T.text, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 15, minWidth: 18, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => updateQty(item, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.accentGrad, border: "none", cursor: "pointer", color: "#000", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
              <div style={{ color: T.accent, fontWeight: 800, fontSize: 14 }}>{formatSum(item.variant.price * item.qty)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery Type */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...glass({ borderRadius: 18, padding: "16px" }) }}>
          <div style={{ color: T.textSecond, fontSize: 12, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>{t.deliveryType}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "delivery", label: t.delivery }, { id: "pickup", label: t.pickup }].map(opt => (
              <button key={opt.id} onClick={() => setDeliveryType(opt.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${deliveryType === opt.id ? T.accent : T.border}`, background: deliveryType === opt.id ? T.accentLight : "rgba(255,255,255,0.03)", color: deliveryType === opt.id ? T.accent : T.textSecond, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{opt.label}</button>
            ))}
          </div>
          {deliveryType === "delivery" && (
            <input
              style={{ ...glassInput, marginTop: 12 }}
              placeholder={t.address}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Comment */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <textarea
          style={{ ...glassInput, minHeight: 72, resize: "vertical", lineHeight: 1.5 }}
          placeholder={t.comment}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      {/* Payment Method */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...glass({ borderRadius: 18, padding: "16px" }) }}>
          <div style={{ color: T.textSecond, fontSize: 12, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>{t.paymentMethod}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.id} onClick={() => setPayMethod(pm.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${payMethod === pm.id ? T.accent : T.border}`, background: payMethod === pm.id ? T.accentLight : "rgba(255,255,255,0.03)", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${payMethod === pm.id ? T.accent : T.border}`, background: payMethod === pm.id ? T.accent : "transparent", flexShrink: 0 }} />
                <span style={{ color: payMethod === pm.id ? T.accent : T.textSecond, fontWeight: 700, fontSize: 14 }}>{pm.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bonus Toggle */}
      {bonusBalance > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12 }}>
          <div style={{ ...glass({ borderRadius: 18, padding: "14px 16px" }), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: T.bonus, fontWeight: 700, fontSize: 14 }}>{t.useBonus}</div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{t.available}: {formatSum(bonusBalance)} · {t.maxDiscount}: {useBonusPercent}%</div>
            </div>
            <div onClick={() => setUseBonus(v => !v)} style={{ width: 48, height: 28, borderRadius: 14, background: useBonus ? T.bonus : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: useBonus ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ ...glass({ borderRadius: 18, padding: "16px" }) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textSecond, fontSize: 14 }}>{t.subtotal}</span>
              <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{formatSum(subtotal)}</span>
            </div>
            {deliveryType === "delivery" && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.textSecond, fontSize: 14 }}>{t.delivery}</span>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{deliveryCost > 0 ? formatSum(deliveryCost) : t.free}</span>
              </div>
            )}
            {useBonus && bonusDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.bonus, fontSize: 14 }}>{t.bonusDiscount}</span>
                <span style={{ color: T.bonus, fontWeight: 700, fontSize: 14 }}>−{formatSum(bonusDiscount)}</span>
              </div>
            )}
            <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{t.total}</span>
              <span style={{ background: T.accentGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 18, fontWeight: 900 }}>{formatSum(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Button */}
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleOrder} style={{ ...btnPrimary(), fontSize: 16, padding: "16px 20px", borderRadius: 18 }}>
          {t.placeOrder}
        </button>
      </div>
    </div>
  );
}
// ─── PROFILE SCREEN ────────────────────────────────────────────────────────────
function ProfileScreen({ user, onLogout, bonusBalance, bonusHistory, referralCode, settings, onCopyReferral }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [tab, setTab] = React.useState("bonus");

  const bonusEarned = bonusHistory.filter(h => h.type === "earned" || h.type === "welcome").reduce((s, h) => s + h.amount, 0);
  const bonusSpent = bonusHistory.filter(h => h.type === "spent").reduce((s, h) => s + Math.abs(h.amount), 0);

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Header Card */}
      <div style={{ margin: "20px 16px 16px", ...glass({ borderRadius: 24, padding: "24px 20px" }) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 20, background: T.accentGrad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 20px rgba(200,150,62,0.4)" }}>
            {React.cloneElement(IC.user, { style: { width: 28, height: 28, color: "#000" } })}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 18 }}>{user?.name || t.guest}</div>
            <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{user?.phone || ""}</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,69,58,0.12)", border: `1px solid rgba(255,69,58,0.25)`, borderRadius: 12, padding: "8px 14px", color: T.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t.logout}</button>
        </div>

        {/* Bonus Balance */}
        <div style={{ marginTop: 20, background: "linear-gradient(135deg, rgba(255,214,10,0.12), rgba(255,214,10,0.05))", border: `1px solid rgba(255,214,10,0.2)`, borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ color: T.bonus, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{t.bonusBalance}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: T.bonus, fontSize: 32, fontWeight: 900 }}>{formatSum(bonusBalance)}</span>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
            <div><div style={{ color: T.textMuted, fontSize: 10 }}>{t.earned}</div><div style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>+{formatSum(bonusEarned)}</div></div>
            <div><div style={{ color: T.textMuted, fontSize: 10 }}>{t.spent}</div><div style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>−{formatSum(bonusSpent)}</div></div>
          </div>
        </div>
      </div>

      {/* Referral */}
      {referralCode && (
        <div style={{ margin: "0 16px 16px", ...glass({ borderRadius: 20, padding: "16px 18px" }), background: "linear-gradient(135deg, rgba(191,90,242,0.1), rgba(191,90,242,0.04))", borderColor: "rgba(191,90,242,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {React.cloneElement(IC.gift, { style: { width: 18, height: 18, color: T.referral } })}
            <div style={{ color: T.referral, fontWeight: 700, fontSize: 14 }}>{t.referralCode}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "rgba(191,90,242,0.1)", borderRadius: 10, padding: "10px 14px", color: T.referral, fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>{referralCode}</div>
            <button onClick={onCopyReferral} style={{ background: T.referral, border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t.copy}</button>
          </div>
          <div style={{ color: T.textMuted, fontSize: 11, marginTop: 8 }}>{t.referralHint} {settings?.referralBonus ? formatSum(settings.referralBonus) : ""}</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ margin: "0 16px 12px", display: "flex", gap: 8 }}>
        {[{ id: "bonus", label: t.bonusHistory }, { id: "info", label: t.accountInfo }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${tab === tb.id ? T.accent : T.border}`, background: tab === tb.id ? T.accentLight : "rgba(255,255,255,0.03)", color: tab === tb.id ? T.accent : T.textSecond, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{tb.label}</button>
        ))}
      </div>

      {tab === "bonus" && (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {bonusHistory.length === 0
            ? <div style={{ color: T.textMuted, textAlign: "center", padding: 32, fontSize: 14 }}>{t.noBonusHistory}</div>
            : bonusHistory.slice().reverse().map((h, i) => (
              <div key={i} style={{ ...glass({ borderRadius: 16, padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: h.type === "spent" ? "rgba(255,69,58,0.12)" : "rgba(255,214,10,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {React.cloneElement(h.type === "spent" ? IC.cart : IC.gift, { style: { width: 18, height: 18, color: h.type === "spent" ? T.danger : T.bonus } })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{h.label || (h.type === "spent" ? t.bonusSpent : t.bonusEarned)}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{h.date}</div>
                </div>
                <div style={{ color: h.type === "spent" ? T.danger : T.bonus, fontWeight: 800, fontSize: 15 }}>
                  {h.type === "spent" ? "−" : "+"}{formatSum(Math.abs(h.amount))}
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "info" && (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: t.name, val: user?.name },
            { label: t.phone, val: user?.phone },
            { label: t.registrationDate, val: user?.registrationDate },
          ].map(row => (
            <div key={row.label} style={{ ...glass({ borderRadius: 16, padding: "14px 16px" }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: T.textSecond, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>{row.val || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MY ORDERS SCREEN ──────────────────────────────────────────────────────────
function MyOrdersScreen({ orders }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];

  if (!orders || orders.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, padding: 32 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(200,150,62,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {React.cloneElement(IC.orders, { style: { width: 36, height: 36, color: T.accent } })}
        </div>
        <div style={{ color: T.textSecond, fontSize: 17, fontWeight: 600 }}>{t.noOrders}</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ padding: "20px 16px 8px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.myOrders}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {orders.slice().reverse().map(order => (
          <div key={order.id} style={{ ...glass({ borderRadius: 20, padding: "18px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: 11, letterSpacing: 0.5 }}>#{order.id}</div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{formatSum(order.total)}</div>
              </div>
              <StatusChip status={order.status} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(order.items || []).map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: T.textSecond, fontSize: 12 }}>{item.name} × {item.qty}</span>
                  <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{formatSum(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            {order.address && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11 }}>{t.address}: {order.address}</div>
            )}
            <div style={{ marginTop: 8, color: T.textMuted, fontSize: 10 }}>{order.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── ADMIN ORDERS SCREEN ───────────────────────────────────────────────────────
function AdminOrdersScreen({ allOrders, onStatusChange, onSendWhatsApp }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [statusMap, setStatusMap] = React.useState({});
  const [expandedId, setExpandedId] = React.useState(null);

  const orders = allOrders.map(o => ({ ...o, status: statusMap[o.id] || o.status }));
  const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
  const statusOptions = ["all", "new", "confirmed", "preparing", "delivering", "delivered", "cancelled"];

  const handleStatus = (orderId, newStatus) => {
    setStatusMap(prev => ({ ...prev, [orderId]: newStatus }));
    if (onStatusChange) onStatusChange(orderId, newStatus);
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 12px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.orders}</div>

      {/* Filter */}
      <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${filterStatus === s ? T.accent : T.border}`, background: filterStatus === s ? T.accentLight : "rgba(255,255,255,0.04)", color: filterStatus === s ? T.accent : T.textSecond, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {s === "all" ? t.allOrders : t["status_" + s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && (
          <div style={{ color: T.textMuted, textAlign: "center", padding: 40 }}>{t.noOrders}</div>
        )}
        {filtered.slice().reverse().map(order => (
          <div key={order.id} style={{ ...glass({ borderRadius: 20, padding: "18px" }) }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }} onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: T.textMuted, fontSize: 11 }}>#{order.id}</span>
                  <StatusChip status={order.status} />
                </div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{formatSum(order.total)}</div>
                <div style={{ color: T.textSecond, fontSize: 12, marginTop: 2 }}>{order.clientName} · {order.clientPhone}</div>
              </div>
              <div style={{ color: T.textMuted, fontSize: 18 }}>{expandedId === order.id ? "▲" : "▼"}</div>
            </div>

            {expandedId === order.id && (
              <div>
                <div style={{ height: 1, background: T.border, margin: "0 0 14px" }} />
                {/* Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} × {item.qty}</span>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{formatSum(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                {/* Details */}
                {[
                  order.address && { k: t.address, v: order.address },
                  order.deliveryType && { k: t.deliveryType, v: order.deliveryType === "pickup" ? t.pickup : t.delivery },
                  order.payMethod && { k: t.paymentMethod, v: order.payMethod },
                  order.comment && { k: t.comment, v: order.comment },
                  order.date && { k: t.date, v: order.date },
                  order.bonusDiscount && { k: t.bonusDiscount, v: "−" + formatSum(order.bonusDiscount) },
                ].filter(Boolean).map(row => (
                  <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: T.textMuted, fontSize: 12 }}>{row.k}</span>
                    <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{row.v}</span>
                  </div>
                ))}
                {/* Status Change */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: T.textSecond, fontSize: 11, marginBottom: 8, fontWeight: 600 }}>{t.changeStatus}:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["confirmed", "preparing", "delivering", "delivered", "cancelled"].map(s => (
                      <button key={s} onClick={() => handleStatus(order.id, s)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${order.status === s ? T.accent : T.border}`, background: order.status === s ? T.accentLight : "rgba(255,255,255,0.04)", color: order.status === s ? T.accent : T.textSecond, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {t["status_" + s] || s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* WhatsApp Button */}
                {order.clientPhone && onSendWhatsApp && (
                  <button onClick={() => onSendWhatsApp(order)} style={{ ...btnGlass({ borderRadius: 12, marginTop: 14, color: "#25D366", borderColor: "rgba(37,211,102,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }) }}>
                    {React.cloneElement(IC.chat, { style: { width: 16, height: 16 } })}
                    {t.sendWhatsApp}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── ADMIN PRODUCTS SCREEN ─────────────────────────────────────────────────────
function AdminProductsScreen({ products, setProducts }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState("");

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const newProduct = () => {
    const np = {
      id: Date.now(), name: "", brand: "", category: "perfumes",
      emoji: "", img: "", desc: "",
      variants: [{ id: Date.now(), label: "50ml", price: 0, inStock: true }]
    };
    setProducts(prev => [...prev, np]);
    setEditing(np.id);
  };

  const updateProduct = (id, field, val) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const deleteProduct = (id) => {
    if (window.confirm(t.confirmDelete)) {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (editing === id) setEditing(null);
    }
  };

  const addVariant = (prodId) => {
    setProducts(prev => prev.map(p =>
      p.id === prodId
        ? { ...p, variants: [...p.variants, { id: Date.now(), label: "", price: 0, inStock: true }] }
        : p
    ));
  };

  const updateVariant = (prodId, varId, field, val) => {
    setProducts(prev => prev.map(p =>
      p.id === prodId
        ? { ...p, variants: p.variants.map(v => v.id === varId ? { ...v, [field]: val } : v) }
        : p
    ));
  };

  const removeVariant = (prodId, varId) => {
    setProducts(prev => prev.map(p =>
      p.id === prodId ? { ...p, variants: p.variants.filter(v => v.id !== varId) } : p
    ));
  };

  const editingProd = products.find(p => p.id === editing);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.products}</div>
        <button onClick={newProduct} style={{ ...btnPrimary({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <input style={glassInput} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {editingProd && (
        <div style={{ margin: "0 16px 20px", ...glass({ borderRadius: 22, padding: "20px" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 16 }}>{editingProd.name || t.newProduct}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 20 }}>×</button>
          </div>
          <ImageUpload value={editingProd.img} onChange={v => updateProduct(editingProd.id, "img", v)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input style={glassInput} placeholder={t.productName} value={editingProd.name} onChange={e => updateProduct(editingProd.id, "name", e.target.value)} />
            <input style={glassInput} placeholder={t.brand} value={editingProd.brand} onChange={e => updateProduct(editingProd.id, "brand", e.target.value)} />
            <select style={{ ...glassInput, appearance: "none" }} value={editingProd.category} onChange={e => updateProduct(editingProd.id, "category", e.target.value)}>
              {["perfumes", "body", "hair", "face", "sets"].map(c => (
                <option key={c} value={c} style={{ background: "#1a1a2e" }}>{t["cat_" + c] || c}</option>
              ))}
            </select>
            <textarea style={{ ...glassInput, minHeight: 60, resize: "vertical" }} placeholder={t.description} value={editingProd.desc} onChange={e => updateProduct(editingProd.id, "desc", e.target.value)} />
          </div>
          {/* Variants */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: T.textSecond, fontWeight: 700, fontSize: 13 }}>{t.variants}</div>
              <button onClick={() => addVariant(editingProd.id)} style={{ background: T.accentLight, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "4px 12px", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ {t.addVariant}</button>
            </div>
            {editingProd.variants.map(v => (
              <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input style={{ ...glassInput, flex: 2, marginBottom: 0 }} placeholder={t.variantLabel} value={v.label} onChange={e => updateVariant(editingProd.id, v.id, "label", e.target.value)} />
                <input style={{ ...glassInput, flex: 2, marginBottom: 0 }} type="number" placeholder={t.price} value={v.price} onChange={e => updateVariant(editingProd.id, v.id, "price", Number(e.target.value))} />
                <button onClick={() => updateVariant(editingProd.id, v.id, "inStock", !v.inStock)} style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${v.inStock ? T.success : T.border}`, background: v.inStock ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.04)", color: v.inStock ? T.success : T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  {v.inStock ? t.inStock : t.outOfStock}
                </button>
                <button onClick={() => removeVariant(editingProd.id, v.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditing(null)} style={{ ...btnPrimary({ flex: 1, padding: "13px 0", borderRadius: 14 }) }}>{t.save}</button>
            <button onClick={() => deleteProduct(editingProd.id)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1px solid ${T.danger}`, background: "rgba(255,69,58,0.1)", color: T.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t.delete}</button>
          </div>
        </div>
      )}

      {/* Products List */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...glass({ borderRadius: 18, padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setEditing(editing === p.id ? null : p.id)}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: "rgba(200,150,62,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {p.img ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>{p.emoji}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{p.brand}</div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{p.name || t.newProduct}</div>
              <div style={{ color: T.textSecond, fontSize: 11 }}>{p.variants.length} {t.variants} · {p.variants.filter(v => v.inStock).length} {t.inStock}</div>
            </div>
            <div style={{ color: T.textMuted, fontSize: 18 }}>{editing === p.id ? "▲" : "▼"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN STATS SCREEN ────────────────────────────────────────────────────────
function AdminStatsScreen({ orders, products }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];

  const delivered = orders.filter(o => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = delivered.length ? Math.round(totalRevenue / delivered.length) : 0;
  const totalOrders = orders.length;
  const newOrders = orders.filter(o => o.status === "new").length;

  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  const topProducts = {};
  orders.forEach(o => (o.items || []).forEach(item => {
    topProducts[item.name] = (topProducts[item.name] || 0) + item.qty;
  }));
  const topList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const statCards = [
    { label: t.totalRevenue, val: formatSum(totalRevenue), color: T.accent, icon: IC.star },
    { label: t.totalOrders, val: totalOrders, color: T.success, icon: IC.orders },
    { label: t.newOrders, val: newOrders, color: T.bonus, icon: IC.bell },
    { label: t.avgOrder, val: formatSum(avgOrder), color: T.referral, icon: IC.chart },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.stats}</div>

      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ ...glass({ borderRadius: 20, padding: "18px 16px" }) }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: `${card.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {React.cloneElement(card.icon, { style: { width: 18, height: 18, color: card.color } })}
            </div>
            <div style={{ color: card.color, fontSize: 20, fontWeight: 900 }}>{card.val}</div>
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Status Distribution */}
      <div style={{ margin: "0 16px 16px", ...glass({ borderRadius: 20, padding: "18px" }) }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.ordersByStatus}</div>
        {Object.entries(statusCounts).map(([s, cnt]) => {
          const pct = totalOrders ? Math.round(cnt / totalOrders * 100) : 0;
          return (
            <div key={s} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: T.textSecond, fontSize: 12 }}>{t["status_" + s] || s}</span>
                <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{cnt} ({pct}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: T.accentGrad, transition: "width 0.5s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Products */}
      {topList.length > 0 && (
        <div style={{ margin: "0 16px", ...glass({ borderRadius: 20, padding: "18px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.topProducts}</div>
          {topList.map(([name, qty], idx) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: idx === 0 ? T.accentGrad : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: idx === 0 ? "#000" : T.textMuted, fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{idx + 1}</div>
              <div style={{ flex: 1, color: T.text, fontSize: 13 }}>{name}</div>
              <div style={{ color: T.accent, fontWeight: 700, fontSize: 13 }}>{qty} {t.pcs}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── ADMIN BANNERS SCREEN ──────────────────────────────────────────────────────
function AdminBannersScreen({ banners, setBanners }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [editing, setEditing] = React.useState(null);

  const addBanner = () => {
    const nb = { id: Date.now(), title: "", subtitle: "", img: "", bg: BG_PRESETS[0], active: true };
    setBanners(prev => [...prev, nb]);
    setEditing(nb.id);
  };

  const updateBanner = (id, field, val) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  };

  const deleteBanner = (id) => {
    setBanners(prev => prev.filter(b => b.id !== id));
    if (editing === id) setEditing(null);
  };

  const editBanner = banners.find(b => b.id === editing);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{t.banners}</div>
        <button onClick={addBanner} style={{ ...btnPrimary({ width: "auto", padding: "10px 18px", borderRadius: 14, fontSize: 13 }) }}>+ {t.add}</button>
      </div>

      {editBanner && (
        <div style={{ margin: "0 16px 20px", ...glass({ borderRadius: 22, padding: "20px" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>{t.editBanner}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
          <ImageUpload value={editBanner.img} onChange={v => updateBanner(editBanner.id, "img", v)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input style={glassInput} placeholder={t.bannerTitle} value={editBanner.title} onChange={e => updateBanner(editBanner.id, "title", e.target.value)} />
            <input style={glassInput} placeholder={t.bannerSubtitle} value={editBanner.subtitle} onChange={e => updateBanner(editBanner.id, "subtitle", e.target.value)} />
          </div>
          {/* BG Presets */}
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8 }}>{t.background}:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BG_PRESETS.map(bg => (
                <div key={bg} onClick={() => updateBanner(editBanner.id, "bg", bg)} style={{ width: 36, height: 36, borderRadius: 10, background: bg, cursor: "pointer", border: `2px solid ${editBanner.bg === bg ? T.accent : "transparent"}`, boxShadow: editBanner.bg === bg ? `0 0 0 1px ${T.accent}` : "none" }} />
              ))}
            </div>
          </div>
          {/* Active Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ color: T.textSecond, fontSize: 14 }}>{t.active}</div>
            <div onClick={() => updateBanner(editBanner.id, "active", !editBanner.active)} style={{ width: 48, height: 28, borderRadius: 14, background: editBanner.active ? T.accent : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: editBanner.active ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditing(null)} style={{ ...btnPrimary({ flex: 1, padding: "13px 0", borderRadius: 14 }) }}>{t.save}</button>
            <button onClick={() => deleteBanner(editBanner.id)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1px solid ${T.danger}`, background: "rgba(255,69,58,0.1)", color: T.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t.delete}</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {banners.map(b => (
          <div key={b.id} style={{ ...glass({ borderRadius: 18, padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setEditing(editing === b.id ? null : b.id)}>
            <div style={{ width: 56, height: 40, borderRadius: 10, background: b.img ? "transparent" : b.bg, overflow: "hidden", flexShrink: 0 }}>
              {b.img && <img src={b.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{b.title || t.noTitle}</div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{b.subtitle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.active ? T.success : T.textLight }} />
              <div style={{ color: T.textMuted, fontSize: 18 }}>{editing === b.id ? "▲" : "▼"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN BONUS SCREEN ────────────────────────────────────────────────────────
function AdminBonusScreen({ settings, setSettings }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [local, setLocal] = React.useState({ ...settings });

  const handleSave = () => setSettings(local);
  const upd = (field, val) => setLocal(prev => ({ ...prev, [field]: val }));

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.bonusSettings}</div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { field: "bonusPercent", label: t.bonusPercent, suffix: "%" },
          { field: "useBonusPercent", label: t.useBonusPercent, suffix: "%" },
          { field: "welcomeBonus", label: t.welcomeBonus, suffix: t.sum },
          { field: "referralBonus", label: t.referralBonus, suffix: t.sum },
          { field: "referralFriendBonus", label: t.referralFriendBonus, suffix: t.sum },
          { field: "deliveryCost", label: t.deliveryCost, suffix: t.sum },
          { field: "minOrderForFreeDelivery", label: t.minOrderForFreeDelivery, suffix: t.sum },
        ].map(row => (
          <div key={row.field} style={{ ...glass({ borderRadius: 18, padding: "16px" }) }}>
            <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{row.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                style={{ ...glassInput, marginBottom: 0, flex: 1 }}
                value={local[row.field] || 0}
                onChange={e => upd(row.field, Number(e.target.value))}
              />
              <span style={{ color: T.textMuted, fontSize: 14, fontWeight: 600 }}>{row.suffix}</span>
            </div>
          </div>
        ))}

        {/* Welcome Bonus Toggle */}
        <div style={{ ...glass({ borderRadius: 18, padding: "16px" }), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: T.textSecond, fontSize: 13, fontWeight: 600 }}>{t.welcomeBonusEnabled}</div>
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{t.welcomeBonusOnlyFirst}</div>
          </div>
          <div onClick={() => upd("welcomeBonusEnabled", !local.welcomeBonusEnabled)} style={{ width: 48, height: 28, borderRadius: 14, background: local.welcomeBonusEnabled ? T.bonus : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: local.welcomeBonusEnabled ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>

        <button onClick={handleSave} style={{ ...btnPrimary({ padding: "16px 0", borderRadius: 16, fontSize: 16 }) }}>{t.saveSettings}</button>
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS SCREEN ─────────────────────────────────────────────────────
function AdminSettingsScreen({ settings, setSettings, onLogout }) {
  const { lang } = React.useContext(LangContext);
  const t = TRANSLATIONS[lang];
  const [local, setLocal] = React.useState({ ...settings });
  const upd = (f, v) => setLocal(prev => ({ ...prev, [f]: v }));

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "20px 16px 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t.settings}</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { field: "shopName", label: t.shopName, type: "text" },
          { field: "whatsappPhone", label: t.whatsappPhone, type: "tel" },
          { field: "greenApiInstance", label: "Green API Instance", type: "text" },
          { field: "greenApiToken", label: "Green API Token", type: "text" },
          { field: "adminPassword", label: t.adminPassword, type: "password" },
        ].map(row => (
          <div key={row.field} style={{ ...glass({ borderRadius: 16, padding: "14px 16px" }) }}>
            <div style={{ color: T.textSecond, fontSize: 11, marginBottom: 6 }}>{row.label}</div>
            <input type={row.type} style={{ ...glassInput, marginBottom: 0 }} value={local[row.field] || ""} onChange={e => upd(row.field, e.target.value)} />
          </div>
        ))}
        <button onClick={() => setSettings(local)} style={{ ...btnPrimary({ padding: "15px 0", borderRadius: 16 }) }}>{t.saveSettings}</button>
        <button onClick={onLogout} style={{ padding: "15px 0", borderRadius: 16, border: `1px solid ${T.danger}`, background: "rgba(255,69,58,0.1)", color: T.danger, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{t.logout}</button>
      </div>
    </div>
  );
}
// ─── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = React.useState("ru");
  const [screen, setScreen] = React.useState("catalog");
  const [adminScreen, setAdminScreen] = React.useState("orders");
  const [products, setProducts] = React.useState(INITIAL_PRODUCTS);
  const [banners, setBanners] = React.useState(DEFAULT_BANNERS);
  const [cart, setCart] = React.useState([]);
  const [orders, setOrders] = React.useState([]);
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [bonusBalance, setBonusBalance] = React.useState(0);
  const [bonusHistory, setBonusHistory] = React.useState([]);
  const [welcomeBonusUsed, setWelcomeBonusUsed] = React.useState(false);
  const [referralCode] = React.useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  const t = TRANSLATIONS[lang];
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = ({ phone, name, isAdminLogin, password }) => {
    if (isAdminLogin) {
      if (password === (settings.adminPassword || "admin123")) {
        setIsAdmin(true);
        setScreen("admin");
        showToast(t.welcomeAdmin);
      } else {
        showToast(t.wrongPassword, "error");
      }
      return;
    }
    const now = new Date().toLocaleDateString("ru-RU");
    setUser({ phone, name, registrationDate: now });
    // Welcome bonus
    if (settings.welcomeBonusEnabled && settings.welcomeBonus > 0 && !welcomeBonusUsed) {
      setBonusBalance(prev => prev + settings.welcomeBonus);
      setBonusHistory(prev => [...prev, { type: "welcome", amount: settings.welcomeBonus, label: t.welcomeBonus, date: now }]);
      showToast(`+${formatSum(settings.welcomeBonus)} ${t.bonusAccrued}`);
    }
    setScreen("catalog");
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    setScreen("login");
    setCart([]);
  };

  const addToCart = (productId, variantId) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === productId && i.variantId === variantId);
      if (exists) return prev.map(i => i.productId === productId && i.variantId === variantId ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId, variantId, qty: 1 }];
    });
    showToast(t.addedToCart);
  };

  const handleOrder = (orderData) => {
    const now = new Date().toLocaleString("ru-RU");
    const orderItems = cart.map(ci => {
      const prod = products.find(p => p.id === ci.productId);
      const variant = prod?.variants.find(v => v.id === ci.variantId);
      return { name: `${prod?.name} ${variant?.label}`, qty: ci.qty, price: variant?.price || 0 };
    });
    const newOrder = {
      id: Date.now().toString().slice(-6),
      clientName: user?.name || "",
      clientPhone: user?.phone || "",
      items: orderItems,
      date: now,
      status: "new",
      ...orderData,
    };
    setOrders(prev => [...prev, newOrder]);

    // Bonus accrual
    const earnPercent = settings.bonusPercent || 0;
    if (earnPercent > 0 && orderData.total > 0) {
      const earned = Math.floor(orderData.total * earnPercent / 100);
      if (earned > 0) {
        setBonusBalance(prev => prev - (orderData.bonusDiscount || 0) + earned);
        setBonusHistory(prev => [...prev,
        ...(orderData.bonusDiscount ? [{ type: "spent", amount: -orderData.bonusDiscount, label: t.bonusSpent, date: now }] : []),
        { type: "earned", amount: earned, label: t.bonusEarned, date: now }
        ]);
      }
    } else if (orderData.bonusDiscount) {
      setBonusBalance(prev => prev - orderData.bonusDiscount);
      setBonusHistory(prev => [...prev, { type: "spent", amount: -orderData.bonusDiscount, label: t.bonusSpent, date: now }]);
    }

    if (orderData.useBonus) setWelcomeBonusUsed(true);

    // WhatsApp notification
    const waMsg = `${t.newOrder} #${newOrder.id}\n${t.client}: ${newOrder.clientName} ${newOrder.clientPhone}\n${orderItems.map(i => `${i.name} × ${i.qty} = ${formatSum(i.price * i.qty)}`).join("\n")}\n${t.total}: ${formatSum(orderData.total)}\n${orderData.address ? `${t.address}: ${orderData.address}` : t.pickup}`;
    if (settings.whatsappPhone && GREEN_API.instanceId && GREEN_API.token) {
      fetch(`https://api.green-api.com/waInstance${GREEN_API.instanceId}/sendMessage/${GREEN_API.token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: `${settings.whatsappPhone.replace(/\D/g, "")}@c.us`, message: waMsg })
      }).catch(() => { });
    }

    setCart([]);
    setScreen("myorders");
    showToast(t.orderPlaced);
  };

  const handleSendWhatsApp = (order) => {
    const msg = `${t.orderStatusUpdated}: #${order.id} — ${t["status_" + order.status] || order.status}`;
    const phone = order.clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode).then(() => showToast(t.copied));
  };

  const handlePaymentDeeplink = (method) => {
    if (method === "mbank") window.open("mbank://", "_blank");
    if (method === "obank") window.open("obank://", "_blank");
  };

  // Nav items
  const NAV_ITEMS = [
    { id: "catalog", icon: IC.home, label: t.catalog },
    { id: "cart", icon: IC.cart, label: t.cart, badge: cartCount },
    { id: "myorders", icon: IC.orders, label: t.myOrders },
    { id: "profile", icon: IC.user, label: t.profile },
  ];
  const ADMIN_NAV = [
    { id: "orders", icon: IC.orders, label: t.orders },
    { id: "products", icon: IC.star, label: t.products },
    { id: "stats", icon: IC.chart, label: t.stats },
    { id: "banners", icon: IC.image, label: t.banners },
    { id: "bonus", icon: IC.gift, label: t.bonus },
    { id: "settings", icon: IC.settings, label: t.settings },
  ];

  if (!user && !isAdmin) {
    return (
      <LangContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
        <div style={{ minHeight: "100vh", background: T.bgGrad, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>
          <Toast toast={toast} />
          <LoginScreen onLogin={handleLogin} />
        </div>
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
      <div style={{ minHeight: "100vh", background: T.bgGrad, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", maxWidth: 480, margin: "0 auto", position: "relative" }}>
        <Toast toast={toast} />

        {/* Main Screens */}
        <div style={{ paddingBottom: 80 }}>
          {isAdmin ? (
            <>
              {/* Admin Header */}
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, letterSpacing: 1, textTransform: "uppercase" }}>{t.adminPanel}</div>
                <LangToggle />
              </div>
              {adminScreen === "orders" && <AdminOrdersScreen allOrders={orders} onStatusChange={(id, st) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status: st } : o))} onSendWhatsApp={handleSendWhatsApp} />}
              {adminScreen === "products" && <AdminProductsScreen products={products} setProducts={setProducts} />}
              {adminScreen === "stats" && <AdminStatsScreen orders={orders} products={products} />}
              {adminScreen === "banners" && <AdminBannersScreen banners={banners} setBanners={setBanners} />}
              {adminScreen === "bonus" && <AdminBonusScreen settings={settings} setSettings={setSettings} />}
              {adminScreen === "settings" && <AdminSettingsScreen settings={settings} setSettings={setSettings} onLogout={handleLogout} />}
            </>
          ) : (
            <>
              {/* User Header */}
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, background: T.accentGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{settings.shopName || "ParfumShop"}</div>
                <LangToggle />
              </div>
              {screen === "catalog" && <CatalogScreen products={products} addToCart={addToCart} banners={banners.filter(b => b.active)} showToast={showToast} />}
              {screen === "cart" && <CartScreen cart={cart} setCart={setCart} products={products} onOrder={handleOrder} bonusBalance={bonusBalance} useBonusPercent={settings.useBonusPercent || 30} settings={settings} />}
              {screen === "myorders" && <MyOrdersScreen orders={orders.filter(o => o.clientPhone === user?.phone)} />}
              {screen === "profile" && <ProfileScreen user={user} onLogout={handleLogout} bonusBalance={bonusBalance} bonusHistory={bonusHistory} referralCode={referralCode} settings={settings} onCopyReferral={handleCopyReferral} />}
            </>
          )}
        </div>

        {/* Bottom Nav */}
        <NavBar
          items={isAdmin ? ADMIN_NAV : NAV_ITEMS}
          active={isAdmin ? adminScreen : screen}
          onSelect={isAdmin ? setAdminScreen : setScreen}
        />
      </div>
    </LangContext.Provider>
  );
}