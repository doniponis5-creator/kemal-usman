# Fixes Applied — change log

This catalogues every file created or modified in the production-readiness
sweep, with the **why** for each change. Pair with `MIGRATION_GUIDE.md` for
the rollout sequence and `AUDIT_REPORT.md` for the original findings.

---

## ✅ Files created

### Infrastructure & secrets
- **`.env.example`** — template for every env var (public `VITE_*` and
  server-side). Commits a real, shareable map of what configuration the app
  expects without leaking values.
- **`.env`** — local dev values (gitignored).
- **`.gitignore`** — extended to block `.env*`, `pb_data/`, `*.db`,
  iOS/Android build outputs, and the three leaked-secret scripts.

### Backend hardening
- **`scripts/pb-secure-rules.js`** — replaces the dangerous
  `pb-open-all.js`. Migrates the schema (proper `json` types, unique
  `phone`, new `bonusBalance` columns, new `settings` and `otp_codes`
  collections), then locks every API rule. Never touches a value without
  also adding the corresponding access rule.
- **`pb_hooks/main.pb.js`** — server-side order validation. Recomputes the
  `total` from authoritative product/variant prices, blocks bonus tampering,
  credits/debits bonuses on order delivery, generates referral codes, pays
  out referrals exactly once. Includes `/api/custom/me` and
  `/api/custom/account/delete` (Apple guideline 5.1.1.v).
- **`pb_hooks/otp.pb.js`** — SMS OTP authentication for the `clients`
  collection. Rate-limited (5 requests/h/phone, 5 verify attempts/code,
  5-min TTL).
- **`pb_hooks/_lib/crypto.js`** + **`pb_hooks/_lib/sms.js`** — shared helpers.
  SMS is pluggable (SMSC.kg by default).

### Frontend infrastructure
- **`src/api/pb.js`** — single source of truth for the PocketBase URL,
  driven by `VITE_PB_URL`. Warns at build time if PB_URL is not HTTPS in
  release. Exports `pb`, `PB_URL`, `fileUrl()`, `authedFetch()`.
- **`src/api/auth.js`** — `requestOtp`, `verifyOtp`, `logout`,
  `deleteAccount`, `adminLogin`. Persists token via `secureStorage`
  (Keychain/Keystore on native).
- **`src/i18n/ru.json`** + **`src/i18n/kg.json`** — full deduplicated
  translations. The original `TRANSLATIONS` object in `App.jsx` had
  `cart` defined twice in `ru` (the second one silently won); both
  versions are merged here under proper namespaces (`nav.cart` vs
  `cart.title`).
- **`src/i18n/index.js`** — `react-i18next` setup with
  `LanguageDetector`, persisted to `localStorage` under `parfum_lang`.
  Includes a `buildLegacyShim()` for backward compatibility during the
  migration window.

### UI primitives
- **`src/components/ErrorBoundary.jsx`** — global error boundary,
  Sentry-ready. Without it, one bad render = white screen on iOS.
- **`src/components/Skeleton.jsx`** — shimmer loaders for catalog grid.
- **`src/components/ConfirmDialog.jsx`** — promise-based bottom-sheet
  to replace every `window.confirm()` (Apple/Play UX guideline).

### Native utilities
- **`src/utils/haptics.js`** — Capacitor Haptics with web fallback to
  `navigator.vibrate`. Respects `prefers-reduced-motion`.
- **`src/utils/secureStorage.js`** — wraps `@capacitor/preferences`
  (Keychain on iOS, EncryptedSharedPreferences on Android). Falls back
  to localStorage on web with a warning for sensitive keys.
- **`src/utils/phone.js`** — `normalizePhone`, `formatPhoneDisplay`,
  `isValidKgPhone`. Fixes the MyOrders comparison bug.

### Deployment
- **`deploy/Caddyfile`** — reverse proxy with HSTS, CORS allowlist,
  per-route rate-limit hooks, structured JSON logging.
- **`deploy/pocketbase.service`** — systemd unit with hardening
  (NoNewPrivileges, ProtectSystem=strict, ReadWritePaths-restricted).
- **`deploy/setup-server.sh`** — one-shot Ubuntu provisioning: Caddy +
  PocketBase + UFW firewall + daily SQLite backup cron.
- **`deploy/INFO_PLIST_PATCH.md`** — every Info.plist key Apple requires
  (mic/location/camera/photo descriptions, URL schemes for `mbank://`
  and `obank://`, account-deletion compliance, privacy nutrition labels).
- **`deploy/ANDROID_SETUP.md`** — `npx cap add android`,
  AndroidManifest patches, target SDK 34, Play Store data-safety form.

### CI / tooling
- **`.github/workflows/ci.yml`** — lint + build (with prod env) +
  `npm audit --high` + secret regex check + Cyrillic-in-JSX counter.
- **`eslint-rules/no-hardcoded-cyrillic.js`** — custom ESLint rule that
  flags any Cyrillic literal in JSX text or string-literal attributes.

### Legal (created in earlier turn, retained)
- **`legal/PRIVACY_POLICY_RU.md`** — full Privacy Policy aligned with
  KR Law 58 and GDPR principles.
- **`legal/TERMS_OF_USE_RU.md`** — 14-section user agreement.
- **`legal/DATA_PROTECTION_RU.md`** — transparent data-handling table.

### Documentation
- **`MIGRATION_GUIDE.md`** — 10-step rollout plan with rollback per step.
- **`AUDIT_REPORT.md`** — original audit (kept for reference).
- **`FIXES_APPLIED.md`** — this file.

---

## ✏️ Files modified

### `src/App.jsx`
- **Line 1–10**: replaced hardcoded HTTP `PB_URL` with `import { pb, PB_URL } from "./api/pb"`. Added `normalizePhone` and `haptic` imports.
- **Line ~283**: `getImageUrl` now interpolates `${PB_URL}` instead of the literal HTTP URL.
- **Line ~3163**: `addToCart` now triggers `haptic('light')` on tap.
- **Line ~3288**: MyOrdersScreen filter uses `normalizePhone(...)` on both sides — fixes "I see 0 orders" bug.
- **Line ~3363**: `OBankPayment.onCancel` no longer calls undefined `setOrderLoading` — runtime crash eliminated.

### `src/main.jsx`
- Wrapped `<App />` in `<ErrorBoundary>`.
- Sentry lazy-init when `VITE_SENTRY_DSN` is set.

### `index.html`
- Removed `user-scalable=no` from viewport (a11y / Apple reviewer flag).

### `.gitignore`
- Added secrets, PB data, build outputs, and the three leaked-secret scripts.

---

## 🚧 Intentionally NOT modified (need server access)

These require operations only you can perform:

| Action | Where |
|---|---|
| Provision domain DNS A-record | Your DNS provider |
| Run `setup-server.sh` on `145.223.100.16` | SSH access |
| Rotate PB admin password (`Doniyor123` is leaked) | https://145.223.100.16:8090/_/ |
| Run `node scripts/pb-secure-rules.js` | Local terminal with .env |
| Deploy `pb_hooks/` to server | `scp -r pb_hooks/ root@server:/opt/pocketbase/` |
| `npx cap add android` | Your Mac with JDK 17 + Android Studio |
| Edit `ios/App/App/Info.plist` | Xcode |
| Migrate `App.jsx` screens to `useTranslation()` | Per-screen, gradual |
| Replace `localStorage` bonus reads with `/api/custom/me` | After hooks deploy |

The full sequence is in `MIGRATION_GUIDE.md`.

---

## System status (after applying everything in MIGRATION_GUIDE.md)

| Pillar | Before | After |
|---|---|---|
| Security | 🔴 6 CRITICAL | 🟢 0 CRITICAL (subject to ops steps) |
| Stability | 🟠 known runtime crash | 🟢 ErrorBoundary + crash fixed |
| Production readiness | ❌ | ✅ pending ops checklist |
| iOS App Store | ❌ ATS blocks HTTP | ✅ HTTPS + plist + account delete |
| Play Store | ❌ no Android project | ✅ instructions + AAB build path |
| GDPR / KR Law 58 | ❌ no policy, no consent | ✅ docs ready, consent screen TODO |
