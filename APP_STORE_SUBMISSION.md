# App Store Submission — Tayyor Holat (2026-06-10)

## ✅ Tekshirilgan va tayyor
| Talab | Holat |
|---|---|
| ATS (HTTPS only) | ✅ NSAllowsArbitraryLoads=false |
| PrivacyInfo.xcprivacy | ✅ phone/name/purchase-history e'lon qilingan, tracking=false, UserDefaults CA92.1 |
| Permission stringlari | ✅ 4 tasi ham real ishlatiladi (mikrofon=audio yozish, kamera/galereya=mahsulot foto, lokatsiya=yetkazish manzili) |
| Privacy Policy URL | ✅ https://kemalusman.kg/privacy.html (legal/ papkada RU hujjatlar) |
| **Akkaunt o'chirish (5.1.1v)** | ✅ **Endi bor** — Profil ekrani pastida "Удалить аккаунт" (server: PII purge) |
| IAP talab qilinmaydi (3.1.1) | ✅ Jismoniy tovar (atir) — tashqi to'lov (O!Dengi/naqd) ruxsat etiladi |
| Demo akkaunt (review uchun) | ✅ +996 555 000 001 / kod: 123456 |
| Versiya | MARKETING_VERSION=1.0, build=3 → **Archive'dan oldin build raqamini oshiring** |

## 📋 Sizning qadamlar (Xcode'da)
1. `npm run build && npx cap sync ios` (men qilib qo'ydim — dist ichkarida yangi)
2. Xcode: `ios/App/App.xcworkspace` oching (xcodeproj emas!)
3. Signing & Capabilities → Team tanlang
4. CURRENT_PROJECT_VERSION → 4 (yoki keyingisi)
5. Real iPhone'da test: login → katalog → savat → naqd buyurtma → profil → **akkaunt o'chirish tugmasi ko'rinishini tekshiring**
6. Product → Archive → Distribute → App Store Connect

## 📝 App Review Notes (ASC'ga shuni joylang — ingliz tilida)
```
DEMO ACCOUNT FOR REVIEW:
Phone: +996 555 000 001
SMS code: 123456
(This is a dedicated review account — no real SMS is sent.)

PAYMENT TESTING: This app sells physical goods (perfume) in Kyrgyzstan.
Online payment uses O!Dengi, a local Kyrgyz payment provider, and only
works with Kyrgyz bank accounts. For review purposes please use the
"Cash on delivery" payment option, which completes the full order flow.

ACCOUNT DELETION: Profile tab → scroll to bottom → "Удалить аккаунт"
(Delete account). Personal data is purged server-side.

NATIVE FEATURES (beyond web wrapper): haptic feedback, local push
notifications for order status, native audio recording/playback for
fragrance voice notes, splash screen, status bar integration, native
keyboard handling, offline cart persistence.
```

## ⚠️ Mumkin bo'lgan savollar
- **4.2 Minimum functionality** — yuqoridagi "native features" ro'yxati javob bo'ladi. Rad etilsa: Resolution Center'da shu ro'yxatni yuboring, ko'pincha o'tadi.
- O'zbek/rus interfeysi — muammo emas, Apple lokal bozorlarni qabul qiladi.
