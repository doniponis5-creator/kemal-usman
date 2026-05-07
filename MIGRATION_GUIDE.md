# Migration Guide — going from "demo" to production

Follow these steps **in order**. Each block is independently safe to roll
back if anything breaks. Estimated total time: 4–6 hours of focused work.

---

## ⚠️ Before you start

Rotate the leaked PocketBase admin password **right now** — `Doniyor123` is
in git history. Even if we delete the script files, the value is in the
commit log. Open `https://145.223.100.16:8090/_/`, go to *Settings →
Admins*, change the password, then commit the change here.

---

## Step 1 — Install new npm dependencies

```bash
cd /Users/doniyorabduganiev/kemal-usman/parfum-shop

# Required for the new infra
npm install \
  i18next react-i18next i18next-browser-languagedetector \
  framer-motion \
  @capacitor/haptics @capacitor/preferences \
  dotenv

# Optional but strongly recommended
npm install -D @sentry/react

# Capacitor Android (also see deploy/ANDROID_SETUP.md)
npm install @capacitor/android@^8.3.1
```

---

## Step 2 — Stand up HTTPS backend (one-time, ~30 min)

You need: a domain (`api.kemalusman.kg`), root SSH on `145.223.100.16`.

```bash
# 1) Point DNS A-record api.kemalusman.kg → 145.223.100.16
# 2) On the server:
scp -r deploy/ root@145.223.100.16:/tmp/parfum-deploy
ssh root@145.223.100.16
cd /tmp/parfum-deploy
PUBLIC_DOMAIN=api.kemalusman.kg bash setup-server.sh
# Edit /etc/pocketbase/env to set the new admin password + SMS keys.
nano /etc/pocketbase/env
systemctl restart pocketbase
```

In ~60 seconds Caddy will fetch a Let's Encrypt cert. Verify:

```bash
curl -I https://api.kemalusman.kg/api/health
# Expected: HTTP/2 200
```

---

## Step 3 — Lock down PocketBase rules

This is the script that **replaces** the dangerous `pb-open-all.js`.

```bash
# Edit .env first — set PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
node scripts/pb-secure-rules.js
```

Expected output: `clients: 401`, `orders: 401`, `products: 200` (only
products are publicly listable — and they're admin-write-only).

Now **delete the old leaked-secret scripts**:

```bash
git rm pb-setup.js pb-fix-rules.js pb-open-all.js
git commit -m "security: remove leaked-secret PB scripts (superseded by scripts/pb-secure-rules.js)"
```

---

## Step 4 — Deploy the server-side hooks

```bash
scp -r pb_hooks/ root@145.223.100.16:/opt/pocketbase/
ssh root@145.223.100.16 "chown -R pocketbase:pocketbase /opt/pocketbase/pb_hooks && systemctl restart pocketbase"
```

PocketBase auto-loads all `*.pb.js` files under `pb_hooks/`. Smoke-test:

```bash
# Should return 400 (invalid_phone) — proves the hook is running
curl -X POST https://api.kemalusman.kg/api/custom/otp/request \
  -H "Content-Type: application/json" -d '{"phone":""}'
```

---

## Step 5 — Switch the frontend to OTP auth

The `LoginScreen` in `src/App.jsx` still uses the old "name + phone, no
verification" flow. Replace its `doLogin()` with calls to the new
helpers from `src/api/auth.js`:

```jsx
import { requestOtp, verifyOtp } from './api/auth';

// Phase 1: collect phone, click "Send code"
async function handleSend() {
  await requestOtp(phone);
  setStep('otp');
}

// Phase 2: collect 6-digit code + name
async function handleVerify() {
  const me = await verifyOtp({ phone, code, name, referredBy: refCode });
  setUser(me);              // pb.authStore now holds the token
  setScreen('catalog');
}
```

Until you migrate, the OLD flow still works — but it does NOT issue a real
auth token, so the new `orders.listRule` will return 401. This is by design
— it forces the migration before you ship.

---

## Step 6 — Move admin login server-side

In `src/App.jsx` find the two places where `settings.adminPassword` is
compared client-side (search for `"admin123"`). Replace with:

```jsx
import { adminLogin } from './api/auth';

const onAdminSubmit = async (email, password) => {
  try {
    await adminLogin(email, password);
    setIsAdmin(true);
    setAdminScreen('orders');
  } catch (e) {
    setAdminLoginErr(t.wrongPassword);
  }
};
```

Now the password lives only in PocketBase admins (bcrypt-hashed) and never
in the client bundle. **Do this before App Store submission.**

---

## Step 7 — Migrate i18n (gradual, screen by screen)

`src/i18n/index.js` is wired up with `react-i18next`. To migrate one
screen at a time without breaking others, wrap `App.jsx` with
`<I18nextProvider>` and replace the existing `LangContext` lookups one by
one:

```jsx
// Old
const { t } = useLang();
<span>{t.cart}</span>

// New
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<span>{t('nav.cart')}</span>
```

The legacy `TRANSLATIONS` object in `App.jsx` still works during the
migration — both systems coexist. Pick one screen per day, replace, ship.

The custom ESLint rule (`eslint-rules/no-hardcoded-cyrillic.js`) catches
new hardcoded strings before they merge.

---

## Step 8 — Move bonus / order math to the server

The PB hooks in `pb_hooks/main.pb.js` already validate orders, recompute
totals, and credit/debit bonuses. Once they're deployed (Step 4), the
client code in `src/App.jsx` that reads/writes
`localStorage.getItem('parfum_bonus_balance')` becomes redundant.

Replace those reads with:

```jsx
import { authedFetch } from './api/pb';
const me = await authedFetch('/api/custom/me');
setBonusBalance(me.bonusBalance);
```

Delete every `setBonusBalance(p => p + …)` and
`setBonusHistory(p => […])` line — the server is now the source of truth.

---

## Step 9 — Mobile prep

- iOS: edit `ios/App/App/Info.plist` per `deploy/INFO_PLIST_PATCH.md`.
- Android: follow `deploy/ANDROID_SETUP.md` (run `npx cap add android`).

---

## Step 10 — Ship

```bash
# Production build with HTTPS backend baked in
VITE_PB_URL=https://api.kemalusman.kg npm run build
npx cap sync ios && npx cap open ios       # Archive in Xcode → upload to App Store
npx cap sync android && cd android && ./gradlew bundleRelease  # Upload AAB to Play Console
```

---

## Roll-back plan

Every change above is reversible:

| Change | How to revert |
|---|---|
| Caddy + HTTPS | `systemctl stop caddy` — frontend reverts to HTTP fallback in `pb.js` |
| Locked rules | Re-run `pb-open-all.js` from a backup branch (don't) |
| PB hooks | Delete `pb_hooks/*.pb.js`, restart PB |
| OTP auth | Frontend keeps old `LoginScreen`, just switch import |
| i18n | Each screen migrates independently — partial is fine |
| Server-side bonuses | Hooks coexist with client logic; delete client logic last |
