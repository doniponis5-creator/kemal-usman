// Production i18n setup using i18next + react-i18next.
// To install: npm i i18next react-i18next i18next-browser-languagedetector
//
// Usage in any component:
//   import { useTranslation } from 'react-i18next';
//   const { t, i18n } = useTranslation();
//   <span>{t('cart.title')}</span>
//   i18n.changeLanguage('kg');

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ru from './ru.json';
import kg from './kg.json';

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

// Backward-compat shim — old code does `t.cart`, `t.placeOrder`, etc.
// During the migration window we expose a flat object that re-resolves on
// language change. Remove this shim once every screen uses useTranslation.
export function buildLegacyShim(lng) {
  const dict = lng === 'kg' ? kg : ru;
  return {
    appName: dict.app.name, appSubtitle: dict.app.subtitle,
    login: dict.auth.login, logout: dict.auth.logout,
    catalog: dict.nav.catalog, cart: dict.nav.cart, myOrders: dict.nav.myOrders, profile: dict.nav.profile,
    orders: dict.nav.orders, products: dict.nav.products, stats: dict.nav.stats, settings: dict.nav.settings,
    banners: dict.nav.banners, bonus: dict.nav.bonus, adminPanel: dict.nav.adminPanel,
    search: dict.catalog.search, allCategories: dict.catalog.allCategories,
    fromPrice: dict.catalog.fromPrice, addToCart: dict.catalog.addToCart, addedToCart: dict.catalog.addedToCart,
    outOfStock: dict.catalog.outOfStock, chooseSize: dict.catalog.chooseSize,
    cartEmpty: dict.cart.empty, cartEmptyHint: dict.cart.emptyHint,
    subtotal: dict.cart.subtotal, delivery: dict.cart.delivery, total: dict.cart.total, free: dict.cart.free,
    placeOrder: dict.cart.placeOrder, deliveryType: dict.cart.deliveryType, pickup: dict.cart.pickup,
    paymentMethod: dict.cart.paymentMethod, useBonus: dict.cart.useBonus,
    maxDiscount: dict.cart.maxDiscount, bonusDiscount: dict.cart.bonusDiscount,
    orderPlaced: dict.cart.orderPlaced,
    name: dict.auth.name, phone: dict.auth.phone,
    bonusBalance: dict.profile.bonusBalance, bonusHistory: dict.profile.bonusHistory,
    bonusEarned: dict.profile.bonusEarned, bonusSpent: dict.profile.bonusSpent,
    earned: dict.profile.earned, spent: dict.profile.spent,
    noBonusHistory: dict.profile.noBonusHistory, noOrders: dict.orders.noOrders,
    accountInfo: dict.profile.accountInfo,
    referralCode: dict.profile.referralCode, referralHint: dict.profile.referralHint,
    copy: dict.profile.copy, copied: dict.profile.copied,
    registrationDate: dict.profile.registrationDate, guest: dict.profile.guest,
    totalRevenue: dict.stats.totalRevenue, totalOrders: dict.stats.totalOrders,
    newOrders: dict.stats.newOrders, ordersByStatus: dict.stats.ordersByStatus,
    topProducts: dict.stats.topProducts, pcs: dict.stats.pcs, allOrders: dict.orders.all,
    changeStatus: dict.orders.changeStatus, sendWhatsApp: dict.orders.sendWhatsApp,
    client: dict.orders.client, date: dict.orders.date,
    add: dict.admin.add, save: dict.admin.save, delete: dict.admin.delete,
    confirmDelete: dict.admin.confirmDelete, newProduct: dict.admin.newProduct,
    productName: dict.admin.productName, brand: dict.admin.brand, description: dict.admin.description,
    addVariant: dict.admin.addVariant, variantLabel: dict.admin.variantLabel, price: dict.admin.price,
    editBanner: dict.admin.editBanner, bannerTitle: dict.admin.bannerTitle,
    bannerSubtitle: dict.admin.bannerSubtitle, background: dict.admin.background,
    active: dict.admin.active, noTitle: dict.admin.noTitle,
    bonusSettings: dict.admin.bonusSettings, bonusPercent: dict.admin.bonusPercent,
    useBonusPercent: dict.admin.useBonusPercent, welcomeBonus: dict.admin.welcomeBonus,
    referralBonus: dict.admin.referralBonus, referralFriendBonus: dict.admin.referralFriendBonus,
    deliveryCost: dict.admin.deliveryCost, minOrderForFreeDelivery: dict.admin.minOrderForFreeDelivery,
    welcomeBonusEnabled: dict.admin.welcomeBonusEnabled,
    welcomeBonusOnlyFirst: dict.admin.welcomeBonusOnlyFirst, saveSettings: dict.admin.saveSettings,
    shopName: dict.admin.shopName, adminPassword: dict.admin.adminPassword,
    whatsappPhone: dict.admin.whatsappPhone, welcomeAdmin: dict.admin.welcomeAdmin,
    bonusAccrued: dict.common.bonusAccrued, wrongPassword: dict.auth.wrongPassword,
    fillAll: dict.auth.fillAll, sum: dict.common.sum, newStatus: dict.orders.status.new,
    status_new: dict.orders.status.new, status_confirmed: dict.orders.status.confirmed,
    status_preparing: dict.orders.status.preparing, status_delivering: dict.orders.status.delivering,
    status_delivered: dict.orders.status.delivered, status_cancelled: dict.orders.status.cancelled,
    todayOrders: dict.stats.todayOrders, todayRevenue: dict.stats.todayRevenue,
    last7days: dict.stats.last7days, recentUsers: dict.stats.recentUsers,
    visits: dict.stats.visits, registeredCount: dict.stats.registeredCount,
    deleteOrder: dict.orders.deleteOrder, confirmDeleteOrder: dict.orders.confirmDeleteOrder,
    listenAroma: dict.audio.listenAroma, aromaDesc: dict.audio.aromaDesc,
    listenBtn: dict.audio.listenBtn, playingAroma: dict.audio.playingAroma,
    pausedAroma: dict.audio.pausedAroma, tapToContinue: dict.audio.tapToContinue,
    continueBtn: dict.audio.continueBtn,
    chooseSize2: dict.catalog.chooseSize, variants: dict.catalog.variants,
  };
}

export default i18n;
