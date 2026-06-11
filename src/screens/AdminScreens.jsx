// src/screens/AdminScreens.jsx — barcha admin ekranlar (P2.1b refactor).
// App.jsx'dan SOF MEXANIK ko'chirildi — logika o'zgarmagan.
// React.lazy orqali yuklanadi: mijozlar admin kodini umuman yuklab olmaydi.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/backend.js";
import { sendWhatsApp as sendWhatsAppServer } from "../api/whatsapp";
import { PB_URL, audioUrl, fileUrl, pb } from "../api/pb";
import { sendWhatsApp } from "../api/whatsapp";
import { BG_PRESETS, INITIAL_PRODUCTS } from "../appData.js";
import { MotionScreen } from "../components/MotionScreen";
import { NumberCounter } from "../components/NumberCounter";
import { OrderTimeline } from "../components/OrderTimeline";
import { useLang } from "../i18n/lang.jsx";
import { IC } from "../icons.jsx";
import { T, btnGreen, card, inputStyle } from "../theme.js";
import { formatSum } from "../utils/format.js";
import { haptic } from "../utils/haptics";
import logger from "../utils/logger";
import { captureError } from "../utils/sentry";
import { AnimatePresence, motion } from "framer-motion";
import { BannerCropModal, MultiImageUpload, ProductAudioRecorder, ProductCard, StatusChip, getSaleInfo } from "../App.jsx";

const STATUS_COLORS = {
  new:        { bg: "#FFF3E0", color: "#FF6B00", border: "#FFB74D" },
  confirmed:  { bg: "#E3F2FD", color: "#1565C0", border: "#64B5F6" },
  preparing:  { bg: "#FFF8E1", color: "#F9A825", border: "#FFD54F" },
  delivering: { bg: "#EDE7F6", color: "#7C5CBF", border: "#B39DDB" },
  delivered:  { bg: "#E8F5E9", color: "#2E7D32", border: "#81C784" },
  cancelled:  { bg: "#FFEBEE", color: "#C62828", border: "#EF9A9A" },
};

export function AdminOrdersScreen({ allOrders = [], onStatusChange, onDelete, onSendWhatsApp, onConfirmOnlinePayment, onRefresh }) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");
  const [statusMap, setStatusMap] = useState({});
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setStatusDropdown(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    haptic('light');
    try { await onRefresh(); } catch { /* ignore */ }
    setRefreshing(false);
  };

  const orders = allOrders.map(o => ({ ...o, status: statusMap[o.id] || o.status }));

  // Archive: orders delivered/cancelled older than 7 days
  const ARCHIVE_DAYS = 7;
  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_DAYS);
  const isArchived = (o) => {
    if (o.status !== 'delivered' && o.status !== 'cancelled') return false;
    try { return new Date(o.date) < archiveCutoff; } catch { return false; }
  };
  const activeOrders = orders.filter(o => !isArchived(o));
  const archivedOrders = orders.filter(o => isArchived(o));
  const workingOrders = showArchive ? archivedOrders : activeOrders;

  // Filter by status
  const statusFiltered = filter === "all" ? workingOrders : workingOrders.filter(o => o.status === filter);

  // Search by name, phone, order ID
  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? statusFiltered.filter(o =>
        (o.clientName || '').toLowerCase().includes(searchLower) ||
        (o.clientPhone || '').includes(searchLower) ||
        (o.id || '').toLowerCase().includes(searchLower)
      )
    : statusFiltered;

  const statuses = ["all", "new", "confirmed", "preparing", "delivering", "delivered", "cancelled"];
  const handleStatus = (id, st) => { haptic('medium'); setStatusMap(p => ({ ...p, [id]: st })); onStatusChange?.(id, st); setStatusDropdown(null); };

  // Summary counts for header
  const newCount = activeOrders.filter(o => o.status === 'new').length;
  const todayCount = activeOrders.filter(o => { try { return new Date(o.date).toDateString() === new Date().toDateString(); } catch { return false; } }).length;
  const todayRevenue = activeOrders.filter(o => { try { return new Date(o.date).toDateString() === new Date().toDateString() && o.status === 'delivered'; } catch { return false; } }).reduce((s, o) => s + (o.total || 0), 0);

  const nextStatusMap = { new: 'confirmed', confirmed: 'preparing', preparing: 'delivering', delivering: 'delivered' };
  const nextStatusLabel = { confirmed: lang === 'kg' ? 'Тастыктоо' : 'Подтвердить', preparing: lang === 'kg' ? 'Даярдоо' : 'Готовить', delivering: lang === 'kg' ? 'Жеткирүү' : 'Доставка', delivered: lang === 'kg' ? 'Жеткирилди' : 'Доставлен' };

  try {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* ── PRO Header with summary stats ── */}
      <div style={{ padding: "52px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: T.text }}>{t.orders}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {lang === 'kg' ? 'Бүгүн' : 'Сегодня'}: {todayCount} {lang === 'kg' ? 'заказ' : 'заказов'}
              {todayRevenue > 0 && ` · ${formatSum(todayRevenue)}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Archive toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => { haptic('light'); setShowArchive(!showArchive); setFilter('all'); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 12px", borderRadius: 10, border: "none",
                background: showArchive ? T.accent : "rgba(0,0,0,0.06)",
                color: showArchive ? "#fff" : T.textSecond,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/>
                <line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              {lang === 'kg' ? 'Архив' : 'Архив'} {archivedOrders.length > 0 && `(${archivedOrders.length})`}
            </motion.button>
            {/* Refresh */}
            {onRefresh && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={refresh}
                disabled={refreshing}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,0.06)", color: "#111",
                  cursor: refreshing ? "default" : "pointer",
                  opacity: refreshing ? 0.6 : 1,
                }}
              >
                <motion.svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 0.9, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                >
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </motion.svg>
              </motion.button>
            )}
          </div>
        </div>

        {/* ── PRO Quick stat pills ── */}
        {!showArchive && newCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 999,
              background: STATUS_COLORS.new.bg, marginBottom: 12,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS.new.color, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLORS.new.color }}>
              {newCount} {lang === 'kg' ? 'жаңы заказ' : newCount === 1 ? 'новый заказ' : 'новых заказов'}
            </span>
          </motion.div>
        )}

        {/* ── Search bar ── */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'kg' ? 'Аты, телефон, ID...' : 'Имя, телефон, ID...'}
            style={{
              width: "100%", padding: "11px 12px 11px 38px", borderRadius: 12,
              border: `1.5px solid ${T.border}`, background: T.card, fontSize: 14,
              outline: "none", boxSizing: "border-box", color: T.text,
              fontFamily: "inherit",
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.08)", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textSecond} strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Status filter chips ── */}
      <div style={{ padding: "0 16px 14px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, width: "max-content" }}>
          {statuses.map(s => {
            const cnt = s === 'all' ? workingOrders.length : workingOrders.filter(o => o.status === s).length;
            const sc = STATUS_COLORS[s];
            const isActive = filter === s;
            return (
              <button key={s} onClick={() => { haptic('light'); setFilter(s); }} style={{
                padding: "8px 14px", borderRadius: 20,
                border: `1.5px solid ${isActive ? (sc ? sc.border : T.accent) : T.border}`,
                background: isActive ? (sc ? sc.bg : T.accent) : T.card,
                color: isActive ? (sc ? sc.color : "#fff") : T.textSecond,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap", minHeight: 36, letterSpacing: -0.1,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {s === "all" ? (lang === 'kg' ? 'Баары' : 'Все') : t["status_" + s] || s}
                {cnt > 0 && <span style={{
                  background: isActive ? (sc ? sc.color : "#fff") : "rgba(0,0,0,0.08)",
                  color: isActive ? "#fff" : T.textSecond,
                  fontSize: 10, fontWeight: 800, borderRadius: 99,
                  padding: "1px 6px", minWidth: 18, textAlign: "center",
                }}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Orders list ── */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!filtered.length && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "56px 24px 64px", gap: 14 }}
          >
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {showArchive
                  ? <><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></>
                  : <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>
                }
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              {showArchive
                ? (lang === 'kg' ? 'Архив бош' : 'Архив пуст')
                : t.noOrders}
            </div>
            <div style={{ fontSize: 13, color: "#8E8E93", lineHeight: 1.45, maxWidth: 260 }}>
              {showArchive
                ? (lang === 'kg' ? 'Жеткирилген/жокко чыгарылган заказдар 7 күндөн кийин архивге түшөт.'
                  : 'Доставленные/отменённые заказы старше 7 дней попадут в архив.')
                : (lang === 'kg' ? 'Жаңы заказдар азырынча жок.' : 'Новые заказы пока не поступали.')}
            </div>
          </motion.div>
        )}
        {filtered.slice().reverse().map((order, idx) => {
          const sc = STATUS_COLORS[order.status] || { bg: "rgba(0,0,0,0.04)", color: T.textSecond, border: T.border };
          const isOpen = open === order.id;
          const nextSt = nextStatusMap[order.status];
          return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
            style={{
              ...card({ padding: 0, overflow: 'hidden' }),
              borderLeft: `4px solid ${sc.border}`,
            }}
          >
            {/* ── Card header — always visible ── */}
            <div style={{ padding: "14px 14px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              {/* Left: order info */}
              <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => setOpen(isOpen ? null : order.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ color: T.textMuted, fontSize: 11, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>#{typeof order.id === 'string' ? order.id.slice(-6).toUpperCase() : order.id}</span>
                  <StatusChip status={order.status} />
                  {(order.paymentMethod === 'mbank' || order.paymentMethod === 'odengi') && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px",
                      background: (order.paymentStatus === 'mbank_pending' || order.paymentStatus === 'odengi_pending') ? '#FFF8E1' : '#D1FAE5',
                      color: (order.paymentStatus === 'mbank_pending' || order.paymentStatus === 'odengi_pending') ? '#D97706' : '#059669',
                    }}>Онлайн</span>
                  )}
                </div>
                <div style={{ color: T.text, fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>{formatSum(order.total)}</div>
                <div style={{ color: T.textMuted, fontSize: 13, marginTop: 3, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {order.clientName && <span style={{ fontWeight: 600, color: T.textSecond }}>{order.clientName}</span>}
                  {order.clientName && order.clientPhone && <span style={{ color: T.border }}>|</span>}
                  {order.clientPhone && <span>{order.clientPhone}</span>}
                  {order.date && <>
                    <span style={{ color: T.border }}>|</span>
                    <span style={{ fontSize: 11 }}>{(() => { try { const d = new Date(order.date); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}</span>
                  </>}
                </div>
              </div>

              {/* Right: quick actions — ALWAYS visible without expanding */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0, paddingTop: 2 }}>
                {/* Quick next-status button */}
                {nextSt && !showArchive && (
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={(e) => { e.stopPropagation(); handleStatus(order.id, nextSt); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "6px 10px", borderRadius: 8, border: "none",
                      background: STATUS_COLORS[nextSt]?.bg || T.accentLight,
                      color: STATUS_COLORS[nextSt]?.color || T.accent,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    {nextStatusLabel[nextSt] || nextSt}
                  </motion.button>
                )}
                {/* Quick action row: WhatsApp + more */}
                <div style={{ display: "flex", gap: 4 }}>
                  {order.clientPhone && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); onSendWhatsApp?.(order); }}
                      title="WhatsApp"
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: "none",
                        background: "#E8F5E9", color: "#2E7D32",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", padding: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.149-2.868.852.852-2.868-.164-.264A8 8 0 1112 20z"/></svg>
                    </motion.button>
                  )}
                  {/* Status dropdown trigger */}
                  {!showArchive && (
                    <div style={{ position: "relative" }} ref={statusDropdown === order.id ? dropdownRef : null}>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === order.id ? null : order.id); }}
                        style={{
                          width: 30, height: 30, borderRadius: 8, border: "none",
                          background: "rgba(0,0,0,0.06)", color: T.textSecond,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", padding: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </motion.button>
                      {/* Dropdown menu */}
                      {statusDropdown === order.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: "absolute", right: 0, top: 34, zIndex: 100,
                            background: "#fff", borderRadius: 12, padding: 4,
                            boxShadow: "0 8px 30px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
                            minWidth: 160, border: `1px solid ${T.border}`,
                          }}
                        >
                          {["confirmed", "preparing", "delivering", "delivered", "cancelled"].map(s => {
                            const scc = STATUS_COLORS[s];
                            return (
                              <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); handleStatus(order.id, s); }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "9px 12px", border: "none", borderRadius: 8,
                                  background: order.status === s ? scc.bg : "transparent",
                                  color: order.status === s ? scc.color : T.text,
                                  fontSize: 13, fontWeight: order.status === s ? 700 : 500,
                                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                                }}
                              >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: scc.color, flexShrink: 0 }} />
                                {t["status_" + s] || s}
                                {order.status === s && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={scc.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><polyline points="20 6 9 17 4 12"/></svg>}
                              </button>
                            );
                          })}
                          <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
                          <button
                            onClick={(e) => { e.stopPropagation(); setStatusDropdown(null); if (window.confirm(t.confirmDeleteOrder || 'Delete?')) { haptic('medium'); onDelete?.(order.id); } }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%",
                              padding: "9px 12px", border: "none", borderRadius: 8,
                              background: "transparent", color: T.danger,
                              fontSize: 13, fontWeight: 600, cursor: "pointer",
                              textAlign: "left", fontFamily: "inherit",
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            {lang === 'kg' ? 'Өчүрүү' : 'Удалить'}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )}
                  {/* Expand toggle */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setOpen(isOpen ? null : order.id)}
                    style={{
                      width: 30, height: 30, borderRadius: 8, border: "none",
                      background: isOpen ? T.accent : "rgba(0,0,0,0.06)",
                      color: isOpen ? "#fff" : T.textSecond,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </motion.svg>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ── Expanded detail ── */}
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                style={{ borderTop: `1px solid ${T.border}`, overflow: 'hidden' }}
              >
                <div style={{ padding: "14px" }}>
                  {/* Order timeline */}
                  <div style={{ marginBottom: 14 }}>
                    <OrderTimeline status={order.status} lang={lang} />
                  </div>

                  {/* Client info card */}
                  {(order.clientName || order.clientPhone) && (
                    <div style={{ background: T.bgSecond || '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {order.clientName && <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{order.clientName}</div>}
                      {order.clientPhone && <div style={{ fontSize: 13, color: T.textSecond }}>{order.clientPhone}</div>}
                      {(order.payMethod || order.paymentMethod) && (
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {(order.payMethod || order.paymentMethod) === 'odengi' ? 'Онлайн оплата' : lang === 'kg' ? 'Накталай' : 'Наличные'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items list */}
                  <div style={{ background: T.bgSecond || '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                    {(order.items || []).map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < (order.items || []).length - 1 ? `1px solid ${T.border}` : 'none' }}>
                        <span style={{ color: T.textSecond, fontSize: 13 }}>{item.name} <span style={{ color: T.textMuted }}>x{item.qty}</span></span>
                        <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>{formatSum((item.price || 0) * (item.qty || 0))}</span>
                      </div>
                    ))}
                    {order.bonusDiscount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0 0", marginTop: 4, borderTop: `1px dashed ${T.border}` }}>
                        <span style={{ color: T.bonus, fontSize: 12, fontWeight: 600 }}>{lang === 'kg' ? 'Бонус чегирме' : 'Бонус скидка'}</span>
                        <span style={{ color: T.bonus, fontWeight: 700, fontSize: 12 }}>-{formatSum(order.bonusDiscount)}</span>
                      </div>
                    )}
                  </div>

                  {order.address && <div style={{ color: T.textSecond, fontSize: 12, marginBottom: 8, padding: "6px 10px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>{lang === 'kg' ? 'Дарек' : 'Адрес'}: {order.address}</div>}
                  {order.comment && <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 8, fontStyle: "italic" }}>{order.comment}</div>}

                  {/* Online payment confirmation */}
                  {(order.paymentMethod === 'mbank' || order.paymentMethod === 'odengi') && (order.paymentStatus === 'mbank_pending' || order.paymentStatus === 'odengi_pending') && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onConfirmOnlinePayment?.(order.id)}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 10, border: "none",
                        background: "#059669", color: "#fff", fontWeight: 700,
                        fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "inherit",
                      }}
                    >
                      {lang === 'kg' ? 'Онлайн төлөмдү тастыктоо' : 'Подтвердить онлайн оплату'}
                    </motion.button>
                  )}

                  {/* Full status change row */}
                  {!showArchive && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ color: T.textSecond, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.changeStatus}:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["confirmed", "preparing", "delivering", "delivered", "cancelled"].map(s => {
                          const scc = STATUS_COLORS[s];
                          return (
                            <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => handleStatus(order.id, s)} style={{
                              padding: "7px 12px", borderRadius: 8,
                              border: `1.5px solid ${order.status === s ? scc.border : T.border}`,
                              background: order.status === s ? scc.bg : "transparent",
                              color: order.status === s ? scc.color : T.textSecond,
                              fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}>{t["status_" + s] || s}</motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
          );
        })}
      </div>

      {/* Pulse animation keyframes */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
  } catch (err) {
    console.error('[Orders CRASH]', err);
    return <div style={{ padding: 32, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Orders crashed: {String(err?.message || err)}</div>;
  }
}
// ─── ADMIN PRODUCTS ────────────────────────────────────────────────────────────
// ── EditSection — stable component for admin edit form grouping ────────────
// Defined at module level (not inside a render fn) so React keeps the same
// reference across re-renders. When it was inside an IIFE, every keystroke
// created a new component type → React unmounted inputs → focus was lost.
function EditSection({ title, hint, children, last, padded = true }) {
  return (
    <div style={{ marginBottom: last ? 0 : 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>{title}</div>
        {hint && <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500, letterSpacing: -0.1 }}>{hint}</div>}
      </div>
      <div style={{
        background: "#FAFAFA",
        borderRadius: 16,
        padding: padded ? "14px 14px" : 0,
        border: "0.5px solid rgba(0,0,0,0.04)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      }}>
        {children}
      </div>
    </div>
  );
}

export function AdminProductsScreen({ products = [], setProducts, showToast }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0=not active, 1=first confirm, 2=second confirm, 3=final warning
  // Edit-form language switcher — drives which language fields are shown.
  // Reset to 'ru' whenever a different product is opened.
  const [editLang, setEditLang] = useState('ru');
  useEffect(() => { setEditLang('ru'); }, [editing]);
  // filtered is now replaced by processedProducts (useMemo with search + filters + sort)
  const editProd = products.find(p => p.id === editing);
  const upd = (id, f, v) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [f]: v } : p));
  const updVar = (pId, vId, f, v) => setProducts(prev => prev.map(p => p.id === pId ? { ...p, variants: p.variants.map(vr => vr.id === vId ? { ...vr, [f]: v } : vr) } : p));
  const addProd = () => { const np = { id: Date.now(), name: "", brand: "", category: "Женские", img: null, images: [], desc: "", isPopular: false, isHit: false, isNew: false, isAuthor: false, featured: false, priority: 0, shortDesc: "", tags: "", scheduled: false, showFrom: "", showUntil: "", relatedIds: [], variants: [{ id: Date.now(), label: "5 мл", price: 0, type: "ml", inStock: true }] }; setProducts(p => [...p, np]); setEditing(np.id); };

  // ═══ DRAFT AUTOSAVE — yangi (hali PB'ga saqlanmagan) mahsulot yo'qolmasin ═══
  // Yangi mahsulotning id'si raqam (Date.now). U to'ldirilayotganda har 0.8s
  // localStorage'ga yoziladi; sahifa yopilib qolsa — qaytib ochilganda tiklanadi.
  // PB'ga saqlangach (id 15 belgili bo'ladi) draft avtomatik tozalanadi.
  const draftTimer = useRef(null);
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        const unsaved = products.filter(p =>
          typeof p.id === 'number' && (p.name || p.brand || (p.images || []).length > 0));
        if (unsaved.length > 0) {
          localStorage.setItem('parfum_product_drafts', JSON.stringify(unsaved));
        } else {
          localStorage.removeItem('parfum_product_drafts');
        }
      } catch { /* localStorage to'lgan bo'lishi mumkin (katta rasm) — jim */ }
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [products]);

  useEffect(() => {
    // Mount'da: tiklanmagan draftlarni ro'yxatga qaytarish
    try {
      const raw = localStorage.getItem('parfum_product_drafts');
      if (!raw) return;
      const drafts = JSON.parse(raw);
      if (!Array.isArray(drafts) || drafts.length === 0) return;
      const known = new Set(products.map(p => p.id));
      const toAdd = drafts.filter(d => d && typeof d.id === 'number' && !known.has(d.id));
      if (toAdd.length === 0) return;
      setProducts(prev => {
        const ids = new Set(prev.map(p => p.id));
        const add = toAdd.filter(d => !ids.has(d.id));
        return add.length ? [...prev, ...add] : prev;
      });
      showToast?.(lang === 'kg' ? '📝 Черновик калыбына келтирилди' : '📝 Черновик восстановлен');
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    fd.append("isHit", String(!!prod.isHit));
    fd.append("isNew", String(!!prod.isNew));
    fd.append("isAuthor", String(!!prod.isAuthor));
    fd.append("priority", String(Number.isFinite(+prod.priority) ? +prod.priority : 0));
    fd.append("shortDesc", prod.shortDesc || '');
    fd.append("tags", prod.tags || '');
    fd.append("scheduled", String(!!prod.scheduled));
    fd.append("showFrom", prod.showFrom || '');
    fd.append("showUntil", prod.showUntil || '');
    fd.append("relatedIds", JSON.stringify(prod.relatedIds || []));
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
      isHit: !!prod.isHit,
      isNew: !!prod.isNew,
      isAuthor: !!prod.isAuthor,
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
            isPopular: created.isPopular === true || created.isPopular === 'true',
            isHit: created.isHit === true || created.isHit === 'true',
            isNew: created.isNew === true || created.isNew === 'true',
            isAuthor: created.isAuthor === true || created.isAuthor === 'true',
            featured: created.featured === true || created.featured === 'true',
            priority: Number(created.priority) || 0,
            shortDesc: created.shortDesc || '',
            tags: created.tags || '',
            scheduled: created.scheduled === true || created.scheduled === 'true',
            showFrom: created.showFrom || '',
            showUntil: created.showUntil || '',
            relatedIds: (() => { try { return Array.isArray(created.relatedIds) ? created.relatedIds : JSON.parse(created.relatedIds || '[]'); } catch { return []; } })(),
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

  // Toggle ALL variants inStock on/off at once
  const toggleAllStock = async (e, prod) => {
    e.stopPropagation();
    haptic('medium');
    const anyInStock = (prod.variants || []).some(v => v.inStock);
    const nextStock = !anyInStock;
    const updatedVariants = (prod.variants || []).map(v => ({ ...v, inStock: nextStock }));
    setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, variants: updatedVariants } : p));
    if (prod.collectionId) {
      try { await api.updateProduct(prod.id, { variants: JSON.stringify(updatedVariants) }); } catch (err) { console.warn('stock toggle:', err); }
    }
    showToast?.(nextStock ? 'В наличии ✓' : 'Снято с продажи');
  };

  // ── PRO: Sort, filter, bulk, desktop detection ──
  const [sortBy, setSortBy] = useState('newest'); // 'newest','name','priceAsc','priceDesc','stock'
  const [filterCat, setFilterCat] = useState('all');
  const [filterStock, setFilterStock] = useState('all'); // 'all','inStock','outOfStock','sale'
  const [selected, setSelected] = useState(new Set());
  const [previewMode, setPreviewMode] = useState('card'); // 'card' | 'detail'
  const [deskW, setDeskW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => { const h = () => setDeskW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  const isDesk = deskW >= 1024;

  // Toggle selection
  const toggleSel = (id, e) => { e.stopPropagation(); setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); };
  const selectAll = () => { if (selected.size === processedProducts.length) setSelected(new Set()); else setSelected(new Set(processedProducts.map(p => p.id))); };

  // Duplicate
  const duplicateProd = (e, prod) => {
    e.stopPropagation();
    haptic('medium');
    const np = {
      ...prod,
      id: Date.now(),
      collectionId: undefined,
      name: (prod.name || '') + ' (копия)',
      name_kg: prod.name_kg ? prod.name_kg + ' (көчүрмө)' : '',
      variants: (prod.variants || []).map(v => ({ ...v, id: Date.now() + Math.random() * 1000 })),
    };
    setProducts(p => [...p, np]);
    setEditing(np.id);
    showToast?.('Копия создана');
  };

  // Bulk actions — update local state + persist to PocketBase
  const [bulkDeleteStep, setBulkDeleteStep] = useState(0); // 0=off, 1/2/3 = confirmation steps
  const bulkDelete = () => { if (!selected.size) return; setBulkDeleteStep(1); };
  const bulkDeleteConfirm = async () => {
    if (bulkDeleteStep < 3) { haptic('light'); setBulkDeleteStep(bulkDeleteStep + 1); return; }
    const count = selected.size;
    for (const id of selected) { await delProd(id); }
    setSelected(new Set());
    setBulkDeleteStep(0);
    haptic('medium');
    showToast?.(`Удалено: ${count}`);
  };
  const bulkDeleteCancel = () => { setBulkDeleteStep(0); };
  const bulkToggleStock = async (inStock) => {
    const ids = [...selected];
    setProducts(prev => prev.map(p => {
      if (!ids.includes(p.id)) return p;
      return { ...p, variants: (p.variants || []).map(v => ({ ...v, inStock })) };
    }));
    // Persist to PB
    let failed = 0;
    for (const id of ids) {
      const prod = products.find(p => p.id === id);
      if (prod?.collectionId) {
        const updatedV = (prod.variants || []).map(v => ({ ...v, inStock }));
        try { await api.updateProduct(id, { variants: JSON.stringify(updatedV) }); } catch (e) { failed++; console.warn('bulk stock:', e); }
      }
    }
    setSelected(new Set());
    showToast?.(failed
      ? `⚠️ ${ids.length - failed} OK, ${failed} не сохранилось — проверьте интернет`
      : (inStock ? `${ids.length} товаров → В наличии` : `${ids.length} товаров → Нет в наличии`));
  };
  const bulkSetCategory = async (cat) => {
    const ids = [...selected];
    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, category: cat } : p));
    // Persist to PB
    let failed = 0;
    for (const id of ids) {
      const prod = products.find(p => p.id === id);
      if (prod?.collectionId) {
        try { await api.updateProduct(id, { category: cat }); } catch (e) { failed++; console.warn('bulk cat:', e); }
      }
    }
    setSelected(new Set());
    showToast?.(failed ? `⚠️ ${ids.length - failed} OK, ${failed} не сохранилось` : `${ids.length} товаров → ${cat}`);
  };

  // CSV Export
  const exportCSV = () => {
    const rows = [['Название','Бренд','Категория','Варианты','Мин. цена','В наличии','Популярный','Скидка %']];
    products.forEach(p => {
      const stockV = (p.variants||[]).filter(v=>v.inStock);
      const prices = stockV.map(v=>v.price).filter(Boolean);
      rows.push([
        p.name||'', p.brand||'', p.category||'',
        (p.variants||[]).map(v=>v.label).join('; '),
        prices.length ? Math.min(...prices) : 'Нет',
        stockV.length + '/' + (p.variants||[]).length,
        p.isPopular ? 'Да' : 'Нет',
        p.salePercent || 0,
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast?.('CSV экспортирован');
  };

  // Process: filter + sort
  const processedProducts = useMemo(() => {
    let list = [...products];
    // Text search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
    }
    // Category filter — "Новинки" checks isNew flag, others check category field
    if (filterCat === 'Новинки') list = list.filter(p => p.isNew);
    else if (filterCat !== 'all') list = list.filter(p => p.category === filterCat);
    // Stock filter
    if (filterStock === 'inStock') list = list.filter(p => (p.variants||[]).some(v => v.inStock && v.price > 0));
    else if (filterStock === 'outOfStock') list = list.filter(p => !(p.variants||[]).some(v => v.inStock));
    else if (filterStock === 'sale') list = list.filter(p => p.salePercent > 0);
    else if (filterStock === 'noPrice') list = list.filter(p => (p.variants||[]).every(v => !v.price || v.price === 0));
    // Sort
    if (sortBy === 'name') list.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    else if (sortBy === 'priceAsc') list.sort((a,b) => {
      const pa = Math.min(...(a.variants||[]).map(v=>v.price||Infinity));
      const pb = Math.min(...(b.variants||[]).map(v=>v.price||Infinity));
      return pa - pb;
    });
    else if (sortBy === 'priceDesc') list.sort((a,b) => {
      const pa = Math.min(...(a.variants||[]).map(v=>v.price||0));
      const pb = Math.min(...(b.variants||[]).map(v=>v.price||0));
      return pb - pa;
    });
    else if (sortBy === 'stock') list.sort((a,b) => {
      const sa = (a.variants||[]).filter(v=>v.inStock).length;
      const sb = (b.variants||[]).filter(v=>v.inStock).length;
      return sb - sa;
    });
    // newest = default order (most recently added last, but we want newest first)
    else if (sortBy === 'newest') list.reverse();
    return list;
  }, [products, search, filterCat, filterStock, sortBy]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => (p.variants||[]).some(v => v.inStock && v.price > 0)).length;
    const outStock = products.filter(p => !(p.variants||[]).some(v => v.inStock)).length;
    const noPrice = products.filter(p => (p.variants||[]).every(v => !v.price || v.price === 0)).length;
    const onSale = products.filter(p => p.salePercent > 0).length;
    const allPrices = products.flatMap(p => (p.variants||[]).filter(v => v.inStock).map(v => v.price)).filter(Boolean);
    const avgPrice = allPrices.length ? Math.round(allPrices.reduce((a,b)=>a+b,0) / allPrices.length) : 0;
    return { total, inStock, outStock, noPrice, onSale, avgPrice };
  }, [products]);

  // ── Stable sub-components — defined at component level so React keeps
  // the same reference across renders. Previously defined inside an IIFE
  // which recreated them every render, causing inputs to lose focus. ──
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

  // ── Reusable focus/blur handlers for inputs ──
  const inputFocus = (e) => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(10,132,255,0.35)"; e.target.style.boxShadow = "0 0 0 3px rgba(10,132,255,0.12)"; };
  const inputBlur = (e) => { e.target.style.background = "#F5F5F7"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; };

  // ── CATEGORIES constant ──
  const CATEGORIES = ["Женские", "Мужские", "Унисекс", "Премиум", "Новинки"];

  // ── Variant presets ──
  const VARIANT_PRESETS = [
    { label: '5 мл', price: 120 },
    { label: '10 мл', price: 220 },
    { label: '20 мл', price: 400 },
    { label: '50 мл', price: 850 },
  ];
  const addPresetVariants = (pId) => {
    const existing = (editProd?.variants || []).map(v => v.label);
    const toAdd = VARIANT_PRESETS.filter(p => !existing.includes(p.label));
    if (!toAdd.length) { showToast?.('Все варианты уже добавлены'); return; }
    setProducts(prev => prev.map(p => p.id === pId ? {
      ...p,
      variants: [...(p.variants || []), ...toAdd.map((v, i) => ({ id: Date.now() + i, label: v.label, price: v.price, type: 'ml', inStock: true }))]
    } : p));
    haptic('medium');
  };

  // ── Move variant up/down ──
  const moveVar = (pId, vId, dir) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== pId) return p;
      const arr = [...(p.variants || [])];
      const idx = arr.findIndex(v => v.id === vId);
      if (idx < 0) return p;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return p;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...p, variants: arr };
    }));
    haptic('light');
  };

  // ── Editor form renderer (extracted for 2-panel layout) ──
  const renderEditorForm = () => {
    if (!editProd) return null;
    const nameField = editLang === 'ru' ? 'name' : 'name_kg';
    const descField = editLang === 'ru' ? 'desc' : 'desc_kg';
    const namePlaceholder = editLang === 'ru' ? (t.productName || "Название") : "Аталышы";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* ── Изображения ── */}
        <EditSection title="Изображения" hint="до 3 фото">
          <MultiImageUpload
            images={editProd.images || []}
            coverImg={editProd.img}
            onImagesChange={imgs => upd(editProd.id, "images", imgs)}
            onCoverChange={url => upd(editProd.id, "img", url)}
          />
        </EditSection>

        {/* ── Основная информация ── */}
        <EditSection title="Основная информация">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Язык</div>
              <div style={{ display: "inline-flex", background: "rgba(120,120,128,0.14)", borderRadius: 10, padding: 2, position: "relative" }}>
                {['ru','kg'].map(l => {
                  const active = editLang === l;
                  return (
                    <button key={l} type="button" onClick={() => { haptic('light'); setEditLang(l); }}
                      style={{ position: "relative", padding: "5px 16px", minWidth: 44, border: "none", background: "transparent", fontSize: 11, fontWeight: 700, color: active ? "#111" : "#8E8E93", cursor: "pointer", zIndex: 1, letterSpacing: 0.5, fontFamily: "inherit" }}>
                      {l.toUpperCase()}
                      {active && (
                        <motion.div layoutId="edit-lang-pill" transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)", zIndex: -1 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>Название</div>
              <motion.input key={`name-${editLang}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                style={baseInput} placeholder={namePlaceholder} value={editProd[nameField] || ""} onChange={e => upd(editProd.id, nameField, e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>Бренд</div>
              <input style={baseInput} placeholder={t.brand} value={editProd.brand || ""} onChange={e => upd(editProd.id, "brand", e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 8, marginLeft: 2, letterSpacing: 0.3 }}>Категория</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map(c => {
                  const active = (editProd.category || "Женские") === c;
                  return (
                    <motion.button key={c} type="button" whileTap={{ scale: 0.95 }} onClick={() => { haptic('light'); upd(editProd.id, "category", c); }}
                      style={{ padding: "8px 14px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: -0.1, background: active ? "#111" : "rgba(120,120,128,0.12)", color: active ? "#fff" : "#3A3A3C", fontFamily: "inherit", transition: "background 0.18s, color 0.18s" }}>
                      {c}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </EditSection>

        {/* ── Описание ── */}
        <EditSection title="Описание">
          {(() => {
            const raw = editProd[descField] || "";
            const parseNotes = (txt) => {
              const m = { top: '', mid: '', base: '', info: '', body: '' };
              txt.split('\n').forEach(l => {
                const t = l.trim();
                if (t.startsWith('🔝')) { const c = t.indexOf(':'); m.top = c > -1 ? t.slice(c+1).trim() : ''; }
                else if (t.startsWith('💎')) { const c = t.indexOf(':'); m.mid = c > -1 ? t.slice(c+1).trim() : ''; }
                else if (t.startsWith('🌿')) { const c = t.indexOf(':'); m.base = c > -1 ? t.slice(c+1).trim() : ''; }
                else if (t.startsWith('📋')) m.info = t.replace('📋', '').trim();
                else if (t.length > 10 && !t.startsWith('🔝') && !t.startsWith('💎') && !t.startsWith('🌿') && !t.startsWith('📋')) {
                  m.body = m.body ? m.body + ' ' + t : t;
                }
              });
              return m;
            };
            const notes = parseNotes(raw);
            const buildDesc = (n) => {
              let lines = [];
              if (n.top) lines.push(`🔝 Верхние: ${n.top}`);
              if (n.mid) lines.push(`💎 Средние: ${n.mid}`);
              if (n.base) lines.push(`🌿 Базовые: ${n.base}`);
              if (n.info) lines.push('', `📋 ${n.info}`);
              if (n.body) lines.push('', n.body);
              return lines.join('\n').trim();
            };
            const updNote = (key, val) => { const n = { ...notes, [key]: val }; upd(editProd.id, descField, buildDesc(n)); };
            const noteInput = (icon, color, label, key) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                <input style={{ ...baseInput, flex: 1, fontSize: 13 }} placeholder={label} value={notes[key] || ''} onChange={e => updNote(key, e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            );
            return (
              <div>
                {noteInput(<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF9500"><path d="M12 3L20 11H15V21H9V11H4L12 3Z"/></svg>, '#FF9500', 'бергамот, перец, лимон...', 'top')}
                {noteInput(<svg width="14" height="14" viewBox="0 0 24 24" fill="#AF52DE"><path d="M6 3H18L21 9L12 21L3 9L6 3Z"/></svg>, '#AF52DE', 'жасмин, роза, ирис...', 'mid')}
                {noteInput(<svg width="14" height="14" viewBox="0 0 24 24" fill="#34C759"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 2 11.5 2 13.5C2 15.5 3.75 17.25 3.75 17.25C7 8 17 8 17 8Z"/></svg>, '#34C759', 'ваниль, мускус, кедр...', 'base')}
                {noteInput(<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#8E8E93" strokeWidth="1.5"/><path d="M9 2V4H15V2" stroke="#8E8E93" strokeWidth="1.5"/></svg>, '#8E8E93', 'Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный', 'info')}
                <textarea style={{ ...baseInput, minHeight: 60, resize: "vertical", lineHeight: 1.45, marginTop: 4, fontSize: 13 }} placeholder="Описание аромата (2-3 предложения)" value={notes.body || ''} onChange={e => updNote('body', e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            );
          })()}
        </EditSection>

        {/* ── Аудио ── */}
        <EditSection title="Аромат" hint="10 сек">
          <ProductAudioRecorder productId={editProd.id} />
        </EditSection>

        {/* ── Варианты (with drag reorder + presets) ── */}
        <EditSection title="Варианты" hint={`${editProd.variants?.length || 0}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(editProd.variants || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 2px 0 30px" }}>
                <div style={{ flex: 2, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Размер</div>
                <div style={{ flex: 2, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Цена</div>
                <div style={{ width: 42, fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", flexShrink: 0 }}>Есть</div>
                <div style={{ width: 32, flexShrink: 0 }} />
              </div>
            )}
            {(editProd.variants || []).map((v, vi) => (
              <div key={v.id} style={{ display: "flex", gap: 6, alignItems: "center", background: "#fff", borderRadius: 12, padding: "6px 8px", border: "0.5px solid rgba(0,0,0,0.04)" }}>
                {/* Drag reorder buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                  <button type="button" onClick={() => moveVar(editProd.id, v.id, -1)} disabled={vi === 0}
                    style={{ width: 22, height: 14, border: "none", background: "transparent", cursor: vi === 0 ? "default" : "pointer", color: vi === 0 ? "#D1D1D6" : "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 5L5 1L9 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button type="button" onClick={() => moveVar(editProd.id, v.id, 1)} disabled={vi === (editProd.variants||[]).length - 1}
                    style={{ width: 22, height: 14, border: "none", background: "transparent", cursor: vi === (editProd.variants||[]).length - 1 ? "default" : "pointer", color: vi === (editProd.variants||[]).length - 1 ? "#D1D1D6" : "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1L5 5L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <input style={{ ...baseInput, flex: 2, padding: "10px 12px", fontSize: 14, background: "#F5F5F7" }} placeholder="5 мл / Полный" value={v.label} onChange={e => updVar(editProd.id, v.id, "label", e.target.value)} />
                <div style={{ flex: 2, position: "relative", display: "flex", alignItems: "center" }}>
                  <input style={{ ...baseInput, padding: "10px 40px 10px 12px", fontSize: 14, background: "#F5F5F7" }} type="number" min={0} placeholder="0" value={v.price} onChange={e => updVar(editProd.id, v.id, "price", Math.max(0, +e.target.value))} />
                  <span style={{ position: "absolute", right: 10, fontSize: 12, color: "#8E8E93", fontWeight: 500, pointerEvents: "none" }}>сом</span>
                </div>
                <button type="button" onClick={() => { haptic('light'); updVar(editProd.id, v.id, "inStock", !v.inStock); }} aria-label="in stock"
                  style={{ position: "relative", width: 42, height: 26, borderRadius: 14, background: v.inStock ? "#34C759" : "rgba(120,120,128,0.32)", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, transition: "background 0.22s" }}>
                  <motion.div animate={{ x: v.inStock ? 18 : 2 }} transition={{ type: "spring", stiffness: 540, damping: 32 }}
                    style={{ position: "absolute", top: 2, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.06)" }} />
                </button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => delVar(editProd.id, v.id)} aria-label="delete variant"
                  style={{ background: "rgba(229,57,53,0.10)", border: "none", color: "#E53935", cursor: "pointer", width: 30, height: 30, borderRadius: 10, padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </motion.button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => addVar(editProd.id)}
                style={{ flex: 1, background: "rgba(0,0,0,0.04)", border: "0.5px dashed rgba(0,0,0,0.18)", borderRadius: 10, padding: "10px", color: "#3A3A3C", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: -0.1, fontFamily: "inherit" }}>
                + Добавить вариант
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => addPresetVariants(editProd.id)}
                style={{ background: "rgba(10,132,255,0.08)", border: "0.5px solid rgba(10,132,255,0.20)", borderRadius: 10, padding: "10px 14px", color: "#0A84FF", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: -0.1, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                5/10/20/50 мл
              </motion.button>
            </div>
          </div>
        </EditSection>

        {/* ── Акция (toggle-based) ── */}
        <EditSection title="Акция">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Toggle + percent in one row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: (editProd.salePercent > 0) ? "rgba(255,59,48,0.04)" : "#fff", borderRadius: 12, border: "0.5px solid " + ((editProd.salePercent > 0) ? "rgba(255,59,48,0.15)" : "rgba(0,0,0,0.04)"), transition: "all 0.22s" }}>
              <button type="button" onClick={() => { haptic('light'); upd(editProd.id, "salePercent", editProd.salePercent > 0 ? 0 : 10); }}
                style={{ position: "relative", width: 48, height: 28, borderRadius: 14, background: editProd.salePercent > 0 ? "#FF3B30" : "rgba(120,120,128,0.32)", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, transition: "background 0.22s" }}>
                <motion.div animate={{ x: editProd.salePercent > 0 ? 22 : 2 }} transition={{ type: "spring", stiffness: 540, damping: 32 }}
                  style={{ position: "absolute", top: 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.20)" }} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>Скидка</div>
                <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 1 }}>{editProd.salePercent > 0 ? 'Активна' : 'Выключена'}</div>
              </div>
              {editProd.salePercent > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" min="1" max="90" step="5" style={{ ...baseInput, width: 60, textAlign: "center", padding: "8px 6px", fontSize: 16, fontWeight: 700 }}
                    value={editProd.salePercent || ''} onChange={e => upd(editProd.id, "salePercent", e.target.value === "" ? "" : Math.min(90, Math.max(0, +e.target.value)))} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#FF3B30" }}>%</span>
                </div>
              )}
            </div>
            {/* Sale timer — only when sale is on */}
            <AnimatePresence>
              {editProd.salePercent > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111", letterSpacing: -0.1, marginBottom: 8 }}>Окончание акции</div>
                    <input type="datetime-local" style={{ ...baseInput, width: "100%", padding: "10px 12px", fontSize: 14 }}
                      value={editProd.saleEnd ? editProd.saleEnd.slice(0, 16) : ''} onChange={e => upd(editProd.id, "saleEnd", e.target.value ? new Date(e.target.value).toISOString() : '')} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {[{ label: "1ч", hours: 1 }, { label: "3ч", hours: 3 }, { label: "6ч", hours: 6 }, { label: "12ч", hours: 12 }, { label: "1д", hours: 24 }, { label: "3д", hours: 72 }, { label: "7д", hours: 168 }].map(q => (
                        <motion.button key={q.label} type="button" whileTap={{ scale: 0.95 }}
                          onClick={() => { haptic('light'); upd(editProd.id, "saleEnd", new Date(Date.now() + q.hours * 3600000).toISOString()); upd(editProd.id, "saleStart", new Date().toISOString()); }}
                          style={{ padding: "5px 10px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,59,48,0.08)", color: "#FF3B30", fontFamily: "inherit" }}>
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </EditSection>

        {/* ── Бейджи и продвижение ── */}
        <EditSection title={t.badges_title}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { key: "isAuthor", label: t.badge_author, sub: t.badge_author_sub, color: "#111", iconFn: () => IC.crown(18, editProd.isAuthor ? "#FFD700" : "#8E8E93") },
              { key: "isPopular", label: t.badge_popular, sub: t.badge_popular_sub, color: "#FF3B30", iconFn: () => IC.flame(18, editProd.isPopular ? "#FF3B30" : "#8E8E93") },
              { key: "isHit", label: t.badge_hit, sub: t.badge_hit_sub, color: "#FF9500", iconFn: () => IC.bolt(18, editProd.isHit ? "#FF9500" : "#8E8E93") },
              { key: "isNew", label: t.badge_new, sub: t.badge_new_sub, color: "#34C759", iconFn: () => IC.sparkle(18, editProd.isNew ? "#34C759" : "#8E8E93") },
              { key: "featured", label: t.badge_featured, sub: t.badge_featured_sub, color: "#007AFF", iconFn: () => IC.pin(18, editProd.featured ? "#007AFF" : "#8E8E93") },
            ].map(item => (
              <div key={item.key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px", background: editProd[item.key] ? (item.color + '08') : "#fff",
                borderRadius: 12, border: "0.5px solid " + (editProd[item.key] ? item.color + '20' : "rgba(0,0,0,0.04)"),
                transition: "all 0.22s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: editProd[item.key] ? (item.color + '12') : "rgba(0,0,0,0.03)", transition: "all 0.22s" }}>{item.iconFn()}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 1 }}>{item.sub}</div>
                  </div>
                </div>
                <button type="button" onClick={() => { haptic('light'); upd(editProd.id, item.key, !editProd[item.key]); }}
                  style={{ position: "relative", width: 48, height: 28, borderRadius: 14, background: editProd[item.key] ? item.color : "rgba(120,120,128,0.32)", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, transition: "background 0.22s" }}>
                  <motion.div animate={{ x: editProd[item.key] ? 22 : 2 }} transition={{ type: "spring", stiffness: 540, damping: 32 }}
                    style={{ position: "absolute", top: 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.20)" }} />
                </button>
              </div>
            ))}
          </div>
        </EditSection>

        {/* ── Приоритет ── */}
        <EditSection title={t.priority_title}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fff", borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", letterSpacing: -0.1 }}>{t.priority_label}</div>
              <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 1 }}>{t.priority_sub}</div>
            </div>
            <input type="number" style={{ ...baseInput, width: 80, textAlign: "center", flexShrink: 0, padding: "8px 10px" }}
              placeholder="0" value={editProd.priority ?? 0} onChange={e => upd(editProd.id, "priority", e.target.value === "" ? "" : +e.target.value)} />
          </div>
        </EditSection>

        {/* ── SEO / Marketing ── */}
        <EditSection title={t.seo_title}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>{t.seo_short_desc}</div>
              <input style={{ ...baseInput, fontSize: 13 }} placeholder={t.seo_short_desc_placeholder} maxLength={100}
                value={editProd.shortDesc || ''} onChange={e => upd(editProd.id, "shortDesc", e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
              <div style={{ fontSize: 10, color: "#C7C7CC", marginTop: 3, textAlign: "right" }}>{(editProd.shortDesc||'').length}/100</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", marginBottom: 6, marginLeft: 2, letterSpacing: 0.3 }}>{t.seo_tags}</div>
              <input style={{ ...baseInput, fontSize: 13 }} placeholder={t.seo_tags_placeholder}
                value={editProd.tags || ''} onChange={e => upd(editProd.id, "tags", e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
              {editProd.tags && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {editProd.tags.split(',').map((tag, i) => tag.trim() && (
                    <span key={i} style={{ fontSize: 10, fontWeight: 600, color: "#0A84FF", background: "rgba(10,132,255,0.08)", padding: "3px 8px", borderRadius: 8 }}>
                      #{tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </EditSection>

        {/* ── Видимость по времени ── */}
        <EditSection title={t.visibility_title}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{t.visibility_schedule}</div>
                <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 1 }}>{t.visibility_from}</div>
              </div>
              <button type="button" onClick={() => { haptic('light'); upd(editProd.id, "scheduled", !editProd.scheduled); }}
                style={{ position: "relative", width: 48, height: 28, borderRadius: 14, background: editProd.scheduled ? "#007AFF" : "rgba(120,120,128,0.32)", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, transition: "background 0.22s" }}>
                <motion.div animate={{ x: editProd.scheduled ? 22 : 2 }} transition={{ type: "spring", stiffness: 540, damping: 32 }}
                  style={{ position: "absolute", top: 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.20)" }} />
              </button>
            </div>
            <AnimatePresence>
              {editProd.scheduled && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#8E8E93", marginBottom: 4 }}>{t.visibility_from}</div>
                      <input type="datetime-local" style={{ ...baseInput, fontSize: 12, padding: "8px 10px" }}
                        value={editProd.showFrom ? editProd.showFrom.slice(0, 16) : ''} onChange={e => upd(editProd.id, "showFrom", e.target.value ? new Date(e.target.value).toISOString() : '')} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#8E8E93", marginBottom: 4 }}>{t.visibility_until}</div>
                      <input type="datetime-local" style={{ ...baseInput, fontSize: 12, padding: "8px 10px" }}
                        value={editProd.showUntil ? editProd.showUntil.slice(0, 16) : ''} onChange={e => upd(editProd.id, "showUntil", e.target.value ? new Date(e.target.value).toISOString() : '')} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </EditSection>

        {/* ── Похожие товары ── */}
        <EditSection title={t.related_title} hint={t.related_max} last>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500 }}>
              {t.related_add}
            </div>
            {/* Selected related products */}
            {(editProd.relatedIds || []).map((rid, ri) => {
              const rp = products.find(pp => pp.id === rid);
              if (!rp) return null;
              return (
                <div key={rid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "#F5F5F7", flexShrink: 0 }}>
                    {rp.img ? <img src={rp.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C7C7CC" }}>{IC.camera}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rp.name}</div>
                    <div style={{ fontSize: 10, color: "#8E8E93" }}>{rp.brand}</div>
                  </div>
                  <button type="button" onClick={() => upd(editProd.id, "relatedIds", (editProd.relatedIds||[]).filter(x => x !== rid))}
                    style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(229,57,53,0.08)", color: "#E53935", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
            {/* Add related product dropdown */}
            {(editProd.relatedIds || []).length < 3 && (
              <select
                value=""
                onChange={e => {
                  if (!e.target.value) return;
                  const current = editProd.relatedIds || [];
                  if (current.includes(e.target.value)) return;
                  upd(editProd.id, "relatedIds", [...current, e.target.value]);
                  e.target.value = '';
                }}
                style={{ ...baseInput, fontSize: 12, padding: "10px 12px", color: "#8E8E93", cursor: "pointer" }}>
                <option value="">+ {t.related_add}...</option>
                {products.filter(pp => pp.id !== editProd.id && !(editProd.relatedIds||[]).includes(pp.id) && pp.name).map(pp => (
                  <option key={pp.id} value={pp.id}>{pp.brand ? `${pp.brand} — ` : ''}{pp.name}</option>
                ))}
              </select>
            )}
          </div>
        </EditSection>

        {/* Delete */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => setDeleteConfirmId(editProd.id)}
          style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none", background: "rgba(229,57,53,0.10)", color: "#E53935", fontWeight: 600, fontSize: 14, cursor: "pointer", letterSpacing: -0.1, fontFamily: "inherit" }}>
          {t.delete}
        </motion.button>
      </div>
    );
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(250,250,250,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        padding: "20px 20px 0",
        borderBottom: "0.5px solid rgba(0,0,0,0.06)",
      }}>
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: -0.6 }}>{t.products}</div>
            <div style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500, marginTop: 2 }}>
              {summaryStats.total} товаров · {summaryStats.inStock} в наличии{summaryStats.noPrice > 0 ? ` · ${summaryStats.noPrice} без цен` : ''}{summaryStats.onSale > 0 ? ` · ${summaryStats.onSale} со скидкой` : ''}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Export CSV */}
            <motion.button whileTap={{ scale: 0.94 }} onClick={exportCSV} title="Экспорт CSV"
              style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: "rgba(0,0,0,0.05)", color: "#3A3A3C", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </motion.button>
            {/* Add product */}
            <motion.button whileTap={{ scale: 0.96 }} onClick={addProd}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 999, border: "none", background: "#111", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: -0.1, boxShadow: "0 6px 16px rgba(17,17,17,0.18), 0 1px 3px rgba(0,0,0,0.08)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t.add}
            </motion.button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#F2F2F7", borderRadius: 12, padding: "0 12px", marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search || "Поиск парфюма..."}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 500, color: "#111", padding: "10px 8px", fontFamily: "inherit", letterSpacing: -0.1 }} />
          <AnimatePresence>
            {search && (
              <motion.button key="clear" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                onClick={() => setSearch("")} aria-label="clear"
                style={{ background: "rgba(0,0,0,0.18)", color: "#fff", border: "none", width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Filter chips row */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, WebkitOverflowScrolling: "touch" }}>
          {/* Category filter */}
          {['all', ...CATEGORIES].map(c => {
            const active = filterCat === c;
            const label = c === 'all' ? 'Все' : c;
            return (
              <motion.button key={c} whileTap={{ scale: 0.95 }} onClick={() => { haptic('light'); setFilterCat(c); }}
                style={{ padding: "6px 14px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: -0.1, background: active ? "#111" : "rgba(120,120,128,0.10)", color: active ? "#fff" : "#3A3A3C", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.18s" }}>
                {label}
              </motion.button>
            );
          })}
          <div style={{ width: 1, background: "rgba(0,0,0,0.08)", margin: "4px 2px", flexShrink: 0 }} />
          {/* Stock filter */}
          {[{id:'all',l:'Все'},{id:'inStock',l:'В наличии'},{id:'outOfStock',l:'Нет'},{id:'noPrice',l:'Без цен'},{id:'sale',l:'Скидки'}].map(f => {
            const active = filterStock === f.id;
            const chipColor = active
              ? (f.id === 'sale' ? { bg: "rgba(255,59,48,0.12)", fg: "#FF3B30" }
                : f.id === 'outOfStock' ? { bg: "rgba(255,149,0,0.12)", fg: "#FF9500" }
                : f.id === 'noPrice' ? { bg: "rgba(142,142,147,0.18)", fg: "#636366" }
                : { bg: "rgba(10,132,255,0.12)", fg: "#0A84FF" })
              : { bg: "rgba(120,120,128,0.08)", fg: "#8E8E93" };
            return (
              <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => { haptic('light'); setFilterStock(f.id); }}
                style={{ padding: "6px 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: chipColor.bg, color: chipColor.fg, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.18s" }}>
                {f.l}{active && f.id !== 'all' ? ` (${f.id === 'inStock' ? summaryStats.inStock : f.id === 'outOfStock' ? summaryStats.outStock : f.id === 'noPrice' ? summaryStats.noPrice : summaryStats.onSale})` : ''}
              </motion.button>
            );
          })}
          <div style={{ width: 1, background: "rgba(0,0,0,0.08)", margin: "4px 2px", flexShrink: 0 }} />
          {/* Sort dropdown */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, background: "rgba(120,120,128,0.10)", color: "#3A3A3C", fontFamily: "inherit", cursor: "pointer", flexShrink: 0, outline: "none" }}>
            <option value="newest">Новые</option>
            <option value="name">По имени</option>
            <option value="priceAsc">Цена ↑</option>
            <option value="priceDesc">Цена ↓</option>
            <option value="stock">По наличию</option>
          </select>
        </div>
      </div>

      {/* ═══ BULK ACTIONS BAR ═══ */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(10,132,255,0.06)", borderBottom: "0.5px solid rgba(10,132,255,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0A84FF", marginRight: 6 }}>Выбрано: {selected.size}</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => bulkToggleStock(true)}
                style={{ padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(52,199,89,0.12)", color: "#34C759", fontFamily: "inherit" }}>В наличии</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => bulkToggleStock(false)}
                style={{ padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,149,0,0.12)", color: "#FF9500", fontFamily: "inherit" }}>Нет в наличии</motion.button>
              {/* Bulk category */}
              <select onChange={e => { if (e.target.value) { bulkSetCategory(e.target.value); e.target.value = ''; } }}
                style={{ padding: "6px 10px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, background: "rgba(120,120,128,0.10)", color: "#3A3A3C", fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                <option value="">Категория...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <motion.button whileTap={{ scale: 0.95 }} onClick={bulkDelete}
                style={{ padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(229,57,53,0.10)", color: "#E53935", fontFamily: "inherit" }}>Удалить</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelected(new Set())}
                style={{ padding: "6px 10px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(0,0,0,0.06)", color: "#8E8E93", fontFamily: "inherit" }}>Отмена</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ EDITOR (2-panel on desktop) ═══ */}
      {editProd && (
        <div style={{ margin: isDesk ? "16px 20px" : "12px 16px 16px", background: "#FFFFFF", borderRadius: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)", border: "0.5px solid rgba(0,0,0,0.05)" }}>
          {/* ── Sticky header — back · title · save ── */}
          <div style={{
            position: "sticky", top: isDesk ? 0 : 0, zIndex: 5,
            background: "rgba(255,255,255,0.94)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
            padding: isDesk ? "14px 20px" : "12px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", borderRadius: "20px 20px 0 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setEditing(null)} aria-label="back"
              style={{ background: "rgba(0,0,0,0.05)", border: "none", color: "#111", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
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
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => saveProd(editProd.id)} disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 999, border: "none", background: "#111", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.85 : 1, letterSpacing: -0.1, boxShadow: "0 4px 12px rgba(17,17,17,0.18)", flexShrink: 0, fontFamily: "inherit" }}>
              {saving && (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 12, height: 12, border: "1.6px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
              )}
              {saving ? "Сохранение" : t.save}
            </motion.button>
          </div>

          {/* ── 2-panel layout (desktop) / single scroll (mobile) ── */}
          {isDesk ? (
            <div style={{ display: "flex", gap: 0 }}>
              {/* Left — sticky live preview with iPhone mockup */}
              <div style={{ width: 370, flexShrink: 0, padding: "20px 16px", borderRight: "0.5px solid rgba(0,0,0,0.06)", position: "sticky", top: 60, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
                {/* Preview mode toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Превью</div>
                  <div style={{ display: "inline-flex", background: "rgba(120,120,128,0.12)", borderRadius: 8, padding: 2 }}>
                    {[{ id: 'card', l: 'Каталог' }, { id: 'detail', l: 'Товар' }].map(m => {
                      const active = previewMode === m.id;
                      return (
                        <button key={m.id} type="button" onClick={() => { haptic('light'); setPreviewMode(m.id); }}
                          style={{ position: "relative", padding: "4px 12px", border: "none", background: "transparent", fontSize: 11, fontWeight: 600, color: active ? "#111" : "#8E8E93", cursor: "pointer", zIndex: 1, fontFamily: "inherit", letterSpacing: -0.1 }}>
                          {m.l}
                          {active && (
                            <motion.div layoutId="preview-mode-pill" transition={{ type: "spring", stiffness: 500, damping: 32 }}
                              style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.10)", zIndex: -1 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* iPhone mockup frame */}
                <div style={{
                  position: "relative", margin: "0 auto", width: 260,
                  background: "#000", borderRadius: 36, padding: "12px 10px",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08), inset 0 0 0 1.5px rgba(255,255,255,0.08)",
                }}>
                  {/* Notch / Dynamic Island */}
                  <div style={{ width: 80, height: 22, background: "#000", borderRadius: 12, margin: "0 auto 8px", position: "relative", zIndex: 2 }}>
                    <div style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }} />
                  </div>
                  {/* Screen content */}
                  <div style={{
                    background: "#FAFAFA", borderRadius: 24, overflow: "hidden",
                    minHeight: previewMode === 'detail' ? 360 : 260,
                    transition: "min-height 0.3s ease",
                  }}>
                    <AnimatePresence mode="wait">
                      {previewMode === 'card' ? (
                        <motion.div key="card-preview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
                          style={{ padding: 16 }}>
                          <ProductCard p={editProd} preview />
                        </motion.div>
                      ) : (
                        <motion.div key="detail-preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                          {/* Mini product detail page */}
                          <div style={{ position: "relative" }}>
                            {/* Hero image */}
                            <div style={{ width: "100%", aspectRatio: "1/1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              {editProd.img ? (
                                <img src={editProd.img} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" />
                              ) : (
                                <div style={{ color: "#C7C7CC", fontSize: 32 }}>📷</div>
                              )}
                            </div>
                            {/* Sale badge */}
                            {editProd.salePercent > 0 && (
                              <div style={{ position: "absolute", top: 8, right: 8, background: "#FF3B30", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8 }}>
                                -{editProd.salePercent}%
                              </div>
                            )}
                            {/* Image dots */}
                            {(editProd.images||[]).length > 1 && (
                              <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
                                {(editProd.images||[]).slice(0,3).map((_,i) => (
                                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i === 0 ? "#111" : "rgba(0,0,0,0.20)" }} />
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Product info */}
                          <div style={{ padding: "12px 14px 16px" }}>
                            <div style={{ fontSize: 9, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 500 }}>{editProd.brand || 'БРЕНД'}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginTop: 2, letterSpacing: -0.3, lineHeight: 1.2 }}>{editProd.name || 'Название'}</div>
                            {/* Variant chips */}
                            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                              {(editProd.variants||[]).slice(0,3).map((v,i) => (
                                <div key={i} style={{
                                  padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                                  background: v.inStock ? (i === 0 ? "#111" : "rgba(0,0,0,0.06)") : "rgba(229,57,53,0.08)",
                                  color: v.inStock ? (i === 0 ? "#fff" : "#3A3A3C") : "#E53935",
                                  border: i === 0 ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                                }}>
                                  {v.label} {v.inStock && v.price > 0 ? `· ${v.price}` : ''}
                                </div>
                              ))}
                              {(editProd.variants||[]).length > 3 && (
                                <div style={{ padding: "4px 6px", fontSize: 9, color: "#8E8E93", fontWeight: 500 }}>+{(editProd.variants||[]).length - 3}</div>
                              )}
                            </div>
                            {/* Price */}
                            {(() => {
                              const ps = (editProd.variants||[]).filter(v=>v.inStock).map(v=>v.price).filter(Boolean);
                              const min = ps.length ? Math.min(...ps) : 0;
                              return (
                                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                                  {editProd.salePercent > 0 && min > 0 && (
                                    <span style={{ fontSize: 11, color: "#8E8E93", textDecoration: "line-through" }}>{formatSum(min)}</span>
                                  )}
                                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111", letterSpacing: -0.3 }}>
                                    {min > 0 ? (editProd.salePercent > 0 ? formatSum(Math.round(min * (1 - editProd.salePercent/100))) : formatSum(min)) : 'Нет в наличии'}
                                  </span>
                                </div>
                              );
                            })()}
                            {/* Description preview */}
                            {(editProd.desc || editProd.desc_kg) && (
                              <div style={{ marginTop: 8, fontSize: 9, color: "#8E8E93", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                {(editProd.desc || editProd.desc_kg || '').replace(/🔝|💎|🌿|📋/g, '').replace(/Верхние:|Средние:|Базовые:/g, '').trim().slice(0, 100)}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Home indicator */}
                  <div style={{ width: 100, height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 2, margin: "8px auto 2px" }} />
                </div>

                {/* Quick stats — with icons */}
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, l: "Варианты", v: `${(editProd.variants||[]).filter(v=>v.inStock).length} из ${(editProd.variants||[]).length}`, c: (editProd.variants||[]).some(v=>v.inStock) ? "#34C759" : "#FF3B30" },
                    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, l: "Цена", v: (() => { const ps = (editProd.variants||[]).filter(v=>v.inStock).map(v=>v.price).filter(Boolean); return ps.length ? (ps.length === 1 ? formatSum(ps[0]) : `${Number(Math.min(...ps)).toLocaleString()} – ${formatSum(Math.max(...ps))}`) : '—'; })(), c: "#111" },
                    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>, l: "Категория", v: editProd.category || '—', c: "#3A3A3C" },
                    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={editProd.salePercent > 0 ? "#FF3B30" : "#8E8E93"} strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, l: "Скидка", v: editProd.salePercent > 0 ? `${editProd.salePercent}%` : 'Нет', c: editProd.salePercent > 0 ? "#FF3B30" : "#8E8E93" },
                    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>, l: "Фото", v: `${(editProd.images||[]).filter(Boolean).length} из 3`, c: (editProd.images||[]).filter(Boolean).length > 0 ? "#34C759" : "#FF9500" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#FAFAFA", borderRadius: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.icon}</div>
                      <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 500, flex: 1 }}>{s.l}</span>
                      <span style={{ fontSize: 12, color: s.c, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right — form */}
              <div style={{ flex: 1, padding: "20px 20px 24px", minWidth: 0 }}>
                {renderEditorForm()}
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px 14px 22px" }}>
              {/* Mobile: compact horizontal preview — card + mini detail side by side */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>Превью</div>
                  <div style={{ display: "inline-flex", background: "rgba(120,120,128,0.12)", borderRadius: 8, padding: 2 }}>
                    {[{ id: 'card', l: 'Каталог' }, { id: 'detail', l: 'Товар' }].map(m => {
                      const active = previewMode === m.id;
                      return (
                        <button key={m.id} type="button" onClick={() => { haptic('light'); setPreviewMode(m.id); }}
                          style={{ position: "relative", padding: "4px 12px", border: "none", background: "transparent", fontSize: 11, fontWeight: 600, color: active ? "#111" : "#8E8E93", cursor: "pointer", zIndex: 1, fontFamily: "inherit", letterSpacing: -0.1 }}>
                          {m.l}
                          {active && (
                            <motion.div layoutId="mob-preview-pill" transition={{ type: "spring", stiffness: 500, damping: 32 }}
                              style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.10)", zIndex: -1 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ background: "#F2F2F7", borderRadius: 16, padding: 12, overflow: "hidden" }}>
                  <AnimatePresence mode="wait">
                    {previewMode === 'card' ? (
                      <motion.div key="mob-card" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.18 }}
                        style={{ maxWidth: 220, margin: "0 auto" }}>
                        <ProductCard p={editProd} preview />
                      </motion.div>
                    ) : (
                      <motion.div key="mob-detail" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.18 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          {/* Mini image */}
                          <div style={{ width: 100, height: 120, borderRadius: 12, background: "#fff", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                            {editProd.img ? (
                              <img src={editProd.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C7C7CC", fontSize: 24 }}>📷</div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 500 }}>{editProd.brand || 'БРЕНД'}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginTop: 2, letterSpacing: -0.2, lineHeight: 1.2 }}>{editProd.name || 'Название'}</div>
                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                              {(editProd.variants||[]).slice(0,3).map((v,vi) => (
                                <div key={vi} style={{ padding: "3px 7px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: v.inStock ? (vi === 0 ? "#111" : "rgba(0,0,0,0.06)") : "rgba(229,57,53,0.08)", color: v.inStock ? (vi === 0 ? "#fff" : "#3A3A3C") : "#E53935" }}>
                                  {v.label}
                                </div>
                              ))}
                            </div>
                            {(() => {
                              const ps = (editProd.variants||[]).filter(v=>v.inStock).map(v=>v.price).filter(Boolean);
                              const min = ps.length ? Math.min(...ps) : 0;
                              return (
                                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: "#111", letterSpacing: -0.3 }}>
                                  {min > 0 ? (editProd.salePercent > 0 ? formatSum(Math.round(min * (1 - editProd.salePercent/100))) : formatSum(min)) : 'Нет в наличии'}
                                </div>
                              );
                            })()}
                            {editProd.salePercent > 0 && (
                              <div style={{ marginTop: 2, display: "inline-block", fontSize: 10, fontWeight: 700, color: "#FF3B30", background: "rgba(255,59,48,0.08)", padding: "2px 8px", borderRadius: 6 }}>
                                -{editProd.salePercent}% скидка
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {renderEditorForm()}
            </div>
          )}
        </div>
      )}

      {/* ═══ DELETE CONFIRMATION MODAL — 3-STEP ═══ */}
      <AnimatePresence>
        {deleteConfirmId && deleteStep > 0 && (() => {
          const delProdName = products.find(p => p.id === deleteConfirmId)?.name || '';
          const stepConfig = {
            1: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
              iconBg: "rgba(255,149,0,0.12)",
              title: lang === 'kg' ? 'Товарды өчүрүүнү каалайсызбы?' : 'Удалить товар?',
              subtitle: delProdName ? `«${delProdName}»` : '',
              desc: lang === 'kg' ? 'Товар каталогдон жок болот.' : 'Товар будет удалён из каталога.',
              confirmText: lang === 'kg' ? 'Ооба, өчүрүү' : 'Да, удалить',
              confirmBg: '#FF9500',
            },
            2: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E53935" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
              iconBg: "rgba(229,57,53,0.12)",
              title: lang === 'kg' ? 'Чындап өчүрөсүзбү?' : 'Точно удалить?',
              subtitle: '',
              desc: lang === 'kg' ? 'Бул иш-аракет кайтарылбайт!' : 'Все данные товара, фото и варианты будут потеряны!',
              confirmText: lang === 'kg' ? 'Ооба, чындап' : 'Да, точно',
              confirmBg: '#E53935',
            },
            3: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
              iconBg: "#E53935",
              title: lang === 'kg' ? 'АКЫРКЫ ЭСКЕРТҮҮ!' : 'ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!',
              subtitle: '',
              desc: lang === 'kg' ? 'Бул товар биротоло жок кылынат. Кайтаруу мүмкүн эмес!' : 'Это действие необратимо! Товар будет удалён навсегда.',
              confirmText: lang === 'kg' ? 'ӨЧҮРҮҮ' : 'УДАЛИТЬ НАВСЕГДА',
              confirmBg: '#B71C1C',
            },
          };
          const cfg = stepConfig[deleteStep];
          return (
            <motion.div key="del-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={() => { setDeleteConfirmId(null); setDeleteStep(0); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <motion.div key={`del-step-${deleteStep}`} initial={{ scale: 0.92, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }} onClick={e => e.stopPropagation()}
                style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.30)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  {cfg.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111", textAlign: "center", letterSpacing: -0.2, marginBottom: cfg.subtitle ? 2 : 6 }}>{cfg.title}</div>
                {cfg.subtitle && <div style={{ fontSize: 13, fontWeight: 600, color: "#3A3A3C", textAlign: "center", marginBottom: 6 }}>{cfg.subtitle}</div>}
                <div style={{ fontSize: 13, color: "#8E8E93", textAlign: "center", lineHeight: 1.45, marginBottom: 16 }}>{cfg.desc}</div>
                {/* Step indicator */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                  {[1,2,3].map(s => (
                    <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: s <= deleteStep ? cfg.confirmBg : '#E5E5EA', transition: 'background 0.2s' }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setDeleteConfirmId(null); setDeleteStep(0); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#F2F2F7", color: "#111", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    {lang === 'kg' ? 'Жокко чыгаруу' : 'Отмена'}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      if (deleteStep < 3) { haptic('light'); setDeleteStep(deleteStep + 1); }
                      else { const id = deleteConfirmId; setDeleteConfirmId(null); setDeleteStep(0); haptic('medium'); await delProd(id); showToast?.('Товар удалён'); }
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: cfg.confirmBg, color: "#fff", fontSize: deleteStep === 3 ? 12 : 14, fontWeight: 700, cursor: "pointer", letterSpacing: deleteStep === 3 ? 0.5 : 0 }}>
                    {cfg.confirmText}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ═══ BULK DELETE CONFIRMATION MODAL — 3-STEP ═══ */}
      <AnimatePresence>
        {bulkDeleteStep > 0 && (() => {
          const count = selected.size;
          const stepConfig = {
            1: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
              iconBg: "rgba(255,149,0,0.12)",
              title: `Удалить ${count} ${count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'}?`,
              desc: 'Выбранные товары будут удалены из каталога.',
              confirmText: 'Да, удалить',
              confirmBg: '#FF9500',
            },
            2: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E53935" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
              iconBg: "rgba(229,57,53,0.12)",
              title: 'Точно удалить все выбранные?',
              desc: `${count} товаров, все фото и варианты будут потеряны навсегда!`,
              confirmText: 'Да, точно',
              confirmBg: '#E53935',
            },
            3: {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
              iconBg: "#E53935",
              title: 'ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!',
              desc: `Вы удаляете ${count} товаров. Это действие НЕОБРАТИМО!`,
              confirmText: 'УДАЛИТЬ НАВСЕГДА',
              confirmBg: '#B71C1C',
            },
          };
          const cfg = stepConfig[bulkDeleteStep];
          return (
            <motion.div key="bulk-del-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={bulkDeleteCancel}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <motion.div key={`bulk-del-step-${bulkDeleteStep}`} initial={{ scale: 0.92, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }} onClick={e => e.stopPropagation()}
                style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.30)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  {cfg.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111", textAlign: "center", letterSpacing: -0.2, marginBottom: 6 }}>{cfg.title}</div>
                <div style={{ fontSize: 13, color: "#8E8E93", textAlign: "center", lineHeight: 1.45, marginBottom: 16 }}>{cfg.desc}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                  {[1,2,3].map(s => (
                    <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: s <= bulkDeleteStep ? cfg.confirmBg : '#E5E5EA', transition: 'background 0.2s' }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={bulkDeleteCancel}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#F2F2F7", color: "#111", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Отмена
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={bulkDeleteConfirm}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: cfg.confirmBg, color: "#fff", fontSize: bulkDeleteStep === 3 ? 12 : 14, fontWeight: 700, cursor: "pointer", letterSpacing: bulkDeleteStep === 3 ? 0.5 : 0 }}>
                    {cfg.confirmText}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ═══ PRODUCT LIST ═══ */}
      <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Select all row */}
        {processedProducts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", marginBottom: 2 }}>
            <button type="button" onClick={selectAll}
              style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (selected.size === processedProducts.length && processedProducts.length > 0 ? "#0A84FF" : "#C7C7CC"), background: selected.size === processedProducts.length && processedProducts.length > 0 ? "#0A84FF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, transition: "all 0.18s" }}>
              {selected.size === processedProducts.length && processedProducts.length > 0 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
            <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 500 }}>
              {processedProducts.length} {processedProducts.length === 1 ? 'товар' : 'товаров'}
              {search || filterCat !== 'all' || filterStock !== 'all' ? ' (фильтр)' : ''}
            </span>
          </div>
        )}

        {processedProducts.map(p => {
          const stockPrices = (p.variants || []).filter(v => v.inStock).map(v => v.price).filter(Boolean);
          const minPrice = stockPrices.length ? Math.min(...stockPrices) : null;
          const maxPrice = stockPrices.length ? Math.max(...stockPrices) : null;
          const inStockCount = (p.variants || []).filter(v => v.inStock).length;
          const totalVariants = (p.variants || []).length;
          const isFeatured = !!p.featured;
          const isSelected = selected.has(p.id);
          const hasSale = p.salePercent > 0;
          const noStock = inStockCount === 0;
          return (
            <motion.div key={p.id} whileTap={{ scale: 0.995 }} transition={{ type: "spring", stiffness: 460, damping: 30 }}
              onClick={() => setEditing(editing === p.id ? null : p.id)}
              style={{
                background: noStock ? "#FAFAFA" : "#fff", borderRadius: 16, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                boxShadow: isSelected ? "0 0 0 2px rgba(10,132,255,0.40)" : "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.04)",
                border: "0.5px solid " + (isSelected ? "rgba(10,132,255,0.30)" : noStock ? "rgba(255,59,48,0.15)" : "rgba(0,0,0,0.05)"),
                borderLeft: noStock ? "3px solid #FF3B30" : hasSale ? "3px solid #FF9500" : "3px solid transparent",
                opacity: noStock ? 0.7 : 1,
                transition: "box-shadow 0.18s, border 0.18s, opacity 0.18s",
              }}>
              {/* Checkbox */}
              <button type="button" onClick={(e) => toggleSel(p.id, e)}
                style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (isSelected ? "#0A84FF" : "#C7C7CC"), background: isSelected ? "#0A84FF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0, transition: "all 0.18s" }}>
                {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              {/* Image */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: p.img ? "#fff" : T.accentPale, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "0.5px solid rgba(0,0,0,0.04)" }}>
                {p.img
                  ? <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} alt="" />
                  : React.cloneElement(IC.bottle, { style: { width: 20, height: 20, color: T.accent, opacity: 0.5 } })}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 500 }}>{p.brand || '—'}</span>
                  {isFeatured && <span style={{ fontSize: 9, fontWeight: 700, color: "#E5A100", background: "rgba(255,184,0,0.14)", padding: "1px 6px", borderRadius: 6 }}>TOP</span>}
                  {hasSale && <span style={{ fontSize: 9, fontWeight: 700, color: "#FF3B30", background: "rgba(255,59,48,0.10)", padding: "1px 6px", borderRadius: 6 }}>-{p.salePercent}%</span>}
                </div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 14, letterSpacing: -0.2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name || t.newProduct}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  {minPrice !== null ? (
                    <span style={{ color: "#111", fontSize: 13, fontWeight: 700, letterSpacing: -0.2, fontVariantNumeric: "tabular-nums" }}>
                      {minPrice === maxPrice ? formatSum(minPrice) : `${Number(minPrice).toLocaleString()} – ${formatSum(maxPrice)}`}
                    </span>
                  ) : (
                    <span style={{ color: T.danger, fontSize: 11, fontWeight: 600 }}>Нет в наличии</span>
                  )}
                  <span style={{ color: T.textMuted, fontSize: 11 }}>·</span>
                  <span style={{ color: noStock ? T.danger : T.textSecond, fontSize: 11, fontWeight: noStock ? 600 : 500, fontVariantNumeric: "tabular-nums" }}>
                    {inStockCount}/{totalVariants} вар.
                  </span>
                  <span style={{ color: T.textMuted, fontSize: 11 }}>·</span>
                  <span style={{ fontSize: 10, color: "#8E8E93", padding: "1px 6px", background: "rgba(120,120,128,0.08)", borderRadius: 6, fontWeight: 500 }}>{p.category || '—'}</span>
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => toggleAllStock(e, p)} aria-label="stock" title={noStock ? "В наличии" : "Снять с продажи"}
                  style={{ width: 34, height: 34, borderRadius: 10, padding: 0, border: "none", background: noStock ? "rgba(255,59,48,0.10)" : "rgba(52,199,89,0.12)", color: noStock ? "#FF3B30" : "#34C759", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {noStock
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => toggleFeatured(e, p)} aria-label="featured" title="В топ"
                  style={{ width: 34, height: 34, borderRadius: 10, padding: 0, border: "none", background: isFeatured ? "rgba(255,184,0,0.16)" : "rgba(0,0,0,0.04)", color: isFeatured ? "#E5A100" : "#C7C7CC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={isFeatured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => duplicateProd(e, p)} aria-label="duplicate" title="Копия"
                  style={{ width: 34, height: 34, borderRadius: 10, padding: 0, border: "none", background: "rgba(88,86,214,0.08)", color: "#5856D6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); haptic('light'); setEditing(p.id); }} aria-label="edit" title="Редактировать"
                  style={{ width: 34, height: 34, borderRadius: 10, padding: 0, border: "none", background: "rgba(10,132,255,0.10)", color: "#0A84FF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); setDeleteStep(1); }} aria-label="delete" title="Удалить"
                  style={{ width: 34, height: 34, borderRadius: 10, padding: 0, border: "none", background: "rgba(229,57,53,0.10)", color: "#E53935", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </motion.button>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state */}
        {processedProducts.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#8E8E93" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#3A3A3C", marginBottom: 4 }}>
              {search ? 'Ничего не найдено' : 'Нет товаров'}
            </div>
            <div style={{ fontSize: 13 }}>
              {search ? `По запросу «${search}» ничего не найдено` : 'Добавьте первый товар'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN STATS ───────────────────────────────────────────────────────────────
// PRO redesign: period selector, revenue chart, avg check, conversion, donut
export function AdminStatsScreen({ orders = [], products = [], registeredUsers = [], visitCount = 0 }) {
  const { t, lang } = useLang();
  const [period, setPeriod] = useState('7d'); // '7d', '30d', 'all'

  const delivered = orders.filter(o => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const avgCheck = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;
  const conversionRate = orders.length > 0 ? Math.round(delivered.length / orders.length * 100) : 0;

  // Today stats
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => { try { return new Date(o.date).toDateString() === todayStr; } catch { return false; } });
  const todayOrdersCount = todayOrders.length;
  const todayRevenue = todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toDateString(); })();
  const yesterdayCount = orders.filter(o => { try { return new Date(o.date).toDateString() === yesterdayStr; } catch { return false; } }).length;
  const dayChange = yesterdayCount > 0 ? Math.round((todayOrdersCount - yesterdayCount) / yesterdayCount * 100) : todayOrdersCount > 0 ? 100 : 0;

  // Status counts
  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const statusOrder = ['new', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'];

  // Top products — with revenue
  const topProds = {};
  const topRevenue = {};
  orders.forEach(o => (o.items || []).forEach(it => {
    topProds[it.name] = (topProds[it.name] || 0) + (it.qty || 0);
    topRevenue[it.name] = (topRevenue[it.name] || 0) + ((it.price || 0) * (it.qty || 0));
  }));
  const topList = Object.entries(topProds).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topMaxQty = topList.length > 0 ? topList[0][1] : 1;

  // Chart data — dynamic by period
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : Math.min(90, Math.max(7, Math.ceil((Date.now() - Math.min(...orders.map(o => { try { return new Date(o.date).getTime(); } catch { return Date.now(); } }))) / 86400000)));
  const days = Array.from({ length: periodDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (periodDays - 1 - i));
    return d;
  });
  const dayData = days.map(d => {
    const ds = d.toDateString();
    const dayOrds = orders.filter(o => { try { return new Date(o.date).toDateString() === ds; } catch { return false; } });
    const dayDel = dayOrds.filter(o => o.status === 'delivered');
    return {
      label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      count: dayOrds.length,
      revenue: dayDel.reduce((s, o) => s + (o.total || 0), 0),
    };
  });
  const maxCount = Math.max(...dayData.map(d => d.count), 1);
  const maxRevenue = Math.max(...dayData.map(d => d.revenue), 1);

  // Donut chart data for status distribution
  const donutData = statusOrder.filter(s => statusCounts[s] > 0).map(s => ({
    status: s,
    count: statusCounts[s] || 0,
    color: (STATUS_COLORS[s] || {}).color || T.textMuted,
  }));
  const donutTotal = donutData.reduce((s, d) => s + d.count, 0);

  const stats = [
    { label: t.totalRevenue || (lang === 'kg' ? 'Жалпы киреше' : 'Общая выручка'), val: formatSum(totalRevenue), color: "#2E7D32", bg: "#E8F5E9", icon: 'revenue' },
    { label: t.totalOrders || (lang === 'kg' ? 'Заказдар' : 'Заказы'), val: orders.length, color: "#1565C0", bg: "#E3F2FD", icon: 'orders' },
    { label: lang === 'kg' ? 'Орточо чек' : 'Средний чек', val: formatSum(avgCheck), color: "#7C5CBF", bg: "#EDE7F6", icon: 'avg' },
    { label: lang === 'kg' ? 'Конверсия' : 'Конверсия', val: `${conversionRate}%`, color: "#FF6B00", bg: "#FFF3E0", icon: 'conversion' },
  ];

  const recentUsers = registeredUsers.slice(-5).reverse();

  // SVG chart dimensions
  const chartW = 320;
  const chartH = 140;
  const chartPadL = 40;
  const chartPadR = 10;
  const chartPadT = 10;
  const chartPadB = 25;
  const plotW = chartW - chartPadL - chartPadR;
  const plotH = chartH - chartPadT - chartPadB;

  // Build line path for revenue
  const revenuePoints = dayData.map((d, i) => {
    const x = chartPadL + (i / Math.max(dayData.length - 1, 1)) * plotW;
    const y = chartPadT + plotH - (d.revenue / maxRevenue) * plotH;
    return `${x},${y}`;
  });
  const revenueLine = revenuePoints.join(' ');
  const areaPath = `M${chartPadL},${chartPadT + plotH} L${revenueLine} L${chartPadL + plotW},${chartPadT + plotH} Z`;

  try {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* Header */}
      <div style={{ padding: "52px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: T.text }}>{t.stats || (lang === 'kg' ? 'Статистика' : 'Статистика')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 stat cards — PRO: better icons, spring entrance */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {stats.map((s, i) => {
          const numericVal = typeof s.val === 'number' ? s.val : null;
          const iconMap = {
            revenue: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
            orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
            avg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
            conversion: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
          };
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
              style={{ ...card({ padding: "14px" }) }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {iconMap[s.icon] || React.cloneElement(IC.stats, { style: { width: 18, height: 18, color: s.color } })}
                </div>
              </div>
              <div style={{ color: s.color, fontSize: 20, fontWeight: 900, letterSpacing: -0.3 }}>
                {numericVal !== null ? <NumberCounter value={numericVal} duration={1.0} /> : s.val}
              </div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 3 }}>{s.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Today highlight card */}
      <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>{lang === 'kg' ? 'Бүгүн' : 'Сегодня'}</div>
          {dayChange !== 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px",
              background: dayChange > 0 ? '#E8F5E9' : '#FFEBEE',
              color: dayChange > 0 ? '#2E7D32' : '#C62828',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dayChange < 0 ? 'rotate(180deg)' : 'none' }}>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              {Math.abs(dayChange)}% {lang === 'kg' ? 'кечеге' : 'ко вчера'}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ background: T.accentPale, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ color: T.accent, fontSize: 22, fontWeight: 900 }}>{todayOrdersCount}</div>
            <div style={{ color: T.textMuted, fontSize: 10, marginTop: 2 }}>{lang === 'kg' ? 'Заказдар' : 'Заказов'}</div>
          </div>
          <div style={{ background: T.accentPale, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ color: T.accent, fontSize: 16, fontWeight: 900 }}>{formatSum(todayRevenue)}</div>
            <div style={{ color: T.textMuted, fontSize: 10, marginTop: 2 }}>{lang === 'kg' ? 'Киреше' : 'Выручка'}</div>
          </div>
          <div style={{ background: T.accentPale, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ color: T.accent, fontSize: 22, fontWeight: 900 }}>{todayOrders.filter(o => o.status === 'new').length}</div>
            <div style={{ color: T.textMuted, fontSize: 10, marginTop: 2 }}>{lang === 'kg' ? 'Жаңы' : 'Новых'}</div>
          </div>
        </div>
      </div>

      {/* Revenue chart — PRO line + area chart */}
      <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>{lang === 'kg' ? 'Киреше динамикасы' : 'Динамика выручки'}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ key: '7d', label: '7' }, { key: '30d', label: '30' }, { key: 'all', label: lang === 'kg' ? 'Баары' : 'Все' }].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: "4px 10px", borderRadius: 6, border: "none",
                background: period === p.key ? T.accent : "rgba(0,0,0,0.06)",
                color: period === p.key ? "#fff" : T.textSecond,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}>{p.label}{p.key !== 'all' && 'd'}</button>
            ))}
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block" }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#2E7D32" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={chartPadL} y1={chartPadT + plotH * (1 - f)} x2={chartW - chartPadR} y2={chartPadT + plotH * (1 - f)} stroke={T.border} strokeWidth="0.5" strokeDasharray="3,3"/>
          ))}
          {/* Y-axis labels */}
          {[0, 0.5, 1].map(f => (
            <text key={f} x={chartPadL - 4} y={chartPadT + plotH * (1 - f) + 3} textAnchor="end" fontSize="7" fill={T.textMuted}>{Math.round(maxRevenue * f / 1000)}k</text>
          ))}
          {/* Area fill */}
          {dayData.some(d => d.revenue > 0) && <path d={areaPath} fill="url(#areaGrad)"/>}
          {/* Line */}
          {dayData.some(d => d.revenue > 0) && <polyline points={revenueLine} fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
          {/* Dots */}
          {dayData.map((d, i) => {
            if (d.revenue <= 0) return null;
            const x = chartPadL + (i / Math.max(dayData.length - 1, 1)) * plotW;
            const y = chartPadT + plotH - (d.revenue / maxRevenue) * plotH;
            return <circle key={i} cx={x} cy={y} r="2.5" fill="#2E7D32" stroke="#fff" strokeWidth="1"/>;
          })}
          {/* X-axis labels — show every nth */}
          {dayData.filter((_, i) => i % Math.max(1, Math.floor(dayData.length / 7)) === 0 || i === dayData.length - 1).map((d, _, arr) => {
            const i = dayData.indexOf(d);
            const x = chartPadL + (i / Math.max(dayData.length - 1, 1)) * plotW;
            return <text key={i} x={x} y={chartH - 4} textAnchor="middle" fontSize="7" fill={T.textMuted}>{d.label}</text>;
          })}
        </svg>
      </div>

      {/* Orders bar chart */}
      <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.last7days || (lang === 'kg' ? 'Акыркы 7 күн' : 'Последние 7 дней')}</div>
        <svg width="100%" viewBox={`0 0 ${Math.min(periodDays * 40 + 20, 320)} 120`} style={{ display: "block" }}>
          {dayData.slice(-7).map((d, i) => {
            const barH = Math.max((d.count / maxCount) * 80, d.count > 0 ? 4 : 0);
            const x = i * 40 + 10;
            return (
              <g key={i}>
                <rect x={x} y={100 - barH} width={24} height={barH} rx={6} fill={d.count > 0 ? T.accent : 'rgba(0,0,0,0.06)'} opacity={0.9} />
                <text x={x + 12} y={115} textAnchor="middle" fontSize="8" fill={T.textMuted}>{d.label}</text>
                {d.count > 0 && <text x={x + 12} y={96 - barH} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>{d.count}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Status distribution — PRO donut chart + legend */}
      {donutData.length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t.ordersByStatus || (lang === 'kg' ? 'Статус боюнча' : 'По статусам')}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {/* Donut SVG */}
            <svg width="100" height="100" viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
              <circle cx="21" cy="21" r="15.915" fill="none" stroke={T.border} strokeWidth="3"/>
              {(() => {
                let offset = 25; // Start at top (25% offset = 12 o'clock)
                return donutData.map((d, i) => {
                  const pct = (d.count / donutTotal) * 100;
                  const dash = `${pct} ${100 - pct}`;
                  const el = <circle key={i} cx="21" cy="21" r="15.915" fill="none" stroke={d.color} strokeWidth="3.5" strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round"/>;
                  offset += pct;
                  return el;
                });
              })()}
              <text x="21" y="20" textAnchor="middle" fontSize="7" fontWeight="900" fill={T.text}>{donutTotal}</text>
              <text x="21" y="25" textAnchor="middle" fontSize="3.5" fill={T.textMuted}>{lang === 'kg' ? 'заказ' : 'заказов'}</text>
            </svg>
            {/* Legend */}
            <div style={{ flex: 1, minWidth: 140 }}>
              {donutData.map(d => {
                const pct = Math.round(d.count / donutTotal * 100);
                return (
                  <div key={d.status} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: T.textSecond }}>{t["status_" + d.status] || d.status}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{d.count}</span>
                    <span style={{ fontSize: 10, color: T.textMuted, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top products — PRO with horizontal bar chart */}
      {topList.length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.topProducts || (lang === 'kg' ? 'Топ товарлар' : 'Топ товары')}</div>
          {topList.map(([name, qty], i) => {
            const barPct = Math.round((qty / topMaxQty) * 100);
            const rev = topRevenue[name] || 0;
            return (
              <div key={name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8,
                    background: i === 0 ? T.accent : i === 1 ? '#666' : i === 2 ? '#8E8E93' : T.accentLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: i < 3 ? "#fff" : T.accent, fontSize: 11, fontWeight: 900, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{qty} {t.pcs || (lang === 'kg' ? 'даана' : 'шт')}</div>
                  <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{formatSum(rev)}</div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(0,0,0,0.06)", marginLeft: 34 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    style={{ height: "100%", borderRadius: 2, background: i === 0 ? T.accent : T.textMuted }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick metrics — registered users + visits */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ ...card({ padding: "14px", textAlign: "center" }) }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.referral }}>
            <NumberCounter value={registeredUsers.length} duration={1.0} />
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{t.registeredCount || (lang === 'kg' ? 'Катталгандар' : 'Зарегистрировано')}</div>
        </div>
        <div style={{ ...card({ padding: "14px", textAlign: "center" }) }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.bonus }}>
            <NumberCounter value={visitCount} duration={1.0} />
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{t.visits || (lang === 'kg' ? 'Кирүүлөр' : 'Посещения')}</div>
        </div>
      </div>

      {/* Recent registered users */}
      {recentUsers.length > 0 && (
        <div style={{ margin: "0 16px 16px", ...card({ padding: "16px" }) }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.recentUsers || (lang === 'kg' ? 'Жаңы колдонуучулар' : 'Новые пользователи')}</div>
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
// ─── ADMIN CLIENTS (CRM) ──────────────────────────────────────────────────────
// PRO: client database with order history, bonus status, total spent, search
export function AdminClientsScreen({ clients = [], orders = [], showToast }) {
  const { t, lang } = useLang();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // 'recent', 'orders', 'spent', 'bonus'
  const [selectedClient, setSelectedClient] = useState(null);
  // Performance: minglab mijozda ham UI qotmasligi uchun sahifalab ko'rsatamiz.
  const [visibleCount, setVisibleCount] = useState(100);

  // Compute client stats
  const clientStats = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const phone = c.phone || '';
      map[phone] = {
        ...c,
        orderCount: 0,
        totalSpent: 0,
        lastOrder: null,
        deliveredCount: 0,
      };
    });
    orders.forEach(o => {
      const phone = o.clientPhone || '';
      if (!map[phone]) {
        map[phone] = { phone, name: o.clientName || '', bonusBalance: 0, orderCount: 0, totalSpent: 0, lastOrder: null, deliveredCount: 0 };
      }
      map[phone].orderCount += 1;
      if (o.status === 'delivered') {
        map[phone].totalSpent += (o.total || 0);
        map[phone].deliveredCount += 1;
      }
      const oDate = o.date || o.created;
      if (oDate && (!map[phone].lastOrder || oDate > map[phone].lastOrder)) {
        map[phone].lastOrder = oDate;
      }
    });
    return Object.values(map);
  }, [clients, orders]);

  // Search
  const searchLower = search.trim().toLowerCase();
  const searched = searchLower
    ? clientStats.filter(c =>
        (c.name || '').toLowerCase().includes(searchLower) ||
        (c.phone || '').includes(searchLower) ||
        (c.referralCode || '').toLowerCase().includes(searchLower)
      )
    : clientStats;

  // Sort
  const sorted = [...searched].sort((a, b) => {
    if (sortBy === 'orders') return (b.orderCount || 0) - (a.orderCount || 0);
    if (sortBy === 'spent') return (b.totalSpent || 0) - (a.totalSpent || 0);
    if (sortBy === 'bonus') return (b.bonusBalance || 0) - (a.bonusBalance || 0);
    // recent
    const da = a.lastOrder || a.created || '';
    const db = b.lastOrder || b.created || '';
    return db > da ? 1 : db < da ? -1 : 0;
  });

  // Client detail modal
  const clientOrders = selectedClient
    ? orders.filter(o => o.clientPhone === selectedClient.phone).sort((a, b) => (b.date || b.created || '') > (a.date || a.created || '') ? 1 : -1)
    : [];

  // Summary stats
  const totalClients = clientStats.length;
  const activeClients = clientStats.filter(c => c.orderCount > 0).length;
  const totalBonusOut = clientStats.reduce((s, c) => s + (c.bonusBalance || 0), 0);

  try {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* Header */}
      <div style={{ padding: "52px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: T.text }}>{lang === 'kg' ? 'Кардарлар' : 'Клиенты'}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {totalClients} {lang === 'kg' ? 'катталган' : 'зарегистрировано'} · {activeClients} {lang === 'kg' ? 'активдүү' : 'активных'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div style={{ ...card({ padding: "12px", textAlign: "center" }) }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1565C0" }}>{totalClients}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{lang === 'kg' ? 'Баары' : 'Всего'}</div>
        </div>
        <div style={{ ...card({ padding: "12px", textAlign: "center" }) }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#2E7D32" }}>{activeClients}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{lang === 'kg' ? 'Заказ берген' : 'С заказами'}</div>
        </div>
        <div style={{ ...card({ padding: "12px", textAlign: "center" }) }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.bonus }}>{formatSum(totalBonusOut)}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{lang === 'kg' ? 'Бонустар' : 'Бонусы'}</div>
        </div>
      </div>

      {/* Search + sort */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'kg' ? 'Аты, телефон, реферал коду...' : 'Имя, телефон, реф. код...'}
            style={{ width: "100%", padding: "11px 12px 11px 38px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, fontSize: 14, outline: "none", boxSizing: "border-box", color: T.text, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {[
            { key: 'recent', label: lang === 'kg' ? 'Жаңы' : 'Новые' },
            { key: 'orders', label: lang === 'kg' ? 'Заказ боюнча' : 'По заказам' },
            { key: 'spent', label: lang === 'kg' ? 'Чыгым' : 'По расходам' },
            { key: 'bonus', label: lang === 'kg' ? 'Бонус' : 'По бонусам' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: sortBy === s.key ? T.accent : "rgba(0,0,0,0.06)",
              color: sortBy === s.key ? "#fff" : T.textSecond,
              fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Clients list */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!sorted.length && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted, fontSize: 14 }}>
            {lang === 'kg' ? 'Кардарлар табылган жок' : 'Клиенты не найдены'}
          </div>
        )}
        {sorted.slice(0, visibleCount).map((client, idx) => (
          <motion.div
            key={client.phone || idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
            onClick={() => setSelectedClient(client)}
            style={{
              ...card({ padding: "14px", cursor: "pointer" }),
              display: "flex", alignItems: "center", gap: 12,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: client.orderCount > 0 ? T.accent : T.accentLight,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: client.orderCount > 0 ? "#fff" : T.accent,
              fontSize: 15, fontWeight: 800, flexShrink: 0,
            }}>
              {(client.name || client.phone || '?')[0].toUpperCase()}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{client.name || (lang === 'kg' ? 'Аты жок' : 'Без имени')}</span>
                {client.bonusBalance > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#FFF3E0", color: T.bonus, padding: "1px 6px", borderRadius: 4 }}>{client.bonusBalance} B</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{client.phone}</div>
            </div>
            {/* Stats */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{client.orderCount}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{lang === 'kg' ? 'заказ' : 'заказов'}</div>
              {client.totalSpent > 0 && (
                <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginTop: 2 }}>{formatSum(client.totalSpent)}</div>
              )}
            </div>
            {/* Arrow */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </motion.div>
        ))}
        {sorted.length > visibleCount && (
          <button
            onClick={() => setVisibleCount(v => v + 100)}
            style={{ width: "100%", padding: "13px 0", background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
          >{lang === 'kg' ? 'Дагы көрсөтүү' : 'Показать ещё'} ({sorted.length - visibleCount})</button>
        )}
      </div>

      {/* Client detail modal */}
      {selectedClient && (
        <div
          onClick={() => setSelectedClient(null)}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "auto", padding: 0 }}
          >
            {/* Modal header */}
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: T.accent, display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 20, fontWeight: 800,
              }}>
                {(selectedClient.name || selectedClient.phone || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{selectedClient.name || (lang === 'kg' ? 'Аты жок' : 'Без имени')}</div>
                <div style={{ fontSize: 13, color: T.textMuted }}>{selectedClient.phone}</div>
              </div>
              <button onClick={() => setSelectedClient(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textSecond} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Client stats grid */}
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: "#E3F2FD", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#1565C0" }}>{selectedClient.orderCount}</div>
                <div style={{ fontSize: 10, color: "#1565C0" }}>{lang === 'kg' ? 'Заказдар' : 'Заказов'}</div>
              </div>
              <div style={{ background: "#E8F5E9", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#2E7D32" }}>{formatSum(selectedClient.totalSpent)}</div>
                <div style={{ fontSize: 10, color: "#2E7D32" }}>{lang === 'kg' ? 'Жыйынтык' : 'Потрачено'}</div>
              </div>
              <div style={{ background: "#FFF3E0", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.bonus }}>{selectedClient.bonusBalance || 0}</div>
                <div style={{ fontSize: 10, color: T.bonus }}>{lang === 'kg' ? 'Бонус' : 'Бонусы'}</div>
              </div>
            </div>

            {/* Referral info */}
            {(selectedClient.referralCode || selectedClient.referredBy) && (
              <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedClient.referralCode && (
                  <div style={{ background: "#EDE7F6", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: T.referral }}>
                    {lang === 'kg' ? 'Реф. код' : 'Реф. код'}: {selectedClient.referralCode}
                  </div>
                )}
                {selectedClient.referredBy && (
                  <div style={{ background: "#F3E5F5", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#8E24AA" }}>
                    {lang === 'kg' ? 'Кимден' : 'Привёл'}: {selectedClient.referredBy}
                  </div>
                )}
              </div>
            )}

            {/* Order history */}
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>
                {lang === 'kg' ? 'Заказ тарыхы' : 'История заказов'} ({clientOrders.length})
              </div>
              {clientOrders.length === 0 && (
                <div style={{ fontSize: 13, color: T.textMuted, padding: "16px 0", textAlign: "center" }}>
                  {lang === 'kg' ? 'Заказдар жок' : 'Заказов нет'}
                </div>
              )}
              {clientOrders.slice(0, 20).map((o, i) => {
                const osc = STATUS_COLORS[o.status] || { bg: "rgba(0,0,0,0.04)", color: T.textMuted };
                return (
                  <div key={o.id || i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                    borderBottom: i < clientOrders.length - 1 ? `1px solid ${T.border}` : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>#{(o.id || '').slice(-6).toUpperCase()}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, background: osc.bg, color: osc.color, padding: "2px 8px", borderRadius: 4 }}>{t["status_" + o.status] || o.status}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {(() => { try { const d = new Date(o.date || o.created); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                        {o.items && ` · ${o.items.length} ${lang === 'kg' ? 'товар' : 'товар'}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{formatSum(o.total || 0)}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
  } catch (err) {
    console.error('[Clients CRASH]', err);
    return <div style={{ padding: 32, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Clients crashed: {String(err?.message || err)}</div>;
  }
}

// ─── ADMIN BANNERS ─────────────────────────────────────────────────────────────
export function AdminBannersScreen({ banners = [], setBanners, products = [] }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(null);
  const bannerFileRef = useRef(null);
  const [bannerCropSrc, setBannerCropSrc] = useState(null);
  const MAX_BANNERS = 5;
  const addBanner = () => { if (banners.length >= MAX_BANNERS) return; const nb = { id: Date.now(), title: "", subtitle: "", img: null, bg: BG_PRESETS[0], active: true, textX: 50, textY: 50, textAlign: 'center', btnText: '', linkedProductId: '', overlayTop: 0.08, overlayBottom: 0.45 }; setBanners(p => [...p, nb]); setEditing(nb.id); };
  const previewRef = useRef(null);
  const upd = (id, f, v) => setBanners(prev => prev.map(b => b.id === id ? { ...b, [f]: v } : b));
  const del = (id) => { api.deleteBannerImage(id).catch(() => {}); setBanners(p => p.filter(b => b.id !== id)); if (editing === id) setEditing(null); };
  const editB = banners.find(b => b.id === editing);

  // Drag reorder
  const [dragIdx, setDragIdx] = useState(null);
  const handleDragStart = (idx) => { setDragIdx(idx); };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setBanners(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // Section label helper
  const SL = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 16 }}>{children}</div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: "var(--nav-height)" }}>
      {/* ── Side panel layout for desktop ── */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 80px)", gap: 0 }}>

        {/* ═══ LEFT: Banner list ═══ */}
        <div style={{ width: 320, minWidth: 320, borderRight: `1px solid ${T.border}`, background: "#FAFAFA", padding: "20px 0", overflowY: "auto" }}>
          <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{lang === 'kg' ? 'Баннерлер' : 'Баннеры'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{banners.length}/{MAX_BANNERS}</div>
            </div>
            {banners.length < MAX_BANNERS && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={addBanner}
                style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 20, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >+</motion.button>
            )}
          </div>

          {/* Hint */}
          <div style={{ padding: "0 20px 12px" }}>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
              {lang === 'kg' ? 'Тартипти өзгөртүү үчүн сүйрөңүз' : 'Перетащите для изменения порядка'}
            </div>
          </div>

          {/* Banner cards — draggable */}
          <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {banners.map((b, idx) => (
              <motion.div
                key={b.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setEditing(b.id)}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 12, cursor: "grab",
                  background: editing === b.id ? "#fff" : "transparent",
                  border: editing === b.id ? `2px solid ${T.accent}` : "2px solid transparent",
                  boxShadow: editing === b.id ? T.shadowSm : "none",
                  transition: "all 0.15s",
                  opacity: dragIdx === idx ? 0.5 : 1,
                }}
              >
                {/* Drag handle */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, cursor: "grab" }}>
                  <div style={{ width: 12, height: 2, borderRadius: 2, background: T.textMuted }} />
                  <div style={{ width: 12, height: 2, borderRadius: 2, background: T.textMuted }} />
                  <div style={{ width: 12, height: 2, borderRadius: 2, background: T.textMuted }} />
                </div>
                {/* Thumbnail */}
                <div style={{ width: 64, height: 36, borderRadius: 8, background: b.img ? "transparent" : b.bg || "#111", overflow: "hidden", flexShrink: 0, border: `1px solid ${T.border}` }}>
                  {b.img && <img src={b.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title || (lang === 'kg' ? 'Аталышсыз' : 'Без названия')}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{b.subtitle || ''}</div>
                </div>
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.active ? "#34C759" : T.border, flexShrink: 0 }} />
              </motion.div>
            ))}
            {banners.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 16px", color: T.textMuted, fontSize: 13 }}>
                {lang === 'kg' ? 'Баннерлер жок' : 'Нет баннеров'}
                <br/>
                <motion.button whileTap={{ scale: 0.95 }} onClick={addBanner} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + {lang === 'kg' ? 'Кошуу' : 'Добавить'}
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Editor panel ═══ */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {!editB ? (
            /* Empty state */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: T.textMuted, padding: 40 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" fill={T.border} stroke="none" /><path d="M21 15l-5-5L5 21" />
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{lang === 'kg' ? 'Баннерди тандаңыз' : 'Выберите баннер'}</div>
              <div style={{ fontSize: 12, maxWidth: 240, textAlign: "center", lineHeight: 1.5 }}>
                {lang === 'kg' ? 'Сол жактан баннерди тандаңыз же жаңысын кошуңуз' : 'Выберите баннер слева или добавьте новый'}
              </div>
            </div>
          ) : (
            <div style={{ padding: "24px 32px", maxWidth: 720 }}>
              {/* ── REAL PREVIEW — how it looks on site ── */}
              <SL>{lang === 'kg' ? 'Алдын ала көрүнүш' : 'Предпросмотр'}</SL>
              <div style={{
                width: "100%", aspectRatio: "2.6 / 1", borderRadius: 16,
                overflow: "hidden", position: "relative",
                background: editB.img ? "transparent" : editB.bg || "#111",
                border: !editB.img ? `2px dashed ${T.border}` : "none",
                cursor: !editB.img ? "pointer" : "default",
                boxShadow: T.shadow,
              }}
                onClick={() => !editB.img && bannerFileRef.current?.click()}
              >
                {editB.img && <img src={editB.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />}
                <div style={{
                  position: "absolute", inset: 0,
                  background: editB.img ? `linear-gradient(to bottom, rgba(0,0,0,${editB.overlayTop ?? 0.08}) 0%, rgba(0,0,0,${editB.overlayBottom ?? 0.45}) 100%)` : "transparent",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 32px 28px",
                }}>
                  {editB.img ? (<>
                    {editB.title && <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{editB.title}</div>}
                    {editB.subtitle && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 4 }}>{editB.subtitle}</div>}
                    {editB.btnText && <div style={{ marginTop: 12, display: "inline-block", padding: "8px 20px", borderRadius: 8, background: "#fff", color: "#111", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{editB.btnText}</div>}
                  </>) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "rgba(255,255,255,0.6)" }}>
                      {React.cloneElement(IC.camera, { style: { width: 32, height: 32 } })}
                      <span style={{ fontSize: 13 }}>{lang === 'kg' ? 'Сүрөт жүктөө үчүн басыңыз' : 'Нажмите чтобы загрузить фото'}</span>
                    </div>
                  )}
                </div>
                {editB.img && (
                  <button
                    onClick={(e) => { e.stopPropagation(); bannerFileRef.current?.click(); }}
                    style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", backdropFilter: "blur(8px)" }}
                  >{lang === 'kg' ? 'Алмаштыруу' : 'Заменить'}</button>
                )}
              </div>

              {/* Hidden file input */}
              <input ref={bannerFileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setBannerCropSrc(ev.target.result); r.readAsDataURL(f); e.target.value = ''; }}
              />
              {bannerCropSrc && (
                <BannerCropModal src={bannerCropSrc}
                  onDone={async (v) => { const pbUrl = await api.saveBannerImage(editB.id, v); upd(editB.id, "img", pbUrl || v); setBannerCropSrc(null); }}
                  onCancel={() => setBannerCropSrc(null)}
                />
              )}

              {editB.img && (
                <button onClick={() => upd(editB.id, "img", null)}
                  style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.danger}`, background: "transparent", color: T.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {lang === 'kg' ? 'Сүрөттү өчүрүү' : 'Удалить фото'}
                </button>
              )}

              {/* ── TEXT FIELDS ── */}
              <SL>{lang === 'kg' ? 'Тексттер' : 'Тексты'}</SL>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecond, marginBottom: 4, display: "block" }}>{lang === 'kg' ? 'Аталышы' : 'Заголовок'}</label>
                  <input style={{ ...inputStyle, borderRadius: 10 }} placeholder={lang === 'kg' ? 'Баннер аталышы' : 'Заголовок баннера'} value={editB.title} onChange={e => upd(editB.id, "title", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecond, marginBottom: 4, display: "block" }}>{lang === 'kg' ? 'Чакан аталыш' : 'Подзаголовок'}</label>
                  <input style={{ ...inputStyle, borderRadius: 10 }} placeholder={lang === 'kg' ? 'Кошумча текст' : 'Дополнительный текст'} value={editB.subtitle} onChange={e => upd(editB.id, "subtitle", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecond, marginBottom: 4, display: "block" }}>{lang === 'kg' ? 'Баскыч тексти' : 'Текст кнопки'}</label>
                  <input style={{ ...inputStyle, borderRadius: 10 }} placeholder={lang === 'kg' ? 'мис. АРОМАТ ТАНДОО' : 'напр. ВЫБРАТЬ АРОМАТ'} value={editB.btnText || ''} onChange={e => upd(editB.id, 'btnText', e.target.value)} />
                </div>
              </div>

              {/* ── OVERLAY SLIDERS ── */}
              {editB.img && (<>
                <SL>{lang === 'kg' ? 'Караңгылатуу' : 'Затемнение'}</SL>
                <div style={{ background: '#F9F8F6', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: T.textSecond, minWidth: 50, fontWeight: 600 }}>{lang === 'kg' ? 'Үстү' : 'Верх'}</span>
                    <input type="range" min="0" max="80" step="5" value={Math.round((editB.overlayTop ?? 0.08) * 100)}
                      onChange={e => upd(editB.id, 'overlayTop', parseInt(e.target.value) / 100)} style={{ flex: 1, accentColor: '#111' }} />
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{Math.round((editB.overlayTop ?? 0.08) * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: T.textSecond, minWidth: 50, fontWeight: 600 }}>{lang === 'kg' ? 'Асты' : 'Низ'}</span>
                    <input type="range" min="0" max="80" step="5" value={Math.round((editB.overlayBottom ?? 0.45) * 100)}
                      onChange={e => upd(editB.id, 'overlayBottom', parseInt(e.target.value) / 100)} style={{ flex: 1, accentColor: '#111' }} />
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{Math.round((editB.overlayBottom ?? 0.45) * 100)}%</span>
                  </div>
                </div>
              </>)}

              {/* ── PRODUCT LINK ── */}
              <SL>{lang === 'kg' ? 'Товарга шилтеме' : 'Ссылка на товар'}</SL>
              <select
                value={editB.linkedProductId || ''}
                onChange={e => upd(editB.id, 'linkedProductId', e.target.value)}
                style={{ ...inputStyle, borderRadius: 10, padding: "12px 14px", appearance: "auto" }}
              >
                <option value="">{lang === 'kg' ? 'Каталогго (демейки)' : 'В каталог (по умолчанию)'}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.brand ? `(${p.brand})` : ''}</option>
                ))}
              </select>

              {/* ── ACTIVE TOGGLE + ACTIONS ── */}
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#F9F8F6", borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{lang === 'kg' ? 'Активдүү' : 'Активен'}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{lang === 'kg' ? 'Сайтта көрүнөт' : 'Отображается на сайте'}</div>
                </div>
                <div onClick={() => upd(editB.id, "active", !editB.active)} style={{ width: 50, height: 30, borderRadius: 15, background: editB.active ? "#34C759" : "#E5E5EA", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 3, left: editB.active ? 23 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setEditing(null)} style={{ ...btnGreen({ flex: 1, padding: "13px 0", borderRadius: 12 }), fontSize: 14 }}>{lang === 'kg' ? 'Даяр' : 'Готово'}</button>
                <button onClick={() => del(editB.id)} style={{ padding: "13px 20px", borderRadius: 12, border: "none", background: "rgba(229,57,53,0.08)", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {lang === 'kg' ? 'Өчүрүү' : 'Удалить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN BONUS ───────────────────────────────────────────────────────────────
export function AdminBonusScreen({ settings = {}, setSettings, showToast }) {
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
      width: 29, height: 29, borderRadius: 8,
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
        padding: 'calc(var(--header-top, 20px) + 32px) 8px 10px',
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export function AdminNotificationsScreen({ products = [], clients = [], showToast, lang }) {
  const t = useLang();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("all"); // "all" | "one"
  const [targetPhone, setTargetPhone] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [promoTag, setPromoTag] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [waSendProgress, setWaSendProgress] = useState(""); // "3/15" progress

  // Load notifications
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getNotifications();
        setNotifications(data);
      } catch (e) { console.warn("Load notifs:", e); }
      setLoading(false);
    })();
  }, []);

  // ── WhatsApp sender — SERVER hook orqali (token mijozga chiqmaydi) ──
  // Eski versiyada token shu yerda hardcode edi (bundle'da ochiq!).
  // Endi pb_hooks/whatsapp.pb.js ga yuboriladi; token faqat serverda.
  const sendWAMessage = async (phone, message) => {
    const r = await sendWhatsAppServer({ phone, message });
    return !!r.ok;
  };

  const sendWAImageWithText = async (phone, imageUrl, caption) => {
    const r = await sendWhatsAppServer({ phone, message: caption, fileUrl: imageUrl });
    return !!r.ok;
  };

  // Send notification
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      showToast(lang === 'kg' ? 'Аталыш жана текст толтуруңуз' : 'Заполните заголовок и текст', 'error');
      return;
    }
    if (targetType === 'one' && !targetPhone) {
      showToast(t.notifSelectClient, 'error');
      return;
    }
    setSending(true);
    try {
      // 1. Save notification to PocketBase
      const data = {
        title: title.trim(),
        body: body.trim(),
        type: promoTag ? 'promo' : 'general',
        productId: selectedProductId || "",
        promoTag: promoTag || "",
        targetPhone: targetType === 'one' ? targetPhone : "",
        readBy: "[]",
      };
      const created = await api.createNotification(data);
      setNotifications(prev => [created, ...prev]);

      // 2. Send WhatsApp via Green API
      if (sendWhatsApp) {
        const product = selectedProductId ? products.find(p => p.id === selectedProductId) : null;
        const promoEmoji = promoTag === 'sale' ? '🔥' : promoTag === 'new' ? '✨' : promoTag === 'limited' ? '⏰' : promoTag === 'gift' ? '🎁' : '';
        const siteUrl = "https://kemalusman.kg";
        const productLink = product ? `${siteUrl}/?product=${product.id}` : '';

        // Build WA message
        let waMessage = `${promoEmoji} *${title.trim()}*\n\n${body.trim()}`;
        if (product) waMessage += `\n\n🔗 ${product.brand} — ${product.name}\n${productLink}`;
        waMessage += `\n\n_Kemal Usman Parfum_`;

        // Get product image URL for sending with image
        const productImgUrl = product?.img || '';

        // Determine recipients
        const recipients = targetType === 'one'
          ? [{ phone: targetPhone }]
          : clients.filter(c => c.phone);

        let sent = 0;
        for (let i = 0; i < recipients.length; i++) {
          const client = recipients[i];
          setWaSendProgress(`${i + 1}/${recipients.length}`);

          try {
            if (productImgUrl) {
              await sendWAImageWithText(client.phone, productImgUrl, waMessage);
            } else {
              await sendWAMessage(client.phone, waMessage);
            }
            sent++;
          } catch { /* continue */ }

          // Rate limit: Green API allows ~1 msg/sec
          if (recipients.length > 1) await new Promise(r => setTimeout(r, 1500));
        }

        setWaSendProgress("");
        showToast(`${t.notifSent} WhatsApp: ${sent}/${recipients.length}`, 'success');
      } else {
        showToast(t.notifSent, 'success');
      }

      // Reset form
      setTitle(""); setBody(""); setSelectedProductId(""); setPromoTag(""); setTargetPhone(""); setTargetType("all");
    } catch (e) {
      console.warn("Send notif:", e);
      showToast(lang === 'kg' ? 'Ката кетти' : 'Ошибка отправки', 'error');
    }
    setSending(false);
  };

  // Delete notification
  const handleDelete = async (id) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      showToast(lang === 'kg' ? 'Өчүрүлдү' : 'Удалено');
    } catch (e) { console.warn("Del notif:", e); }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedClient = clients.find(c => c.phone === targetPhone);

  const filteredProducts = products.filter(p =>
    !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.brand?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 20);

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
  ).slice(0, 20);

  const PROMO_TAGS = [
    { value: "", label: lang === 'kg' ? 'Жок' : 'Нет' },
    { value: "sale", label: "🔥 " + (lang === 'kg' ? 'Чегирме' : 'Скидка') },
    { value: "new", label: "✨ " + (lang === 'kg' ? 'Жаңылык' : 'Новинка') },
    { value: "limited", label: "⏰ " + (lang === 'kg' ? 'Чектелген' : 'Ограничено') },
    { value: "gift", label: "🎁 " + (lang === 'kg' ? 'Белек' : 'Подарок') },
  ];

  return (
    <div style={{ padding: "0 16px 100px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "16px 0 12px", display: "flex", alignItems: "center", gap: 10 }}>
        {React.cloneElement(IC.bell, { style: { width: 22, height: 22, color: T.accent } })}
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{t.notifications}</div>
      </div>

      {/* ── COMPOSE FORM ── */}
      <div style={{ ...card({ padding: "20px 16px" }), marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
          {lang === 'kg' ? 'Жаңы билдирүү' : 'Новое уведомление'}
        </div>

        {/* Target type */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { id: "all", label: t.notifSendAll, icon: "👥" },
            { id: "one", label: t.notifSendOne, icon: "👤" },
          ].map(opt => (
            <div key={opt.id}
              onClick={() => { setTargetType(opt.id); if (opt.id === 'all') setTargetPhone(''); }}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                background: targetType === opt.id ? T.accent : T.cardBg,
                color: targetType === opt.id ? "#fff" : T.text,
                fontWeight: 600, fontSize: 13, textAlign: "center",
                border: `1px solid ${targetType === opt.id ? T.accent : T.border}`,
                transition: "all 0.2s",
              }}
            >
              {opt.icon} {opt.label}
            </div>
          ))}
        </div>

        {/* Client picker (if targetType === 'one') */}
        {targetType === 'one' && (
          <div style={{ marginBottom: 14 }}>
            <div
              onClick={() => setShowClientPicker(!showClientPicker)}
              style={{
                ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                color: selectedClient ? T.text : T.textMuted,
              }}
            >
              <span>{selectedClient ? `${selectedClient.name || selectedClient.phone}` : t.notifSelectClient}</span>
              {React.cloneElement(IC.chevron, { style: { width: 14, height: 14, color: T.textMuted, transform: showClientPicker ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' } })}
            </div>
            {showClientPicker && (
              <div style={{ marginTop: 8, ...card({ padding: "8px" }), maxHeight: 200, overflowY: "auto" }}>
                <input
                  type="text" placeholder={lang === 'kg' ? 'Издөө...' : 'Поиск...'}
                  value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }}
                />
                {filteredClients.map(c => (
                  <div key={c.id}
                    onClick={() => { setTargetPhone(c.phone); setShowClientPicker(false); setClientSearch(""); }}
                    style={{
                      padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                      background: targetPhone === c.phone ? T.accentLight : "transparent",
                      display: "flex", justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{c.name || '—'}</span>
                    <span style={{ color: T.textMuted }}>{c.phone}</span>
                  </div>
                ))}
                {filteredClients.length === 0 && (
                  <div style={{ padding: 12, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                    {lang === 'kg' ? 'Табылган жок' : 'Не найдено'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <input
          type="text" placeholder={t.notifTitle}
          value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10, fontWeight: 600 }}
        />

        {/* Body */}
        <textarea
          placeholder={t.notifBody}
          value={body} onChange={e => setBody(e.target.value)}
          rows={3}
          style={{ ...inputStyle, marginBottom: 14, resize: "vertical", minHeight: 60, lineHeight: 1.5 }}
        />

        {/* Product link */}
        <div style={{ marginBottom: 14 }}>
          <div
            onClick={() => setShowProductPicker(!showProductPicker)}
            style={{
              ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
              color: selectedProduct ? T.text : T.textMuted,
            }}
          >
            <span>{selectedProduct ? `🔗 ${selectedProduct.brand} — ${selectedProduct.name}` : `📎 ${t.notifSelectProduct}`}</span>
            {selectedProduct && (
              <span onClick={(e) => { e.stopPropagation(); setSelectedProductId(""); }} style={{ color: "#FF3B30", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</span>
            )}
          </div>
          {showProductPicker && (
            <div style={{ marginTop: 8, ...card({ padding: "8px" }), maxHeight: 200, overflowY: "auto" }}>
              <input
                type="text" placeholder={lang === 'kg' ? 'Атыр издөө...' : 'Поиск товара...'}
                value={productSearch} onChange={e => setProductSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }}
              />
              {filteredProducts.map(p => (
                <div key={p.id}
                  onClick={() => { setSelectedProductId(p.id); setShowProductPicker(false); setProductSearch(""); }}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, background: selectedProductId === p.id ? T.accentLight : "transparent" }}
                >
                  <span style={{ fontWeight: 600 }}>{p.brand}</span> — {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promo tag */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {PROMO_TAGS.map(tag => (
            <div key={tag.value}
              onClick={() => setPromoTag(promoTag === tag.value ? "" : tag.value)}
              style={{
                padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: promoTag === tag.value ? T.accent : T.cardBg,
                color: promoTag === tag.value ? "#fff" : T.text,
                border: `1px solid ${promoTag === tag.value ? T.accent : T.border}`,
                transition: "all 0.2s",
              }}
            >
              {tag.label}
            </div>
          ))}
        </div>

        {/* Preview */}
        {(title || body) && (
          <div style={{ ...card({ padding: "14px 16px" }), marginBottom: 16, background: T.accentLight, borderLeft: `3px solid ${T.accent}` }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              {lang === 'kg' ? 'Алдын ала көрүү' : 'Предпросмотр'}
            </div>
            {promoTag && (
              <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: promoTag === 'sale' ? '#FF3B30' : promoTag === 'new' ? '#34C759' : promoTag === 'limited' ? '#FF9500' : '#007AFF', color: "#fff", fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                {PROMO_TAGS.find(t => t.value === promoTag)?.label || promoTag}
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>{title || '...'}</div>
            <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.4 }}>{body || '...'}</div>
            {selectedProduct && (
              <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.04)", fontSize: 12, color: T.accent, fontWeight: 600 }}>
                🔗 {selectedProduct.brand} — {selectedProduct.name}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted }}>
              📤 {targetType === 'all' ? t.notifSendAll : (selectedClient?.name || targetPhone || t.notifSendOne)}
            </div>
          </div>
        )}

        {/* WhatsApp toggle */}
        <label
          onClick={() => setSendWhatsApp(!sendWhatsApp)}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 0", cursor: "pointer", marginBottom: 8, userSelect: "none",
          }}
        >
          <div style={{
            width: 44, height: 26, borderRadius: 14, padding: 2,
            background: sendWhatsApp ? '#25D366' : '#E0E0E0',
            transition: 'background 0.2s', display: 'flex', alignItems: 'center',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 12, background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transform: sendWhatsApp ? 'translateX(18px)' : 'translateX(0)',
              transition: 'transform 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            📱 WhatsApp {lang === 'kg' ? 'аркылуу жөнөтүү' : 'рассылка'}
          </span>
          {sendWhatsApp && (
            <span style={{ fontSize: 11, color: '#25D366', fontWeight: 600 }}>
              {targetType === 'one' ? '1' : clients.filter(c => c.phone).length} {lang === 'kg' ? 'кардар' : 'получат.'}
            </span>
          )}
        </label>

        {/* Send button */}
        <div
          onClick={sending ? undefined : handleSend}
          style={{
            ...btnGreen(),
            opacity: sending ? 0.6 : 1,
            pointerEvents: sending ? "none" : "auto",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {sending ? (
            <>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              {waSendProgress ? `WhatsApp ${waSendProgress}...` : t.notifSend + '...'}
            </>
          ) : (
            <>
              {sendWhatsApp ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              ) : (
                React.cloneElement(IC.bell, { style: { width: 16, height: 16, color: "#fff" } })
              )}
              {t.notifSend} {sendWhatsApp ? '+ WhatsApp' : ''}
            </>
          )}
        </div>
      </div>

      {/* ── HISTORY ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        {t.notifHistory} ({notifications.length})
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>
          <div style={{ width: 24, height: 24, border: "2px solid rgba(0,0,0,0.1)", borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>
          {React.cloneElement(IC.bell, { style: { width: 32, height: 32, color: T.textMuted, opacity: 0.3, margin: "0 auto 8px", display: "block" } })}
          <div>{t.notifEmpty}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map(n => {
            const targetLabel = n.targetPhone
              ? (clients.find(c => c.phone === n.targetPhone)?.name || n.targetPhone)
              : (lang === 'kg' ? 'Баарына' : 'Все');
            const linkedProduct = n.productId ? products.find(p => p.id === n.productId) : null;
            const readCount = (() => { try { return JSON.parse(n.readBy || '[]').length; } catch { return 0; } })();
            const date = new Date(n.created);
            const dateStr = `${date.getDate().toString().padStart(2,'0')}.${(date.getMonth()+1).toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

            return (
              <div key={n.id} style={{ ...card({ padding: "14px 16px" }), position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    {n.promoTag && (
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: n.promoTag === 'sale' ? '#FF3B30' : n.promoTag === 'new' ? '#34C759' : n.promoTag === 'limited' ? '#FF9500' : '#007AFF', color: "#fff", fontSize: 9, fontWeight: 700 }}>
                        {n.promoTag.toUpperCase()}
                      </span>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{n.title}</div>
                  </div>
                  <div
                    onClick={() => handleDelete(n.id)}
                    style={{ color: "#FF3B30", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                  >×</div>
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.4, marginBottom: 8 }}>{n.body}</div>
                {linkedProduct && (
                  <div style={{ padding: "4px 8px", borderRadius: 6, background: T.accentLight, fontSize: 11, color: T.accent, fontWeight: 600, display: "inline-block", marginBottom: 6 }}>
                    🔗 {linkedProduct.brand} — {linkedProduct.name}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: T.textMuted }}>
                  <span>📤 {targetLabel} · 👁 {readCount}</span>
                  <span>{dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminSettingsScreen({ banners = [], setBanners, products = [], settings = {}, setSettings, onLogout, showToast, lang }) {
  const { t, setLang } = useLang();
  const [sub, setSub] = useState(null); // null | 'banners' | 'bonus' | 'whatsapp' | 'shop' | 'loginBg'

  // Payment phones + QR — loaded from PocketBase (site_media), synced to settings
  const [whatsappAdmin, setWhatsappAdmin]   = useState(settings?.whatsappPhone || '');
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
    // FIX: ilgari settings'ga yozilmasdi — buyurtma xabarlari eski raqamga
    // ketaverardi. Endi settings.whatsappPhone yangilanadi (PB'ga avto-sync).
    setSettings(p => ({ ...p, whatsappPhone: whatsappAdmin }));
    // green_instance / green_token deliberately NOT saved here — they are
    // managed by the PB host (env vars), never by the client.
  };

  const handleLoginBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 1) PB'ga yuklash — barcha qurilmalar ko'radi (instagramScreen kabi)
    const rec = await api.uploadSiteMedia('loginBg', file).catch(() => null);
    if (rec && rec.id && rec.file) {
      const url = `${PB_URL}/api/files/site_media/${rec.id}/${rec.file}`;
      setSettings(p => ({ ...p, loginBg: url }));
      localStorage.setItem('parfum_login_bg', url);
      showToast?.('Фон сохранён');
      return;
    }
    // 2) Fallback: lokal base64 (PB vaqtincha ishlamasa)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setSettings(p => ({ ...p, loginBg: dataUrl }));
      localStorage.setItem('parfum_login_bg', dataUrl);
      showToast?.('Сохранено локально (PB недоступен)');
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

  // ═══ TIZIM DIAGNOSTIKASI — bir tugma bilan hammasini tekshirish ═══
  const [diagResults, setDiagResults] = useState(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const runDiagnostics = async () => {
    setDiagRunning(true);
    const res = [];
    const authHdr = pb.authStore.token ? { Authorization: pb.authStore.token } : {};
    // 1. PocketBase server
    try {
      const r = await fetch(`${PB_URL}/api/health`, { method: 'GET' });
      res.push({ name: 'PocketBase server', ok: r.ok, detail: r.ok ? 'Работает' : `HTTP ${r.status}` });
    } catch { res.push({ name: 'PocketBase server', ok: false, detail: 'Нет связи' }); }
    // 2. Mahsulotlar
    res.push({ name: lang === 'kg' ? 'Товарлар' : 'Товары', ok: products.length > 0, detail: `${products.length} шт` });
    // 3. Sozlamalar PB sync
    try {
      const st = await api.getSettings();
      res.push({ name: lang === 'kg' ? 'Жөндөөлөр (сервер)' : 'Настройки (сервер)', ok: !!st, detail: st ? 'Синхронизированы' : 'Записи нет — измените любую настройку' });
    } catch { res.push({ name: 'Настройки (сервер)', ok: false, detail: 'Ошибка' }); }
    // 4. O!Dengi konfiguratsiyasi (400 = sozlangan, 503 = parol yo'q)
    try {
      const r = await fetch(`${PB_URL}/api/custom/odengi/create-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr }, body: '{}',
      });
      const ok = r.status === 400;
      res.push({ name: 'O!Деньги', ok, detail: ok ? 'Настроена' : r.status === 503 ? 'Нет ODENGI_PASSWORD на сервере!' : r.status === 401 ? 'Нужен admin-токен' : `HTTP ${r.status}` });
    } catch { res.push({ name: 'O!Деньги', ok: false, detail: 'Нет связи' }); }
    // 5. WhatsApp (400 = sozlangan, 500 = token yo'q)
    try {
      const r = await fetch(`${PB_URL}/api/custom/whatsapp/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr }, body: '{}',
      });
      const ok = r.status === 400;
      res.push({ name: 'WhatsApp (Green API)', ok, detail: ok ? 'Настроен' : r.status === 500 ? 'Нет GREEN_API_TOKEN на сервере' : `HTTP ${r.status}` });
    } catch { res.push({ name: 'WhatsApp (Green API)', ok: false, detail: 'Нет связи' }); }
    setDiagResults(res);
    setDiagRunning(false);
    haptic(res.every(x => x.ok) ? 'medium' : 'heavy');
  };

  const renderDiagnostics = () => (
    <SettingsSubScreen title={lang === 'kg' ? 'Система текшерүү' : 'Проверка системы'} onBack={() => setSub(null)}>
      <SettingsSection
        header={lang === 'kg' ? 'Диагностика' : 'Диагностика'}
        footer={lang === 'kg'
          ? 'Сервер, төлөм жана билдирүүлөр иштеп жатканын текшерет.'
          : 'Проверяет сервер, оплату и уведомления за пару секунд. Запускайте после каждого деплоя.'}
      >
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG, borderRadius: 12 }}>
          {!diagResults && !diagRunning && (
            <div style={{ fontSize: 13, color: '#8E8E93', fontFamily: SETTINGS_FONT, textAlign: 'center', padding: '8px 0' }}>
              {lang === 'kg' ? 'Текшерүүнү баштаңыз' : 'Нажмите кнопку для проверки'}
            </div>
          )}
          {diagRunning && (
            <div style={{ fontSize: 13, color: '#8E8E93', fontFamily: SETTINGS_FONT, textAlign: 'center', padding: '8px 0' }}>
              ⏳ {lang === 'kg' ? 'Текшерилүүдө...' : 'Проверяем...'}
            </div>
          )}
          {diagResults && diagResults.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < diagResults.length - 1 ? `1px solid ${SETTINGS_SEPARATOR}` : 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: SETTINGS_LABEL_COLOR, fontFamily: SETTINGS_FONT }}>{r.ok ? '✅' : '❌'} {r.name}</span>
              <span style={{ fontSize: 12, color: r.ok ? '#34C759' : '#FF3B30', fontFamily: SETTINGS_FONT, textAlign: 'right', maxWidth: '55%' }}>{r.detail}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={runDiagnostics} disabled={diagRunning} style={{ ...primarySaveBtn, opacity: diagRunning ? 0.6 : 1 }}>
          {diagRunning ? '...' : (lang === 'kg' ? 'Текшерүүнү баштоо' : 'Запустить проверку')}
        </button>
      </div>
    </SettingsSubScreen>
  );

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

  const renderDelivery = () => (
    <SettingsSubScreen title={lang === 'kg' ? 'Жеткирүү' : 'Доставка'} onBack={() => setSub(null)}>
      <SettingsSection
        header={lang === 'kg' ? 'Жеткирүү баасы' : 'Стоимость доставки'}
        footer={lang === 'kg' ? 'Бул сумма заказга кошулат (жеткирүү тандалганда).' : 'Эта сумма прибавляется к заказу при выборе доставки.'}
      >
        <SettingsTextField
          label={lang === 'kg' ? 'Баасы (сом)' : 'Цена (сом)'}
          value={String(settings?.deliveryCost || '')}
          onChange={v => setSettings(p => ({ ...p, deliveryCost: Number(v) || 0 }))}
          placeholder="200"
        />
      </SettingsSection>
      <SettingsSection
        header={lang === 'kg' ? 'Минималдуу заказ' : 'Минимальный заказ'}
        footer={lang === 'kg' ? 'Бул суммадан аз заказ кабыл алынбайт.' : 'Заказы меньше этой суммы не принимаются.'}
      >
        <SettingsTextField
          label={lang === 'kg' ? 'Сумма (сом)' : 'Сумма (сом)'}
          value={String(settings?.minOrder || '')}
          onChange={v => setSettings(p => ({ ...p, minOrder: Number(v) || 0 }))}
          placeholder="500"
        />
      </SettingsSection>
      <SettingsSection
        header={lang === 'kg' ? 'Акысыз жеткирүү' : 'Бесплатная доставка'}
        footer={lang === 'kg' ? 'Бул суммадан жогору заказдарга жеткирүү акысыз.' : 'Для заказов выше этой суммы доставка бесплатная.'}
      >
        <SettingsTextField
          label={lang === 'kg' ? 'Суммадан (сом)' : 'От суммы (сом)'}
          value={String(settings?.freeDeliveryFrom || '')}
          onChange={v => setSettings(p => ({ ...p, freeDeliveryFrom: Number(v) || 0 }))}
          placeholder="3000"
        />
      </SettingsSection>
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { showToast?.(lang === 'kg' ? 'Сакталды' : 'Сохранено'); setSub(null); }} style={primarySaveBtn}>
          {lang === 'kg' ? 'Сактоо' : 'Сохранить'}
        </button>
      </div>
    </SettingsSubScreen>
  );

  /* ── 1. О магазине — базовая инфо, адрес, координаты, текст "О нас" ── */
  const renderShopInfo = () => (
    <SettingsSubScreen title="О магазине" onBack={() => setSub(null)}>
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
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { showToast?.('Сохранено'); setSub(null); }} style={primarySaveBtn}>Готово</button>
      </div>
    </SettingsSubScreen>
  );

  /* ── 2. Главная страница — Hero баннер, Announcement bar, CTA ── */
  const renderHeroPage = () => (
    <SettingsSubScreen title="Главная страница" onBack={() => setSub(null)}>
      <SettingsSection header="Hero баннер" footer="Тексты, отображаемые в главном баннере на десктопе.">
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
      </SettingsSection>
      <SettingsSection header="Бегущая строка" footer="Каждая строка = новое объявление. Показывается вверху сайта.">
        <div style={{ padding: '12px 16px', background: SETTINGS_CARD_BG }}>
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
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { showToast?.('Сохранено'); setSub(null); }} style={primarySaveBtn}>Готово</button>
      </div>
    </SettingsSubScreen>
  );

  /* ── 3. Соцсети — Instagram, TikTok, YouTube ── */
  const renderSocials = () => (
    <SettingsSubScreen title="Соцсети" onBack={() => setSub(null)}>
      <SettingsSection header="Ссылки" footer="Иконки без ссылки станут неактивными в футере.">
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
          type="password"
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
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { showToast?.('Сохранено'); setSub(null); }} style={primarySaveBtn}>Готово</button>
      </div>
    </SettingsSubScreen>
  );

  /* ── 4. Футер — колонки ссылок, копирайт ── */
  const renderFooterSettings = () => (
    <SettingsSubScreen title="Футер" onBack={() => setSub(null)}>
      <SettingsSection header="Колонка «Компания»" footer="Каждая строка — отдельная ссылка.">
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
      <SettingsSection header="Колонка «Помощь»" footer="Каждая строка — отдельная ссылка.">
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
                    <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 11 }}>Нет фото</div>
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
            width: 32, height: 32, borderRadius: 10,
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
  const bannerCount = (banners || []).length;
  const adminInitial = (settings?.shopName || 'Admin').trim().charAt(0).toUpperCase() || 'A';

  // ─── Quick-edit inline values (shown on root, no sub-screen needed) ─────────
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [editingMinOrder, setEditingMinOrder] = useState(false);

  const renderRoot = () => (
    <div style={{ background: SETTINGS_PAGE_BG, minHeight: '100vh', paddingBottom: 'var(--nav-height)', fontFamily: SETTINGS_FONT }}>
      {/* ── Header — iOS style ── */}
      <div style={{
        padding: 'calc(var(--header-top, 44px) + 6px) 16px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#000', letterSpacing: -0.5, fontFamily: SETTINGS_FONT }}>{lang === 'kg' ? 'Жөндөөлөр' : 'Настройки'}</div>
          {settings?.shopName && (
            <div style={{ fontSize: 13, color: SETTINGS_SECTION_HEADER, marginTop: 2, fontWeight: 500, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {settings.shopName}
            </div>
          )}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1f1f22 0%, #111111 100%)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 16, letterSpacing: -0.2,
          boxShadow: '0 4px 12px rgba(17,17,17,0.20), 0 1px 2px rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>{adminInitial}</div>
      </div>

      {/* ══════ 1. ТЕЗКОР СОЗЛАМАЛАР (Quick Settings) ══════ */}
      <Card title={lang === 'kg' ? 'Тез жөндөөлөр' : 'Быстрые настройки'}>
        {/* WhatsApp — inline editable */}
        <PremiumRow
          icon={SET_ICON.chat} iconBg="#25D366"
          label="WhatsApp"
          hint={whatsappAdmin || (lang === 'kg' ? 'Номер киргизиңиз' : 'Введите номер')}
          status={whatsappStatus}
          onClick={() => setSub('whatsapp')} isFirst
        />
        {/* Delivery cost — inline display */}
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
          iconBg="#007AFF"
          label={lang === 'kg' ? 'Жеткирүү баасы' : 'Доставка'}
          hint={settings?.deliveryCost ? `${settings.deliveryCost} сом` : (lang === 'kg' ? 'Белгиленбеген' : 'Не указано')}
          onClick={() => setSub('delivery')}
        />
        {/* Bonus % */}
        <PremiumRow
          icon={SET_ICON.gift} iconBg="#AF52DE"
          label={lang === 'kg' ? 'Бонус тутуму' : 'Бонусы'}
          hint={settings?.bonusPercent ? `${settings.bonusPercent}% ${lang === 'kg' ? 'кайтарым' : 'начисление'}` : (lang === 'kg' ? 'Стандарт' : 'Стандарт')}
          onClick={() => setSub('bonus')} isLast
        />
      </Card>

      {/* ══════ 2. ОПЛАТА (Payments) ══════ */}
      <Card title={lang === 'kg' ? 'Төлөм' : 'Оплата'}>
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20"/></svg>}
          iconBg={settings?.onlinePaymentEnabled !== false ? '#34C759' : '#8E8E93'}
          label={lang === 'kg' ? 'Онлайн төлөм (O!Деньги)' : 'Онлайн оплата (O!Деньги)'}
          hint={settings?.onlinePaymentEnabled !== false
            ? (lang === 'kg' ? 'Күйүк — кардарларга көрүнөт' : 'Включена — видна клиентам')
            : (lang === 'kg' ? 'Өчүк — жашырылган' : 'Выключена — скрыта из оформления')}
          onClick={() => {
            const next = !(settings?.onlinePaymentEnabled !== false);
            setSettings(p => ({ ...p, onlinePaymentEnabled: next }));
            haptic('light');
            showToast?.(next
              ? (lang === 'kg' ? 'Онлайн төлөм күйгүзүлдү' : 'Онлайн оплата включена')
              : (lang === 'kg' ? 'Онлайн төлөм өчүрүлдү' : 'Онлайн оплата выключена'));
          }} isFirst
        />
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>}
          iconBg="#34C759"
          label={lang === 'kg' ? 'Накталай' : 'Наличные при получении'}
          hint={lang === 'kg' ? 'Дайыма иштейт' : 'Всегда доступны'}
          isLast
        />
      </Card>

      {/* ══════ ПРОВЕРКА СИСТЕМЫ ══════ */}
      <Card title={lang === 'kg' ? 'Система' : 'Система'}>
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
          iconBg="#FF9500"
          label={lang === 'kg' ? 'Система текшерүү' : 'Проверка системы'}
          hint={lang === 'kg' ? 'Сервер, төлөм, WhatsApp' : 'Сервер, оплата, WhatsApp — за 5 секунд'}
          onClick={() => { setDiagResults(null); setSub('diagnostics'); }}
          isFirst isLast
        />
      </Card>

      {/* ══════ 3. КОНТЕНТ (Content) ══════ */}
      <Card title={lang === 'kg' ? 'Мазмун' : 'Контент'}>
        <PremiumRow
          icon={SET_ICON.photo} iconBg="#FF9500"
          label={lang === 'kg' ? 'Баннерлер' : 'Баннеры'}
          hint={bannerCount ? `${bannerCount} ${lang === 'kg' ? 'активдүү' : 'активн.'}` : (lang === 'kg' ? 'Жөндөлбөгөн' : 'Не настроено')}
          onClick={() => setSub('banners')} isFirst
        />
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>}
          iconBg="#5856D6"
          label={lang === 'kg' ? 'Башкы бет' : 'Главная страница'}
          hint={settings?.heroSubtitle ? (lang === 'kg' ? 'Жөндөлгөн' : 'Настроено') : 'Hero, CTA'}
          onClick={() => setSub('heroPage')}
        />
        <PremiumRow
          icon={SET_ICON.loginBg} iconBg="#5AC8FA"
          label={lang === 'kg' ? 'Кирүү фону' : 'Фон входа'}
          hint={settings?.loginBg ? (lang === 'kg' ? 'Кастомдук' : 'Кастомный') : (lang === 'kg' ? 'Стандарт' : 'Стандартный')}
          onClick={() => setSub('loginBg')}
        />
        <PremiumRow
          icon={SET_ICON.photo} iconBg="#C13584"
          label="Instagram"
          hint={settings?.instagramScreen ? (lang === 'kg' ? 'Жүктөлгөн' : 'Загружен') : (lang === 'kg' ? 'Жүктөлбөгөн' : 'Не загружен')}
          onClick={() => setSub('instaScreen')} isLast
        />
      </Card>

      {/* ══════ 4. МАГАЗИН (Shop Info) ══════ */}
      <Card title={lang === 'kg' ? 'Дүкөн' : 'Магазин'}>
        <PremiumRow
          icon={SET_ICON.store} iconBg="#007AFF"
          label={lang === 'kg' ? 'Дүкөн жөнүндө' : 'О магазине'}
          hint={settings?.shopName || (lang === 'kg' ? 'Белгиленбеген' : 'Не указан')}
          onClick={() => setSub('shopInfo')} isFirst
        />
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>}
          iconBg="#FF6B35"
          label={lang === 'kg' ? 'Соцтармактар' : 'Соцсети'}
          hint={settings?.instagramUrl ? 'IG, TikTok, YT' : (lang === 'kg' ? 'Жөндөлбөгөн' : 'Не настроено')}
          onClick={() => setSub('socials')}
        />
        <PremiumRow
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
          iconBg="#8E8E93"
          label={lang === 'kg' ? 'Футер' : 'Футер'}
          hint={settings?.copyrightText ? (lang === 'kg' ? 'Жөндөлгөн' : 'Настроен') : (lang === 'kg' ? 'Мамычалар, копирайт' : 'Колонки, копирайт')}
          onClick={() => setSub('footerSettings')} isLast
        />
      </Card>

      {/* ══════ 5. ТИЛ / ЯЗЫК ══════ */}
      <Card title={lang === 'kg' ? 'Тил' : 'Язык'}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, background: SETTINGS_CARD_BG, borderRadius: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: '#5856D6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 16,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#000', letterSpacing: -0.2, fontFamily: SETTINGS_FONT }}>{lang === 'kg' ? 'Тил' : 'Язык'}</div>
          <div style={{ display: 'inline-flex', background: 'rgba(120,120,128,0.14)', borderRadius: 10, padding: 2, position: 'relative' }}>
            {[{ id: 'ru', label: 'Рус' }, { id: 'kg', label: 'Кырг' }].map(opt => {
              const active = lang === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { haptic('light'); setLang(opt.id); }}
                  style={{
                    position: 'relative',
                    padding: '6px 16px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
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
                        borderRadius: 8,
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

      {/* ══════ ВЫХОД ══════ */}
      <div style={{ padding: '0 14px', marginTop: 16 }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          onClick={onLogout}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14,
            background: SETTINGS_CARD_BG,
            color: SETTINGS_DANGER,
            fontWeight: 600, fontSize: 16,
            cursor: 'pointer', fontFamily: SETTINGS_FONT,
            letterSpacing: -0.2,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 16px rgba(0,0,0,0.04)',
            border: '0.5px solid rgba(0,0,0,0.04)',
            textAlign: 'center',
          }}
        >
          {lang === 'kg' ? 'Чыгуу' : t.logout}
        </motion.button>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '24px 16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, letterSpacing: 0.1, fontFamily: SETTINGS_FONT }}>
          {lang === 'kg' ? 'Версия' : 'Версия'} 2.0 PRO
        </div>
        <div style={{ fontSize: 11, color: '#C7C7CC', marginTop: 3, fontFamily: SETTINGS_FONT, letterSpacing: 0.1 }}>Kemal Usman · Smart Center</div>
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
            {sub === 'delivery' && renderDelivery()}
            {sub === 'shopInfo'       && renderShopInfo()}
            {sub === 'heroPage'       && renderHeroPage()}
            {sub === 'socials'        && renderSocials()}
            {sub === 'footerSettings' && renderFooterSettings()}
            {sub === 'loginBg'  && renderLoginBg()}
            {sub === 'instaScreen' && renderInstaScreen()}
            {sub === 'diagnostics' && renderDiagnostics()}
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
export function AdminReviewsScreen({ reviews = [], setReviews, showToast }) {
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


// ─── ORDER RECEIPT ────────────────────────────────────────────────────────────
// ─── Online Payment Screen (Premium iOS Bottom-Sheet) ───────────────────────
// Creates invoice via server hook, shows paylink/QR, polls for payment.
