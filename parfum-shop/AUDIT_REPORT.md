# PRODUCTION AUDIT — Kemal Usman Parfum Shop

**Date:** 2026-04-30
**Auditor role:** Senior architect, security engineer, product designer
**Scope:** Frontend (`src/App.jsx`, ~3 369 lines), PocketBase backend, Capacitor iOS shell, deployment posture
**Verdict (TL;DR):** ❌ **NOT production-ready.** Multiple **CRITICAL** security issues that allow full data exfiltration, free product theft, free bonus farming, admin takeover and hard App Store rejection (HTTP backend on iOS).

---

## RISK LEGEND

| Level | Meaning |
|---|---|
| 🔴 CRITICAL | Exploitable now, blocks launch |
| 🟠 HIGH | Will be exploited within weeks of launch |
| 🟡 MEDIUM | Causes pain, but not immediate breach |
| 🟢 LOW | Polish / future tech debt |

---

## 1. ARCHITECTURE & CODE QUALITY

### Findings

| # | Issue | Risk | Where |
|---|---|---|---|
| 1.1 | **Single-file monolith** — entire app in 3 369 lines of `App.jsx` (13 screens + ICONS + DATA + API + AUDIO + PAYMENTS) | 🟠 HIGH | `src/App.jsx` |
| 1.2 | No module/folder structure (`/components`, `/screens`, `/api`, `/hooks`, `/utils`) | 🟠 HIGH | repo root |
| 1.3 | Inline-JS-objects styling everywhere — duplicated style strings, no theming pipeline, ~30 % bundle bloat | 🟡 MEDIUM | all screens |
| 1.4 | Hardcoded design tokens repeated outside `T` (e.g. `'#111'`, `'#fff'`, `'#aaa'` literal in 200+ places) breaks the rule in `CLAUDE.md` | 🟡 MEDIUM | all screens |
| 1.5 | No `ErrorBoundary` — one render exception = white screen on iOS | 🟠 HIGH | `main.jsx` |
| 1.6 | No code splitting / lazy loading — admin bundle ships to every customer | 🟡 MEDIUM | `vite.config.js` |
| 1.7 | `INITIAL_PRODUCTS` (≈ 30 SKUs hard-coded) ships in JS — bloats first paint | 🟡 MEDIUM | App.jsx L343-524 |
| 1.8 | `localStorage` is the source of truth for bonus balance, audio blobs, banking tokens, referrals — anything client can edit, client will edit | 🔴 CRITICAL | App.jsx everywhere |
| 1.9 | `requestKey: null` used on every PocketBase call — disables auto-cancel → race-condition order duplications under flaky 3G | 🟡 MEDIUM | App.jsx L275-296 |
| 1.10 | `setOrderLoading is not defined` — runtime crash inside `OBankPayment.onCancel` | 🟠 HIGH | App.jsx L3363 |
| 1.11 | `useEffect` in `BannerSlider` depends on `banners.length` only — banner content edits in admin won't re-mount the timer | 🟡 MEDIUM | App.jsx L825 |
| 1.12 | `window.innerHeight` read inside render closure with no resize listener — broken on rotation | 🟡 MEDIUM | App.jsx L1114 |
| 1.13 | `setTimeout(stopRecorder, 10000)` in `ProductAudioRecorder` — never cleared on unmount → memory leak + zombie mic | 🟡 MEDIUM | App.jsx L2635 |
| 1.14 | Cart items keyed by array `i` index — re-order/remove animation glitches | 🟢 LOW | L1346 |
| 1.15 | `App.jsx.broken` left in `src/` — gets indexed by build tooling | 🟢 LOW | `src/App.jsx.broken` |
| 1.16 | Lots of dead state (`showAdminLogin`, `pbLoading`, `welcomeBonusUsed`) — never gates UI | 🟢 LOW | App root |

### Recommendation
1. Split into `src/screens/`, `src/components/`, `src/api/`, `src/hooks/`, `src/i18n/`, `src/styles/tokens.ts`.
2. Add `ErrorBoundary` (Sentry-compatible) at `main.jsx`.
3. Move `INITIAL_PRODUCTS` server-side; ship empty + skeleton + fetch.
4. Lazy-load admin bundle: `const Admin = lazy(() => import("./screens/Admin"))`.
5. Replace `localStorage` writes for money-impacting state with PocketBase mutations.
6. Add Vitest + React Testing Library for cart/bonus/order math.

---

## 2. FUNCTIONAL LOGIC

| # | Bug / Edge case | Risk |
|---|---|---|
| 2.1 | Welcome bonus key = `'parfum_welcome_' + (phone or name)` — clearing browser data farms bonus indefinitely | 🔴 CRITICAL |
| 2.2 | Referral system stores "used codes" only locally — second device of same user can re-use any code | 🔴 CRITICAL |
| 2.3 | Bonus balance `parfum_bonus_balance` stored in `localStorage` and trusted on order calc — user can DevTools → set 999 999 → checkout | 🔴 CRITICAL |
| 2.4 | `MultiImageUpload` saves image **dataURLs** into product state, but `saveProd()` only sends `name/brand/category/desc/variants` — product images **never persist** to PocketBase | 🟠 HIGH |
| 2.5 | Admin product create returns PB record, then code overwrites local with `images: []` and old in-memory `variants` — destroys server fields | 🟠 HIGH |
| 2.6 | `MyOrdersScreen` filters by `o.clientPhone === user?.phone` but phone is stored unformatted vs formatted (`+996 700 …` vs `996700…`) → user sees 0 orders | 🟠 HIGH |
| 2.7 | Order ID created twice (client `localId` + PB `created.id`) — admin "delete" by client localId never matches PB | 🟠 HIGH |
| 2.8 | Cart quantity has no upper bound — user can order `qty: 9 999 999` (UI integer overflow) | 🟡 MEDIUM |
| 2.9 | Variant "out-of-stock" toggle is **client-side only** — no atomic decrement, no race-protection | 🟡 MEDIUM |
| 2.10 | No phone verification (no SMS / OTP) — anyone can claim any phone, including yours, and spend your bonuses | 🔴 CRITICAL |
| 2.11 | "5-tap secret" admin gateway on the catalog header is security-by-obscurity | 🟡 MEDIUM |
| 2.12 | `handleOrder` doesn't await PB before clearing the cart — failure on backend still empties cart and shows success | 🟠 HIGH |
| 2.13 | Welcome message loop in `MBankPayment` calls Green API directly with token from `localStorage` (token leaks into client bundle) | 🔴 CRITICAL |
| 2.14 | No empty-state for failed PB load (just `console.warn`) — user sees demo products forever, places phantom orders | 🟠 HIGH |
| 2.15 | `formatPhone` accepts max 12 digits but KG numbers are 12 → corner cases for foreign numbers (KZ, RU diaspora) | 🟢 LOW |

---

## 3. SECURITY AUDIT — DEEP

> This section alone is a launch-blocker.

### 3.1 Authentication & Authorization

| # | Finding | Risk |
|---|---|---|
| 3.1.1 | **No real authentication.** "Login" only collects name + phone, never validates anything. No password, no OTP, no session token. | 🔴 CRITICAL |
| 3.1.2 | Admin password (`"admin123"`) checked **client-side** by string compare — DevTools → `settings.adminPassword` reveals it. Trivial admin takeover. | 🔴 CRITICAL |
| 3.1.3 | Admin password bundled into JS — anyone who downloads the app sees `DEFAULT_SETTINGS = { adminPassword: "admin123" }` | 🔴 CRITICAL |
| 3.1.4 | No JWT, no refresh tokens, no expiry, no logout from server side | 🟠 HIGH |
| 3.1.5 | Role check is just a React `useState` boolean (`isAdmin`) — manipulable from React DevTools / Cordova bridge | 🔴 CRITICAL |
| 3.1.6 | No rate limiting on login attempts (n/a since there's no real login, but the future fix needs it) | 🟠 HIGH |

### 3.2 Vulnerabilities Detection

| Vector | Status | Notes |
|---|---|---|
| **SQL Injection** | 🟡 PARTIAL | `getFirstListItem(\`phone="${phone}"\`)` — phone passes through `replace(/\D/g,'')` for length check but full `phone` (with `+`, spaces) goes into the filter. Name field is fully user-controlled and goes into queries unescaped. PocketBase filter injection is real. |
| **XSS** | 🟢 OK-ish | React escapes output, but `localStorage` values (audio dataURLs, settings) are loaded into `<img src>` and `new Audio(data)` — a malicious admin or compromised PB record can inject `javascript:` URIs. No CSP header. |
| **CSRF** | 🟠 HIGH | No CSRF protection on PocketBase. Combined with open API rules → attacker site can issue write requests on behalf of user's browser. |
| **IDOR** | 🔴 CRITICAL | Anyone with the PB URL can `GET /api/collections/orders/records` and read every customer's name + phone + address + items. **Verified: rules are `""` (open).** |
| **Broken Auth** | 🔴 CRITICAL | (See 3.1.) |
| **Insecure endpoints** | 🔴 CRITICAL | All endpoints HTTP plaintext on `145.223.100.16:8090`. |

### 3.3 Data Protection

| # | Finding | Risk |
|---|---|---|
| 3.3.1 | **PocketBase URL is HTTP** (`http://145.223.100.16:8090`) — all customer phones, names, addresses, orders travel in clear over Wi-Fi | 🔴 CRITICAL |
| 3.3.2 | Green API WhatsApp **token** stored in `localStorage` ("green_token") — any XSS or shared device leaks the messaging instance | 🔴 CRITICAL |
| 3.3.3 | `pb-setup.js`, `pb-fix-rules.js`, `pb-open-all.js` all contain `ADMIN_PASSWORD = "Doniyor123"` and admin email in **committed source** | 🔴 CRITICAL |
| 3.3.4 | No password hashing on app side (no passwords stored). PB admin password "Doniyor123" is weak. | 🟠 HIGH |
| 3.3.5 | Audio recordings stored as `data:audio/webm;base64,…` blobs in `localStorage` — quickly fills 5 MB quota, browser may purge silently | 🟡 MEDIUM |
| 3.3.6 | `parfum_login_bg`, product images, banner images all serialized as base64 in `localStorage` → quota crash on iOS Safari (~5 MB hard cap) | 🟡 MEDIUM |
| 3.3.7 | No encryption at rest on PB (default SQLite file) | 🟠 HIGH |

### 3.4 Mobile Security (iOS / Android)

| # | Finding | Risk |
|---|---|---|
| 3.4.1 | iOS App Transport Security blocks plain HTTP — app **will fail App Store review** until backend is HTTPS | 🔴 CRITICAL |
| 3.4.2 | No `@capacitor/android` package — Android target literally does not exist yet | 🟠 HIGH |
| 3.4.3 | No certificate pinning (`@capacitor-community/http` or native) | 🟠 HIGH |
| 3.4.4 | No jailbreak / root detection | 🟡 MEDIUM |
| 3.4.5 | No `@capacitor/preferences` (Keychain/Keystore) — sensitive tokens land in WKWebView `localStorage` | 🟠 HIGH |
| 3.4.6 | No code obfuscation / minification flags beyond Vite default | 🟡 MEDIUM |
| 3.4.7 | No App Transport Security exception list (which would be a fatal red flag if they tried to add one for the HTTP backend) | 🔴 CRITICAL |
| 3.4.8 | No biometric lock for admin panel | 🟡 MEDIUM |

### 3.5 API & Backend Security

| # | Finding | Risk |
|---|---|---|
| 3.5.1 | PocketBase rules opened with `listRule="" viewRule="" createRule="" updateRule="" deleteRule=""` for **products / orders / clients** → world-writable database | 🔴 CRITICAL |
| 3.5.2 | No rate limiting (PB has none built-in, no reverse proxy) — order spam DOS trivial | 🟠 HIGH |
| 3.5.3 | No request validation server-side (variants stored as raw `text`, prices accepted without bounds) | 🟠 HIGH |
| 3.5.4 | No audit log of admin actions | 🟡 MEDIUM |
| 3.5.5 | No WAF, no fail2ban | 🟠 HIGH |
| 3.5.6 | Geolocation reverse-geocoded via `nominatim.openstreetmap.org` with no `User-Agent` header — violates Nominatim usage policy, can be banned | 🟢 LOW |

### 3.6 Infrastructure

| # | Finding | Risk |
|---|---|---|
| 3.6.1 | Backend on bare IP `145.223.100.16:8090`, no domain, no certificate | 🔴 CRITICAL |
| 3.6.2 | No CORS allowlist → any browser tab can hit the API | 🟠 HIGH |
| 3.6.3 | Secrets in `.js` files in repo, not in `.env` | 🔴 CRITICAL |
| 3.6.4 | `vite.config.js` has `host: true` — fine for dev, but no prod hardening (no preview-only ssl, no HSTS) | 🟡 MEDIUM |
| 3.6.5 | `@vitejs/plugin-basic-ssl` installed but unused | 🟢 LOW |

### 3.7 OWASP Top 10 (2021) coverage

| OWASP item | Status |
|---|---|
| A01 Broken Access Control | ❌ Open PB rules |
| A02 Cryptographic Failures | ❌ HTTP backend |
| A03 Injection | ⚠️ PB filter injection possible |
| A04 Insecure Design | ❌ Auth model is decorative |
| A05 Security Misconfig | ❌ Admin password in repo, default `admin123` |
| A06 Vulnerable Components | ⚠️ React 19, Vite 8, Capacitor 8 are recent — OK, but no `npm audit` automation |
| A07 Identification/Auth Failures | ❌ No password, no OTP |
| A08 Software/Data Integrity | ❌ No signing, no integrity checks |
| A09 Logging/Monitoring | ❌ Only `console.warn` |
| A10 SSRF | 🟢 N/A (no server-side fetches) |

### 3.8 GDPR / KR personal-data law

| # | Finding | Risk |
|---|---|---|
| 3.8.1 | No Privacy Policy / consent screen — required by KR Law 58 (2008) "On personal information" | 🔴 CRITICAL |
| 3.8.2 | No "delete my data" flow | 🟠 HIGH |
| 3.8.3 | Geolocation requested without explicit consent dialog | 🟡 MEDIUM |
| 3.8.4 | Microphone permission requested without contextual explanation | 🟡 MEDIUM |
| 3.8.5 | No DPO contact published | 🟠 HIGH |

> Drafted documents are at:
> `legal/PRIVACY_POLICY_RU.md`, `legal/TERMS_OF_USE_RU.md`, `legal/DATA_PROTECTION_RU.md`

---

## 4. DATABASE (PocketBase)

| # | Finding | Risk |
|---|---|---|
| 4.1 | `variants` stored as **`text`** instead of `json` — no schema validation, JSON.parse spread across UI | 🟠 HIGH |
| 4.2 | `clients.phone` has no unique index → duplicates on every login | 🟠 HIGH |
| 4.3 | No `bonusBalance` / `bonusHistory` / `referralCode` columns on `clients` (CLAUDE.md says they exist; `pb-setup.js` defines only `phone/name/date`) | 🟠 HIGH |
| 4.4 | `orders.items` stored as text JSON — can't query "find all orders containing product X" | 🟡 MEDIUM |
| 4.5 | No relations (`relation` field) between orders and clients/products | 🟡 MEDIUM |
| 4.6 | No soft-delete / deleted-at — admin "delete" is destructive | 🟡 MEDIUM |
| 4.7 | No backup script in repo | 🟠 HIGH |
| 4.8 | SQLite file lives next to PocketBase binary — no off-site replica | 🟠 HIGH |

### Recommendations
- Migrate to `variants: json`, `items: json`.
- Add `relation` clientId on orders, productId on order-line.
- Index `clients.phone UNIQUE`, `orders.clientId`.
- Add fields: `clients.bonusBalance number`, `clients.bonusHistory json`, `clients.referralCode text UNIQUE`, `clients.referredBy text`.
- Move bonus calculation to a PB **hook** (`pb_hooks/orders.create.js`) — never trust client total.
- Litestream or `cron + scp` to S3 for daily SQLite snapshots.

---

## 5. MOBILE READINESS (iOS & Android)

### iOS

| Check | Status |
|---|---|
| App Transport Security (HTTPS) | ❌ FAIL — backend HTTP |
| App icons (1024×1024 + variants) | ⚠️ default Capacitor placeholders |
| Launch screen | ⚠️ default |
| Push notifications | ❌ not configured |
| Background modes | ❌ none |
| Privacy nutrition labels | ❌ not declared (mic, location) |
| `NSMicrophoneUsageDescription` | ❌ not in Info.plist |
| `NSLocationWhenInUseUsageDescription` | ❌ not in Info.plist |
| In-app purchase compliance (bonus / referral) | ⚠️ may need clarification with Apple |
| Tracking transparency | ✅ N/A (no tracking) |
| Universal links (`mbank://`, `obank://`) | ⚠️ tested only on browser |

### Android

| Check | Status |
|---|---|
| Capacitor Android platform | ❌ NOT INSTALLED |
| Adaptive icons | ❌ |
| `usesCleartextTraffic="false"` | ❌ would break with HTTP backend |
| Play Console data-safety form | ❌ |
| Target SDK 34+ | ❌ N/A (no project yet) |

### Performance / responsiveness

- ✅ `safe-area-inset-bottom` respected in NavBar
- ⚠️ `viewport user-scalable=no` — accessibility violation, will be flagged by reviewers
- ❌ Many `100vh`/`100svh` mixing — iOS Safari can clip content above keyboard
- ❌ No service worker / offline mode (app dies without network)
- ❌ No image lazy-loading, no `loading="lazy"`
- ❌ Banner uses raw JPEGs in `public/` — no WebP / AVIF, no responsive `srcset`

### Verdict
**iOS:** ❌ will be rejected at first review (HTTP). After HTTPS + plist + icons → still 1–2 weeks of polish.
**Android:** ❌ does not exist as a project yet.

---

## 6. UI / UX & DESIGN

### What's good
- Strong, consistent monochrome aesthetic (premium-feeling)
- Playfair Display italic on the logo is a nice touch
- Detail screen scroll-shrink hero is *almost* there
- Inline status chips, M-Bank/O!Bank deeplink flow, audio "listen the aroma" feature is a memorable differentiator

### What's missing to feel "PRO" / TOP 1 %

| # | Improvement | Priority |
|---|---|---|
| 6.1 | Skeleton loaders (product cards, banner, profile) — currently shows nothing while PB loads | HIGH |
| 6.2 | Page transitions — use `framer-motion` or CSS view transitions for screen→screen | HIGH |
| 6.3 | Add to cart "fly-to-cart" micro-animation (parabolic curve from card to nav badge) | HIGH |
| 6.4 | Pull-to-refresh on catalog + my-orders | MED |
| 6.5 | Haptic feedback on iOS via `@capacitor/haptics` for add-to-cart, success, error | HIGH |
| 6.6 | `prefers-reduced-motion` respected for all animations | HIGH (a11y) |
| 6.7 | Replace alerts (`window.confirm`) with custom bottom-sheets | HIGH |
| 6.8 | Empty-state illustrations (currently 🔍 emoji) — commission proper SVGs | MED |
| 6.9 | Image gallery: add pinch-to-zoom in product detail | MED |
| 6.10 | Scent profile visualization (top/heart/base notes) — huge UX win for parfum | HIGH (differentiator) |
| 6.11 | Order tracker timeline (Новый → Подтверждён → … → Доставлен) with animated checkmark | HIGH |
| 6.12 | Bonus animation: counter-up + confetti on welcome bonus | MED |
| 6.13 | Dark mode (you're 90% there with monochrome — add system toggle) | MED |
| 6.14 | Better typography scale — currently 6+ font sizes within one screen, no rhythm | HIGH |
| 6.15 | Replace inline emojis (📞 🚪 💬 ⚡ 💳 🎁 📍) with consistent SF/Lucide icons | HIGH |
| 6.16 | Use system font stack on iOS, Inter or SF Pro on Android — currently mixing | MED |
| 6.17 | Login screen background gradient pulse / Ken Burns slow zoom | MED |
| 6.18 | Add shop "About" / "Contacts" / "Working hours" public screen | HIGH |
| 6.19 | Use `IntersectionObserver` to fade-in product cards on scroll | LOW |
| 6.20 | Add bottom-sheet "Filter & Sort" (price asc/desc, brand A-Z, popularity) | HIGH |

### Animations checklist (concrete plan)

- Install `framer-motion` (`npm i framer-motion@^11`).
- Wrap routes in `<AnimatePresence mode="wait">` with `initial={{opacity:0, y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}`.
- Add `<motion.div layoutId={`product-${id}`}>` for the product card → detail morph.
- `useReducedMotion()` hook to disable for accessibility.
- Native haptic on every button: `Haptics.impact({ style: ImpactStyle.Light })`.

---

## 7. PERFORMANCE

| # | Issue | Fix |
|---|---|---|
| 7.1 | First load = ~3 369 lines of monolith JS + 30 hardcoded products + 30 fimgs.net image URLs hot-loaded | Code-split admin, lazy-load product images, ship products from PB only |
| 7.2 | All product images hosted on `fimgs.net` (Fragrantica CDN) — third-party, slow, not cache-controlled by you | Mirror to your CDN (Cloudflare R2 / Bunny) |
| 7.3 | Inline base64 images in `localStorage` & state — re-renders repaint massive strings | Upload via PB `file` field, store URL only |
| 7.4 | No memoization (`React.memo`, `useMemo`, `useCallback`) on product list (re-renders 30 cards on every keystroke in search) | Memoize `ProductCard`, debounce `search` |
| 7.5 | `BannerSlider` re-mounts whenever banners array reference changes | `React.memo` + stable key |
| 7.6 | No Service Worker / Workbox | Add Vite PWA plugin |
| 7.7 | No image format conversion (AVIF/WebP) | Use `vite-imagetools` or CDN-side |
| 7.8 | No Lighthouse / WebPageTest pinned | Add `npm run lighthouse` in CI |

Target metrics for PRO level:
- LCP < 2.0 s on 3G
- TTI < 3.5 s on mid-tier Android
- JS payload < 150 KB gzipped (initial route)

---

## 8. INTERNATIONALIZATION (RU / KG)

### What works
- `LangContext` + `useLang()` is a clean pattern.
- Two language tables (`ru`, `kg`) stored in single object.

### What's broken

| # | Finding |
|---|---|
| 8.1 | **Duplicate keys** — `cart` defined twice in `ru` (line 15 and 22), `myOrders` twice (15 and 34). The second wins, the first is silently lost. |
| 8.2 | **Hardcoded RU strings** in production code — at least 60 instances: `"📍 Адрес: ул. Манаса 45, кв. 12"`, `"Комментарий к заказу"`, `"📞 Позвоните перед доставкой"`, `"Аудио аромата"`, `"Варианты"`, `"Открыть M-Bank"`, `"Готово ✓"`, `"Обрезать фото"`, `"Загрузить фото"`, `"Нет в наличии"`, all of `AdminSettingsScreen`, etc. |
| 8.3 | KG translation table missing keys: `cart`, `catalog` not in the `kg` block (same shadowing issue). |
| 8.4 | No fallback chain — if `t.foo` is undefined, you render `undefined` (React hides it but devs miss bugs). |
| 8.5 | `lang === 'ru' ? "..." : "..."` ternaries scattered in JSX — defeats the i18n table. |
| 8.6 | No language detection from device locale on first launch. |
| 8.7 | No date/number locale (`Intl.NumberFormat('ky-KG')`). |

### Recommendation
1. Extract `TRANSLATIONS` to `src/i18n/{ru,kg}.json`.
2. Use `i18next` + `react-i18next`. Pluralization for `товаров / товара / товар` is the killer use case.
3. Add a CI lint that scans for Cyrillic / Latin strings in JSX (forbid hardcoded text).
4. Build a `t('common.cart')` namespace structure.
5. Auto-detect `Capacitor.Device.getLanguageCode()` on first launch.

---

## 9. CONFIDENTIALITY & LEGAL

✅ Three production-ready RU documents created:
- `legal/PRIVACY_POLICY_RU.md` — Политика конфиденциальности (по 12 разделам, соответствует Закону КР № 58)
- `legal/TERMS_OF_USE_RU.md` — Пользовательское соглашение (14 разделов: оплата, доставка, возврат, бонусы, рефералы)
- `legal/DATA_PROTECTION_RU.md` — Прозрачное объяснение обработки данных + таблица "что собираем / зачем / срок"

**Action required:**
- Заполнить юридические реквизиты ОсОО / ИП (ИНН, адрес).
- Перевести Privacy Policy на кыргызский.
- Добавить в приложении экран **«Согласие»** при первом запуске с чекбоксом "Я ознакомлен с Политикой и Соглашением".
- Опубликовать оба документа на публичном HTTPS URL — App Store и Play Store требуют ссылку при подаче.
- Добавить кнопку «Удалить аккаунт» в Профиль (Apple требует с iOS 14.5+).

---

## 10. DEVOPS & DEPLOYMENT

| # | Issue | Action |
|---|---|---|
| 10.1 | No CI/CD | GitHub Actions: lint → build → preview deploy |
| 10.2 | No environment separation (`dev` / `staging` / `prod`) | `.env.development`, `.env.production`, store `VITE_PB_URL` |
| 10.3 | Backend on bare server, no Caddy / nginx in front | Put Caddy in front → free Let's Encrypt → `https://api.kemalusman.kg` |
| 10.4 | No monitoring | Add Sentry (frontend), Uptime-Kuma (backend) |
| 10.5 | No backup | Litestream → S3 / Backblaze B2, daily |
| 10.6 | No log retention policy | Pipe PB logs to Loki / Vector |
| 10.7 | Secrets in repo (`pb-setup.js` etc.) | Move to `.env`, `.gitignore`, rotate "Doniyor123" today |
| 10.8 | No automated `npm audit` / `dependabot` | Add Dependabot weekly |
| 10.9 | `package.json scripts` missing `test`, `format`, `typecheck` | Vitest + Prettier + (optional) tsc |

---

## 11. FINAL VERDICT

### ❌ Production-ready? **NO.**

### CRITICAL must-fix before any launch (in priority order)

1. **Put PocketBase behind HTTPS** with a real domain (`api.kemalusman.kg`) via Caddy + Let's Encrypt. iOS won't ship without this.
2. **Lock PocketBase API rules.** `clients` → user-only, `orders` → owner-or-admin, `products` → admin-write, public-read. Use PB filter expressions.
3. **Implement real authentication** — phone + 6-digit SMS OTP (Telegram bot or SMSC.kg) → PB `users` collection with token.
4. **Move bonus / referral / order-total math to PocketBase server-side hooks** (`pb_hooks/`). Never trust client.
5. **Remove `adminPassword` from JS bundle.** Admins log in via PB native admin auth → JWT.
6. **Rotate all secrets** committed to git: `Doniyor123`, Green API token if any. Add `.env` + `.gitignore`.
7. **Delete `pb-open-all.js` / `pb-fix-rules.js`** from repo (or move to `.tools/` and ignore).
8. **Persist product images** to PB `file` field. Right now the entire image upload pipeline is broken (no save).
9. **Fix order ID mismatch** — let PB generate, drop client-side `localId`.
10. **Add `ErrorBoundary`** + Sentry — one bad render = white screen on iOS.
11. **Privacy/Terms screens + consent checkbox** on first launch (legal & store-policy requirement).
12. **Add `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`** to `Info.plist`.
13. **Install `@capacitor/android`** and run through one Android build.
14. **Fix runtime crash:** `setOrderLoading is not defined` in `OBankPayment.onCancel`.

### What will make this PRO LEVEL (TOP 1 %)

1. **Server-side everything money-related.** Bonuses, prices, stock, totals — PocketBase hooks with strict validation.
2. **Cert pinning + Keychain/Keystore** via Capacitor plugins. No tokens in `localStorage`.
3. **Push notifications** for order status (Capacitor + FCM/APNs) — drives retention.
4. **Scent-profile visualization** in product detail (top/heart/base notes) — unique to your category.
5. **Order tracker timeline** with live updates (PB realtime subscriptions).
6. **Smooth view-transition morphing** (Framer Motion `layoutId` from card → detail) + Apple-grade haptics.
7. **Offline-first PWA**: cache catalog, queue orders, sync on reconnect.
8. **Skeleton screens + Suspense** everywhere — no blank states.
9. **i18n done right** with `react-i18next`, device-locale detection, pluralization.
10. **Analytics privacy-first** (Plausible / PostHog self-hosted). Track funnels: cart → checkout → paid.
11. **Admin AI assistant** — "show me orders with payment pending > 24h", "top customers this month".
12. **A/B test bonus % and referral amount** — gamify retention.
13. **WhatsApp templates** (HSM) instead of free-text — better delivery rates.
14. **Real CI/CD** (preview per PR, screenshot diff on visual regression).
15. **Lighthouse > 95** on mobile, JS payload < 100 KB initial.

---

## Appendix A — files audited
- `src/App.jsx` (3 369 LOC)
- `src/main.jsx`, `src/index.css`, `src/App.css`
- `index.html`
- `package.json`, `vite.config.js`, `eslint.config.js`
- `capacitor.config.json`
- `pb-setup.js`, `pb-fix-rules.js`, `pb-open-all.js`
- `CLAUDE.md`

## Appendix B — files produced
- `legal/PRIVACY_POLICY_RU.md`
- `legal/TERMS_OF_USE_RU.md`
- `legal/DATA_PROTECTION_RU.md`
- `AUDIT_REPORT.md` (this file)

— end of report —
