import React, { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";
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
  deleteAccount as authDeleteAccount,
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
import {
  notifyOrderCreated,
  notifyOrderStatus,
  notifyAdminNewOrder,
  notifyPaymentPending,
  notifyPaymentConfirmed,
  notifyBonusEarned,
  notifyWelcomeBonus,
  notifyReferralBonus,
  notifyNewReview,
  scheduleCartReminder,
  cancelCartReminder,
} from "./api/notifications";
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
import { CashLogo } from "./components/BankLogos";
// FIX: robust deep-link opener — uses Capacitor App.openUrl on native.
import { openPaymentApp, dialPhone, copyToClipboard } from "./utils/openPayment";
import { createOdengiInvoice, pollOdengiPayment, cancelOdengiInvoice } from "./api/odengi";
// PRO: premium iOS-style floating glass navbar with liquid bubble
import { GlassNavBar } from "./components/GlassNavBar";

// ─── TRANSLATIONS ──────────────────────────────────────────────────────────────
// ─── P2.1 REFACTOR: fundament modullari alohida fayllarga ko'chirildi ───
// Logika o'zgarmagan — faqat joylashuv. Qarang: src/theme.js, src/icons.jsx,
// src/i18n/lang.jsx, src/appData.js, src/api/backend.js, src/utils/format.js
import { TRANSLATIONS, LangContext, useLang } from "./i18n/lang.jsx";
import { T, card, inputStyle, btnGreen, btnOutline } from "./theme.js";
import { IC } from "./icons.jsx";
import { PAYMENT_METHODS, BG_PRESETS, DEFAULT_SETTINGS, FALLBACK_IMAGES, INITIAL_PRODUCTS, DEFAULT_BANNERS } from "./appData.js";
import { api } from "./api/backend.js";
import { formatSum, pickName, pickDesc, generateReferralCode } from "./utils/format.js";
import { withSuspense } from "./utils/lazyScreen.jsx";
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

export function StatusChip({ status }) {
  const { lang } = useLang();
  const labels = {
    ru: { new: "Новый", confirmed: "Подтверждён", preparing: "Готовится", delivering: "Доставляется", delivered: "Доставлен", cancelled: "Отменён" },
    kg: { new: "Жаңы", confirmed: "Тастыкталды", preparing: "Даярдалууда", delivering: "Жеткирилүүдө", delivered: "Жеткирилди", cancelled: "Жокко чыгарылды" },
  };
  const colors = { new: { bg: "#FFF3E0", color: "#FF6B00" }, confirmed: { bg: "#E3F2FD", color: "#1976D2" }, preparing: { bg: "#E8F5E9", color: "#388E3C" }, delivering: { bg: "#EDE7F6", color: "#7C5CBF" }, delivered: { bg: "#E8F5E9", color: "#388E3C" }, cancelled: { bg: "#FFEBEE", color: "#E53935" } };
  const c = colors[status] || { bg: "rgba(0,0,0,0.08)", color: T.textSecond };
  const label = (labels[lang] || labels.ru)[status] || status;
  return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{label}</span>;
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

// ─── DESCRIPTION RENDERER (SVG icons instead of emoji) ────────────────────────
// Description renderer — splits by keyword patterns, not newlines
// Handles text that may have no real \n (PocketBase may store as single block)
const DESC_SECTIONS = [
  { kw: "Верхние", svg: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M12 3L20 11H15V21H9V11H4L12 3Z" fill={c || '#FF9500'}/></svg> },
  { kw: "Средние", svg: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M6 3H18L21 9L12 21L3 9L6 3Z" fill={c || '#AF52DE'}/></svg> },
  { kw: "Базовые", svg: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 2 11.5 2 13.5C2 15.5 3.75 17.25 3.75 17.25C7 8 17 8 17 8Z" fill={c || '#34C759'}/></svg> },
  { kw: "Тип", svg: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><rect x="5" y="2" width="14" height="20" rx="2" stroke={c || '#8E8E93'} strokeWidth="1.5" fill="none"/><path d="M9 2V4H15V2" stroke={c || '#8E8E93'} strokeWidth="1.5"/><line x1="9" y1="9" x2="15" y2="9" stroke={c || '#8E8E93'} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="13" x2="15" y2="13" stroke={c || '#8E8E93'} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="17" x2="12" y2="17" stroke={c || '#8E8E93'} strokeWidth="1.5" strokeLinecap="round"/></svg> },
];

export function DescRenderer({ text, color, iconColor }) {
  if (!text) return null;
  const tc = color || '#666';
  // Build a regex that splits before each keyword: Верхние:|Средние:|Базовые:|Тип:
  const kwPattern = DESC_SECTIONS.map(s => s.kw + ':').join('|');
  const splitRe = new RegExp('(' + kwPattern + ')', 'g');
  // Remove all emoji characters first
  let clean = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE0E}\u{FE0F}\u{200D}]/gu, '');
  // Split by keywords, keeping delimiters
  const tokens = clean.split(splitRe).filter(Boolean);
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    // Check if this token is a keyword delimiter
    const sec = DESC_SECTIONS.find(s => token === s.kw + ':');
    if (sec) {
      // Next token is the content after the keyword
      const content = (tokens[i + 1] || '').replace(/^\s+/, '').split(/[。\n]/).shift()?.trim() || '';
      // Find where this section's content ends (before next keyword or end)
      let fullContent = '';
      if (i + 1 < tokens.length) {
        const nextTok = tokens[i + 1] || '';
        // Check if next token is another keyword
        const isNextKw = DESC_SECTIONS.some(s => nextTok === s.kw + ':');
        if (!isNextKw) {
          fullContent = nextTok.trim();
          i += 2;
        } else {
          i += 1;
        }
      } else {
        i += 1;
      }
      result.push(
        <div key={'s' + result.length} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <div style={{ marginTop: 2 }}>{sec.svg(iconColor)}</div>
          <span style={{ color: tc, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600, color: iconColor || tc }}>{sec.kw}: </span>
            {fullContent}
          </span>
        </div>
      );
    } else {
      // Plain text (body paragraph) — split by newlines for multi-line
      const lines = token.split(/\n+/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        result.push(
          <div key={'t' + result.length} style={{ color: tc, fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>{line}</div>
        );
      }
      i += 1;
    }
  }
  return result.length > 0 ? <>{result}</> : null;
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
export function BannerCropModal({ src, onDone, onCancel }) {
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

export function MultiImageUpload({ images = [], coverImg, onImagesChange, onCoverChange }) {
  const { t } = useLang();
  const fileRef0 = useRef(null);
  const fileRef1 = useRef(null);
  const fileRef2 = useRef(null);
  const fileRefs = [fileRef0, fileRef1, fileRef2];
  const [cropSrc, setCropSrc] = useState(null);
  const [cropSlot, setCropSlot] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);

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

  // Move image left/right for reorder
  const moveImage = (fromIdx, dir) => {
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= 3) return;
    const newImages = [...images];
    const tmp = newImages[fromIdx];
    newImages[fromIdx] = newImages[toIdx];
    newImages[toIdx] = tmp;
    onImagesChange(newImages);
    // Update cover if moved
    if (coverImg === tmp) onCoverChange(tmp);
  };

  const slots = [0, 1, 2];
  const filledCount = images.filter(Boolean).length;

  return (
    <div>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => { setCropSrc(null); setCropSlot(null); }}
        />
      )}
      {/* Header with count indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93", letterSpacing: -0.1 }}>
          {t.selectCover || 'Выберите обложку'}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: images[i] ? "#34C759" : "rgba(120,120,128,0.20)",
              transition: "background 0.22s",
            }} />
          ))}
          <span style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500, marginLeft: 4 }}>{filledCount}/3</span>
        </div>
      </div>

      {/* Image grid — PRO layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {slots.map(i => {
          const imgUrl = images[i] || null;
          const isCover = !!(coverImg && coverImg === imgUrl);
          const isHover = hoverSlot === i;
          return (
            <div key={i} style={{ position: "relative" }}
              onMouseEnter={() => setHoverSlot(i)} onMouseLeave={() => setHoverSlot(null)}>
              {/* Main image area */}
              <div
                onClick={() => { if (!imgUrl) fileRefs[i].current?.click(); else onCoverChange(imgUrl); }}
                style={{
                  width: "100%",
                  aspectRatio: "3/4",
                  borderRadius: 14,
                  border: isCover
                    ? "2.5px solid #111"
                    : imgUrl
                      ? "1.5px solid rgba(0,0,0,0.08)"
                      : "1.5px dashed rgba(0,0,0,0.12)",
                  background: imgUrl ? "#fff" : "rgba(120,120,128,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden", position: "relative",
                  boxSizing: "border-box",
                  transition: "border-color 0.22s, box-shadow 0.22s, transform 0.18s",
                  boxShadow: isCover
                    ? "0 2px 8px rgba(0,0,0,0.12)"
                    : imgUrl
                      ? "0 1px 4px rgba(0,0,0,0.06)"
                      : "none",
                  transform: isHover && imgUrl ? "scale(1.02)" : "scale(1)",
                }}
              >
                {imgUrl ? (
                  <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover", background: "#fff" }} alt="" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#C7C7CC" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>Фото {i + 1}</span>
                  </div>
                )}
                {/* Cover badge */}
                {isCover && (
                  <div style={{
                    position: "absolute", top: 6, left: 6,
                    background: "#111", color: "#fff",
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                    borderRadius: 6, padding: "3px 8px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  }}>
                    {t.cover}
                  </div>
                )}
                {/* Hover overlay with actions */}
                {imgUrl && isHover && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.35)",
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "opacity 0.18s",
                  }}>
                    {/* Replace */}
                    <button onClick={(e) => { e.stopPropagation(); fileRefs[i].current?.click(); }}
                      style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.92)", color: "#111", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </button>
                    {/* Move left */}
                    {i > 0 && images[i-1] && (
                      <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1); }}
                        style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.92)", color: "#111", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}
                    {/* Move right */}
                    {i < 2 && images[i+1] && (
                      <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1); }}
                        style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.92)", color: "#111", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                    {/* Delete */}
                    <button onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                      style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(229,57,53,0.92)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                )}
              </div>
              {/* Mobile action buttons (no hover on touch) */}
              {imgUrl && !isHover && (
                <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                  {!isCover && (
                    <button onClick={() => onCoverChange(imgUrl)}
                      style={{ flex: 1, fontSize: 9, padding: "4px 0", borderRadius: 8, border: "none", background: "rgba(0,0,0,0.06)", color: "#3A3A3C", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Обложка
                    </button>
                  )}
                  <button onClick={() => fileRefs[i].current?.click()}
                    style={{ width: 28, fontSize: 10, padding: "4px 0", borderRadius: 8, border: "none", background: "rgba(10,132,255,0.08)", color: "#0A84FF", fontWeight: 600, cursor: "pointer" }}>
                    ↑
                  </button>
                  <button onClick={() => handleRemove(i)}
                    style={{ width: 28, fontSize: 10, padding: "4px 0", borderRadius: 8, border: "none", background: "rgba(229,57,53,0.08)", color: "#E53935", fontWeight: 600, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              )}
              <input ref={fileRefs[i]} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e, i)} />
            </div>
          );
        })}
      </div>

      {/* Tip */}
      {filledCount === 0 && (
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#C7C7CC", fontWeight: 500 }}>
          Нажмите на слот для загрузки фото
        </div>
      )}
    </div>
  );
}

// ─── STORY VIEWER — Instagram-style fullscreen product stories ────────────────
export function StoryViewer({ stories, initialGroup, onClose, onAddToCart, lang }) {
  const [groupIdx, setGroupIdx] = useState(initialGroup || 0);
  const [itemIdx, setItemIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [selVarIdx, setSelVarIdx] = useState(0);
  const [swipedUp, setSwipedUp] = useState(false);
  const [paused, setPaused] = useState(false);
  const DURATION = 8000;
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());
  const touchStartRef = useRef({ y: 0, time: 0 });

  const group = stories[groupIdx];
  if (!group || !group.items || group.items.length === 0) return null;
  const item = group.items[itemIdx] || group.items[0];

  // Reset variant when item changes
  useEffect(() => { setSelVarIdx(0); setSwipedUp(false); }, [groupIdx, itemIdx]);

  // Progress timer
  useEffect(() => {
    if (paused || swipedUp) return;
    startRef.current = Date.now();
    setProgress(0);
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(elapsed / DURATION, 1);
      setProgress(p);
      if (p >= 1) { goNext(); return; }
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
    return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current); };
  }, [groupIdx, itemIdx, paused, swipedUp]);

  const goNext = () => {
    if (itemIdx < group.items.length - 1) {
      setItemIdx(i => i + 1);
    } else if (groupIdx < stories.length - 1) {
      setGroupIdx(g => g + 1);
      setItemIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (itemIdx > 0) {
      setItemIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(g => g - 1);
      setItemIdx(0);
    }
  };

  const handleTap = (e) => {
    if (swipedUp) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) goPrev();
    else goNext();
  };

  // Pause on hold
  const handlePointerDown = () => {
    if (swipedUp) return;
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
  };
  const handlePointerUp = () => {
    if (paused || swipedUp) return;
    startRef.current = Date.now() - (progress * DURATION);
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(elapsed / DURATION, 1);
      setProgress(p);
      if (p >= 1) { goNext(); return; }
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
  };

  // Swipe up detection
  const handleTouchStart = (e) => {
    touchStartRef.current = { y: e.touches[0].clientY, time: Date.now() };
  };
  const handleTouchEnd = (e) => {
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartRef.current.time;
    if (dy > 60 && dt < 400 && !swipedUp) {
      setSwipedUp(true);
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    } else if (dy < -60 && dt < 400 && swipedUp) {
      setSwipedUp(false);
    }
  };

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') { if (swipedUp) setSwipedUp(false); else onClose(); }
      else if (e.key === 'ArrowUp') { setSwipedUp(true); if (timerRef.current) cancelAnimationFrame(timerRef.current); }
      else if (e.key === 'ArrowDown') setSwipedUp(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [groupIdx, itemIdx, swipedUp]);

  const imgSrc = item.img || item.images?.[0] || '';
  const variants = (item.variants || []).filter(v => v.inStock);
  const allVariants = item.variants || [];
  const selectedVar = allVariants[selVarIdx] || allVariants[0];
  const selectedPrice = selectedVar?.price || 0;
  const saleInfo = typeof getSaleInfo === 'function' ? getSaleInfo(item) : null;
  const discountedPrice = saleInfo && selectedPrice ? Math.round(selectedPrice * (1 - saleInfo.percent / 100)) : null;
  const desc = item.desc || item.description || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Main story area */}
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 440, height: '100%', maxHeight: '100vh',
          overflow: 'hidden', cursor: 'pointer',
        }}
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background — full bleed product image with gradient */}
        {imgSrc && (
          <motion.div
            key={`bg-${groupIdx}-${itemIdx}`}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${imgSrc})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(50px) saturate(1.4) brightness(0.35)',
            }}
          />
        )}
        {/* Gradient overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.9) 100%)', zIndex: 1 }} />

        {/* Progress bars */}
        <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', gap: 3, zIndex: 20 }}>
          {group.items.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', borderRadius: 2, background: '#fff',
                  width: i < itemIdx ? '100%' : i === itemIdx ? `${progress * 100}%` : '0%',
                  transition: i === itemIdx ? 'none' : 'width 0.2s',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ position: 'absolute', top: 24, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #833AB4, #F56040, #FFDC80)',
              padding: 2, flexShrink: 0,
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {group.icon ? (
                  <span style={{ fontSize: 16 }}>{group.icon}</span>
                ) : (
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>KU</span>
                )}
              </div>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{group.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                {itemIdx + 1} / {group.items.length} · Kemal Usman
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Pause/Play */}
            <motion.div
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); setPaused(p => !p); }}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              {paused ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              )}
            </motion.div>
            {/* Close */}
            <motion.div
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </motion.div>
          </div>
        </div>

        {/* Main Content — slides up when swipedUp */}
        <motion.div
          animate={{ y: swipedUp ? '-28%' : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '70px 24px 160px', zIndex: 10,
          }}
        >
          {/* Product image — KATTA */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${groupIdx}-${itemIdx}`}
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -30 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ textAlign: 'center', width: '100%' }}
            >
              {imgSrc ? (
                <div style={{
                  width: '65%', maxWidth: 280, aspectRatio: '3/4', margin: '0 auto 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))',
                }}>
                  <img src={imgSrc} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
              ) : (
                <div style={{
                  width: '55%', aspectRatio: '3/4', margin: '0 auto 20px',
                  borderRadius: 20, background: 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="48" height="100" viewBox="0 0 60 140" fill="none" opacity="0.3">
                    <rect x="20" y="0" width="20" height="16" rx="2" fill="#555"/>
                    <rect x="8" y="16" width="44" height="110" rx="4" fill="#444"/>
                  </svg>
                </div>
              )}

              {/* Brand */}
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 3.5, textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>
                {item.brand || item.category || ''}
              </div>
              {/* Name */}
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 10, letterSpacing: -0.5, lineHeight: 1.2 }}>
                {pickName(item, lang)}
              </div>

              {/* Price pill */}
              <motion.div
                layout
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
                  borderRadius: 16, padding: '10px 22px', marginBottom: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {discountedPrice ? (
                  <>
                    <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{discountedPrice.toLocaleString()} сом</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, textDecoration: 'line-through' }}>{selectedPrice.toLocaleString()}</span>
                    <span style={{ background: '#FF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>-{saleInfo.percent}%</span>
                  </>
                ) : (
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{selectedPrice ? `${selectedPrice.toLocaleString()} сом` : ''}</span>
                )}
              </motion.div>

              {saleInfo && (
                <div style={{ color: '#FF8A80', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  {saleInfo.remaining.h}ч {saleInfo.remaining.m}м {lang === 'kg' ? 'калды' : 'осталось'}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Swipe-up detail panel */}
        <motion.div
          animate={{ y: swipedUp ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '55%', zIndex: 25,
            background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(30px)',
            borderRadius: '24px 24px 0 0',
            padding: '20px 20px 100px',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }}
            onClick={() => setSwipedUp(false)}
          />

          {/* Variant selector */}
          {allVariants.length > 1 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
                {lang === 'kg' ? 'Көлөмү' : 'Объём'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {allVariants.filter(v => v.inStock).map((v) => {
                  const vi = allVariants.indexOf(v);
                  return (
                    <motion.button
                      key={v.id || vi}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setSelVarIdx(vi)}
                      style={{
                        padding: '8px 18px', borderRadius: 12,
                        background: vi === selVarIdx ? '#fff' : 'rgba(255,255,255,0.08)',
                        color: vi === selVarIdx ? '#111' : '#fff',
                        border: vi === selVarIdx ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        fontSize: 13, fontWeight: vi === selVarIdx ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {v.label}
                      {v.price ? ` · ${v.price.toLocaleString()} сом` : ''}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {desc && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                {lang === 'kg' ? 'Сүрөттөмө' : 'Описание'}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <DescRenderer text={desc} color="rgba(255,255,255,0.7)" iconColor="rgba(255,255,255,0.5)" />
              </div>
            </div>
          )}

          {/* Category tag */}
          {item.category && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 14px', marginBottom: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{item.category}</span>
            </div>
          )}
        </motion.div>

        {/* Swipe up hint — only when NOT swiped up */}
        <AnimatePresence>
          {!swipedUp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, -6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ y: { repeat: Infinity, duration: 1.5 }, opacity: { duration: 0.3 } }}
              style={{
                position: 'absolute', bottom: 100, left: 0, right: 0, zIndex: 20,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                pointerEvents: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 500 }}>
                {lang === 'kg' ? 'Толугураак' : 'Подробнее'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom CTA */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', zIndex: 30,
          background: swipedUp ? 'rgba(15,15,15,0.98)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                const varId = selectedVar?.id || item.variants?.[0]?.id;
                if (varId && onAddToCart) {
                  onAddToCart(item.id, varId);
                }
              }}
              style={{
                flex: 1, background: '#fff', color: '#111', border: 'none',
                padding: '15px 20px', borderRadius: 16, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              {lang === 'kg' ? 'Себетке' : 'В корзину'}
              {selectedPrice > 0 && (
                <span style={{ opacity: 0.5, fontWeight: 500, fontSize: 13, marginLeft: 4 }}>
                  · {(discountedPrice || selectedPrice).toLocaleString()} сом
                </span>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); if (swipedUp) setSwipedUp(false); else goNext(); }}
              style={{
                width: 52, background: 'rgba(255,255,255,0.12)', border: 'none',
                backdropFilter: 'blur(10px)',
                borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {swipedUp ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Side panel — story groups (desktop only) */}
      {typeof window !== 'undefined' && window.innerWidth >= 768 && (
        <div style={{
          width: 200, background: 'rgba(255,255,255,0.03)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 14px', height: '100%', overflowY: 'auto',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>
            Stories
          </div>
          {stories.map((g, gi) => (
            <motion.div
              key={gi}
              whileHover={{ background: 'rgba(255,255,255,0.08)' }}
              onClick={(e) => { e.stopPropagation(); setGroupIdx(gi); setItemIdx(0); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px', borderRadius: 12, cursor: 'pointer', marginBottom: 6,
                background: gi === groupIdx ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: gi === groupIdx ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: gi === groupIdx
                  ? 'linear-gradient(135deg, #833AB4, #F56040, #FFDC80)'
                  : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: gi === groupIdx ? 2 : 0,
              }}>
                {gi === groupIdx ? (
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 15 }}>{g.icon}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 15 }}>{g.icon}</span>
                )}
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 11, fontWeight: gi === groupIdx ? 600 : 400 }}>{g.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                  {g.items.length} {lang === 'kg' ? 'товар' : (g.items.length === 1 ? 'товар' : 'товаров')}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── BANNER SLIDER ─────────────────────────────────────────────────────────────
function BannerSlider({ banners }) {
  const [idx, setIdx] = useState(0);
  const [imgErrors, setImgErrors] = useState({});
  useEffect(() => {
    if (!banners.length) return;
    const timer = setInterval(() => setIdx(i => (i + 1) % banners.length), 3000);
    return () => clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  // Filter out banners whose images failed to load
  const validBanners = banners.filter(b => !b.img || !imgErrors[b.id]);
  if (!validBanners.length) return null;
  const safeIdx = idx % validBanners.length;
  const b = validBanners[safeIdx];
  const fallbackBg = b.bg || "linear-gradient(135deg, #111111 0%, #000000 100%)";
  return (
    <div style={{ margin: "0 16px", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", position: "relative", aspectRatio: "21 / 9" }}>
      <div style={{ width: "100%", height: "100%", background: fallbackBg, position: "relative" }}>
        {b.img && !imgErrors[b.id] && (
          <img
            src={b.img} alt=""
            onError={() => setImgErrors(prev => ({ ...prev, [b.id]: true }))}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center", display: "block" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center", background: b.img && !imgErrors[b.id] ? "rgba(0,0,0,0.35)" : "transparent" }}>
          {b.title && <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, lineHeight: 1.2, marginBottom: 8 }}>{b.title}</div>}
          {b.subtitle && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{b.subtitle}</div>}
        </div>
      </div>
      {validBanners.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 5 }}>
          {validBanners.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: i === safeIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === safeIdx ? "#fff" : "rgba(255,255,255,0.5)", transition: "width 0.3s", cursor: "pointer" }} />)}
        </div>
      )}
    </div>
  );
}

// ─── REGISTER MODAL (for guests trying to order) ─────────────────────────────
// Shows a bottom-sheet registration form (phone + name + OTP) when a guest
// attempts to place an order. After successful OTP verification the parent
// receives onRegister({ phone, name, refCode, record, isNewClient }) and can
// immediately submit the pending order.
function RegisterModal({ open, onClose, onRegister, showToast }) {
  const { lang, t } = useLang();
  const [phone, setPhone] = useState("+996");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [refCode, setRefCode] = useState("");
  const [showRefInput, setShowRefInput] = useState(false);
  const [otpStep, setOtpStep] = useState("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhone("+996"); setName(""); setErr(""); setRefCode("");
      setShowRefInput(false); setOtpStep("idle"); setOtpCode("");
    }
  }, [open]);

  const formatPhone = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    if (digits.length <= 3) return "+" + digits;
    if (digits.length <= 6) return "+" + digits.slice(0, 3) + " " + digits.slice(3);
    if (digits.length <= 9) return "+" + digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6);
    return "+" + digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6, 9) + " " + digits.slice(9, 12);
  };

  async function handleRequestOtp() {
    if (!phone || !name) { setErr(lang === "ru" ? "Заполните все поля" : "Бардык талааларды толтуруңуз"); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 11) { setErr(lang === "ru" ? "Введите корректный номер" : "Туура номер жазыңыз"); return; }
    setErr(""); setOtpLoading(true);
    try {
      await requestOtp(phone);
      setOtpStep("verify"); setOtpCode(""); setResendCooldown(60);
      showToast?.(lang === "ru" ? "Код отправлен по SMS" : "Код SMS аркылуу жөнөтүлдү");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("429") || msg.includes("too_many")) {
        setErr(lang === "ru" ? "Слишком много попыток, попробуйте позже" : "Көп аракет, кийинчерээк аракет кылыңыз");
      } else {
        setErr(lang === "ru" ? "Ошибка отправки SMS" : "SMS жөнөтүүдө ката");
      }
    } finally { setOtpLoading(false); }
  }

  async function handleVerifyOtp() {
    const code = otpCode.replace(/\D/g, "");
    if (code.length !== 6) { setErr(lang === "ru" ? "Введите код из SMS" : "SMS кодду жазыңыз"); return; }
    setErr(""); setOtpLoading(true);
    try {
      const { record, isNewClient } = await verifyOtp({ phone, code, name, referredBy: refCode.trim().toUpperCase() || null });
      onRegister({ phone, name, refCode: refCode.trim().toUpperCase(), record, isNewClient });
    } catch {
      setErr(lang === "ru" ? "Неверный код" : "Код туура эмес");
    } finally { setOtpLoading(false); }
  }

  const inp = {
    width: "100%", padding: "14px 16px", fontSize: 15,
    background: "#F5F5F5", border: "1px solid #E5E5E5",
    borderRadius: 14, color: "#111", outline: "none", boxSizing: "border-box",
  };
  const lbl = { fontSize: 10, color: "#888", marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="reg-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }}
          />
          {/* Bottom sheet */}
          <motion.div
            key="reg-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
              background: "#fff", borderRadius: "24px 24px 0 0",
              padding: "28px 20px", paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#DDD", margin: "0 auto 20px" }} />

            {/* Title */}
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 4, textAlign: "center" }}>
              {lang === "ru" ? "Регистрация" : "Катталуу"}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20, textAlign: "center" }}>
              {lang === "ru" ? "Для оформления заказа зарегистрируйтесь" : "Заказ берүү үчүн катталыңыз"}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>{lang === "ru" ? "НОМЕР ТЕЛЕФОНА" : "ТЕЛЕФОН НОМЕРИ"}</div>
              <input
                type="tel" value={phone}
                onChange={e => { if (otpStep === "idle") { setPhone(formatPhone(e.target.value)); setErr(""); } }}
                readOnly={otpStep !== "idle"}
                placeholder="+996 700 123 456"
                style={{ ...inp, letterSpacing: 1, opacity: otpStep !== "idle" ? 0.7 : 1 }}
              />
            </div>

            {otpStep === "idle" ? (
              <>
                {/* Name */}
                <div style={{ marginBottom: 16 }}>
                  <div style={lbl}>{lang === "ru" ? "ВАШЕ ИМЯ" : "АТЫҢЫЗ"}</div>
                  <input
                    type="text" value={name}
                    onChange={e => { setName(e.target.value); setErr(""); }}
                    placeholder={lang === "ru" ? "Введите имя" : "Атыңызды жазыңыз"}
                    style={inp}
                  />
                </div>

                {/* Referral */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => setShowRefInput(p => !p)} style={{ background: "none", border: "none", color: "#AAA", fontSize: 12, cursor: "pointer", padding: 0, letterSpacing: 0.5 }}>
                    {lang === "ru" ? "Есть реферальный код? +" : "Реферал код барбы? +"}
                  </button>
                  {showRefInput && (
                    <input
                      type="text" value={refCode}
                      onChange={e => setRefCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder={lang === "ru" ? "Введите код (6 символов)" : "Код жазыңыз (6 белги)"}
                      style={{ ...inp, marginTop: 8, letterSpacing: 2, textAlign: "center" }}
                    />
                  )}
                </div>

                {err && (
                  <div style={{ color: "#E53935", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "#FFF5F5", borderRadius: 10, border: "1px solid #FFCDD2", textAlign: "center" }}>{err}</div>
                )}

                <button onClick={handleRequestOtp} disabled={otpLoading} style={{
                  width: "100%", padding: "16px", background: "#111", border: "none",
                  borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: otpLoading ? "default" : "pointer", letterSpacing: 2,
                  opacity: otpLoading ? 0.6 : 1,
                }}>
                  {otpLoading ? (lang === "ru" ? "ОТПРАВКА..." : "ЖӨНӨТҮҮ...") : (lang === "ru" ? "ПОЛУЧИТЬ КОД" : "КОДДУ АЛУУ")}
                </button>
              </>
            ) : (
              <>
                {/* OTP input */}
                <div style={{ marginBottom: 14 }}>
                  <div style={lbl}>{lang === "ru" ? "КОД ИЗ SMS" : "SMS КОДУ"}</div>
                  <input
                    type="tel" inputMode="numeric" maxLength={6} value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
                    placeholder="••••••" autoFocus
                    style={{ ...inp, fontSize: 22, letterSpacing: 8, textAlign: "center", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
                  />
                </div>

                {err && (
                  <div style={{ color: "#E53935", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "#FFF5F5", borderRadius: 10, border: "1px solid #FFCDD2", textAlign: "center" }}>{err}</div>
                )}

                <button onClick={handleVerifyOtp} disabled={otpLoading} style={{
                  width: "100%", padding: "16px", background: "#111", border: "none",
                  borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: otpLoading ? "default" : "pointer", letterSpacing: 2,
                  marginBottom: 10, opacity: otpLoading ? 0.6 : 1,
                }}>
                  {otpLoading ? (lang === "ru" ? "ПРОВЕРКА..." : "ТЕКШЕРҮҮ...") : (lang === "ru" ? "ВОЙТИ И ЗАКАЗАТЬ" : "КИРҮҮ ЖАНА ЗАКАЗ БЕРҮҮ")}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => { setOtpStep("idle"); setOtpCode(""); setErr(""); }}
                    style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 0 }}>
                    {lang === "ru" ? "Изменить номер" : "Номерди өзгөртүү"}
                  </button>
                  <button onClick={() => { if (resendCooldown <= 0 && !otpLoading) handleRequestOtp(); }}
                    disabled={resendCooldown > 0 || otpLoading}
                    style={{ background: "none", border: "none", color: resendCooldown > 0 ? "#CCC" : "#555", fontSize: 12, cursor: (resendCooldown > 0 || otpLoading) ? "default" : "pointer", padding: 0 }}>
                    {resendCooldown > 0 ? (lang === "ru" ? `Повторно через ${resendCooldown}с` : `${resendCooldown}с кийин кайра`) : (lang === "ru" ? "Отправить ещё раз" : "Кайра жөнөтүү")}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
          <button onClick={setGuestMode} style={{
            background: 'none', border: '1.5px solid #D1D1D6', color: '#888', fontSize: 13,
            cursor: 'pointer', letterSpacing: 1, padding: '12px 0', borderRadius: 14,
            width: '100%', fontWeight: 600, textTransform: 'uppercase',
          }}>
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
      height: "100dvh",
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
        padding: "0 24px calc(env(safe-area-inset-bottom, 20px) + 28px)",
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
          background: "none", border: "1.5px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.5)",
          fontSize: 13, cursor: "pointer", letterSpacing: 1, padding: "12px 0",
          borderRadius: 14, width: "100%", fontWeight: 600, textTransform: "uppercase",
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
export const getSaleInfo = (p) => {
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
export const salePrice = (originalPrice, salePercent) => Math.round(originalPrice * (1 - salePercent / 100));

// ─── SMART SEARCH ──────────────────────────────────────────────────────────────
// Fuzzy matching: supports partial words, typos (edit distance), transliteration
// Returns scored results sorted by relevance
export const smartSearch = (products, query, lang, limit = 8) => {
  if (!query || query.length < 3) return [];
  const q = query.toLowerCase().trim();

  // Simple edit distance for short strings (fuzzy)
  const editDist = (a, b) => {
    if (a.length > 20 || b.length > 20) return 99;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0));
    return dp[m][n];
  };

  // Score a product (higher = better match, 0 = no match)
  const score = (p) => {
    const name = (p.name || "").toLowerCase();
    const nameKg = (p.name_kg || "").toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const category = (p.category || "").toLowerCase();
    const displayName = pickName(p, lang).toLowerCase();
    let s = 0;

    // Exact start match — highest priority
    if (name.startsWith(q) || brand.startsWith(q) || displayName.startsWith(q)) s += 100;
    // Contains match
    if (name.includes(q) || brand.includes(q) || displayName.includes(q) || nameKg.includes(q)) s += 50;
    // Category match
    if (category.includes(q)) s += 20;

    // Word-level matching: each query word checked against all product words
    const qWords = q.split(/\s+/);
    const pWords = `${name} ${brand} ${nameKg} ${category}`.split(/\s+/).filter(Boolean);
    for (const qw of qWords) {
      if (qw.length < 2) continue;
      for (const pw of pWords) {
        if (pw.startsWith(qw)) s += 30;        // word prefix
        else if (pw.includes(qw)) s += 15;     // word contains
        else if (qw.length >= 3 && pw.length >= 3) {
          const d = editDist(qw, pw.slice(0, qw.length + 2));
          if (d <= 1) s += 20;                  // 1 typo tolerance
          else if (d <= 2 && qw.length >= 5) s += 8; // 2 typos for longer words
        }
      }
    }

    return s;
  };

  return products
    .map(p => ({ product: p, score: score(p) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.product);
};

// ─── SEARCH DROPDOWN COMPONENT ─────────────────────────────────────────────────
function SearchDropdown({ results, onSelect, lang, isMobile = true }) {
  if (!results || results.length === 0) return null;

  const minPriceOf = (p) => {
    const prices = (p.variants || []).filter(v => v.inStock).map(v => v.price || 0).filter(Boolean);
    return prices.length ? Math.min(...prices) : 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 2000,
        background: "#fff",
        borderRadius: isMobile ? "0 0 16px 16px" : 16,
        boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
        maxHeight: isMobile ? "60vh" : 480,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        border: "1px solid rgba(0,0,0,0.06)",
        borderTop: "none",
      }}
    >
      {results.map((p, idx) => {
        const imgSrc = p.img || p.images?.[0];
        const name = pickName(p, lang);
        const price = minPriceOf(p);
        const si = getSaleInfo(p);
        return (
          <motion.div
            key={p.id || idx}
            onClick={() => onSelect(p)}
            whileTap={{ scale: 0.98, backgroundColor: "#F8F8F8" }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: isMobile ? "10px 14px" : "12px 20px",
              cursor: "pointer",
              borderBottom: idx < results.length - 1 ? "1px solid #F0F0F0" : "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = '#F8F8F8'; }}
            onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = '#fff'; }}
          >
            {/* Product image */}
            <div style={{
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              borderRadius: 10,
              background: "#FFFFFF",
              border: "1px solid #F0F0F0",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}>
              {imgSrc ? (
                <img src={imgSrc} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <svg width="24" height="32" viewBox="0 0 60 140" fill="none" opacity="0.25">
                  <rect x="20" y="0" width="20" height="16" rx="2" fill="#C5C0B6"/>
                  <rect x="8" y="16" width="44" height="110" rx="4" fill="#D5D0C8"/>
                </svg>
              )}
            </div>
            {/* Product info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                color: "#111",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {name}
              </div>
              <div style={{
                fontSize: isMobile ? 12 : 13,
                color: "#999",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {p.brand || p.category || ""}
              </div>
            </div>
            {/* Price */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {price > 0 ? (
                <>
                  {si ? (
                    <>
                      <div style={{ fontSize: 11, color: "#bbb", textDecoration: "line-through" }}>
                        {price.toLocaleString()} сом
                      </div>
                      <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: "#E53935" }}>
                        {salePrice(price, si.percent).toLocaleString()} сом
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: "#111" }}>
                      {price > 0 ? `от ${price.toLocaleString()} сом` : ""}
                    </div>
                  )}
                </>
              ) : null}
            </div>
            {/* Arrow */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
              <path d="M9 18l6-6-6-6" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// Live countdown hook — ticks every 50ms for millisecond display
function useSaleCountdown(product) {
  const [info, setInfo] = React.useState(() => getSaleInfo(product));
  const [ms, setMs] = React.useState(0);
  React.useEffect(() => {
    if (!product?.salePercent || !product?.saleEnd) { setInfo(null); return; }
    const tick = () => {
      const si = getSaleInfo(product);
      setInfo(si);
      if (si) {
        const now = Date.now();
        const end = new Date(product.saleEnd).getTime();
        const remaining = Math.max(0, end - now);
        setMs(Math.floor((remaining % 1000) / 10));
      }
    };
    tick();
    const id = setInterval(tick, 47);
    return () => clearInterval(id);
  }, [product?.salePercent, product?.saleEnd, product?.saleStart]);
  return info ? { ...info, ms } : null;
}

// Compact countdown badge for product cards — Variant C: progress bar + milliseconds
export function SaleCountdownBadge({ product }) {
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
        borderRadius: 11, padding: '8px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E53935', animation: 'salePulse 1.5s infinite' }} />
          <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Скидка -{sale.percent}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>
            {pad(sale.remaining.h)}:{pad(sale.remaining.m)}:{pad(sale.remaining.s)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>.</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 500, width: 16, display: 'inline-block' }}>
            {pad(sale.ms)}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(2, sale.progress * 100)}%`, height: '100%', borderRadius: 2,
          background: sale.progress < 0.15 ? '#E53935' : 'linear-gradient(90deg, #E53935, #FF8A80)',
          transition: 'width 0.3s ease',
        }} />
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
//                   200px, object-fit: contain (full bottle visible, 8px padding)
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
  const pad = isCard ? 10 : 14;
  const containerStyle = {
    width: "100%",
    height: isCard ? 200 : 260,
    background: "#FFFFFF",
    position: "relative",
    overflow: "hidden",
  };
  const imgStyle = {
    position: "absolute",
    top: pad,
    left: pad,
    right: pad,
    bottom: pad,
    width: `calc(100% - ${pad * 2}px)`,
    height: `calc(100% - ${pad * 2}px)`,
    objectFit: "contain",
    objectPosition: "center center",
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
function ProductCardBase({ p, onClick, preview = false, showAudioHint = false, onAudioHintDismiss }) {
  const { lang, t } = useLang();
  const stk = productHasStock(p);
  const minP = productMinPrice(p);
  const saleInfo = useSaleCountdown(p);
  const saleMinP = saleInfo && minP !== null ? salePrice(minP, saleInfo.percent) : null;
  // Tooltip is only meaningful when this card actually has audio.
  const audioForHint = audioUrl(p) || (typeof window !== 'undefined' && p?.id ? localStorage.getItem('parfum_audio_' + p.id) : null);
  const hintVisible = !preview && showAudioHint && !!audioForHint;
  return (
    <div
      onClick={onClick}
      style={{ ...card({ borderRadius: 16, overflow: "hidden", cursor: onClick ? "pointer" : "default" }), WebkitTransform: 'translateZ(0)' }}
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
        {/* ── Stacked badges (top-left) ── */}
        {stk && !saleInfo && (() => {
          const badges = [];
          if (p?.isPopular) badges.push({ icon: IC.flame(10, "#fff"), text: t.badge_popular, bg: "linear-gradient(135deg, #FF6A00 0%, #FF3B30 100%)", shadow: "rgba(255,59,48,0.25)" });
          if (p?.isHit) badges.push({ icon: IC.bolt(10, "#fff"), text: t.badge_hit, bg: "linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)", shadow: "rgba(255,149,0,0.25)" });
          if (p?.isNew) badges.push({ icon: IC.sparkle(10, "#fff"), text: t.badge_new, bg: "linear-gradient(135deg, #34C759 0%, #30D158 100%)", shadow: "rgba(52,199,89,0.25)" });
          return badges.slice(0, 2).map((b, bi) => (
            <div key={bi}
              style={{
                position: "absolute", top: 8 + bi * 26, left: 8,
                display: "inline-flex", alignItems: "center", gap: 4,
                background: b.bg, color: "#fff", borderRadius: 20,
                padding: "3px 9px 3px 6px", fontSize: 10, fontWeight: 600,
                letterSpacing: 0.1, lineHeight: 1,
                boxShadow: `0 2px 6px ${b.shadow}`,
                backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              }}>
              <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{b.icon}</span>
              <span>{b.text}</span>
            </div>
          ));
        })()}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 400, lineHeight: 1, flex: 1 }}>
            {p?.brand || ""}
          </div>
          {p?.isAuthor && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#111", color: "#fff", borderRadius: 7,
              padding: "3px 9px 3px 6px", fontSize: 9.5, fontWeight: 700,
              letterSpacing: 0.6, lineHeight: 1, textTransform: "uppercase",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}>
              <span style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>{IC.crown(11, "#FFD700")}</span>
              {t.badge_author}
            </div>
          )}
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
        {/* SaleProgressBar removed — progress bar is now inside SaleCountdownBadge (Variant C) */}
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
          <div
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
          </div>
        </div>
      </div>
    </div>
  );
}

// P2.1: memoized — katalog 100+ karta render qiladi. p/preview/showAudioHint
// chiqishni belgilaydi; onClick/onAudioHintDismiss inline closure bo'lib har
// renderda yangi identity oladi, lekin faqat `p` va stabil setterlardan
// foydalanadi — shuning uchun taqqoslashdan ataylab chiqarilgan.
export const ProductCard = React.memo(ProductCardBase, (prev, next) =>
  prev.p === next.p && prev.preview === next.preview && prev.showAudioHint === next.showAudioHint
);

// ─── CATALOG SCREEN ────────────────────────────────────────────────────────────
function CatalogScreen({ products, settings, addToCart, banners, showToast, onAdminLogin, onRefresh, setIsDetailOpen, reviews = [] }) {
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
  const [imgIsLandscape, setImgIsLandscape] = useState(false);
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
  const heroHeight = useTransform(scrollMV, [0, 200], [380, 460], { clamp: true });
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

  const cats = ["all", ...Array.from(new Set(products.map(p => (p.category || "").trim()).filter(Boolean)))];
  // PRO: sort state + bottom-sheet
  const [sort, setSort] = useState('default');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  let filteredProducts = products.filter(p => {
    // Hide products where ALL variants are out of stock (admin X toggle controls visibility)
    const vars = p.variants || [];
    const hasInStock = vars.some(v => v.inStock);
    if (!hasInStock) return false;
    const matchCat = cat === "all" || (p.category || "").trim() === (cat || "").trim();
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.name_kg || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q) ||
      (p.shortDesc || "").toLowerCase().includes(q) ||
      (p.tags || "").toLowerCase().includes(q) ||
      (p.desc || "").toLowerCase().includes(q);
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

  const openDetail = (p) => { setDetail(p); setSelVariant(p.variants.find(v => v.inStock) || p.variants[0]); setImgIndex(0); setImgIsLandscape(false); setDescExpanded(false); scrollMV.set(0); heroScale.set(1); setIsDetailOpen?.(true); };

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
          {/* ── Hero image — adaptive: landscape photos get `cover` (edge-to-edge),
              portrait/cutout images get `contain` with a rich blurred backdrop.
              Aspect ratio is detected on load for each image. ── */}
          <motion.div
            style={{
              position: "relative",
              width: "100%",
              height: heroHeight,
              backgroundColor: "#FFFFFF",
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
                {/* Blurred backdrop — hidden for portrait (white bg), visible for landscape */}
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
                    filter: imgIsLandscape ? "blur(0px)" : "blur(44px) saturate(140%) brightness(0.95)",
                    transform: imgIsLandscape ? "scale(1)" : "scale(1.25)",
                    opacity: 0,
                    pointerEvents: "none",
                    transition: "filter 0.3s, opacity 0.3s, transform 0.3s",
                  }}
                />
                {/* Foreground: cover for landscape, contain for portrait */}
                <motion.img
                  src={allImages[imgIndex]}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const { naturalWidth: nw, naturalHeight: nh } = e.target;
                    setImgIsLandscape(nw > 0 && nh > 0 && nw / nh >= 1.25);
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: imgIsLandscape ? "cover" : "contain",
                    objectPosition: "center center",
                    display: "block",
                    zIndex: 1,
                    scale: heroScale,
                    transformOrigin: "center center",
                    willChange: "transform",
                    padding: imgIsLandscape ? 0 : 16,
                    boxSizing: "border-box",
                    transition: "padding 0.3s",
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
            boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
          }}>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{detail.brand}</div>
              <div style={{ color: "#111", fontSize: 26, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 8 }}>{pickName(detail, lang)}</div>
              {/* Sale badge + countdown in detail */}
              {(() => {
                const si = getSaleInfo(detail);
                if (!si) return null;
                return <SaleCountdownBadge product={detail} />;
              })()}
              {pickDesc(detail, lang) && (
                <div>
                  <motion.div
                    animate={{ height: descExpanded ? "auto" : 60 }}
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    style={{
                      overflow: "hidden",
                      WebkitMaskImage: descExpanded ? "none" : "linear-gradient(to bottom, #000 60%, transparent 100%)",
                      maskImage: descExpanded ? "none" : "linear-gradient(to bottom, #000 60%, transparent 100%)",
                    }}
                  >
                    <DescRenderer text={pickDesc(detail, lang)} color="#6b6b70" iconColor="#999" />
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
                {detail.variants.filter(v => v.inStock).map((v, i) => {
                  const isSel = selVariant?.id === v.id;
                  const staggered = i < 4;
                  return (
                    <motion.div
                      key={v.id}
                      initial={staggered ? { opacity: 0, y: 10 } : false}
                      animate={staggered ? { opacity: 1, y: 0 } : undefined}
                      transition={staggered ? { duration: 0.28, delay: 0.2 + i * 0.06, ease: [0.22, 1, 0.36, 1] } : undefined}
                    >
                      <motion.button
                        onClick={() => setSelVariant(v)}
                        whileTap={{ scale: 0.94 }}
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
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? "#fff" : "#111", lineHeight: 1.2 }}>{v.label}</div>
                        {(() => {
                          const si = getSaleInfo(detail);
                          if (si) {
                            const sp = salePrice(v.price, si.percent);
                            return (
                              <div style={{ marginTop: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isSel ? "#fff" : "#FF3B30" }}>{formatSum(sp)}</span>
                                <span style={{ fontSize: 10, color: isSel ? "rgba(255,255,255,0.4)" : "#bbb", textDecoration: "line-through", marginLeft: 4 }}>{formatSum(v.price)}</span>
                              </div>
                            );
                          }
                          return <div style={{ fontSize: 12, color: isSel ? "rgba(255,255,255,0.65)" : "#999", marginTop: 4 }}>{formatSum(v.price)}</div>;
                        })()}
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
                style={{ display: "flex", alignItems: "baseline", gap: 8 }}
              >
                {(() => {
                  const si = getSaleInfo(detail);
                  if (si) {
                    return (
                      <>
                        <span style={{ color: "#FF3B30", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1 }}>
                          {formatSum(salePrice(selVariant.price, si.percent))}
                        </span>
                        <span style={{ color: "#bbb", fontSize: 16, fontWeight: 500, textDecoration: "line-through" }}>
                          {formatSum(selVariant.price)}
                        </span>
                      </>
                    );
                  }
                  return (
                    <span style={{ color: "#111", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1 }}>
                      {formatSum(selVariant.price)}
                    </span>
                  );
                })()}
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
          style={{ padding: "0 16px 10px", position: "relative", zIndex: 100 }}
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
          {/* Smart search dropdown */}
          <AnimatePresence>
            {search.length >= 3 && (
              <SearchDropdown
                results={smartSearch(products, search, lang)}
                onSelect={(p) => { openDetail(p); setSearch(""); }}
                lang={lang}
                isMobile={true}
              />
            )}
          </AnimatePresence>
        </motion.div>
        {/* Backdrop overlay when search is active */}
        <AnimatePresence>
          {search.length >= 3 && smartSearch(products, search, lang).length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearch("")}
              style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.2)", zIndex: 99 }}
            />
          )}
        </AnimatePresence>
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
          // PRO: only animate first 8 cards for smooth initial load;
          // remaining cards render instantly to avoid 500+ motion.div jank.
          if (idx < 8) {
            const delay = idx * 0.035;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay, ease: [0.32, 0.72, 0, 1] }}
              >
                <ProductCard
                  p={p}
                  onClick={() => openDetail(p)}
                  showAudioHint={idx === 0 && audioHintVisible}
                  onAudioHintDismiss={() => setAudioHintVisible(false)}
                />
              </motion.div>
            );
          }
          return (
            <div key={p.id} className="product-card-wrap">
              <ProductCard
                p={p}
                onClick={() => openDetail(p)}
              />
            </div>
          );
        })}
      </div>

      {/* ── ОТЗЫВЫ КЛИЕНТОВ (approved reviews) ── */}
      {(() => {
        const approved = reviews.filter(r => r.approved);
        if (approved.length === 0) return null;
        return (
          <div style={{ padding: "28px 16px 20px" }}>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 6, fontWeight: 600 }}>
              {lang === 'kg' ? 'Кардарлардын пикири' : 'Отзывы клиентов'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 400, color: "#0a0a0a", marginBottom: 20, fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
              {lang === 'kg' ? 'Алар биз жөнүндө эмне дейт' : 'Что говорят о нас'}
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
              {approved.slice(0, 10).map((r, i) => (
                <motion.div
                  key={r.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  style={{
                    minWidth: 260, maxWidth: 280, flexShrink: 0,
                    background: "#f7f7f5", borderRadius: 16, padding: "20px 18px",
                    border: "1px solid rgba(0,0,0,0.05)", scrollSnapAlign: "start",
                  }}
                >
                  <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
                    {[1,2,3,4,5].map(s => (
                      <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= (r.rating || 5) ? "#111" : "#ddd"}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    "{r.text}"
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", background: "#111",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 11, fontWeight: 600,
                    }}>
                      {(r.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{r.name}</div>
                      {r.city && <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{r.city}</div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

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
  const [showPayQr, setShowPayQr] = useState(false);

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

  const subtotal = items.reduce((s, i) => {
    const si = getSaleInfo(i.prod);
    const fp = si ? salePrice(i.variant.price, si.percent) : i.variant.price;
    return s + fp * i.qty;
  }, 0);
  const _minFree = settings?.minOrderForFreeDelivery || 0;
  const deliveryCost = deliveryType === "delivery" ? (_minFree > 0 && subtotal >= _minFree ? 0 : (settings?.deliveryCost || 0)) : 0;
  const bonusDiscount = useBonus ? Math.min(bonusBalance, Math.floor(subtotal * (useBonusPercent / 100))) : 0;
  const total = subtotal + deliveryCost - bonusDiscount;

  // ── Out-of-stock detection for cart items ──────────────────────────────
  const outOfStockIds = new Set(
    items.filter(i => i.variant?.inStock === false).map(i => `${i.productId}_${i.variantId}`)
  );
  const hasOutOfStock = outOfStockIds.size > 0;
  const canCheckout = total > 0 && !hasOutOfStock && items.length > 0;

  const updateQty = (ci, d) => setCart(prev => { const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId ? { ...i, qty: Math.max(1, i.qty + d) } : i); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });
  const remove = (ci) => setCart(prev => { const next = prev.filter(i => !(i.productId === ci.productId && i.variantId === ci.variantId)); localStorage.setItem('parfum_cart', JSON.stringify(next)); return next; });

  // The single floating checkout bar (in App.jsx) submits the order from the
  // cart screen via this window event. We mirror form state into a ref so the
  // listener never closes over stale values.
  const formRef = React.useRef(null);
  formRef.current = { comment, useBonus, deliveryType, address, payMethod, total, bonusDiscount, subtotal, canCheckout };
  React.useEffect(() => {
    const handler = () => {
      if (!formRef.current.canCheckout) return; // Block invalid orders at UI level
      onOrder?.(formRef.current);
    };
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
          {items.map((item) => {
            const isOOS = outOfStockIds.has(`${item.productId}_${item.variantId}`);
            return (
            <motion.div
              key={`${item.productId}-${item.variantId}`}
              layout
              initial={{ opacity: 0, x: -16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 120, scale: 0.85, transition: { duration: 0.22 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ ...card({ padding: "14px 16px" }), display: "flex", gap: 12, alignItems: "center", ...(isOOS ? { border: '2px solid #FF3B30', opacity: 0.7 } : {}) }}
            >
              <div style={{ width: 60, height: 60, borderRadius: 14, background: T.accentPale, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {item.prod.img ? <img src={item.prod.img} style={{ width: "100%", height: "100%", objectFit: "cover", ...(isOOS ? { filter: 'grayscale(1)' } : {}) }} /> : React.cloneElement(IC.bottle, { style: { width: 28, height: 28, color: T.accent, opacity: 0.5 } })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{item.prod.brand}</div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{item.prod.name}</div>
                <div style={{ color: T.accent, fontSize: 12, fontWeight: 600 }}>{item.variant.label}</div>
                {isOOS && <div style={{ color: '#FF3B30', fontSize: 11, fontWeight: 700, marginTop: 2 }}>{lang === 'kg' ? 'Кампада жок' : 'Нет в наличии'}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <button onClick={() => remove(item)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2 }}>{IC.close}</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => updateQty(item, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer", fontSize: 16, fontWeight: 700, color: T.text }}>−</button>
                  <motion.span key={item.qty} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 22 }} style={{ fontWeight: 700, minWidth: 16, textAlign: "center", color: T.text, display: 'inline-block' }}>{item.qty}</motion.span>
                  <button onClick={() => updateQty(item, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: T.accent, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#fff" }}>+</button>
                </div>
                <motion.div key={(() => { const si = getSaleInfo(item.prod); const fp = si ? salePrice(item.variant.price, si.percent) : item.variant.price; return fp * item.qty; })()} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }} style={{ color: T.accent, fontWeight: 800, fontSize: 14 }}>{(() => { const si = getSaleInfo(item.prod); const fp = si ? salePrice(item.variant.price, si.percent) : item.variant.price; return formatSum(fp * item.qty); })()}</motion.div>
              </div>
            </motion.div>
          ); })}
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
            { id: 'odengi', label: 'Онлайн оплата', logo: <svg style={{width:24,height:24,flexShrink:0,display:'block'}} viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/><rect x="5" y="14" width="4" height="2" rx="1" fill="currentColor"/></svg> },
            { id: 'cash',  label: 'Наличные / Нак. акча', logo: <CashLogo size={24} /> },
          ].map(opt => {
            const selected = payMethod === opt.id;
            return (
              <motion.button
                key={opt.id}
                onClick={() => { haptic('light'); setPayMethod(opt.id); }}
                whileTap={{ scale: 0.97 }}
                animate={{
                  borderColor: selected ? 'rgba(17,17,17,0.12)' : T.border,
                  backgroundColor: selected ? '#111' : '#fff',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 14,
                  border: '1px solid', cursor: "pointer",
                  width: "100%", marginBottom: 8,
                  textAlign: "left", boxSizing: "border-box",
                  boxShadow: selected ? '0 2px 12px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                <motion.div
                  animate={{ color: selected ? '#fff' : '#999' }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  {opt.logo}
                </motion.div>
                <motion.span
                  animate={{ color: selected ? '#fff' : T.text }}
                  transition={{ duration: 0.2 }}
                  style={{ fontWeight: 600, fontSize: 14.5, flex: 1, letterSpacing: -0.2 }}
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
                        background: 'rgba(255,255,255,0.2)',
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
        {/* Out-of-stock warning banner */}
        {hasOutOfStock && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FFECB5', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#664D03', fontWeight: 500 }}>
              {lang === 'kg' ? 'Себетте кампада жок товарлар бар. Аларды өчүрүңүз.' : 'В корзине есть товары, которых нет в наличии. Удалите их для оформления.'}
            </span>
          </div>
        )}
        {total <= 0 && items.length > 0 && !hasOutOfStock && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FFECB5', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#664D03', fontWeight: 500 }}>
              {lang === 'kg' ? 'Заказдын суммасы 0 болушу мүмкүн эмес' : 'Сумма заказа не может быть 0 сом'}
            </span>
          </div>
        )}
        <motion.button
          style={{
            ...btnGreen(),
            width: "100%",
            marginTop: 12,
            marginBottom: 8,
            ...(canCheckout ? {} : { opacity: 0.45, pointerEvents: 'none' }),
          }}
          whileTap={canCheckout ? { scale: 0.97 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          disabled={!canCheckout}
          onClick={() => { if (!canCheckout) return; haptic('medium'); window.dispatchEvent(new CustomEvent('cart:checkout')); }}
        >
          {t.placeOrder}
        </motion.button>
      </div>
    </div>
  );
}

// ─── MY ORDERS SCREEN ──────────────────────────────────────────────────────────
export function MyOrdersScreen({ orders, goToCatalog, reviews, user, showToast }) {
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
                          notifyNewReview(user?.name || user?.phone || 'Клиент', reviewRating);
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
function ProfileScreen({ user, onLogout, onDeleteAccount, bonusBalance, bonusHistory, referralCode, settings, onCopyReferral, onAdminLogin, goToOrders, onOpenNotifications, unreadNotifCount = 0 }) {
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
          onClick={() => { haptic('light'); if (onOpenNotifications) onOpenNotifications(); }}
          style={{ ...card({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            {React.cloneElement(IC.bell, { style: { width: 18, height: 18, color: T.accent } })}
            {unreadNotifCount > 0 && (
              <div style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: "#FF3B30", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid #fff" }}>
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{lang === 'kg' ? 'Билдирүүлөр' : 'Уведомления'}</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>
              {unreadNotifCount > 0
                ? (lang === 'kg' ? `${unreadNotifCount} жаңы билдирүү` : `${unreadNotifCount} новых`)
                : (lang === 'kg' ? 'Заказ статусу жөнүндө' : 'О статусах заказа')}
            </div>
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

      {/* ── Akkaunt o'chirish — App Store Guideline 5.1.1(v) majburiy talabi ── */}
      {user && !user.isGuest && onDeleteAccount && (
        <div style={{ padding: "8px 16px 28px" }}>
          <button
            onClick={onDeleteAccount}
            style={{ width: "100%", background: "transparent", border: "none", color: T.danger, fontSize: 13, fontWeight: 600, padding: "12px 0", cursor: "pointer", fontFamily: "inherit" }}
          >{t.deleteAccount}</button>
          <div style={{ textAlign: "center", color: T.textMuted, fontSize: 11, marginTop: 2 }}>{t.deleteAccountHint}</div>
        </div>
      )}

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
// PRO redesign: quick actions, search, archive, inline status dropdown
// ─── P2.1b: ADMIN EKRANLAR alohida chunk'da (src/screens/AdminScreens.jsx) ───
// React.lazy: admin kodi (≈5100 qator) faqat admin kirganda yuklanadi.
// withSuspense iOS-uslubidagi spinner bilan o'raydi (utils/lazyScreen.jsx).
const _adminChunk = () => import("./screens/AdminScreens.jsx");
const AdminOrdersScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminOrdersScreen }))));
const AdminProductsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminProductsScreen }))));
const AdminStatsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminStatsScreen }))));
const AdminClientsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminClientsScreen }))));
const AdminBannersScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminBannersScreen }))));
const AdminBonusScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminBonusScreen }))));
const AdminNotificationsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminNotificationsScreen }))));
const AdminSettingsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminSettingsScreen }))));
const AdminReviewsScreen = withSuspense(React.lazy(() => _adminChunk().then(m => ({ default: m.AdminReviewsScreen }))));
function OdengiPayment({ total, pendingOrder, onConfirm, onCancel, showToast }) {
  const [phase, setPhase] = React.useState('creating'); // creating | waiting | success | error
  const [paymentData, setPaymentData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [statusText, setStatusText] = React.useState('');
  const [dots, setDots] = React.useState('');
  const pollRef = React.useRef(null);
  const orderIdRef = React.useRef(null);

  // Animated dots for waiting text
  React.useEffect(() => {
    if (phase !== 'waiting' && phase !== 'creating') return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(iv);
  }, [phase]);

  // Phase 1: Create PB order + invoice
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pbData = {
          clientName: pendingOrder.clientName || '',
          clientPhone: pendingOrder.clientPhone || '',
          items: pendingOrder.items || [],
          date: pendingOrder.date || new Date().toLocaleString('ru-RU'),
          status: 'new',
          total: total || 0,
          payMethod: 'odengi',
          address: pendingOrder.address || '',
          comment: pendingOrder.comment || '',
          bonusDiscount: pendingOrder.bonusDiscount || 0,
          paymentMethod: 'odengi',
          paymentStatus: 'odengi_pending',
        };
        const { pb } = await import('./api/pb');
        const created = await pb.collection('orders').create(pbData);
        if (cancelled) return;
        orderIdRef.current = created.id;

        const invoiceResult = await createOdengiInvoice(created.id);
        if (cancelled) return;
        setPaymentData(invoiceResult);
        setPhase('waiting');

        pollOdengiPayment(created.id, {
          intervalMs: 3000,
          timeoutMs: 600000,
          onStatus: (s) => {
            if (cancelled) return;
            if (s.paymentApproved) {
              setPhase('success');
              setTimeout(() => onConfirm?.({ ...pendingOrder, id: created.id }), 1800);
            } else {
              setStatusText(s.status === 'processing' ? 'Ожидание оплаты' : (s.status || ''));
            }
          }
        }).then(paid => {
          if (cancelled) return;
          if (!paid && phase !== 'success') {
            setStatusText('Время ожидания истекло');
          }
        });
      } catch (e) {
        if (cancelled) return;
        console.error('OdengiPayment error:', e);
        setError(String(e.message || e));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openPaylink = () => {
    if (paymentData?.paylink_url) window.open(paymentData.paylink_url, '_blank');
    else if (paymentData?.site_pay) window.open(paymentData.site_pay, '_blank');
    else if (paymentData?.link_app) window.open(paymentData.link_app, '_blank');
  };

  const handleCancel = async () => {
    if (orderIdRef.current) {
      try { await cancelOdengiInvoice(orderIdRef.current); } catch (_) {}
    }
    onCancel?.();
  };

  // Pulsing ring animation for waiting
  const PulseRing = () => (
    <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          animate={{ scale: [1, 2.2], opacity: [0.25, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #FF6B00' }}
        />
      ))}
      <div style={{
        position: 'absolute', inset: 8, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF6B00 0%, #FF9500 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(255,107,0,0.35)'
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>
          <rect x="6" y="14" width="4" height="2" rx="1"/>
        </svg>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'creating') handleCancel(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        style={{
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 460,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0))',
          overflow: 'hidden',
        }}
      >
        {/* Grab handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: '#E0E0E0' }} />
        </div>

        {/* Header strip */}
        <div style={{
          padding: '8px 24px 20px',
          textAlign: 'center',
          borderBottom: phase === 'waiting' ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', letterSpacing: -0.3 }}>
            Онлайн оплата
          </div>
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{ fontSize: 28, fontWeight: 800, color: '#FF6B00', marginTop: 4, letterSpacing: -0.5 }}
          >
            {total?.toLocaleString()} сом
          </motion.div>
        </div>

        {/* ── Creating phase ── */}
        {phase === 'creating' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '40px 24px', textAlign: 'center' }}
          >
            <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto 16px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '3px solid #F0F0F0',
                  borderTopColor: '#FF6B00',
                }}
              />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Создание счёта{dots}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 6 }}>Подождите немного</div>
          </motion.div>
        )}

        {/* ── Waiting for payment ── */}
        {phase === 'waiting' && paymentData && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ padding: '24px 24px 16px' }}
          >
            {/* QR Code */}
            {paymentData.qr_url && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  background: '#FAFAFA', borderRadius: 16, padding: 16,
                  marginBottom: 16, border: '1px solid #F0F0F0',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                <img
                  src={paymentData.qr_url} alt="QR"
                  style={{
                    width: 180, height: 180, display: 'block',
                    borderRadius: 12, border: '1px solid #eee',
                  }}
                />
                <div style={{ fontSize: 12, color: '#999', marginTop: 10, letterSpacing: 0.2 }}>
                  Сканируйте QR-код для оплаты
                </div>
              </motion.div>
            )}

            {/* Divider with text */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px' }}>
              <div style={{ flex: 1, height: 0.5, background: '#E5E5E5' }} />
              <span style={{ fontSize: 11, color: '#BBB', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>или</span>
              <div style={{ flex: 1, height: 0.5, background: '#E5E5E5' }} />
            </div>

            {/* Open wallet button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openPaylink}
              style={{
                width: '100%', padding: '16px 20px',
                background: 'linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%)',
                color: '#fff', border: 'none', borderRadius: 14,
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255,107,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                letterSpacing: -0.2,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h7"/>
                <circle cx="18" cy="17" r="3"/><path d="M18 15v4"/><path d="M16 17h4"/>
              </svg>
              Открыть онлайн кошелёк
            </motion.button>

            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 20, padding: '10px 0',
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid #F0F0F0', borderTopColor: '#FF6B00',
                }}
              />
              <span style={{ fontSize: 13, color: '#999', fontWeight: 500 }}>
                {statusText || 'Ожидание оплаты'}{dots}
              </span>
            </div>

            {/* Cancel */}
            <button
              onClick={handleCancel}
              style={{
                display: 'block', width: '100%', marginTop: 8,
                background: 'none', border: 'none',
                color: '#C4C4C4', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', padding: '10px 16px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = '#FF3B30'}
              onMouseLeave={e => e.target.style.color = '#C4C4C4'}
            >
              Отменить оплату
            </button>
          </motion.div>
        )}

        {/* ── Success ── */}
        {phase === 'success' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '40px 24px', textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
              style={{
                width: 72, height: 72, margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 24px rgba(52,199,89,0.3)',
              }}
            >
              <motion.svg
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </motion.svg>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 4 }}>Оплата прошла!</div>
              <div style={{ fontSize: 14, color: '#999' }}>Заказ успешно оплачен</div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '36px 24px', textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                width: 64, height: 64, margin: '0 auto 16px',
                borderRadius: '50%', background: '#FFF2F0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>
              </svg>
            </motion.div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 6 }}>Ошибка оплаты</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 24, lineHeight: 1.5, padding: '0 12px' }}>{error}</div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCancel}
              style={{
                padding: '14px 32px',
                background: '#111', color: '#fff', border: 'none',
                borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', letterSpacing: -0.2,
              }}
            >
              Закрыть
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// Chiroyli chek ekran — buyurtma tasdiqlangandan keyin ko'rsatiladi.
// "Adminga yuborish" tugmasi WhatsApp deeplink orqali chek matnini yuboradi.
function OrderReceipt({ order, settings, onClose }) {
  if (!order) return null;
  const items = order.items || [];
  const payLabel = order.payMethod === 'odengi' ? 'Онлайн оплата' : 'Наличные';
  const deliveryLabel = order.deliveryType === 'pickup' ? 'Самовывоз' : (order.address || 'Доставка');
  const adminPhone = (settings?.whatsappPhone || '').replace(/\D/g, '');

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

  const fileInputRef = React.useRef(null);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  // Option A: WhatsApp text — asks client to attach screenshot manually
  const shareTextToAdmin = () => {
    const bankName = 'Онлайн оплата';
    const msg = `📋 ${receiptText}\n\n✅ Оплата совершена через ${bankName}.\n\n📎 Пожалуйста, отправьте сюда скриншот квитанции об оплате для подтверждения заказа 🙏`;
    if (adminPhone) {
      window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (navigator.share) {
      navigator.share({ title: `Заказ №${order.id}`, text: msg }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(msg);
    }
  };

  // Option B: Pick image from camera/gallery, then share via navigator.share (with file) or WhatsApp
  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);
  };

  const shareImageToAdmin = async () => {
    if (!selectedImage) return;
    setSending(true);
    const bankName = 'Онлайн оплата';
    const caption = `📋 Квитанция об оплате\n\nЗаказ №${order.id}\nСумма: ${(order.total || 0).toLocaleString()} сом\nОплата: ${bankName}\nКлиент: ${order.clientName}\nТел: ${order.clientPhone}\n\n✅ Подтвердите, пожалуйста 🙏`;

    // Try navigator.share with files (works on iOS Safari / Capacitor WKWebView)
    if (navigator.share && navigator.canShare) {
      try {
        const shareData = {
          title: `Квитанция — Заказ №${order.id}`,
          text: caption,
          files: [selectedImage],
        };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setSending(false);
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[receipt] share failed:', err);
      }
    }
    // Fallback: open WhatsApp with text (image can't be pre-attached via deeplink)
    if (adminPhone) {
      const fallbackMsg = `${caption}\n\n⚠️ Фото квитанции прикреплено отдельно — пожалуйста, проверьте.`;
      window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(fallbackMsg)}`, '_blank');
    }
    setSending(false);
  };

  const isBankPayment = false;

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

        {/* Bank payment receipt section */}
        {isBankPayment && (
          <div style={{ marginBottom: 10 }}>
            {/* Hidden file input for camera/gallery */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImagePick}
            />

            {/* Selected image preview */}
            {selectedImage && (
              <div style={{ marginBottom: 10, position: 'relative' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Квитанция выбрана
                </div>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #E8F5E9', position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(selectedImage)}
                    alt="receipt"
                    style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Two-button layout: camera/gallery + WhatsApp text */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {/* Option B: Pick photo of receipt */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, padding: '13px 8px',
                  background: selectedImage ? '#E8F5E9' : '#F5F5F5',
                  color: selectedImage ? '#2E7D32' : '#333',
                  border: selectedImage ? '1.5px solid #A5D6A7' : '1.5px solid #E0E0E0',
                  borderRadius: 14, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {selectedImage ? 'Заменить фото' : 'Фото квитанции'}
              </motion.button>

              {/* Option A: WhatsApp text asking to attach */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={shareTextToAdmin}
                style={{
                  flex: 1, padding: '13px 8px',
                  background: '#25D366', color: '#fff', border: 'none', borderRadius: 14,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 2px 8px rgba(37,211,102,0.25)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.005 21.785a9.674 9.674 0 01-4.93-1.35l-.354-.21-3.67.963.98-3.577-.231-.367A9.67 9.67 0 012.22 12.01C2.222 6.61 6.607 2.226 12.01 2.226c2.613 0 5.068 1.019 6.914 2.867a9.715 9.715 0 012.862 6.918c-.003 5.4-4.388 9.784-9.78 9.784z"/></svg>
                Отправить чек
              </motion.button>
            </div>

            {/* Send selected image via share API */}
            {selectedImage && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={shareImageToAdmin}
                disabled={sending}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  width: '100%', padding: 15, marginBottom: 10,
                  background: sending ? '#999' : '#111', color: '#fff', border: 'none', borderRadius: 14,
                  fontSize: 14, fontWeight: 700, cursor: sending ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {sending ? 'Отправка...' : 'Отправить квитанцию администратору'}
              </motion.button>
            )}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          style={{ width: '100%', padding: 15, background: isBankPayment ? '#F5F5F5' : '#111', color: isBankPayment ? '#333' : '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
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

// ─── FLOATING DRAGGABLE CART PILL ──────────────────────────────────────────
// Extracted as a proper component so React hooks run stably (no IIFE).
function FloatingCartPill({ cartCount, cartTotal, lang, screen, onGoToCart }) {
  const STORAGE_KEY = 'parfum_cart_pill_pos';
  const pillRef = React.useRef(null);
  const dragState = React.useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const [expanded, setExpanded] = React.useState(false);

  const getDefaultPos = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.x >= 0 && p.y >= 0 && p.x < window.innerWidth - 40 && p.y < window.innerHeight - 20) return p;
      }
    } catch {}
    return { x: window.innerWidth - 220, y: window.innerHeight - 160 };
  };
  const [pillPos, setPillPos] = React.useState(getDefaultPos);

  const clamp = React.useCallback((pos) => {
    const el = pillRef.current;
    const w = el ? el.offsetWidth : 200;
    const h = el ? el.offsetHeight : 52;
    return {
      x: Math.max(8, Math.min(pos.x, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(pos.y, window.innerHeight - h - 8)),
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    const touch = e.touches ? e.touches[0] : e;
    dragState.current = { dragging: true, startX: touch.clientX, startY: touch.clientY, origX: pillPos.x, origY: pillPos.y, moved: false };
    e.preventDefault();
  };

  const onPointerMove = React.useCallback((e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - ds.startX;
    const dy = touch.clientY - ds.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) ds.moved = true;
    if (!ds.moved) return;
    setPillPos(clamp({ x: ds.origX + dx, y: ds.origY + dy }));
  }, [clamp]);

  const onPointerUp = React.useCallback(() => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    ds.dragging = false;
    setPillPos(prev => {
      const pillW = pillRef.current?.offsetWidth || 200;
      const midX = window.innerWidth / 2;
      const snapX = prev.x + pillW / 2 < midX ? 12 : window.innerWidth - pillW - 12;
      const snapped = clamp({ x: snapX, y: prev.y });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)); } catch {}
      return snapped;
    });
  }, [clamp]);

  React.useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  React.useEffect(() => {
    const onResize = () => setPillPos(prev => clamp(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const ruPlural = (n) => {
    const m100 = n % 100;
    if (m100 >= 11 && m100 <= 14) return 'товаров';
    const m10 = n % 10;
    if (m10 === 1) return 'товар';
    if (m10 >= 2 && m10 <= 4) return 'товара';
    return 'товаров';
  };
  const itemsWord = lang === 'kg' ? 'товар' : ruPlural(cartCount);
  const onCart = screen === 'cart';
  const ctaLabel = onCart
    ? (lang === 'kg' ? 'Заказ берүү' : 'Оформить заказ')
    : (lang === 'kg' ? 'Заказга өтүү' : 'Перейти к оформлению');

  const handleTap = () => {
    haptic('medium');
    if (onCart) {
      window.dispatchEvent(new CustomEvent('cart:checkout'));
    } else {
      onGoToCart();
    }
  };

  return (
    <motion.div
      ref={pillRef}
      key="floating-cart-pill"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, x: pillPos.x, y: pillPos.y }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        x: { type: 'spring', stiffness: 300, damping: 28 },
        y: { type: 'spring', stiffness: 300, damping: 28 },
        scale: { type: 'spring', stiffness: 500, damping: 25 },
      }}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      style={{
        position: "fixed", top: 0, left: 0,
        zIndex: 9999,
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: dragState.current.dragging ? "grabbing" : "grab",
      }}
    >
      {/* Outer glow layer */}
      <motion.div
        animate={{
          boxShadow: expanded
            ? "0 0 28px 4px rgba(255,107,0,0.18), 0 8px 32px rgba(0,0,0,0.35)"
            : "0 0 16px 2px rgba(255,107,0,0.12), 0 4px 20px rgba(0,0,0,0.3)",
        }}
        transition={{ duration: 0.4 }}
        style={{ borderRadius: 50 }}
      >
        <motion.button
          onClick={() => {
            if (dragState.current.moved) { dragState.current.moved = false; return; }
            if (expanded) {
              handleTap();
            } else {
              setExpanded(true);
              setTimeout(() => setExpanded(false), 4000);
            }
          }}
          whileTap={!dragState.current.moved ? { scale: 0.93 } : {}}
          style={{
            background: "rgba(18,18,20,0.82)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderRadius: 50,
            padding: expanded ? "8px 16px 8px 8px" : "8px",
            border: "0.5px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", gap: expanded ? 10 : 0,
            cursor: dragState.current.dragging ? "grabbing" : "pointer",
            whiteSpace: "nowrap",
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle inner highlight */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
            borderRadius: '50px 50px 0 0',
            pointerEvents: 'none',
          }} />

          {/* Cart icon circle */}
          <div style={{ position: 'relative', flexShrink: 0, zIndex: 1 }}>
            <motion.div
              animate={{
                background: expanded
                  ? "linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%)"
                  : "rgba(255,255,255,0.1)",
              }}
              transition={{ duration: 0.3 }}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
                boxShadow: expanded ? "0 2px 12px rgba(255,107,0,0.3)" : "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </motion.div>

            {/* Badge */}
            <motion.div
              key={`badge-${cartCount}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 19, height: 19, borderRadius: 10,
                background: '#FF3B30',
                color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
                border: '2px solid rgba(18,18,20,0.9)',
                boxShadow: '0 1px 6px rgba(255,59,48,0.4)',
              }}
            >
              {cartCount}
            </motion.div>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    color: '#fff', fontSize: 13.5, fontWeight: 700,
                    letterSpacing: -0.3,
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}>
                    {ctaLabel}
                  </span>
                  <span style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: 11.5, fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {cartCount} {itemsWord} · <AnimatedSum value={cartTotal} duration={0.55} />
                  </span>
                </div>

                {/* Arrow button */}
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(255,107,0,0.2)',
                    border: '1px solid rgba(255,107,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export function ProductAudioRecorder({ productId, onAudioUploaded }) {
  const { lang } = useLang();
  const key = 'parfum_audio_' + productId;

  // Check if PB already has audio for this product
  const [pbHasAudio, setPbHasAudio] = React.useState(false);
  const [pbAudioUrl, setPbAudioUrl] = React.useState(null);

  // status: idle | requesting | recording | encoding | uploading | done | error
  const [status, setStatus] = React.useState('idle');
  const [error, setError] = React.useState(null);
  const [countdown, setCountdown] = React.useState(10);
  const [duration, setDuration] = React.useState(0);
  const [uploadProgress, setUploadProgress] = React.useState('');

  const player = useAudioPlayer();
  const audioSrc = pbAudioUrl || null;
  const isMine = !!audioSrc && player.currentSrc === audioSrc;
  const isPlaying = isMine && player.isPlaying;
  const currentTime = isMine ? player.currentTime : 0;
  const totalDur = isMine ? (player.duration || duration || 10) : (duration || 10);
  const progress = totalDur > 0 ? Math.min(1, currentTime / totalDur) : 0;

  const recorderRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const startTimeRef = React.useRef(0);
  const tickRef = React.useRef(null);
  const stopTimerRef = React.useRef(null);
  const audioBlobRef = React.useRef(null);

  const isRu = lang !== 'kg';

  // On mount — check if product has audio in PB
  React.useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const rec = await pb.collection('products').getOne(productId);
        if (rec.audio) {
          const url = `${PB_URL}/api/files/products/${rec.id}/${rec.audio}`;
          setPbAudioUrl(url);
          setPbHasAudio(true);
          setStatus('done');
        } else if (localStorage.getItem(key)) {
          setStatus('done');
        }
      } catch {}
    })();
  }, [productId]);

  const errMsg = (kind) => {
    const map = {
      ru: { unsupported: 'Запись не поддерживается', permission: 'Нет доступа к микрофону', record: 'Ошибка записи', upload: 'Не удалось загрузить на сервер' },
      kg: { unsupported: 'Жазуу колдоого алынбайт', permission: 'Микрофонго мүмкүнчүлүк жок', record: 'Жазуу катасы', upload: 'Серверге жүктөө мүмкүн болбоду' },
    };
    return (lang === 'kg' ? map.kg : map.ru)[kind] || kind;
  };

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

  React.useEffect(() => () => { cleanupRecorder(); }, []);

  // ── Upload blob to PocketBase ──────────────────────────────────────────
  const uploadToPB = async (blob) => {
    if (!productId || !blob) return;
    setStatus('uploading');
    setUploadProgress(isRu ? 'Загрузка на сервер...' : 'Серверге жүктөлүүдө...');
    try {
      const ext = (blob.type?.split('/')[1] || 'm4a').replace('mpeg', 'mp3').replace('mp4', 'm4a').replace('webm', 'webm');
      const file = new File([blob], `audio_${productId}.${ext}`, { type: blob.type });
      const fd = new FormData();
      fd.append('audio', file);
      const updated = await pb.collection('products').update(productId, fd, { requestKey: null });
      if (updated.audio) {
        const url = `${PB_URL}/api/files/products/${updated.id}/${updated.audio}`;
        setPbAudioUrl(url);
        setPbHasAudio(true);
        // Clean up localStorage — PB is now the source of truth
        localStorage.removeItem(key);
        onAudioUploaded?.();
      }
      setStatus('done');
      setUploadProgress('');
    } catch (err) {
      console.warn('[AudioRecorder] PB upload error:', err);
      // Fall back to localStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        try { localStorage.setItem(key, reader.result); } catch {}
        setStatus('done');
        setUploadProgress('');
      };
      reader.onerror = () => {
        setStatus('error');
        setError(errMsg('upload'));
        setUploadProgress('');
      };
      reader.readAsDataURL(blob);
    }
  };

  // ── Record ─────────────────────────────────────────────────────────────
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
      setStatus('error'); setError(denied ? errMsg('permission') : errMsg('record')); return;
    }
    streamRef.current = stream;
    const mime = pickAudioMime();
    let rec;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setStatus('error'); setError(errMsg('record'));
      stream.getTracks().forEach(t => t.stop()); return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    rec.onerror = () => { setStatus('error'); setError(errMsg('record')); cleanupRecorder(); };
    rec.onstop = () => {
      const elapsedMs = Date.now() - startTimeRef.current;
      cleanupRecorder();
      if (chunks.length === 0) { setStatus('error'); setError(errMsg('record')); return; }
      const recordedMime = rec.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type: recordedMime });
      audioBlobRef.current = blob;
      setDuration(Math.min(10, Math.round(elapsedMs / 1000)));
      // Upload directly to PB
      uploadToPB(blob);
    };
    recorderRef.current = rec;
    setStatus('recording');
    setCountdown(10);
    startTimeRef.current = Date.now();
    try { haptic('light'); } catch {}
    let c = 10;
    tickRef.current = setInterval(() => {
      c -= 1; setCountdown(Math.max(0, c));
      if (c <= 0) { clearInterval(tickRef.current); tickRef.current = null; }
    }, 1000);
    try { rec.start(100); } catch {
      setStatus('error'); setError(errMsg('record')); cleanupRecorder(); return;
    }
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state !== 'inactive') { try { recorderRef.current.stop(); } catch {} }
    }, 10000);
  };

  const stopRecordingEarly = () => {
    if (recorderRef.current?.state !== 'inactive') {
      try { haptic('medium'); } catch {}
      try { recorderRef.current.stop(); } catch {}
    }
  };

  // ── Delete from PB ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    player.pause();
    if (pbHasAudio && productId) {
      try {
        await pb.collection('products').update(productId, { audio: null }, { requestKey: null });
      } catch (e) { console.warn('[AudioRecorder] PB delete error:', e); }
    }
    localStorage.removeItem(key);
    audioBlobRef.current = null;
    setPbAudioUrl(null);
    setPbHasAudio(false);
    setStatus('idle');
    setDuration(0);
    setError(null);
  };

  const togglePlay = () => {
    if (!audioSrc) return;
    player.toggle(audioSrc);
  };

  const fmtTime = (s) => `0:${String(Math.max(0, Math.floor(s))).padStart(2, '0')}`;

  // ── Error banner ───────────────────────────────────────────────────────
  const errorBanner = error && (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,59,48,0.08)', borderRadius: 12, padding: '10px 14px', marginTop: 10, fontSize: 12, color: '#FF3B30', fontWeight: 500 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#FF3B30', display: 'flex' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </motion.div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  RECORDING STATE — iOS Voice Memo style
  // ═══════════════════════════════════════════════════════════════════════
  if (status === 'recording' || status === 'requesting') {
    const elapsed = 10 - countdown;
    return (
      <div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)', borderRadius: 20, padding: '18px 18px 16px', marginTop: 8 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 10, height: 10, borderRadius: 5, background: '#FF3B30', boxShadow: '0 0 8px rgba(255,59,48,0.5)' }}
              />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: -0.2 }}>
                {status === 'requesting'
                  ? (isRu ? 'Доступ к микрофону…' : 'Микрофонго мүмкүнчүлүк…')
                  : fmtTime(elapsed)}
              </span>
              {status === 'recording' && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500 }}>/ 0:10</span>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={stopRecordingEarly} disabled={status === 'requesting'}
              style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,59,48,0.4)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </motion.button>
          </div>
          {/* Waveform — iOS Voice Memo style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, marginBottom: 12, padding: '0 2px' }}>
            <style>{`@keyframes recWave{0%,100%{transform:scaleY(0.2)}25%{transform:scaleY(0.8)}50%{transform:scaleY(1)}75%{transform:scaleY(0.5)}}`}</style>
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 28, borderRadius: 1.5,
                background: `linear-gradient(180deg, #FF3B30 0%, #FF6B6B 100%)`,
                transformOrigin: 'center',
                animation: status === 'recording' ? `recWave ${0.6 + (i % 5) * 0.15}s ease-in-out infinite` : 'none',
                animationDelay: `${(i % 8) * 0.06}s`,
                opacity: status === 'recording' ? (0.4 + Math.random() * 0.6) : 0.2,
                transform: status === 'requesting' ? 'scaleY(0.15)' : undefined,
              }} />
            ))}
          </div>
          {/* Progress track */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div animate={{ width: `${(elapsed / 10) * 100}%` }}
              transition={{ duration: 0.8, ease: 'linear' }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #FF3B30, #FF6B6B)', borderRadius: 3 }} />
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UPLOADING / ENCODING STATE
  // ═══════════════════════════════════════════════════════════════════════
  if (status === 'encoding' || status === 'uploading') {
    return (
      <div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)', borderRadius: 20, padding: '18px 20px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 22, height: 22, border: '2.5px solid rgba(255,255,255,0.15)', borderTopColor: '#FF3B30', borderRadius: '50%', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              {status === 'uploading' ? (isRu ? 'Сохраняем в облако' : 'Булутка сакталууда') : (isRu ? 'Обработка…' : 'Иштетилүүдө…')}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              {uploadProgress || (isRu ? 'Несколько секунд...' : 'Бир нече секунд...')}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DONE STATE — Premium iOS player
  // ═══════════════════════════════════════════════════════════════════════
  if (status === 'done') {
    return (
      <div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)',
            borderRadius: 20, padding: '16px 16px 14px', marginTop: 8,
          }}>
          {/* Player row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={togglePlay}
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: 22,
                background: isPlaying ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.1)',
                border: isPlaying ? '1.5px solid rgba(255,59,48,0.3)' : '1.5px solid rgba(255,255,255,0.12)',
                color: isPlaying ? '#FF3B30' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><polygon points="6 4 20 12 6 20 6 4"/></svg>
              )}
            </motion.button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: '#34C759' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    {pbHasAudio ? (isRu ? 'Сохранено в облаке' : 'Булутта сакталды') : (isRu ? 'Аудио готово' : 'Аудио даяр')}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {isPlaying ? `${fmtTime(currentTime)} / ${fmtTime(totalDur)}` : fmtTime(duration || totalDur)}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', cursor: 'pointer' }}
                onClick={(e) => {
                  if (!audioSrc) return;
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  if (!isMine) player.play(audioSrc);
                  setTimeout(() => player.seek(ratio * totalDur), 100);
                }}>
                <motion.div
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ ease: 'linear', duration: 0.08 }}
                  style={{ height: '100%', background: isPlaying ? '#FF3B30' : 'rgba(255,255,255,0.35)', borderRadius: 3 }} />
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button whileTap={{ scale: 0.95 }} onClick={startRecording}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
              {isRu ? 'Перезаписать' : 'Кайра жаз'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleDelete}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.08)', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              {isRu ? 'Удалить' : 'Өчүрүү'}
            </motion.button>
          </div>
        </motion.div>
        {errorBanner}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  IDLE — Record CTA (iOS Voice Memo inspired)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={startRecording}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          width: '100%', padding: '16px',
          borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)',
          cursor: 'pointer', marginTop: 8,
        }}>
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'linear-gradient(135deg, #FF3B30, #FF6B6B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(255,59,48,0.35)',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </motion.div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
            {isRu ? 'Записать аромат' : 'Жытты жаз'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 1 }}>
            {isRu ? 'до 10 секунд · сохранится на сервере' : '10 секундга чейин · серверге сакталат'}
          </div>
        </div>
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

export function ClientAudioBtn({ product, productId, compact = false }) {
  const { t, lang } = useLang();
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
  const isRu = lang !== 'kg';

  // ── Compact pill (catalog card) — Apple Music mini style ────────────────
  if (compact) {
    return (
      <motion.div
        onClick={e => { e.stopPropagation(); handleToggle(); }}
        whileTap={{ scale: 0.92 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px 4px 5px',
          borderRadius: 20,
          background: isPlaying ? 'linear-gradient(135deg, #1C1C1E, #2C2C2E)' : 'rgba(0,0,0,0.05)',
          cursor: 'pointer',
          marginTop: 8,
          userSelect: 'none',
          alignSelf: 'flex-start',
          border: isPlaying ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.06)',
        }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isPlaying ? 'rgba(255,59,48,0.2)' : 'rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isPlaying ? '#FF3B30' : '#666', flexShrink: 0,
        }}>
          {isPlaying
            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </div>
        {isPlaying ? (
          <div style={{ display: 'flex', gap: 1.5, alignItems: 'center', height: 12 }}>
            <style>{`@keyframes abPro{0%,100%{height:3px}50%{height:10px}}`}</style>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 2, borderRadius: 1, background: '#FF3B30', animation: 'abPro 0.65s ease-in-out infinite', animationDelay: `${i*0.1}s`, height: 3 }}/>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#666', whiteSpace: 'nowrap', letterSpacing: -0.1 }}>
            {t.listenBtn || (isRu ? 'Слушать' : 'Угуу')}
          </span>
        )}
      </motion.div>
    );
  }

  // ── Full player (detail screen) — iOS Now Playing / Apple Music style ──────
  const fmt = (s) => `0:${String(Math.max(0, Math.floor(s))).padStart(2, '0')}`;
  const totalDur = Math.max(1, duration || 10);
  const progressVal = Math.min(1, currentTime / totalDur);

  let titleText, subtitleText;
  if (isError) {
    titleText = isRu ? 'Ошибка воспроизведения' : 'Угуу катасы';
    subtitleText = isRu ? 'Нажмите для повтора' : 'Кайра аракет кылыңыз';
  } else if (isLoading) {
    titleText = isRu ? 'Загрузка...' : 'Жүктөлүүдө...';
    subtitleText = '';
  } else if (isPlaying) {
    titleText = isRu ? 'Описание аромата' : 'Жыт сүрөттөмөсү';
    subtitleText = isRu ? 'Сейчас играет' : 'Азыр ойноп жатат';
  } else {
    titleText = isRu ? 'Послушать аромат' : 'Жытты угуу';
    subtitleText = isRu ? `${fmt(totalDur)} · голосовое описание` : `${fmt(totalDur)} · үн сүрөттөмөсү`;
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, marginBottom: 6 }}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        style={{
          background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)',
          borderRadius: 18,
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        <div onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Play / Pause button — glassmorphic */}
          <motion.div
            animate={isPlaying ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={isPlaying ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
            style={{
              width: 42, height: 42, borderRadius: 21, flexShrink: 0,
              background: isError ? 'rgba(255,59,48,0.2)' : isPlaying ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.1)',
              border: isPlaying ? '1px solid rgba(255,59,48,0.25)' : '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isError ? '#FF3B30' : isPlaying ? '#FF3B30' : '#fff',
            }}>
            {isLoading ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'block' }} />
            ) : isError ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            ) : isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><polygon points="6 4 20 12 6 20 6 4"/></svg>
            )}
          </motion.div>

          {/* Title + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: -0.2, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleText}
            </div>
            {subtitleText && (
              <div style={{ fontSize: 11, color: isPlaying ? '#FF3B30' : 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: -0.1 }}>
                {subtitleText}
              </div>
            )}
          </div>

          {/* Waveform animation (when playing) or mic icon (idle) */}
          {isPlaying ? (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 20, flexShrink: 0 }}>
              <style>{`@keyframes clWave{0%,100%{height:4px}50%{height:16px}}`}</style>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width: 2.5, borderRadius: 2, background: '#FF3B30',
                  animation: 'clWave 0.6s ease-in-out infinite',
                  animationDelay: `${i * 0.08}s`, height: 4,
                }} />
              ))}
            </div>
          ) : !isLoading && !isError && (
            <div style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
          )}
        </div>

        {/* Progress bar — only when active */}
        {isActive && !isError && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.querySelector('[data-track]')?.getBoundingClientRect();
              if (!rect) return;
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              player.seek(ratio * totalDur);
            }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0, width: 28 }}>
              {fmt(currentTime)}
            </span>
            <div data-track style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
              <motion.div
                animate={{ width: `${progressVal * 100}%` }}
                transition={{ ease: 'linear', duration: 0.08 }}
                style={{ height: '100%', background: '#FF3B30', borderRadius: 3, position: 'relative' }}>
                {/* Scrubber dot */}
                <div style={{ position: 'absolute', right: -4, top: -3, width: 9, height: 9, borderRadius: '50%', background: '#FF3B30', boxShadow: '0 0 6px rgba(255,59,48,0.4)' }} />
              </motion.div>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0, width: 28, textAlign: 'right' }}>
              {fmt(totalDur)}
            </span>
          </div>
        )}
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
// ─── P2.1b: DESKTOP LAYOUT alohida chunk'da (src/screens/DesktopLayout.jsx) ───
// Mobil foydalanuvchilar (asosiy auditoriya — iOS ilova) bu kodni yuklamaydi.
const DesktopLayout = withSuspense(React.lazy(() => import("./screens/DesktopLayout.jsx").then(m => ({ default: m.DesktopLayout }))));

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
  const [products, setProducts] = useState([]);
  const [clientNotifications, setClientNotifications] = useState([]);
  const [showNotifSheet, setShowNotifSheet] = useState(false);
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
  // Admin mode is PER-TAB via URL hash (#admin).
  // This lets you run admin in one tab and client store in another.
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      // If URL has #admin and the token is a REAL ADMIN token → admin.
      // SECURITY: a regular client token must never unlock the admin UI.
      if (window.location.hash === '#admin') {
        const isAdminToken = pb.authStore.isValid &&
          (pb.authStore.isAdmin || pb.authStore.model?.collectionName === '_superusers');
        if (isAdminToken) return true;
        // Not an admin token — clean hash
        window.location.hash = '';
      }
      // Legacy: migrate from localStorage-only (old sessions)
      const saved = localStorage.getItem('parfum_is_admin');
      if (saved === 'true' && pb.authStore.isValid) {
        // Don't auto-activate admin — let user choose via #admin
        return false;
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
  const [showRegModal, setShowRegModal] = useState(false);
  const [pendingOrderForReg, setPendingOrderForReg] = useState(null);
  
  const [showOdengi, setShowOdengi] = useState(false);
  const [odengiPaymentData, setOdengiPaymentData] = useState(null);
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
  const [adminLoginEmail, setAdminLoginEmail] = useState(() => {
    try { const s = localStorage.getItem('parfum_admin_saved'); if (s) { const d = JSON.parse(s); return d.email || ""; } } catch {} return "";
  });
  const [adminLoginPass, setAdminLoginPass] = useState(() => {
    // SECURITY: admin password is no longer persisted (it used to sit in
  // localStorage in plaintext). Only the email is remembered.
  return "";
  });
  const [adminLoginErr, setAdminLoginErr] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminRemember, setAdminRemember] = useState(() => {
    try { return !!localStorage.getItem('parfum_admin_saved'); } catch { return false; }
  });
  const [adminShowPass, setAdminShowPass] = useState(false);
  const submitTopAdminLogin = async () => {
    if (!adminLoginEmail || !adminLoginPass) { setAdminLoginErr(t.fillAll || "Заполните все поля"); return; }
    setAdminLoginLoading(true); setAdminLoginErr("");
    try {
      await adminLoginApi(adminLoginEmail, adminLoginPass);
      // Save or clear credentials based on checkbox
      if (adminRemember) {
        // SECURITY: remember the email only — never store the password.
        localStorage.setItem('parfum_admin_saved', JSON.stringify({ email: adminLoginEmail }));
      } else {
        localStorage.removeItem('parfum_admin_saved');
      }
      setShowAdminLogin(false);
      setIsAdmin(true);
      localStorage.setItem('parfum_is_admin', 'true');
      window.location.hash = 'admin'; // per-tab admin mode
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
    const baseP = v?.price || 0;
    const si = getSaleInfo(prod);
    const fp = si ? salePrice(baseP, si.percent) : baseP;
    return sum + (fp * i.qty);
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
    // Only activate admin if this tab has #admin in URL
    const hashAdmin = window.location.hash === '#admin';
    // SECURITY: only a verified admin token re-activates admin mode.
    // (The old localStorage 'parfum_is_admin' fallback let any logged-in
    // client open the admin UI by setting one flag — removed.)
    if (hashAdmin && (pb.authStore.isAdmin || pb.authStore.model?.collectionName === '_superusers')) {
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

  // Persist banners to localStorage + PocketBase on every change
  const bannerSaveTimer = useRef(null);
  useEffect(() => {
    try {
      const fixed = banners.map(b => ({
        ...b,
        bg: b.bg && (b.bg.includes('green') || b.bg.includes('#4CAF') || b.bg.includes('#43A0') || b.bg.includes('#388E') || b.bg.includes('#2E7D'))
          ? "linear-gradient(135deg, #111111 0%, #000000 100%)"
          : b.bg,
      }));
      localStorage.setItem('parfum_banners', JSON.stringify(fixed));
      // Debounced sync to PocketBase (admin only) — so all devices see same banners
      if (isAdmin) {
        clearTimeout(bannerSaveTimer.current);
        bannerSaveTimer.current = setTimeout(() => {
          api.saveBannersMeta(fixed).catch(() => {});
        }, 2000);
      }
    } catch { /* ignore */ }
  }, [banners, isAdmin]);

  // Persist settings to localStorage on every change (excluding loginBg — stored separately)
  useEffect(() => {
    try {
      const { loginBg, ...rest } = settings;
      localStorage.setItem('parfum_settings', JSON.stringify(rest));
    } catch { /* ignore */ }
    // ADMIN: sozlamalarni PocketBase'ga ham yozish (debounce) — server
    // hooks (bonus %, yetkazish narxi...) va boshqa qurilmalar ko'rsin.
    if (isAdmin && pb.authStore.isValid) {
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
      settingsSaveTimer.current = setTimeout(() => {
        api.saveSettings(settings).then(r => {
          if (!r) console.warn('settings PB sync failed');
        });
      }, 1200);
    }
  }, [settings, isAdmin]);
  const settingsSaveTimer = useRef(null);

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
          // PocketBase images only — Fragrantica CDN blocks hotlinking
          // All images hosted on PB via pb-download-images.js
          const coverUrl = galleryUrls[0] || null;
          return {
            ...p,
            img: coverUrl,
            images: galleryUrls.length > 0 ? galleryUrls : [],
            variants: Array.isArray(p.variants) ? p.variants : (p.variants ? JSON.parse(p.variants) : []),
            isPopular: p.isPopular === true || p.isPopular === 'true',
            isHit: p.isHit === true || p.isHit === 'true',
            isNew: p.isNew === true || p.isNew === 'true',
            isAuthor: p.isAuthor === true || p.isAuthor === 'true',
            featured: p.featured === true || p.featured === 'true',
            priority: Number(p.priority) || 0,
            shortDesc: p.shortDesc || '',
            tags: p.tags || '',
            scheduled: p.scheduled === true || p.scheduled === 'true',
            showFrom: p.showFrom || '',
            showUntil: p.showUntil || '',
            relatedIds: (() => { try { return Array.isArray(p.relatedIds) ? p.relatedIds : JSON.parse(p.relatedIds || '[]'); } catch { return []; } })(),
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

      // Load notifications
      try {
        const notifs = await api.getNotifications();
        setClientNotifications(notifs);
      } catch { /* notifications collection may not exist yet */ }

      // Load shared media from PB (instagramScreen, etc.)
      const instaScreenUrl = await api.getSiteMedia('instagramScreen').catch(() => null);
      if (instaScreenUrl) {
        setSettings(prev => ({ ...prev, instagramScreen: instaScreenUrl }));
      }

      // Load payment settings from PocketBase
      const paymentData = await api.loadPaymentSettings().catch(() => null);
      if (paymentData) {
        // FIX: ilgari bu spread bo'sh edi — yuklangan to'lov sozlamalari
        // tashlab yuborilardi. Endi to'g'ri qo'llanadi.
        setSettings(prev => ({ ...prev, ...paymentData }));
      }

      // Global settings PB'dan — admin boshqa qurilmada o'zgartirgan bo'lsa
      // ham hamma joyda bir xil bo'lsin. localStorage faqat tezkor kesh.
      const pbSettings = await api.getSettings().catch(() => null);
      if (pbSettings) {
        const { id, created, updated, collectionId, collectionName, ...rest } = pbSettings;
        setSettings(prev => ({ ...prev, ...rest }));
      }

      // Load banners from PocketBase — overrides localStorage so ALL devices
      // show the same banners that admin configured.
      const pbBanners = await api.loadBannersMeta().catch(() => null);
      if (pbBanners && pbBanners.length > 0) {
        setBanners(pbBanners);
        localStorage.setItem('parfum_banners', JSON.stringify(pbBanners));
      }
    } catch (e) {
      console.warn("PocketBase load error:", e);
      // APP STORE 2.1a/2.2 fix: agar server vaqtincha ishlamasa, katalog
      // HECH QACHON bo'sh ko'rinmasin — lokal demo-katalog (public/perfumes/
      // SVG'lari bilan) fallback sifatida ko'rsatiladi. Server qaytishi bilan
      // keyingi loadAll real ma'lumotni ustidan yozadi.
      setProducts(prev => (prev && prev.length > 0) ? prev : INITIAL_PRODUCTS);
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

  // Persist bonus balance and history — sync to both localStorage AND PocketBase
  useEffect(() => {
    localStorage.setItem('parfum_bonus_balance', String(bonusBalance));
    localStorage.setItem('parfum_bonus_history', JSON.stringify(bonusHistory));
    // Sync to PocketBase so bonus persists across devices / cache clears
    if (user?.id && bonusBalance !== undefined) {
      api.updateClient(user.id, { bonusBalance, bonusHistory }).catch(() => {});
    }
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

    // 1. Sync referral code — generate if missing or fix Cyrillic codes
    const existingCode = record?.referralCode || '';
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(existingCode);
    if (existingCode && !hasCyrillic) {
      // Valid Latin code from server
      setReferralCode(existingCode);
      localStorage.setItem('parfum_ref_code', existingCode);
    } else if (record?.id) {
      // No code or has Cyrillic — generate clean Latin code and save to PocketBase
      const newCode = generateReferralCode(record.name || name || phone || 'USER');
      setReferralCode(newCode);
      localStorage.setItem('parfum_ref_code', newCode);
      api.updateClient(record.id, { referralCode: newCode }).catch(() => {});
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
      notifyWelcomeBonus(serverBalance);
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

  // ── Registration from modal (guest → registered user, then auto-order) ──
  const handleRegisterFromModal = async (regData) => {
    // Run the same login flow
    await handleLogin(regData);
    setShowRegModal(false);
    setGuestMode(false);
    // If there was a pending order, submit it now
    if (pendingOrderForReg) {
      // Small delay so user state settles
      setTimeout(() => {
        handleOrder(pendingOrderForReg);
        setPendingOrderForReg(null);
      }, 300);
    }
  };

  // Clear PB auth (token in pb.authStore + secureStorage) before resetting
  // local UI state — otherwise the next mount restores the old session.
  // `authLogout` is async (touches secureStorage) but failure here is benign;
  // we still want to drop the local state synchronously.
  const handleLogout = () => {
    authLogout().catch(() => {});
    clearSentryUser();
    setUser(null); setIsAdmin(false); setGuestMode(false); setScreen("catalog"); setCart([]);
    localStorage.removeItem('parfum_is_admin');
    if (window.location.hash === '#admin') window.location.hash = '';
    localStorage.removeItem('parfum_bonus_balance');
    localStorage.removeItem('parfum_bonus_history');
    localStorage.removeItem('parfum_ref_code');
    setBonusBalance(0);
    setBonusHistory([]);
    setReferralCode('');
  };

  // App Store 5.1.1(v): in-app account deletion. Server hook
  // /api/custom/account/delete soft-deletes + PII purge (pb_hooks/main.pb.js).
  const handleDeleteAccount = async () => {
    const msg = (TRANSLATIONS[lang] || TRANSLATIONS.ru).deleteAccountConfirm;
    if (!window.confirm(msg)) return;
    try {
      await authDeleteAccount();
      showToast((TRANSLATIONS[lang] || TRANSLATIONS.ru).accountDeleted);
    } catch (e) {
      captureError(e, { where: 'deleteAccount' });
      showToast('Ошибка. Попробуйте позже.');
      return;
    }
    handleLogout();
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
      // Schedule cart reminder (2 hours)
      scheduleCartReminder(next.length);
      return next;
    });
    showToast(t.addedToCart);
  };

  const handleOrder = async (orderData) => {
    if (!user) {
      // Guest trying to order → show registration modal, save order data for after registration
      setPendingOrderForReg(orderData);
      setShowRegModal(true);
      return;
    }
    // ── VALIDATION: block 0-sum orders ──────────────────────────────────────
    if (!orderData.total || orderData.total <= 0) {
      showToast(lang === 'kg' ? 'Заказдын суммасы 0 болушу мүмкүн эмес' : 'Сумма заказа не может быть 0 сом', 'error');
      return;
    }
    // ── VALIDATION: block out-of-stock items ────────────────────────────────
    const outOfStockItems = cart.filter(ci => {
      const prod = products.find(p => String(p.id) === String(ci.productId));
      const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
      return !variant || variant.inStock === false;
    });
    if (outOfStockItems.length > 0) {
      const names = outOfStockItems.map(ci => {
        const prod = products.find(p => String(p.id) === String(ci.productId));
        return prod?.name || ci.name || 'Товар';
      }).join(', ');
      showToast(lang === 'kg' ? `Кампада жок товарлар: ${names}` : `Нет в наличии: ${names}`, 'error');
      return;
    }
    // ── VALIDATION: block empty cart ────────────────────────────────────────
    if (!cart || cart.length === 0) {
      showToast(lang === 'kg' ? 'Себет бош' : 'Корзина пуста', 'error');
      return;
    }
    // Critical #2: Validate delivery address before creating order
    if (orderData.deliveryType === 'delivery' && !orderData.address?.trim()) {
      showToast(lang === 'kg' ? 'Жеткирүү дарегин жазыңыз' : 'Укажите адрес доставки', 'error');
      return;
    }
    const now = new Date().toLocaleString("ru-RU");
    const items = cart.map(ci => {
      const prod = products.find(p => String(p.id) === String(ci.productId));
      const variant = prod?.variants.find(v => String(v.id) === String(ci.variantId));
      const basePrice = variant?.price || 0;
      const si = getSaleInfo(prod);
      const itemPrice = si ? salePrice(basePrice, si.percent) : basePrice;
      return { productId: ci.productId, variantId: ci.variantId, name: `${prod?.name || ci.name || 'Товар'} ${variant?.label || ci.variantLabel || ''}`.trim(), qty: ci.qty, price: itemPrice };
    });
    const localId = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(0, 8);
    const newOrder = { id: localId, clientName: user?.name || "", clientPhone: user?.phone || "", items, date: now, status: "new", ...orderData };
    if (orderData.payMethod === 'odengi') {
      setPendingOrder(newOrder);
      setShowOdengi(true);
      return;
    }
    // Save to PocketBase
    try {
      const pbData = {
        clientName: newOrder.clientName,
        clientPhone: newOrder.clientPhone,
        items: newOrder.items,
        date: now,
        status: "new",
        total: orderData.total || 0,
        payMethod: orderData.payMethod || "cash",
        address: orderData.address || "",
        comment: orderData.comment || "",
        bonusDiscount: orderData.bonusDiscount || 0,
      };
      console.log('[order] pbData items:', JSON.stringify(pbData.items));
      const created = await api.createOrder(pbData);
      // Use PB-assigned ID everywhere so WhatsApp hook can verify the order.
      newOrder.id = created.id;
      newOrder.collectionId = created.collectionId;
      setOrders(p => [...p, { ...newOrder }]);
    } catch (e) {
      console.warn("PocketBase order error:", e);
      setOrders(p => [...p, newOrder]);
    }
    // Bonus SPENT is deducted immediately at order placement.
    // Bonus EARNED (cashback) is only credited when order reaches "delivered" status
    // — see handleStatusChange below. This prevents gaming via order→cancel.
    if (orderData.bonusDiscount > 0) {
      setBonusBalance(p => p - orderData.bonusDiscount);
      setBonusHistory(p => [...p, { type: "spent", amount: -orderData.bonusDiscount, label: "Бонус потрачен", date: now }]);
    }
    setCart([]); localStorage.removeItem('parfum_cart');
    haptic('success'); // PRO: success haptic on order placement
    setCompletedOrder(newOrder);
    // Push notification — order created
    notifyOrderCreated(newOrder.id, newOrder.total, 'cash');
    cancelCartReminder();
    const itemsList = (newOrder.items || []).map(i => `  • ${i.name} × ${i.qty} шт. — ${(i.price * i.qty).toLocaleString()} сом`).join('\n');
    const deliveryLine = orderData.deliveryType === 'pickup' ? 'Самовывоз' : (orderData.address || 'Доставка');
    const bonusLine = orderData.bonusDiscount > 0 ? `\nБонус: −${orderData.bonusDiscount.toLocaleString()} сом` : '';
    const cName = newOrder.clientName || user?.name || 'Клиент';
    const cPhone = newOrder.clientPhone || user?.phone || '';
    const shopName = settings?.shopName || 'Kemal Usman';
    const clientMsg = `Здравствуйте, ${cName}! 🌸\n\nВаш заказ №${newOrder.id} успешно оформлен ✅\n\n${itemsList}\n\n💳 Способ оплаты: наличные\n📦 Доставка: ${deliveryLine}${bonusLine}\n💰 Итого: ${newOrder.total.toLocaleString()} сом\n\nМы свяжемся с вами для подтверждения 🤝\nСпасибо за покупку! 🙏\n\n— ${shopName}`;
    const adminPhone = settings?.whatsappPhone || '';
    const adminMsg = `🆕 Новый заказ №${newOrder.id}\n\n👤 Клиент: ${cName}\n📞 Телефон: ${cPhone}\n\n${itemsList}\n\n💵 Оплата: наличные\n📍 Адрес: ${deliveryLine}${bonusLine}\n💰 Итого: ${newOrder.total.toLocaleString()} сом`;
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

  // ── STATUS CHANGE → AUTO WHATSAPP TO CLIENT ──────────────────────────────
  // Professional messages for each status transition. Includes receipt
  // request for bank payments upon confirmation.
  const handleStatusChange = async (id, newStatus) => {
    const order = orders.find(o => o.id === id);
    setOrders(p => p.map(o => o.id === id ? { ...o, status: newStatus } : o));
    try { await api.updateOrder(id, { status: newStatus }); } catch (e) { console.warn('Status update error:', e); }

    // Push notification — status changed
    notifyOrderStatus(id, newStatus, order?.total);

    // Build status notification message for client
    if (!order?.clientPhone) return;

    const name = order.clientName || '';
    const oid = order.id || '';
    const total = (order.total || 0).toLocaleString();
    const itemsList = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items || [])
      .map(i => `  • ${i.name} × ${i.qty} — ${(i.price * i.qty).toLocaleString()} сом`)
      .join('\n');
    const isBankPay = false;
    const bankName = 'Онлайн оплата';
    const shopName = settings?.shopName || 'Kemal Usman';

    const statusMessages = {
      confirmed: lang === 'kg'
        ? `${name}, заказыңыз №${oid} ырасталды! ✅\n\n${itemsList}\n\n💰 Жалпы: ${total} сом\n${isBankPay ? `\n📎 ${bankName} аркылуу төлөгөндөн кийин, квитанциянын скриншотун жөнөтүңүз 🙏\n` : ''}\nБиз даярдап жатабыз 🤝\n\n— ${shopName}`
        : `${name}, ваш заказ №${oid} подтверждён! ✅\n\n${itemsList}\n\n💰 Итого: ${total} сом\n${isBankPay ? `\n📎 После оплаты через ${bankName}, отправьте скриншот квитанции в ответ на это сообщение 🙏\n` : ''}\nМы уже готовим ваш заказ 🤝\n\n— ${shopName}`,

      preparing: lang === 'kg'
        ? `${name}, заказыңыз №${oid} даярдалууда! 📦\n\nТезарада жеткирүүгө даяр болот ✨\n\n— ${shopName}`
        : `${name}, ваш заказ №${oid} готовится 📦\n\nСовсем скоро будет готов к отправке ✨\n\n— ${shopName}`,

      delivering: lang === 'kg'
        ? `${name}, заказыңыз №${oid} жолдо! 🚗\n\nКурьер жакында жетет. Телефонуңуз иштеп турсун 📱\n\n— ${shopName}`
        : `${name}, ваш заказ №${oid} в пути! 🚗\n\nКурьер скоро будет у вас. Держите телефон включённым 📱\n\n— ${shopName}`,

      delivered: lang === 'kg'
        ? `${name}, заказыңыз №${oid} жеткирилди! 🎉\n\n💰 ${total} сом\n\nСатып алганыңыз үчүн рахмат! Жыттар сизге жагат деп үмүттөнөбүз 🌸\n\nБизди тандаганыңыз үчүн ыраазыбыз! 🤍\n\n— ${shopName}`
        : `${name}, ваш заказ №${oid} доставлен! 🎉\n\n💰 ${total} сом\n\nСпасибо за покупку! Надеемся, ароматы вам понравятся 🌸\n\nБудем рады видеть вас снова! 🤍\n\n— ${shopName}`,

      cancelled: lang === 'kg'
        ? `${name}, тилекке каршы, заказыңыз №${oid} жокко чыгарылды 😔\n\nСуроолоруңуз болсо, бизге жазыңыз 💬\n\n— ${shopName}`
        : `${name}, к сожалению, ваш заказ №${oid} отменён 😔\n\nЕсли у вас есть вопросы, напишите нам 💬\n\n— ${shopName}`,
    };

    const msg = statusMessages[newStatus];
    if (msg) {
      sendWhatsApp({ phone: order.clientPhone, message: msg, orderId: oid })
        .then(r => { if (!r.ok) console.warn('[status] whatsapp notify failed:', r.error); });
    }

    // ── Cashback: credit bonus ONLY when order is delivered ──
    if (newStatus === 'delivered' && order) {
      const orderTotal = order.total || 0;
      const earned = Math.floor(orderTotal * (settings.bonusPercent || 0) / 100);
      if (earned > 0) {
        notifyBonusEarned(earned);
        const now = new Date().toLocaleDateString("ru-RU");
        setBonusBalance(p => {
          const newBal = p + earned;
          localStorage.setItem('parfum_bonus_balance', String(newBal));
          // Also update PocketBase for the client
          if (order.clientPhone) {
            const normalizedPhone = normalizePhone(order.clientPhone);
            api.getClientByPhone(normalizedPhone).then(client => {
              if (client?.id) {
                const serverBal = (client.bonusBalance || 0) + earned;
                const serverHist = [...(Array.isArray(client.bonusHistory) ? client.bonusHistory : []), { type: "earned", amount: earned, label: "Кэшбэк за заказ №" + oid, date: now }];
                api.updateClient(client.id, { bonusBalance: serverBal, bonusHistory: serverHist }).catch(() => {});
              }
            }).catch(() => {});
          }
          return newBal;
        });
        setBonusHistory(p => {
          const newHist = [...p, { type: "earned", amount: earned, label: "Кэшбэк за заказ №" + oid, date: new Date().toLocaleDateString("ru-RU") }];
          localStorage.setItem('parfum_bonus_history', JSON.stringify(newHist));
          return newHist;
        });
      }
    }

    // ── Cancelled: refund spent bonus + claw back cashback if was delivered ──
    if (newStatus === 'cancelled' && order) {
      const now = new Date().toLocaleDateString("ru-RU");
      const refund = order.bonusDiscount || 0;
      // Claw back cashback if order was previously delivered
      const wasDelivered = order.status === 'delivered';
      const clawback = wasDelivered ? Math.floor((order.total || 0) * (settings.bonusPercent || 0) / 100) : 0;
      const totalChange = refund - clawback; // refund adds, clawback removes

      if (refund > 0 || clawback > 0) {
        const histEntries = [];
        if (refund > 0) histEntries.push({ type: "refund", amount: refund, label: "Возврат бонуса (заказ №" + oid + ")", date: now });
        if (clawback > 0) histEntries.push({ type: "clawback", amount: -clawback, label: "Возврат кэшбэка (заказ №" + oid + ")", date: now });

        setBonusBalance(p => {
          const newBal = Math.max(0, p + totalChange);
          localStorage.setItem('parfum_bonus_balance', String(newBal));
          if (order.clientPhone) {
            const normalizedPhone = normalizePhone(order.clientPhone);
            api.getClientByPhone(normalizedPhone).then(client => {
              if (client?.id) {
                const serverBal = Math.max(0, (client.bonusBalance || 0) + totalChange);
                const serverHist = [...(Array.isArray(client.bonusHistory) ? client.bonusHistory : []), ...histEntries];
                api.updateClient(client.id, { bonusBalance: serverBal, bonusHistory: serverHist }).catch(() => {});
              }
            }).catch(() => {});
          }
          return newBal;
        });
        setBonusHistory(p => {
          const newHist = [...p, ...histEntries];
          localStorage.setItem('parfum_bonus_history', JSON.stringify(newHist));
          return newHist;
        });
      }
    }
  };

  const handleSendWhatsApp = (order) => {
    const name = order.clientName || '';
    const total = (order.total || 0).toLocaleString();
    const statusLabel = t["status_" + order.status] || order.status;
    const msg = `Здравствуйте, ${name}! 🌸\n\n📋 Ваш заказ №${order.id}\n📌 Статус: ${statusLabel}\n💰 Итого: ${total} сом\n\nЕсли есть вопросы — напишите нам 💬\n\n— ${settings?.shopName || 'Kemal Usman'}`;
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
    { id: "orders",        icon: IC.orders,   label: t.orders },
    { id: "products",      icon: IC.bottle,   label: t.products },
    { id: "clients",       icon: IC.user,     label: lang === 'kg' ? 'Кардарлар' : 'Клиенты' },
    { id: "notifications", icon: IC.bell,     label: t.notifications },
    { id: "reviews",       icon: IC.star || IC.orders, label: lang === 'kg' ? 'Пикирлер' : 'Отзывы' },
    { id: "stats",         icon: IC.stats,    label: t.stats },
    { id: "settings",      icon: IC.settings, label: t.settings },
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
        <div style={{ width: "100vw", maxWidth: "100vw", minHeight: "100dvh", overflow: "hidden", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
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
      {/* Registration modal — shown when guest tries to order */}
      <RegisterModal
        open={showRegModal}
        onClose={() => { setShowRegModal(false); setPendingOrderForReg(null); }}
        onRegister={handleRegisterFromModal}
        showToast={showToast}
      />
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
      

      {showOdengi && pendingOrder && (
        <OdengiPayment
          total={pendingOrder.total}
          pendingOrder={pendingOrder}
          showToast={showToast}
          onConfirm={(confirmedOrder) => {
            const finalOrder = { ...pendingOrder, ...confirmedOrder, paymentStatus: 'paid', paymentMethod: 'odengi' };
            setOrders(prev => [...prev, finalOrder]);
            setCart([]); localStorage.removeItem('parfum_cart');
            const odSpent = pendingOrder.bonusDiscount || 0;
            if (odSpent > 0) { setBonusBalance(p => p - odSpent); setBonusHistory(p => [...p, { type: 'spent', amount: -odSpent, label: 'Бонус потрачен', date: new Date().toISOString() }]); }
            setShowOdengi(false);
            setCompletedOrder(finalOrder);
            notifyOrderCreated(finalOrder.id, finalOrder.total, 'odengi');
            notifyPaymentConfirmed(finalOrder.id, 'Онлайн оплата');
            cancelCartReminder();
            setPendingOrder(null);
            haptic('success');
            const adm4 = settings?.whatsappPhone || '';
            const itemsList4 = (pendingOrder.items || []).map(i => `  • ${i.name} × ${i.qty} шт. — ${(i.price * i.qty).toLocaleString()} сом`).join('\n');
            const deliveryLine4 = pendingOrder.deliveryType === 'pickup' ? 'Самовывоз' : (pendingOrder.address || 'Доставка');
            const bonusLine4 = pendingOrder.bonusDiscount > 0 ? `\nБонус: −${pendingOrder.bonusDiscount.toLocaleString()} сом` : '';
            const odName = pendingOrder.clientName || user?.name || 'Клиент';
            const odPhone = pendingOrder.clientPhone || user?.phone || '';
            const odShop = settings?.shopName || 'Kemal Usman';
            const clientMsg4 = `Здравствуйте, ${odName}! 🌸\n\nВаш заказ №${finalOrder.id} оплачен через O!Деньги ✅\n\n${itemsList4}\n\n💳 Оплата: O!Деньги (подтверждена)\n📍 Адрес: ${deliveryLine4}${bonusLine4}\n💰 Итого: ${pendingOrder.total.toLocaleString()} сом\n\nСпасибо за покупку! 🤍\n\n— ${odShop}`;
            const adminMsg4 = `🆕 Заказ №${finalOrder.id} ОПЛАЧЕН (O!Деньги)\n\n👤 ${odName}\n📞 ${odPhone}\n\n${itemsList4}\n\n💳 O!Деньги — оплачен ✅\n📍 ${deliveryLine4}${bonusLine4}\n💰 ${pendingOrder.total.toLocaleString()} сом`;
            if (pendingOrder.clientPhone) sendWhatsApp({ phone: pendingOrder.clientPhone, message: clientMsg4, orderId: finalOrder.id }).catch(() => {});
            if (adm4) sendWhatsApp({ phone: adm4, message: adminMsg4, orderId: finalOrder.id }).catch(() => {});
          }}
          onCancel={() => { setShowOdengi(false); setPendingOrder(null); }}
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
          setScreen={setScreen}
          screen={screen}
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
              onClick={() => { setIsAdmin(false); localStorage.removeItem('parfum_is_admin'); setAdminScreen('orders'); if (window.location.hash === '#admin') window.location.hash = ''; }}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', padding: '6px 16px', fontSize: 11, letterSpacing: 2,
                textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
              }}>
              {t.exit}
            </button>
          </div>

          {/* Desktop admin tab nav */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid #EBEBEB',
            padding: '0 48px',
          }}>
            {[
              { id: 'orders',        label: t.orders   || 'Заказы'     },
              { id: 'products',      label: t.products  || 'Товары'     },
              { id: 'clients',       label: lang === 'kg' ? 'Кардарлар' : 'Клиенты' },
              { id: 'notifications', label: t.notifications || 'Уведомления' },
              { id: 'reviews',       label: lang === 'kg' ? 'Пикирлер' : 'Отзывы' },
              { id: 'stats',         label: t.stats     || 'Статистика' },
              { id: 'settings',      label: t.settings  || 'Настройки'  },
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
              const VALID_ADMIN_TABS = ['orders', 'products', 'clients', 'notifications', 'reviews', 'stats', 'settings'];
              const safeAdminScreen = VALID_ADMIN_TABS.includes(adminScreen) ? adminScreen : 'orders';
              return (
                <ErrorBoundary key={safeAdminScreen}>
                  {safeAdminScreen === 'orders' && (
                    <AdminOrdersScreen
                      allOrders={orders}
                      onRefresh={handleRefresh}
                      onStatusChange={handleStatusChange}
                      onDelete={async (id) => {
                        setOrders(p => p.filter(o => o.id !== id));
                        try { await api.deleteOrder(id); } catch (e) { console.warn(e); }
                      }}
                      onSendWhatsApp={handleSendWhatsApp}
                      onConfirmOnlinePayment={(id) => {
                        setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o));
                        showToast(t.orderPlaced);
                        const ord = orders.find(o => o.id === id);
                        if (ord) notifyPaymentConfirmed(id, 'Онлайн оплата');
                      }}
                    />
                  )}
                  {safeAdminScreen === 'products' && (
                    <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />
                  )}
                  {safeAdminScreen === 'clients' && (
                    <AdminClientsScreen clients={registeredUsers} orders={orders} showToast={showToast} />
                  )}
                  {safeAdminScreen === 'notifications' && (
                    <AdminNotificationsScreen products={products} clients={registeredUsers} showToast={showToast} lang={lang} />
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
                const VALID_ADMIN_TABS = ["orders", "products", "clients", "reviews", "stats", "settings"];
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
                    {safeAdminScreen === "orders" && <AdminOrdersScreen allOrders={orders} onRefresh={handleRefresh} onStatusChange={handleStatusChange} onDelete={async (id) => { setOrders(p => p.filter(o => o.id !== id)); try { await api.deleteOrder(id); } catch (e) { console.warn("Delete order error:", e); } }} onSendWhatsApp={handleSendWhatsApp} onConfirmOnlinePayment={(id) => { setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o)); showToast(t.orderPlaced); const ord2 = orders.find(o => o.id === id); if (ord2) notifyPaymentConfirmed(id, 'Онлайн оплата'); }} />}
                    {safeAdminScreen === "products" && <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />}
                    {safeAdminScreen === "clients" && <AdminClientsScreen clients={registeredUsers} orders={orders} showToast={showToast} />}
                    {safeAdminScreen === "notifications" && <AdminNotificationsScreen products={products} clients={registeredUsers} showToast={showToast} lang={lang} />}
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
                    <CatalogScreen products={products} settings={settings} addToCart={addToCart} banners={banners.filter(b => b.active)} showToast={showToast} onAdminLogin={() => { setShowAdminLogin(true); setAdminLoginPass(""); setAdminLoginErr(""); }} onRefresh={handleRefresh} setIsDetailOpen={setIsDetailOpen} reviews={reviews} />
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
                    <ProfileScreen user={user} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} bonusBalance={bonusBalance} bonusHistory={bonusHistory} referralCode={referralCode} settings={settings} onCopyReferral={handleCopyReferral} onAdminLogin={() => { setIsAdmin(true); localStorage.setItem('parfum_is_admin', 'true'); window.location.hash = 'admin'; setAdminScreen("orders"); }} goToOrders={() => setScreen("myorders")} onOpenNotifications={() => setShowNotifSheet(true)} unreadNotifCount={clientNotifications.filter(n => { const phone = user?.phone; if (!phone) return false; if (n.targetPhone && n.targetPhone !== phone) return false; const readBy = n.readBy ? (() => { try { return JSON.parse(n.readBy); } catch { return []; } })() : []; return !readBy.includes(phone); }).length} />
                  </div>
                </>
              )}
            </MotionScreen>
          )}
        </div>
        {/* ── DRAGGABLE FLOATING CART PILL ──────────────────────────
             Proper component so hooks run stably. Portal → document.body. */}
        {createPortal(
        <AnimatePresence>
          {!isAdmin && !isDetailOpen && cartCount > 0 && screen === "catalog" && (
            <FloatingCartPill
              key="floating-cart-pill"
              cartCount={cartCount}
              cartTotal={cartTotal}
              lang={lang}
              screen={screen}
              onGoToCart={() => setScreen('cart')}
            />
          )}
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
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowAdminLogin(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 20, textAlign: "center", letterSpacing: -0.3 }}>{t.adminPanel}</div>
              <div style={{ marginBottom: 10 }}>
                <input type="email" autoComplete="username" value={adminLoginEmail} onChange={e => { setAdminLoginEmail(e.target.value); setAdminLoginErr(""); }} placeholder="admin@kemalusman.kg" style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }} autoFocus onFocus={e => e.target.style.borderColor = "#111"} onBlur={e => e.target.style.borderColor = "#eee"} />
              </div>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input type={adminShowPass ? "text" : "password"} autoComplete="current-password" value={adminLoginPass} onChange={e => { setAdminLoginPass(e.target.value); setAdminLoginErr(""); }} placeholder={t.passwordLabel || "Пароль"} style={{ width: "100%", padding: "14px 48px 14px 16px", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }} onKeyDown={e => { if (e.key === 'Enter') submitTopAdminLogin(); }} onFocus={e => e.target.style.borderColor = "#111"} onBlur={e => e.target.style.borderColor = "#eee"} />
                <button type="button" onClick={() => setAdminShowPass(v => !v)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: "#8E8E93", fontSize: 11, fontWeight: 600, letterSpacing: 0.2 }}>
                  {adminShowPass ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {/* Remember me checkbox */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", padding: "4px 0", WebkitTapHighlightColor: "transparent" }} onClick={() => setAdminRemember(v => !v)}>
                <div style={{ width: 22, height: 22, borderRadius: 7, border: adminRemember ? "none" : "1.5px solid #D1D1D6", background: adminRemember ? "#111" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
                  {adminRemember && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{t.remember_me}</span>
              </label>
              {adminLoginErr && <div style={{ color: "#E53935", fontSize: 13, marginBottom: 10, textAlign: "center", fontWeight: 500 }}>{adminLoginErr}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#333" }}>{t.cancel}</button>
                <button onClick={submitTopAdminLogin} disabled={adminLoginLoading} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 700, cursor: adminLoginLoading ? "default" : "pointer", opacity: adminLoginLoading ? 0.6 : 1, fontFamily: "inherit" }}>{adminLoginLoading ? '...' : 'OK'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
      {/* ── DESKTOP ADMIN LOGIN MODAL — rendered at root level so it works on desktop too ── */}
      {showAdminLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowAdminLogin(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 20, textAlign: "center", letterSpacing: -0.3 }}>{t.adminPanel}</div>
            <div style={{ marginBottom: 10 }}>
              <input type="email" autoComplete="username" value={adminLoginEmail} onChange={e => { setAdminLoginEmail(e.target.value); setAdminLoginErr(""); }} placeholder="admin@kemalusman.kg" style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }} autoFocus onFocus={e => e.target.style.borderColor = "#111"} onBlur={e => e.target.style.borderColor = "#eee"} />
            </div>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <input type={adminShowPass ? "text" : "password"} autoComplete="current-password" value={adminLoginPass} onChange={e => { setAdminLoginPass(e.target.value); setAdminLoginErr(""); }} placeholder={t.passwordLabel || "Пароль"} style={{ width: "100%", padding: "14px 48px 14px 16px", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }} onKeyDown={e => { if (e.key === 'Enter') submitTopAdminLogin(); }} onFocus={e => e.target.style.borderColor = "#111"} onBlur={e => e.target.style.borderColor = "#eee"} />
              <button type="button" onClick={() => setAdminShowPass(v => !v)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: "#8E8E93" }}>
                {adminShowPass ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {/* Remember me checkbox */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", padding: "4px 0", WebkitTapHighlightColor: "transparent" }} onClick={() => setAdminRemember(v => !v)}>
              <div style={{ width: 22, height: 22, borderRadius: 7, border: adminRemember ? "none" : "1.5px solid #D1D1D6", background: adminRemember ? "#111" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
                {adminRemember && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{t.remember_me}</span>
            </label>
            {adminLoginErr && <div style={{ color: "#E53935", fontSize: 13, marginBottom: 10, textAlign: "center", fontWeight: 500 }}>{adminLoginErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #eee", background: "#f7f7f8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#333" }}>{t.cancel}</button>
              <button onClick={submitTopAdminLogin} disabled={adminLoginLoading} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 700, cursor: adminLoginLoading ? "default" : "pointer", opacity: adminLoginLoading ? 0.6 : 1, fontFamily: "inherit" }}>{adminLoginLoading ? '...' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── CLIENT NOTIFICATIONS SHEET ── */}
      {showNotifSheet && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99998 }} onClick={() => setShowNotifSheet(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "#fff", borderRadius: "24px 24px 0 0",
              maxHeight: "80vh", overflowY: "auto",
              paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.15)",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E0E0E0" }} />
            </div>
            {/* Header */}
            <div style={{ padding: "8px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {React.cloneElement(IC.bell, { style: { width: 20, height: 20, color: T.accent } })}
                <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{t.notifications}</span>
              </div>
              <div onClick={() => setShowNotifSheet(false)} style={{ width: 28, height: 28, borderRadius: 14, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ fontSize: 16, color: T.textMuted, lineHeight: 1 }}>×</span>
              </div>
            </div>
            {/* Notifications list */}
            <div style={{ padding: "0 16px" }}>
              {clientNotifications.filter(n => !n.targetPhone || n.targetPhone === user?.phone).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted }}>
                  {React.cloneElement(IC.bell, { style: { width: 40, height: 40, color: T.textMuted, opacity: 0.2, margin: "0 auto 12px", display: "block" } })}
                  <div style={{ fontSize: 14 }}>{t.notifEmpty}</div>
                </div>
              ) : (
                clientNotifications
                  .filter(n => !n.targetPhone || n.targetPhone === user?.phone)
                  .map(n => {
                    const readBy = n.readBy ? (() => { try { return JSON.parse(n.readBy); } catch { return []; } })() : [];
                    const isRead = user?.phone ? readBy.includes(user.phone) : false;
                    const linkedProduct = n.productId ? products.find(p => p.id === n.productId) : null;
                    const date = new Date(n.created);
                    const now = new Date();
                    const diffH = Math.floor((now - date) / 3600000);
                    const timeStr = diffH < 1 ? (lang === 'kg' ? 'Жаңы эле' : 'Только что') : diffH < 24 ? `${diffH} ${lang === 'kg' ? 'саат мурун' : 'ч назад'}` : `${date.getDate()}.${(date.getMonth()+1).toString().padStart(2,'0')}`;

                    return (
                      <div key={n.id}
                        onClick={async () => {
                          if (!isRead && user?.phone) {
                            api.markNotificationRead(n.id, user.phone).catch(() => {});
                            setClientNotifications(prev => prev.map(x => x.id === n.id ? { ...x, readBy: JSON.stringify([...readBy, user.phone]) } : x));
                          }
                          if (linkedProduct) {
                            setShowNotifSheet(false);
                            // Navigate to product — set screen to catalog and trigger product detail
                          }
                        }}
                        style={{
                          padding: "14px 16px", borderRadius: 16, marginBottom: 8, cursor: "pointer",
                          background: isRead ? "#FAFAFA" : "#F0F7FF",
                          border: isRead ? "1px solid #F0F0F0" : "1px solid #D0E4FF",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              {!isRead && <div style={{ width: 6, height: 6, borderRadius: 3, background: "#007AFF", flexShrink: 0 }} />}
                              {n.promoTag && (
                                <span style={{
                                  padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, color: "#fff",
                                  background: n.promoTag === 'sale' ? '#FF3B30' : n.promoTag === 'new' ? '#34C759' : n.promoTag === 'limited' ? '#FF9500' : '#007AFF',
                                }}>
                                  {n.promoTag === 'sale' ? (lang === 'kg' ? 'ЧЕГИРМЕ' : 'СКИДКА') : n.promoTag === 'new' ? (lang === 'kg' ? 'ЖАҢЫ' : 'НОВИНКА') : n.promoTag === 'limited' ? (lang === 'kg' ? 'ЧЕКТЕЛГЕН' : 'ОГРАНИЧЕНО') : (lang === 'kg' ? 'БЕЛЕК' : 'ПОДАРОК')}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{n.title}</span>
                            </div>
                            <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.4, marginBottom: linkedProduct ? 8 : 0 }}>{n.body}</div>
                            {linkedProduct && (
                              <div style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(0,122,255,0.08)", fontSize: 11, color: "#007AFF", fontWeight: 600, display: "inline-block" }}>
                                🔗 {linkedProduct.brand} — {linkedProduct.name}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, marginTop: 2 }}>{timeStr}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </LangContext.Provider>
  );
}
