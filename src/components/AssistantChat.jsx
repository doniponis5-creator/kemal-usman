// Онлайн-консультант «Спросить»: плавающая кнопка + окно чата.
// Ответы даёт сервер (pb_hooks/assistant.pb.js → Gemini); ключ ИИ в приложение не попадает.
// Под ответом — карточки ароматов: объём кладётся в корзину сразу, по карточке открывается товар.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { T, R } from "../theme";
import { IC } from "../icons";
import { PB_URL } from "../api/pb";
import { haptic } from "../utils/haptics";

// В `npm run dev` вопрос уходит в локальный предпросмотр (vite.config.js), в сборке — на PocketBase.
const ENDPOINT = import.meta.env.DEV ? "/api/custom/assistant" : `${PB_URL}/api/custom/assistant`;
const STORE_KEY = "ku_assistant_chat";
// Окно рисуется в document.body, а у body шрифт по умолчанию — задаём тот же, что у приложения.
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif";

const loadChat = () => {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(-30) : [];
  } catch { return []; }
};
const saveChat = (list) => {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-30))); } catch { /* приватный режим */ }
};

function waLink(phone, text) {
  const num = String(phone || "").replace(/\D/g, "");
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function ProductPick({ product, t, inCart, onAdd, onOpen, now }) {
  const sale = Number(product.salePercent) > 0 && product.saleEnd && new Date(product.saleEnd).getTime() > now
    ? Number(product.salePercent) : 0;
  const stock = (product.variants || []).filter(v => v.inStock);
  const price = (v) => sale ? Math.round(v.price * (1 - sale / 100)) : v.price;
  return (
    <div style={{ background: T.white, borderRadius: R.lg, padding: 10, display: "flex", gap: 10, boxShadow: T.shadowSm }}>
      <button
        onClick={onOpen}
        aria-label={`${product.brand} ${product.name}`}
        style={{ width: 64, height: 64, flexShrink: 0, borderRadius: R.md, background: "var(--ku-surface-2, #F5F5F5)", border: "none", padding: 0, overflow: "hidden", cursor: "pointer" }}
      >
        {product.img
          ? <img src={product.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{IC.bottle}</span>}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", width: "100%", color: T.text }}>
          <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: T.textSecond, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.brand}</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
        </button>
        {stock.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{t.askNoStock}</div>
        ) : (
          <div style={{ display: "flex", gap: 6, marginTop: 6, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {stock.map(v => {
              const added = inCart(product.id, v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => onAdd(product.id, v.id)}
                  style={{
                    flexShrink: 0, border: "none", cursor: "pointer", borderRadius: R.pill, padding: "6px 10px",
                    fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit",
                    background: added ? "var(--ku-accent, #111111)" : "var(--ku-fill, rgba(0,0,0,0.06))",
                    color: added ? "#fff" : T.text,
                  }}
                >
                  {added ? "✓ " : "+ "}{String(v.label || "").trim()} · {price(v)} с
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "12px 14px", background: "var(--ku-surface-2, #F5F5F5)", borderRadius: 18, borderBottomLeftRadius: 6, width: "fit-content" }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          style={{ width: 6, height: 6, borderRadius: 3, background: T.textSecond, display: "block" }}
        />
      ))}
    </div>
  );
}

/**
 * products — тот же массив, что у каталога (картинки уже ссылками);
 * cart — [{ productId, variantId, qty }]; onOpenProduct(id) — открыть страницу аромата.
 * bottomOffset — сколько места снизу занимает нижняя панель (телефон).
 */
export function AssistantChat({ products, cart, addToCart, onOpenProduct, settings, lang, t, desktop = false, bottomOffset = 0, viewing = null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Время для проверки скидок — берём при открытии окна, а не на каждой перерисовке.
  const [now, setNow] = useState(() => Date.now());
  // При прокрутке вниз кнопка сжимается в круг, чтобы меньше закрывать карточки.
  const [compact, setCompact] = useState(false);
  // Пока покупатель листает — кнопка прячется, через секунду после остановки возвращается.
  const [scrolling, setScrolling] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of products || []) m.set(String(p.id), p);
    return m;
  }, [products]);

  useEffect(() => { saveChat(messages); }, [messages]);

  useEffect(() => {
    if (desktop) return;
    let last = 0;
    let timer = 0;
    // Каталог прокручивается внутри своего блока, а не окна, — ловим прокрутку любого блока.
    const onScroll = (e) => {
      // Событие от документа: прокручивается либо окно, либо <body> — берём тот, что двигается.
      const root = document.scrollingElement;
      const el = e.target === document
        ? (root && root.scrollHeight > root.clientHeight + 1 ? root : document.body)
        : e.target;
      // Горизонтальные витрины (карусели) кнопку не трогают.
      if (!el || el.scrollHeight <= el.clientHeight + 1) return;
      const top = el.scrollTop || 0;
      if (Math.abs(top - last) < 8) return;
      setCompact(top > 120 && top > last);
      last = top;
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 900);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => { document.removeEventListener("scroll", onScroll, { capture: true }); clearTimeout(timer); };
  }, [desktop]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, busy]);

  // Телефон: окно на весь экран — страницу под ним не прокручиваем.
  useEffect(() => {
    if (!open || desktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, desktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const inCart = (pid, vid) => (cart || []).some(i => String(i.productId) === String(pid) && String(i.variantId) === String(vid));

  const lastQuestion = [...messages].reverse().find(m => m.role === "user")?.text || "";
  const wa = waLink(settings?.whatsappPhone, lastQuestion ? `${t.askWaIntro}\n${lastQuestion}` : t.askWaIntro);

  const ask = async (raw) => {
    const question = String(raw || "").trim();
    if (!question || busy) return;
    haptic("light");
    const next = [...messages, { role: "user", text: question }];
    setMessages(next);
    setText("");
    setBusy(true);
    const shown = [];
    for (const m of next) for (const id of m.productIds || []) if (!shown.includes(id)) shown.push(id);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter(m => !m.error).map(m => ({ role: m.role, text: m.text })),
          lang,
          viewing,
          shown: shown.slice(-12),
        }),
      });
      if (res.status === 429) throw Object.assign(new Error("limit"), { limit: true });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        text: String(data.reply || ""),
        productIds: (data.productIds || []).filter(id => byId.has(String(id))),
        handoff: !!data.handoff,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: e.limit ? t.askTooMany : t.askError, error: true, handoff: true }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setMessages([]); setText(""); inputRef.current?.focus(); };

  const openProduct = (id) => {
    if (!desktop) setOpen(false);
    onOpenProduct?.(String(id));
  };

  const add = (pid, vid) => {
    if (inCart(pid, vid)) return;
    addToCart(pid, vid);
  };

  const chips = [t.askChip1, t.askChip2, t.askChip3, t.askChip4];

  const fab = (
    <motion.button
      key="ask-fab"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={scrolling && !desktop ? { opacity: 0, scale: 0.85, y: 12 } : { opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.22 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => { haptic("light"); setNow(Date.now()); setOpen(true); }}
      aria-label={t.askTitle}
      style={{
        position: "fixed", zIndex: 1001,
        ...(desktop
          ? { right: 24, bottom: 24 }
          // Справа: слева внизу на карточках кнопка ▶ «Послушать аромат».
          : { right: 16, bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px) + 14px)`, pointerEvents: scrolling ? "none" : "auto" }),
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46,
        padding: compact ? 0 : "0 18px 0 14px", width: compact ? 46 : "auto",
        borderRadius: R.pill, border: "none", cursor: "pointer", fontFamily: FONT,
        background: "var(--ku-accent, #111111)", color: "#fff", fontSize: 15, fontWeight: 600,
        boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
      }}
    >
      {IC.chat}
      {!compact && t.askButton}
    </motion.button>
  );

  const panelStyle = desktop
    ? { position: "fixed", right: 24, bottom: 24, width: 400, height: "min(640px, calc(100vh - 48px))", borderRadius: R.xxl, zIndex: 1100 }
    : { position: "fixed", left: 0, right: 0, bottom: 0, height: "92dvh", borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, zIndex: 1100 };

  const panel = (
    <React.Fragment key="ask-panel">
      {!desktop && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1099 }}
        />
      )}
      <motion.div
        role="dialog"
        aria-label={t.askTitle}
        initial={desktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
        animate={desktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
        exit={desktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        style={{
          ...panelStyle,
          background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Шапка */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: desktop ? "14px 14px 12px 18px" : "16px 14px 12px 18px", background: T.white, borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ width: 38, height: 38, borderRadius: 19, background: "var(--ku-accent, #111111)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, letterSpacing: 0.5, flexShrink: 0 }}>KU</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{t.askTitle}</div>
            <div style={{ fontSize: 12, color: T.textSecond }}>{t.askSubtitle}</div>
          </div>
          {messages.length > 0 && (
            <button onClick={reset} style={{ background: "none", border: "none", color: T.textSecond, fontSize: 13, cursor: "pointer", padding: "8px 6px", fontFamily: "inherit" }}>{t.askClear}</button>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label={t.askClose}
            style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "var(--ku-fill, rgba(0,0,0,0.06))", color: T.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            {IC.close}
          </button>
        </div>

        {/* Переписка */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          <div style={{ alignSelf: "flex-start", maxWidth: "86%", background: T.white, color: T.text, borderRadius: 18, borderBottomLeftRadius: 6, padding: "10px 14px", fontSize: 15, lineHeight: 1.4, boxShadow: T.shadowSm }}>
            {t.askHello}
          </div>
          {messages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
              {chips.map(c => (
                <button
                  key={c}
                  onClick={() => ask(c)}
                  style={{ border: `1px solid ${T.border}`, background: T.white, color: T.text, borderRadius: R.pill, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "86%", padding: "10px 14px", fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                borderRadius: 18,
                ...(m.role === "user"
                  ? { background: "var(--ku-accent, #111111)", color: "#fff", borderBottomRightRadius: 6 }
                  : { background: T.white, color: m.error ? T.textSecond : T.text, borderBottomLeftRadius: 6, boxShadow: T.shadowSm }),
              }}>
                {m.text}
              </div>
              {m.role === "assistant" && (m.productIds || []).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
                  {m.productIds.map(id => byId.get(String(id))).filter(Boolean).map(p => (
                    <ProductPick key={p.id} product={p} t={t} now={now}inCart={inCart} onAdd={add} onOpen={() => openProduct(p.id)} />
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.handoff && wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: R.pill, background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                >
                  {IC.chat}{t.askWhatsApp}
                </a>
              )}
            </div>
          ))}
          {busy && <Typing />}
        </div>

        {/* Ввод */}
        <form
          onSubmit={(e) => { e.preventDefault(); ask(text); }}
          style={{ background: T.white, borderTop: `0.5px solid ${T.border}`, padding: desktop ? "10px 12px 12px" : "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              maxLength={600}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }}
              placeholder={t.askPlaceholder}
              aria-label={t.askPlaceholder}
              style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "var(--ku-surface-2, #F5F5F5)", color: T.text, borderRadius: 20, padding: "11px 16px", fontSize: 16, fontFamily: "inherit", lineHeight: 1.35, maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!text.trim() || busy}
              aria-label={t.askSend}
              style={{ width: 44, height: 44, borderRadius: 22, border: "none", flexShrink: 0, cursor: text.trim() && !busy ? "pointer" : "default", background: "var(--ku-accent, #111111)", color: "#fff", opacity: text.trim() && !busy ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </button>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, textAlign: "center", marginTop: 6 }}>{t.askNote}</div>
        </form>
      </motion.div>
    </React.Fragment>
  );

  return createPortal(
    <AnimatePresence>
      {open ? panel : fab}
    </AnimatePresence>,
    document.body
  );
}

export default AssistantChat;
