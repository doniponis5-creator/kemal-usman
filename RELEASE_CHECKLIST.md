# Kemal Usman Parfum — Release Checklist

## Before every App Store submission

### 1. Automated check

```bash
npm run release
# → npm run build && npx cap sync ios && npm run prerelease
```

If any line is ❌, fix it before going further.

---

### 2. Server (manual, run on the VPS)

- [ ] Caddy running, HTTPS live
       `curl https://api.kemalusman.kg/api/health` → `{"code":200,...}`
- [ ] PB rules locked
       `npm run pb:lock` → all green
- [ ] Order validation hook live
       `npm run pb:verify-orders` → all passed
- [ ] `GREEN_API_INSTANCE` + `GREEN_API_TOKEN` set in systemd unit (PB process env)
- [ ] `SMS_PROVIDER` + provider creds set in systemd
- [ ] PocketBase superuser password rotated (not the install default)
- [ ] `pb_hooks/` deployed to the host and PB restarted

---

### 3. Xcode

- [ ] Open `ios/App/App.xcworkspace` (the `.xcworkspace`, NOT `.xcodeproj`)
- [ ] Signing & Capabilities: Team selected, provisioning profile auto-managed
- [ ] Bundle ID: `kg.kemalusman.parfum`
- [ ] Version: `1.0.0`  Build: `1` (bump build by 1 for every upload)
- [ ] Active scheme: `App`, Device target: **Any iOS Device (arm64)**
- [ ] Product → Clean Build Folder (`⇧⌘K`)
- [ ] Product → Archive
- [ ] Distribute → App Store Connect → Upload

---

### 4. App Store Connect

- [ ] App name: `Kemal Usman`
- [ ] Subtitle: `Парфюмерия и ароматы`
- [ ] Primary category: Shopping
- [ ] Age rating: 4+
- [ ] Privacy policy URL: required (host a one-pager — Notion/Vercel free is fine)
- [ ] Screenshots: 6.7" (iPhone 17 Pro Max) and 6.1" (iPhone 17) sets
- [ ] App description (RU)
- [ ] Keywords: `парфюм, духи, атыр, аромат, Кыргызстан, Бишкек`
- [ ] Support URL (a contact page or `https://wa.me/996...`)

---

### 5. TestFlight (before public release)

- [ ] Internal test build installs cleanly on your iPhone
- [ ] OTP login with a real phone number — SMS arrives
- [ ] Browse catalog, open product detail, audio player works
- [ ] Add to cart, checkout completes
- [ ] Admin login with a PB superuser account
- [ ] Admin add/edit a product with images — saves and shows up
- [ ] WhatsApp notification arrives on a test order
- [ ] Switch to KG language — UI translates, OTP still works
- [ ] Switch back to RU language

---

## Version increment guide

| Change | Marketing version | Build |
|---|---|---|
| Bug fix | 1.0.0 → 1.0.1 | +1 |
| New feature | 1.0.0 → 1.1.0 | +1 |
| Major redesign | 1.0.0 → 2.0.0 | +1 |
| Re-upload after rejection | unchanged | +1 |

Build number must increase **every** upload, even rejected ones — App Store
Connect refuses duplicates.

---

## What "✅ Task 1-8" of the audit covered

| Task | Done | Where |
|---|---|---|
| 1. Real auth | ✓ | OTP via `pb_hooks/otp.pb.js`, admin via `pb.admins.authWithPassword`. No more `admin123`. |
| 2. WhatsApp server-side | ✓ | `pb_hooks/whatsapp.pb.js`. Tokens in PB env, never client. |
| 3. HTTPS + ATS | ✓ | `.env` → HTTPS, Info.plist `NSAllowsArbitraryLoads = false`, per-domain exceptions. |
| 4. PB rules | ✓ | `npm run pb:lock` applies + verifies; clients/orders/otp_codes private. |
| 5. Order totals | ✓ | Existing `pb_hooks/main.pb.js` recomputes; `npm run pb:verify-orders` confirms. |
| 6. Console + Sentry | ✓ | Terser strips log/info/debug; Sentry in `src/utils/sentry.js`. |
| 7. Bundle splitting | ✓ | App chunk -31% (393K → 272K). framer-motion own chunk. |
| 8. App Store prep | ✓ | This document. |

---

## Final command sequence

```bash
# On the VPS, one time per deploy of pb_hooks/:
npm run pb:lock                 # apply + verify rules
npm run pb:verify-orders        # confirm hook is live

# Every release, on dev machine:
npm run release                 # build + sync iOS + run all checks
# Then in Xcode: Product → Archive → Distribute
```
