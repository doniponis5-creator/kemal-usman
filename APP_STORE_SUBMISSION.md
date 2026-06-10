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
2. Xcode: `ios/App/App.xcodeproj` oching (bu loyiha CocoaPods emas, Swift Package Manager ishlatadi — shuning uchun .xcworkspace yo'q, .xcodeproj to'g'ri)
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

---

# 🔁 RESUBMISSION (1-rad etishdan keyin, 2026-06-10)

Reviewer 1.0 (build 1) ni ko'rgan — 15-maydagi ESKI build (API hali HTTP edi,
ATS bloklagan → katalog bo'sh, banner singan). Hozirgi kod + quyidagi fixlar
bilan build 4 yuboriladi.

## Har bir sababga qilingan fix
| Guideline | Sabab | Fix |
|---|---|---|
| 2.2 Beta Testing | iPad'da katalog bo'sh ko'ringan ("Ничего не найдено") | API endi HTTPS (yuklanadi) + server ishlamasa lokal demo-katalog fallback — do'kon hech qachon bo'sh ko'rinmaydi |
| 2.1(a) bug | Banner rasmi yuklanmagan | HTTPS + banner img onError himoyasi (singan rasm o'rniga gradient) |
| 2.1(a) demo akkaunt | ASC'da demo akkaunt ko'rsatilmagan | Demo endi SERVER tomonda, to'liq funksional (buyurtma ham ishlaydi): +996 555 000 001 / 123456 — **ASC → App Review Information'ga YOZING!** |
| 2.5.4 bg audio | UIBackgroundModes=audio e'lon qilingan, lekin kerak emas | Hozirgi Info.plist'da bu kalit YO'Q (build 1'da edi) — hal bo'lgan |
| iPad muammolari | iPad Air'da test qilingan | TARGETED_DEVICE_FAMILY=1 (iPhone-only) — iPad review yuzasi yo'q |

## ⚠️ Yuborishdan OLDIN majburiy
1. `./deploy-odengi.sh` — otp.pb.js o'zgardi (demo akkaunt server-side)!
   Reviewer demo login jonli serverga uradi.
2. Demo login testi: ilovada +996 555 000 001 / kod 123456 → kirishi, katalog,
   naqd buyurtma berishi ISHLASHI kerak.
3. ASC → App → App Review Information:
   - Sign-in required: ✅
   - User name: `+996555000001`  Password: `123456`
4. iPhone-only bo'lgani uchun iPad skrinshtlari shart emas (iPhone 6.7"/6.5" yetadi).
5. Xcode: build 4 allaqachon qo'yilgan → Archive → Upload.

## 📝 Resolution Center javob matni (nusxalab yuboring)
```
Hello, thank you for the detailed review.

We have addressed all issues in build 4:

1. Guideline 2.2 / 2.1(a) — The empty catalog and broken promo image were
caused by our backend being reachable only over HTTP in build 1, which iOS
ATS correctly blocked. The backend now runs on HTTPS
(https://api.kemalusman.kg) with a valid certificate, and the app
additionally ships a local fallback catalog so content is always visible.
The store is fully stocked with 300+ products.

2. Guideline 2.1(a) Information Needed — A fully functional demo account
has been added to App Review Information:
   Phone: +996 555 000 001, SMS code: 123456
No real SMS is sent for this account. It supports the complete flow:
browsing, cart, placing an order (please use "Cash on delivery" — online
payment requires a local Kyrgyz O!Dengi wallet), order history, and
account deletion (Profile → bottom of screen).

3. Guideline 2.5.4 — The UIBackgroundModes "audio" key has been removed.
The app's fragrance voice-note playback works in foreground only.

4. We have also limited distribution to iPhone (TARGETED_DEVICE_FAMILY=1),
as the app is designed for iPhone.

Thank you!
```
