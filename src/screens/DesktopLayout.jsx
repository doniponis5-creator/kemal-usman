// src/screens/DesktopLayout.jsx — desktop rejimi (P2.1b refactor).
// App.jsx'dan SOF MEXANIK ko'chirildi — logika o'zgarmagan.
// React.lazy: mobil foydalanuvchilar bu 2,575 qatorni umuman yuklamaydi.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioPlayerOverlay from "../components/AudioPlayerOverlay";
import { CashLogo } from "../components/BankLogos";
import { api } from "../api/backend.js";
import { fileUrl } from "../api/pb";
import { IC } from "../icons.jsx";
import { pickName, pickDesc } from "../utils/format.js";
import {
  ClientAudioBtn, DescRenderer, MyOrdersScreen, SaleCountdownBadge,
  StoryViewer, getSaleInfo, salePrice, smartSearch,
} from "../App.jsx";

export function DesktopLayout({
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
  setScreen, screen,
}) {
  const [desktopSearch, setDesktopSearch] = useState('');
  const [desktopCategory, setDesktopCategory] = useState('all');
  const [desktopSort, setDesktopSort] = useState('default');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(null); // group index or null
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
  const [showPayQr, setShowPayQr] = useState(false);
  const [useBonus, setUseBonus] = useState(false);
  const [modalVariantId, setModalVariantId] = useState(null);
  const [modalImgIndex, setModalImgIndex] = useState(0);

  const minPrice = (p) => {
    const prices = (p.variants || []).filter(v => v.inStock).map(v => v.price || 0).filter(Boolean);
    return prices.length ? Math.min(...prices) : 0;
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, ci) => {
    const prod = products.find(p => String(p.id) === String(ci.productId));
    const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
    const basePrice = variant?.price || 0;
    const si = getSaleInfo(prod);
    const finalPrice = si ? salePrice(basePrice, si.percent) : basePrice;
    return s + finalPrice * ci.qty;
  }, 0);

  const announcements = settings?.announcementTexts?.split('\n').filter(Boolean) || [
    'Бесплатная доставка по Бишкеку от 1 000 сом',
    'Скидка 15% на Премиум коллекцию',
    'Новые ароматы каждую неделю',
  ];

  const heroButtonText = settings?.heroButtonText || 'ВЫБРАТЬ АРОМАТ';

  const gridColumns = windowWidth >= 1600 ? 'repeat(5, 1fr)' : windowWidth >= 1200 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';

  const filteredProducts = products
    .filter(p => { const vars = p.variants || []; return vars.some(v => v.inStock); })
    .filter(p => desktopCategory === 'all' || (p.category || '').trim() === desktopCategory)
    .filter(p => {
      if (!desktopSearch) return true;
      const q = desktopSearch.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) ||
        (p.name_kg || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.shortDesc || '').toLowerCase().includes(q) ||
        (p.tags || '').toLowerCase().includes(q) ||
        (p.desc || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (desktopSort === 'price_asc') return minPrice(a) - minPrice(b);
      if (desktopSort === 'price_desc') return minPrice(b) - minPrice(a);
      if (desktopSort === 'name') return (a.name || '').localeCompare(b.name || '');
      // Default: featured first, then by priority
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return (b.priority || 0) - (a.priority || 0);
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
    { id: 'Женские',  label: 'Женские' },
    { id: 'Мужские',  label: 'Мужские' },
    { id: 'Унисекс',  label: 'Унисекс' },
    { id: 'Премиум',  label: 'Премиум' },
  ];

  const CAT_TABS = [
    { id: 'all', label: 'Все' },
    { id: 'Женские', label: 'Женские' },
    { id: 'Мужские', label: 'Мужские' },
    { id: 'Унисекс', label: 'Унисекс' },
    { id: 'Премиум', label: 'Премиум' },
  ];

  const currentBanner = activeHeroBanners[heroBannerIndex];

  // ── Story groups — auto-generated from visible (in-stock) products ──
  const storyGroups = React.useMemo(() => {
    // Only show in-stock products in story groups
    const visProducts = products.filter(p => (p.variants || []).some(v => v.inStock));
    const groups = [];
    // 1. Новинки — last 14 days
    const newItems = visProducts.filter(p => {
      if (!p.created) return false;
      return (Date.now() - new Date(p.created).getTime()) < 14 * 24 * 60 * 60 * 1000;
    });
    if (newItems.length > 0) groups.push({ label: lang === 'kg' ? 'Жаңылыктар' : 'Новинки', icon: '✨', items: newItems.slice(0, 8) });

    // 2. Хиты — most ordered
    const orderCounts = {};
    (orders || []).filter(o => o.status === 'delivered').forEach(o => {
      (o.items || []).forEach(ci => { orderCounts[ci.productId] = (orderCounts[ci.productId] || 0) + ci.qty; });
    });
    const topIds = Object.entries(orderCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
    const topProducts = topIds.map(id => visProducts.find(p => String(p.id) === String(id))).filter(Boolean);
    if (topProducts.length >= 2) {
      groups.push({ label: lang === 'kg' ? 'Хиттер' : 'Хиты', icon: '🔥', items: topProducts });
    }

    // 3. Акции — on sale
    const saleItems = visProducts.filter(p => { const s = getSaleInfo(p); return s && s.active; });
    if (saleItems.length > 0) groups.push({ label: lang === 'kg' ? 'Акциялар' : 'Акции', icon: '🎁', items: saleItems.slice(0, 8) });

    // 4. Premium
    const premiumItems = visProducts.filter(p => p.category === 'premium');
    if (premiumItems.length > 0) groups.push({ label: 'Premium', icon: '💎', items: premiumItems.slice(0, 8) });

    // 5. Женские
    const femaleItems = visProducts.filter(p => p.category === 'female');
    if (femaleItems.length >= 3) groups.push({ label: lang === 'kg' ? 'Аялдар' : 'Женские', icon: '🌸', items: femaleItems.slice(0, 8) });

    // 6. Мужские
    const maleItems = visProducts.filter(p => p.category === 'male');
    if (maleItems.length >= 3) groups.push({ label: lang === 'kg' ? 'Эркектер' : 'Мужские', icon: '🖤', items: maleItems.slice(0, 8) });

    // If no groups, show random products
    if (groups.length === 0 && visProducts.length > 0) {
      groups.push({ label: lang === 'kg' ? 'Каталог' : 'Каталог', icon: '🛍️', items: visProducts.slice(0, 8) });
    }

    return groups;
  }, [products, orders, lang]);

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
        <div style={{ position: 'relative', aspectRatio: '1 / 1.15', overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          {(product.img || product.images?.[0]) ? (
            <motion.img
              src={product.img || product.images[0]}
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
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
          {/* ── Stacked SVG badges (top-left) ── */}
          {!allOutOfStock && !_saleInfo && (() => {
            const badges = [];
            if (product.category === 'premium') badges.push({ icon: IC.crown(10, "#fff"), text: "Premium", bg: "rgba(17,17,17,0.85)" });
            if (product?.isPopular) badges.push({ icon: IC.flame(10, "#fff"), text: t.badge_popular, bg: "linear-gradient(135deg, #FF6A00, #FF3B30)" });
            if (product?.isHit) badges.push({ icon: IC.bolt(10, "#fff"), text: t.badge_hit, bg: "linear-gradient(135deg, #FF9500, #FF6B00)" });
            if (product?.isNew || _isNew) badges.push({ icon: IC.sparkle(10, "#fff"), text: t.badge_new, bg: "linear-gradient(135deg, #34C759, #30D158)" });
            return badges.slice(0, 2).map((b, bi) => (
              <motion.div key={bi}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + bi * 0.06, duration: 0.35 }}
                style={{
                  position: "absolute", top: 10 + bi * 28, left: 10,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: b.bg, color: "#fff", borderRadius: 20,
                  padding: "5px 10px 5px 7px", fontSize: 8, fontWeight: 700,
                  letterSpacing: 0.8, textTransform: "uppercase",
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  zIndex: 5,
                }}>
                <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{b.icon}</span>
                <span>{b.text}</span>
              </motion.div>
            ));
          })()}
          {allOutOfStock && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(180,0,0,0.8)',
              backdropFilter: 'blur(8px)', color: '#fff', fontSize: 8, fontWeight: 600,
              letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px',
              borderRadius: 20, zIndex: 5 }}>
              {t.outOfStock}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa', fontWeight: 500, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {product.brand}
            </div>
            {product?.isAuthor && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#111", color: "#fff", borderRadius: 6,
                padding: "3px 8px 3px 5px", fontSize: 8.5, fontWeight: 700,
                letterSpacing: 0.6, lineHeight: 1, textTransform: "uppercase",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)", flexShrink: 0,
              }}>
                <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{IC.crown(10, "#FFD700")}</span>
                {t.badge_author}
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 3, lineHeight: 1.3,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12, lineHeight: 1.5, height: 33,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {(() => { const d = pickDesc(product, lang); const lines = d.split('\n').filter(l => l.trim() && !l.trim().startsWith('🔝') && !l.trim().startsWith('💎') && !l.trim().startsWith('🌿') && !l.trim().startsWith('📋')); return lines.join(' ').trim() || d; })()}
          </div>
          {/* SaleProgressBar removed — progress bar is now inside SaleCountdownBadge (Variant C) */}
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

      {/* ── DESKTOP MY ORDERS OVERLAY ── */}
      {screen === 'myorders' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setScreen('catalog'); }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '90%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '20px 20px 0 0', zIndex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{lang === 'kg' ? 'Менин заказтарым' : 'Мои заказы'}</div>
              <div onClick={() => setScreen('catalog')} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 10, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div style={{ padding: '0 4px 20px' }}>
              <MyOrdersScreen orders={orders} goToCatalog={() => setScreen('catalog')} reviews={reviews} user={user} showToast={showToast} />
            </div>
          </div>
        </div>
      )}

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
                    style={{ position: 'absolute', top: '100%', right: 0, width: 280,
                      background: '#fff', border: '1px solid #E5E5E5', borderRadius: 16, zIndex: 1001, marginTop: 8,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}
                  >
                    {user ? (
                      <>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: '#BBB' }}>{user.phone}</div>
                        </div>
                        {[
                          { label: 'Мои заказы', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#555" strokeWidth="1.4"/><path d="M8 10h8M8 14h5" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/></svg>, action: () => { setScreen('myorders'); setUserMenuOpen(false); } },
                          { label: `Бонусы: ${bonusBalance} сом`, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#C9A84C" strokeWidth="1.4"/></svg> },
                          ...(referralCode ? [{ label: `Реф. код: ${referralCode}`, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#7C5CBF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#7C5CBF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { navigator.clipboard.writeText(referralCode).then(() => { showToast('Код скопирован!'); }); } }] : []),
                          { label: 'Выйти', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { onLogout(); setUserMenuOpen(false); } },
                        ].map((item, i, arr) => (
                          <div key={i} onClick={item.action || (() => setUserMenuOpen(false))}
                            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                              fontSize: 13, color: '#555', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid #F5F5F5' : 'none' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {item.icon} {item.label}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ padding: '24px 20px', minWidth: 240 }}>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F5F5F5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="#999" strokeWidth="1.5"/></svg>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: -0.2 }}>Войти в аккаунт</div>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Бонусы, история заказов и кэшбэк</div>
                        </div>
                        <div onClick={() => { setUserMenuOpen(false); setGuestMode(false); }}
                          style={{ width: '100%', background: '#111', color: '#fff', padding: '12px 0',
                            textAlign: 'center', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
                            cursor: 'pointer', marginBottom: 8, borderRadius: 12, fontWeight: 700 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#333'}
                          onMouseLeave={e => e.currentTarget.style.background = '#111'}>
                          Войти
                        </div>
                        <div onClick={() => { setGuestMode(true); setUserMenuOpen(false); }}
                          style={{ width: '100%', textAlign: 'center', fontSize: 13, color: '#888', cursor: 'pointer',
                            letterSpacing: 1, padding: '12px 0', border: '1.5px solid #E5E5E5', borderRadius: 12,
                            fontWeight: 700, textTransform: 'uppercase' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#CCC'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E5E5'}>
                          Гость
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
            {/* WhatsApp — edge right */}
            <a href={`https://wa.me/${(settings?.whatsappPhone || '996551120009').replace(/[^0-9]/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 14px 6px 10px',
                background: '#25D366', borderRadius: 20,
                textDecoration: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1EBE5A'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.29-1.24l-.28-.168-2.9.76.78-2.84-.18-.29A8 8 0 1112 20z"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', letterSpacing: 0.3 }}>
                {lang === 'kg' ? 'Жазыңыз' : 'Написать нам'}
              </span>
            </a>
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
                    ) : settings?.shopName ? (
                      <>{settings.shopName.split(' ')[0]}<br /><strong style={{ fontWeight: 800 }}>{settings.shopName.split(' ').slice(1).join(' ')}</strong></>
                    ) : null}
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'transparent', color: '#fff',
                      fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500,
                      padding: '6px 2px', cursor: 'pointer', borderRadius: 0,
                      boxShadow: 'none', transition: 'all 0.35s ease',
                      border: 'none', borderBottom: '1.5px solid rgba(255,255,255,0.8)',
                      backdropFilter: 'none' }}
                  >
                    {currentBanner?.btnText || heroButtonText}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{marginLeft: 2}}><path d="M7 17L17 7M17 7H7M17 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

          {/* Center — story group circles + subscribe button */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
            {/* Stories circles — Instagram style (Variant A) */}
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {storyGroups.slice(0, 6).map((g, i) => {
                const coverImg = g.items[0]?.img || g.items[0]?.images?.[0] || '';
                const itemCount = g.items.length;
                return (
                  <motion.div
                    key={`sg-${i}`}
                    whileHover={{ scale: 1.08, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={(e) => { e.stopPropagation(); setStoryViewerOpen(i); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    {/* Gradient ring with pulse animation */}
                    <div style={{
                      width: 68, height: 68, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FFDC80, #F77737, #F56040, #C13584, #833AB4)',
                      padding: 2.5, flexShrink: 0, position: 'relative',
                      animation: 'storyRingPulse 3s ease-in-out infinite',
                    }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #fff', background: '#eee' }}>
                        {coverImg ? (
                          <img src={coverImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 22 }}>{g.icon}</span>
                          </div>
                        )}
                      </div>
                      {/* Item count badge */}
                      {itemCount > 1 && (
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2,
                          minWidth: 18, height: 18, borderRadius: 9,
                          background: '#0095F6', color: '#fff',
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2px solid #fff', padding: '0 4px',
                          boxShadow: '0 2px 6px rgba(0,149,246,0.4)',
                        }}>
                          {itemCount}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.55)', fontWeight: 600, maxWidth: 70, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.2 }}>
                      {g.label}
                    </span>
                  </motion.div>
                );
              })}
              {/* "+N Ещё" button if more than 6 groups */}
              {storyGroups.length > 6 && (
                <motion.div
                  whileHover={{ scale: 1.08, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  onClick={(e) => { e.stopPropagation(); setStoryViewerOpen(6); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 68, height: 68, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.12))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>+{storyGroups.length - 6}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.55)', fontWeight: 600, letterSpacing: 0.2 }}>
                    {lang === 'kg' ? 'Дагы' : 'Ещё'}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Hint text — directs users to tap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -8 }}
            >
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.28)', fontWeight: 500, fontStyle: 'italic', letterSpacing: 0.3 }}>
                {lang === 'kg' ? 'Басып көрүңүз →' : 'Нажмите чтобы посмотреть →'}
              </span>
            </motion.div>

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
          const visibleProducts = products.filter(p => (p.variants || []).some(v => v.inStock));
          const bestsellers = bestsellerIds
            .map(id => visibleProducts.find(p => String(p.id) === String(id)))
            .filter(Boolean);
          // If not enough orders, show first 6 visible products as featured
          const displayItems = bestsellers.length >= 3 ? bestsellers : visibleProducts.slice(0, 6);
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
                      <div style={{ aspectRatio: '1/1.15', overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                        {(product.img || product.images?.[0]) ? (
                          <motion.img
                            src={product.img || product.images[0]}
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
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
            { bg: 'linear-gradient(135deg, #111 0%, #2a1f0e 100%)', eye: 'НОВАЯ КОЛЛЕКЦИЯ', title: 'ЖЕНСКИЕ\nАРОМАТЫ', cat: 'Женские' },
            { bg: 'linear-gradient(135deg, #0d1f3c 0%, #111 100%)', eye: 'ПРЕМИУМ ЛИНЕЙКА', title: 'МУЖСКИЕ\nАРОМАТЫ', cat: 'Мужские' },
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
            {products.filter(p => (p.variants || []).some(v => v.inStock)).slice(-8).reverse().slice(0, windowWidth >= 1600 ? 5 : 4).map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.10), 0 8px 16px rgba(0,0,0,0.06)' }}
                onClick={() => { setSelectedProduct(p); setModalVariantId(p.variants?.[0]?.id || null); setModalImgIndex(0); }}
                style={{ cursor: 'pointer', background: '#fff', borderRadius: 16, overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.05)', transition: 'box-shadow 0.35s ease, transform 0.35s ease' }}>
                <div style={{ aspectRatio: '1/1.15', overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                  {(p.img || p.images?.[0]) ? (
                    <motion.img src={p.img || p.images[0]} alt={p.name}
                      whileHover={{ scale: 1.06 }}
                      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
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
                <p style={{ marginBottom: 14 }}>Онлайн төлөм же накталай төлөм. Банк тиркемеси аркылуу QR-код менен да төлөй аласыз.</p>
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
                <p style={{ marginBottom: 14 }}>Онлайн оплата или наличные. Также можно оплатить через QR-код в приложении банка.</p>
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
                { q: 'Кайсы төлөм ыкмалары бар?', a: 'Онлайн төлөм же накталай акча. QR-код аркылуу каалаган банк тиркемеси менен төлөй аласыз.' },
                { q: 'Буйрутма канча убакытта жеткирилет?', a: 'Ош шаары боюнча буйрутмалар адатта ошол эле күнү же кийинки күнү жеткирилет.' },
                { q: 'Бонус система кантип иштейт?', a: `Ар бир буйрутмадан ${settings?.bonusPercent || 5}% бонус балл аласыз. Кийинки сатып алууда буйрутма суммасынын ${settings?.useBonusPercent || 30}% чейин колдоно аласыз.` },
                { q: 'Товарды кайтарса болобу?', a: 'Ооба, товарды 3 күндүн ичинде кайтара аласыз, эгер ал ачылбаган жана баштапкы көрүнүшүн сактаган болсо.' },
                { q: 'Самовывоз кайдан алса болот?', a: 'Биздин 2 филиалдын каалаганынан: Ош, А. Шакирова к., 30 (ТЦ Maxcom) же Араван, Ош-3000 к., 86.' },
              ] : [
                { q: 'Ваша парфюмерия оригинальная?', a: 'Да, мы продаём качественную оригинальную парфюмерию и парфюм на разлив.' },
                { q: 'Сколько стоит доставка?', a: `Стоимость доставки — ${settings?.deliveryCost || 0} сом. ${settings?.minOrderForFreeDelivery ? 'Бесплатно при заказе от ' + settings.minOrderForFreeDelivery + ' сом.' : ''}` },
                { q: 'Какие способы оплаты доступны?', a: 'Онлайн оплата или наличные. Также можно оплатить по QR-коду через приложение банка.' },
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

      {/* ── STORY VIEWER ── */}
      <AnimatePresence>
        {storyViewerOpen !== null && storyGroups.length > 0 && (
          <StoryViewer
            stories={storyGroups}
            initialGroup={storyViewerOpen}
            onClose={() => setStoryViewerOpen(null)}
            onAddToCart={(productId, variantId) => {
              addToCart(productId, variantId);
              showToast?.(lang === 'kg' ? 'Себетке кошулду!' : 'Добавлено в корзину!');
            }}
            lang={lang}
          />
        )}
      </AnimatePresence>

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
                  { svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><path d="M9 18h6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 6v6l3 2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: 'Онлайн', desc: 'Все банки КР' },
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
              <div style={{ background: '#FFFFFF', display: 'flex',
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
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#BBB', flex: 1 }}>
                    {selectedProduct.brand}
                  </div>
                  {selectedProduct?.isAuthor && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: "#111", color: "#fff", borderRadius: 7,
                      padding: "4px 10px 4px 7px", fontSize: 10, fontWeight: 700,
                      letterSpacing: 0.6, lineHeight: 1, textTransform: "uppercase",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{IC.crown(12, "#FFD700")}</span>
                      {t.badge_author}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#111', marginBottom: 6 }}>
                  {selectedProduct.name}
                </div>
                {/* Badges row */}
                {(() => {
                  const db = [];
                  if (selectedProduct?.isPopular) db.push({ icon: IC.flame(11, "#fff"), text: t.badge_popular, bg: "linear-gradient(135deg, #FF6A00, #FF3B30)" });
                  if (selectedProduct?.isHit) db.push({ icon: IC.bolt(11, "#fff"), text: t.badge_hit, bg: "linear-gradient(135deg, #FF9500, #FF6B00)" });
                  if (selectedProduct?.isNew) db.push({ icon: IC.sparkle(11, "#fff"), text: t.badge_new, bg: "linear-gradient(135deg, #34C759, #30D158)" });
                  return db.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                      {db.map((b, bi) => (
                        <div key={bi} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: b.bg, color: "#fff", borderRadius: 20,
                          padding: "4px 10px 4px 7px", fontSize: 10, fontWeight: 600,
                          letterSpacing: 0.3,
                        }}>
                          <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{b.icon}</span>
                          <span>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ marginBottom: 12 }} />;
                })()}
                {/* Sale badge in desktop detail */}
                {(() => {
                  const si = getSaleInfo(selectedProduct);
                  if (!si) return null;
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <SaleCountdownBadge product={selectedProduct} />
                    </div>
                  );
                })()}
                <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  <DescRenderer text={pickDesc(selectedProduct, lang)} color="#666" />
                </div>
                {(() => {
                  const selVariant = (selectedProduct.variants || []).find(v => v.id === modalVariantId);
                  if (!selVariant) return null;
                  const si = getSaleInfo(selectedProduct);
                  if (si) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#FF3B30' }}>
                          {salePrice(selVariant.price, si.percent).toLocaleString()} сом
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 500, color: '#bbb', textDecoration: 'line-through' }}>
                          {Number(selVariant.price).toLocaleString()} сом
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', padding: '3px 8px', borderRadius: 6 }}>
                          -{si.percent}%
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 20 }}>
                      {Number(selVariant.price).toLocaleString()} сом
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {(selectedProduct.variants || []).filter(v => v.inStock !== false).map(v => {
                    const si = getSaleInfo(selectedProduct);
                    const isSel = modalVariantId === v.id;
                    return (
                      <div key={v.id} onClick={() => setModalVariantId(v.id)}
                        style={{ padding: '10px 16px', border: `1px solid ${isSel ? '#111' : '#E5E5E5'}`,
                          background: isSel ? '#111' : '#fff',
                          color: isSel ? '#fff' : '#555',
                          fontSize: 12, cursor: 'pointer' }}>
                        {si ? (
                          <>
                            {v.label} — <span style={{ color: isSel ? '#fff' : '#FF3B30', fontWeight: 700 }}>{salePrice(v.price, si.percent).toLocaleString()}</span>
                            <span style={{ textDecoration: 'line-through', color: isSel ? 'rgba(255,255,255,0.4)' : '#bbb', marginLeft: 4, fontSize: 11 }}>{v.price}</span> сом
                          </>
                        ) : (
                          <>{v.label} — {v.price} сом</>
                        )}
                      </div>
                    );
                  })}
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
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{(() => { const si = getSaleInfo(prod); const fp = si ? salePrice(variant?.price || 0, si.percent) : (variant?.price || 0); return fp * ci.qty; })()} сом</div>
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
                      { id: 'odengi', label: 'Онлайн', logo: <svg style={{width:22,height:22}} viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="#FF6B00" strokeWidth="2" fill="none"/><path d="M2 10h20" stroke="#FF6B00" strokeWidth="2"/></svg> },
                      { id: 'cash',  label: 'Наличные', logo: <CashLogo size={22} /> },
                    ].filter(opt => opt.id !== 'odengi' || settings?.onlinePaymentEnabled !== false).map(pm => (
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
                      if (deliveryType === 'delivery' && !address.trim()) { showToast(lang === 'kg' ? 'Жеткирүү дарегин жазыңыз' : 'Укажите адрес доставки', 'error'); return; }
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
                    {lang === 'kg' ? 'Заказ берүү' : 'Оформить заказ'}
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
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(false); setDesktopSearch(''); }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.15)', zIndex: 1049 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ position: 'fixed', top: 38 + 68 + 44, left: 0, right: 0, zIndex: 1050,
                background: '#fff', borderBottom: desktopSearch.length < 3 ? '1px solid #E5E5E5' : 'none',
                padding: '20px 48px',
                display: 'flex', flexDirection: 'column', gap: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#BBB" strokeWidth="1.5"/>
                  <path d="M16.5 16.5L21 21" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  autoFocus
                  value={desktopSearch}
                  onChange={e => setDesktopSearch(e.target.value)}
                  placeholder={lang === 'kg' ? 'Атыр издөө...' : 'Поиск ароматов...'}
                  style={{ flex: 1, fontSize: 22, border: 'none', outline: 'none', color: '#111', background: 'transparent' }}
                />
                {desktopSearch && (
                  <div onClick={() => setDesktopSearch('')} style={{ cursor: 'pointer', marginRight: 12 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
                <div onClick={() => { setSearchOpen(false); setDesktopSearch(''); }} style={{ cursor: 'pointer' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              {/* Desktop smart search results */}
              <AnimatePresence>
                {desktopSearch.length >= 3 && (() => {
                  const deskResults = smartSearch(products, desktopSearch, lang, 10);
                  if (deskResults.length === 0) return (
                    <motion.div
                      key="no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ padding: '24px 0', textAlign: 'center', color: '#999', fontSize: 15 }}
                    >
                      {lang === 'kg' ? 'Эч нерсе табылган жок' : 'Ничего не найдено'}
                    </motion.div>
                  );
                  return (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{ marginTop: 12, borderTop: '1px solid #F0F0F0' }}
                    >
                      {deskResults.map((p, idx) => {
                        const imgSrc = p.img || p.images?.[0];
                        const name = pickName(p, lang);
                        const prices = (p.variants || []).filter(v => v.inStock).map(v => v.price || 0).filter(Boolean);
                        const price = prices.length ? Math.min(...prices) : 0;
                        const si = getSaleInfo(p);
                        return (
                          <motion.div
                            key={p.id || idx}
                            onClick={() => { setSelectedProduct(p); setModalVariantId(p.variants?.[0]?.id || null); setModalImgIndex(0); setSearchOpen(false); setDesktopSearch(''); }}
                            whileTap={{ scale: 0.99 }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 4px',
                              cursor: 'pointer', borderBottom: idx < deskResults.length - 1 ? '1px solid #F5F5F5' : 'none',
                              transition: 'background 0.15s', borderRadius: 8,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{
                              width: 64, height: 64, borderRadius: 12,
                              background: '#FFF', border: '1px solid #F0F0F0',
                              overflow: 'hidden', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
                            }}>
                              {imgSrc ? (
                                <img src={imgSrc} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              ) : (
                                <svg width="28" height="36" viewBox="0 0 60 140" fill="none" opacity="0.25">
                                  <rect x="20" y="0" width="20" height="16" rx="2" fill="#C5C0B6"/>
                                  <rect x="8" y="16" width="44" height="110" rx="4" fill="#D5D0C8"/>
                                </svg>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {name}
                              </div>
                              <div style={{ fontSize: 13, color: '#999', marginTop: 3 }}>
                                {p.brand || p.category || ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {price > 0 && (
                                si ? (
                                  <>
                                    <div style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>{price.toLocaleString()} сом</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#E53935' }}>{salePrice(price, si.percent).toLocaleString()} сом</div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>от {price.toLocaleString()} сом</div>
                                )
                              )}
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
                              <path d="M9 18l6-6-6-6" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
