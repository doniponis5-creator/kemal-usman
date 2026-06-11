# HANDOFF — Kemal Usman parfum-shop (yangi chat uchun kontekst)
**Oxirgi yangilanish:** 2026-06-11

Bu fayl yangi suhbatga loyiha holatini bir o'qishda tushuntirish uchun. Senior
muhandis sifatida shu kontekstdan davom et.

---

## STACK (HAQIQIY — hujjatlardagi "SwiftUI" XATO)
- **Frontend:** React 19 + Vite 8, butun ilova `src/App.jsx`da (~7,400 qator) + ajratilgan modullar
- **Mobil:** Capacitor 8 -> iOS (`.xcodeproj`, SPM — CocoaPods EMAS, `.xcworkspace` yo'q)
- **Backend:** PocketBase **v0.22** (ESKI!), VPS `145.223.100.16`, domen `https://api.kemalusman.kg`
- **To'lov:** O!Dengi (Kirgiz), **WhatsApp:** Green API (OTP + buyurtma xabarlari)
- Frontend serverda `/var/www/parfum`, hooks `/root/parfum-backend/pb_hooks`, Cloudflare oldida

## SERVER HAQIDA 4 TA HAYOTIY MUHIM HAQIQAT
1. **clients sxemasi snake_case:** `bonus_balance, bonus_history, referral_code, referred_by`.
   camelCase yozish JIM no-op bo'ladi. Hook'lar shunga moslangan (`pb_hooks/main.pb.js`, `otp.pb.js`).
2. **PB JSVM JsonRaw tuzog'i:** JSON maydonlar Go bayt-massivi bo'lib keladi. To'g'ridan
   `.push()` qilsang goja sinadi va server 500'ga QOTADI. Har doim: `String(raw)` -> `JSON.parse`,
   yozishda `JSON.stringify`.
3. **Legacy admin auth:** PB 0.22 `/api/admins/auth-with-password` ishlatadi. Skriptlarda
   avval shu endpoint, keyin SDK fallback (barcha `scripts/*.js`da bor).
4. **orders/reviews'da relation yo'q:** egalik `clientPhone`/`@request.auth.phone` orqali
   (`client` maydoni mavjud EMAS — qoidalarda ishlatma).

## DEPLOY (har o'zgarishdan keyin)
```bash
./deploy-odengi.sh          # kredensial fayl + hooks + build + frontend + PB restart + smoke-test
# Cloudflare -> Caching -> Purge Everything (MAJBURIY)
```
Diagnostika: admin panel -> Настройки -> **Проверка системы** (5 ta belgi).
Testlar: `npm run test:security` (8/8), `npm run test:money` (8/8).
Migratsiya skriptlari (bir martalik, bajarilgan): `pb:ensure-settings`, `pb-secure-rules.js`.

## SANDBOX'DA `npm install`/`npm audit fix` ISHLATMA
node_modules Mac bilan umumiy — Linux sandbox'da o'rnatish darwin binarlarini buzadi.
Build-tekshiruvni faqat izolyatsiya muhitida qil, foydalanuvchi fayllariga tegma.

## BAJARILGAN (2026-06-10/11, hammasi commit + deploy qilingan)
- P0 xavfsizlik: webhook imzo majburiy + amount check, O!Dengi creds env/pb_data, debug hooks
  o'chirildi, to'lov endpointlariga auth, settings'dan sirlar
- Bonus tizimi TIRILDI (snake_case fix) — test:money 8/8, tarixda birinchi marta ishlaydi
- Barcha 8 PB kolleksiya qulflangan (pb-secure-rules)
- App.jsx refactor: 15,905 -> 7,400 qator, lazy admin/desktop chunklar, bundle 614->288KB
- i18n birlashtirildi (strings-ru/kg.json), ProductCard memo, dizayn (banner crossfade/Ken Burns,
  rang konsolidatsiya), reduced-motion
- Admin: real-time yangi buyurtma (ovoz+toast), draft-autosave, diagnostika, online-payment toggle
- Bildirishnomalar: mahsulot deeplink (`?product=`), xavfsiz mark-read hook
- Frontend fixlar: order double-submit guard, "yolg'on muvaffaqiyat" fix, to'lovni davom ettirish,
  offline kesh, admin reload bug (legacy token), guest mode persist
- Hardening: CSP + nosniff, DoS input cheklovlari, npm audit 0
- App Store: build 4, iPhone-only, server-side demo akkaunt (+996555000001/123456),
  delete-account (5.1.1v), submission guide + Resolution Center javob matni

## FOYDALANUVCHI QILISHI SHART (kod bilan bo'lmaydi)
1. **O!Dengi merchant parolini ROTATE** — git tarixiga oqqan (`.env`dagi ODENGI_PASSWORD ham yangila)
2. **Green API token ROTATE** — admin bundle'ga oqqan edi
3. **PB admin parol** kuchli qilish (16+ belgi)
4. **App Store resubmit:** Xcode -> `ios/App/App.xcodeproj` -> Archive -> Upload ->
   ASC App Review Information'ga demo akkaunt -> Resolution Center'ga `APP_STORE_SUBMISSION.md` javobi
5. Caddy rate-limit moduli o'rnatilganini tasdiqlash (`deploy/Caddyfile` izohi)
6. Sentry DSN (`.env.production` `VITE_SENTRY_DSN=`) — ixtiyoriy, crash monitoring

## MUHIM HUJJATLAR
- `SECURITY_FIX_README.md` — P0/P1 deploy yo'riqnomasi
- `SECURITY_HARDENING.md` — to'liq himoya xaritasi
- `APP_STORE_SUBMISSION.md` — submission + reviewer javobi
- `CLAUDE.md` — kod tuzilishi va qoidalar

## ISHCHI USLUB (foydalanuvchi afzal ko'radi)
O'zbek tilida muloqot. Kod birinchi, izoh keyin. Har o'zgarishda: build + `eslint no-undef` 0.
Logikani buzma, sof mexanik ko'chirish. Deploy'ni foydalanuvchi o'zi qiladi, natijani ko'rsatadi.
Parol/tokenlarni kodga yozma — faqat env/pb_data. Mayda buglarni proaktiv qidirib tuzat.
