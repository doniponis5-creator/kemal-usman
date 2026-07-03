# CURSOR_TASK_16 — Deploy v1.3 (App Store + VPS)

> Konteks: v1.3 "iOS PRO Design Polish" relizi. Barcha kod o'zgarishlari TAYYOR va
> verifikatsiyadan o'tgan (bundle 0 xato). Versiya allaqachon bump qilingan:
> MARKETING_VERSION 1.3, CURRENT_PROJECT_VERSION 8 (project.pbxproj).
> Bu hujjat FAQAT deploy jarayoni. Kod yozish/o'zgartirish KERAK EMAS.

## Nima o'zgargan (commit message va release notes uchun)

- Motion tokenlari yagonalashtirildi (iosEase/iosSpring/DUR), 15 ad-hoc bezier olib tashlandi
- Rang tokenlari: T.warning/successIOS/gold/gray, 80+ hardcoded hex almashtirildi (dark mode fix)
- Radius shkalasi (R), kapsulalar 999
- Universal BottomSheet: grabber + blur + spring + drag-to-dismiss (SortFilter/Confirm/Notif sheetlar migratsiya)
- Checkout "signature moment": chek-mark path-draw + success haptic (OrderSuccessGate)
- Login OTP: 6 katak (yashirin input, SMS autofill saqlangan), tugma spinnerlari, xato shake
- BannerSlider: touch swipe, avto-pauza, Ken Burns alternate, 44px dot hit-area
- FloatingCartPill monoxrom restyle
- Status chiplar iOS tinted-fill
- Splash: oq minimal + "Kemal Usman / PARFUM" harf-tracking intro (index.html + main.jsx)
- Native tab bar intro tugagach katalog bilan birga chiqadi (Swift: syncTab 'intro' → .hidden)
- Perf: o'lik blur(44px) qatlam olib tashlandi, EdgeSwipeBack willChange, tab crossfade
- Swift: tab bar haptic olib tashlandi (Apple standarti)
- index.css: Vite template qoldiqlari tozalandi, :focus-visible qo'shildi

## QADAM 1 — Commit

```bash
cd ~/Проекты/kemal-usman/parfum-shop
git add -A
git commit -m "feat(design): iOS PRO polish v1.3 — motion tokens, sheets, OTP cells, splash intro, perf"
```

## QADAM 2 — Web deploy (VPS)

```bash
./deploy.sh
```

Bu `npm run build` + `rsync dist/ → root@145.223.100.16:/var/www/parfum/` qiladi.

Tekshirish: https://kemalusman.kg ochilsin, katalog ko'rinsin, birinchi ochilishda
"Kemal Usman / PARFUM" intro chiqsin (sessiyada bir marta).

DIQQAT: `pb_hooks/_lib/sms.js` da lokal o'zgarish bor. Agar u serverda kerak bo'lsa:
pb_hooks/ ni VPS'ga ko'chir va PocketBase'ni restart qil. Server checklist:
RELEASE_CHECKLIST.md → "2. Server" bo'limi (health check, pb:lock, pb:verify-orders).

## QADAM 3 — App Store

### 3.1 Pre-release tekshiruv

```bash
npm run release
# = npm run build && npx cap sync ios && npm run prerelease
```

HAMMA qator ✅ bo'lishi shart. ❌ bo'lsa — to'xta, xatoni o'qi, hal qilmasdan davom etma.

### 3.2 Xcode Archive

1. `npx cap open ios`
2. Agar "Missing package product Capacitor/Cordova/OneSignal" xatolari chiqsa:
   File → Packages → Reset Package Caches → Resolve Package Versions → kut → ⇧⌘K
3. Tepada target: **Any iOS Device (arm64)**
4. **Product → Archive**
5. Organizer → **Distribute App → App Store Connect → Upload** (default sozlamalar bilan Next-Next)

### 3.3 App Store Connect

1. appstoreconnect.apple.com → My Apps → Kemal Usman
2. Yangi versiya: **1.3**
3. What's New (ruscha, tayyor matn):

```
— Обновлённый дизайн в стиле iOS: плавные анимации и переходы
— Новый экран входа: удобный ввод SMS-кода
— Баннеры теперь листаются свайпом
— Красивая анимация при оформлении заказа
— Тёмная тема стала аккуратнее
— Улучшена плавность и скорость работы
```

4. Build tanlash: **8** (upload'dan keyin 10–30 daqiqada "Processing" tugaydi)
5. **Submit for Review**

## QADAM 4 — Post-deploy tekshiruv

- [ ] Web: kemalusman.kg — intro, katalog, buyurtma oqimi ishlaydi
- [ ] Web: eski keshni tekshir — hard refresh (⌘⇧R) bilan yangi bundle kelsin
- [ ] TestFlight/qurilma: login OTP kataklari, tab bar intro'dan keyin chiqishi,
      saralash sheet drag-to-dismiss, checkout chek-mark, dark mode profil
- [ ] Sentry'da yangi xatolar oqimi yo'qligini kuzat (birinchi 24 soat)

## Muammolar bo'lsa

| Muammo | Yechim |
|--------|--------|
| Archive'da signing xato | Xcode → Signing & Capabilities → Team tanlangan, "Automatically manage signing" yoniq |
| Upload'da "build already exists" | project.pbxproj'da CURRENT_PROJECT_VERSION ni 9 ga ko'tar, qayta Archive |
| deploy.sh SSH permission denied | `ssh root@145.223.100.16` qo'lda ulanib kalitni tekshir |
| Splash eski ko'rinsa | Telefondan appni O'CHIRIB qayta o'rnat (iOS launch-screen keshi) |
| Reviewer rad etsa | Rad sababini shu chatga qaytar — birga hal qilamiz |

## QILMA (muhim!)

- Kod fayllariga TEGMA — hammasi tayyor va tekshirilgan
- node_modules'ni qayta o'rnatMA
- Versiyani qayta bump qilMA (1.3/8 allaqachon qilingan)
- CSP yoki capacitor.config.json'ni o'zgartirMA
