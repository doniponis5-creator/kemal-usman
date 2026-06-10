# 🔐 XAVFSIZLIK TUZATISHLARI — Deploy Yo'riqnomasi
**Sana:** 2026-06-10 · Ushbu fayl P0 (kritik) tuzatishlarni serverga chiqarish tartibini tushuntiradi.
**Tartibni buzmang** — qadamlar ketma-ketligi muhim.

---

## NIMA TUZATILDI (kodda — allaqachon tayyor ✅)

| # | Muammo | Tuzatish |
|---|---|---|
| 1 | To'lov webhook'i imzosiz so'rovni qabul qilib, buyurtmani "to'langan" qilardi | Endi hash MAJBURIY — noto'g'ri/yo'q hash = 403 rad |
| 2 | Webhook summani tekshirmasdi | Endi amount (tiyin) + valyuta buyurtma bilan solishtiriladi |
| 3 | O!Dengi SID + parol kodga yozilgan edi (git'da oqib ketgan) | Endi faqat server muhitidan (`ODENGI_SID`, `ODENGI_PASSWORD`) o'qiladi |
| 4 | `settings` kolleksiyasi ochiq, ichida to'lov paroli turardi | Hook endi settings'dan o'qimaydi + maydonlarni o'chiruvchi skript tayyor |
| 5 | Debug endpointlar production'da ochiq edi | `debug_odengi.pb.js`, `debug_variant.pb.js`, `main.pb.js.bak` o'chirildi |
| 6 | To'lov endpointlari autentifikatsiyasiz edi | Endi PB token + buyurtma egaligi tekshiriladi (admin ham o'tadi) |
| 7 | `.env`da real admin parol turardi | Placeholder bilan almashtirildi — yangi parol qo'yish kerak (quyida) |

O'zgartirilgan fayllar: `pb_hooks/odengi.pb.js` (v4), `src/api/odengi.js`,
`scripts/pb-remove-odengi-secrets.js` (yangi), `deploy-odengi.sh` (v2),
`.env`, `.env.example`, `package.json`.

---

## ⚠️ SIZ QILISHINGIZ SHART BO'LGAN QADAMLAR

### 1-QADAM. O!Dengi merchant parolini almashtiring (ENG MUHIM!)
Eski parol (`ER@L...`) git tarixida yotibdi — **oqib ketgan deb hisoblanadi**.
O!Dengi merchant kabinetiga kiring (yoki ularning qo'llab-quvvatlash xizmatiga
murojaat qiling) va **API parolini yangilang**. Yangi parolni hech qayerga
commit qilmang — faqat 2-qadamdagi server fayliga yozasiz.

### 2-QADAM. Serverga yangi parollarni joylashtiring
Terminalda:
```bash
ssh root@145.223.100.16
mkdir -p /etc/pocketbase
nano /etc/pocketbase/env
```
Fayl ichiga (o'z qiymatlaringiz bilan):
```
ODENGI_SID=5084412514
ODENGI_PASSWORD=YANGI_ROTATSIYA_QILINGAN_PAROL
GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
```
Saqlang (Ctrl+O, Enter, Ctrl+X). So'ng faylni faqat root o'qiy oladigan qiling:
```bash
chmod 600 /etc/pocketbase/env
```

**PocketBase systemd orqali ishlayotgan bo'lsa** — unit faylda
`EnvironmentFile=/etc/pocketbase/env` borligini tekshiring
(`deploy/pocketbase.service` namunasida bor), keyin:
```bash
systemctl daemon-reload && systemctl restart pocketbase
```

**PocketBase qo'lda (nohup) ishlayotgan bo'lsa** — restart oldidan env yuklang:
```bash
pkill pocketbase
set -a; . /etc/pocketbase/env; set +a
cd /root/pb && nohup ./pocketbase serve --http 127.0.0.1:8091 >/dev/null 2>&1 &
```

### 3-QADAM. PocketBase admin parolini almashtiring
1. Brauzerda oching: `https://api.kemalusman.kg/_/`
2. Eski email/parol bilan kiring → Settings → Admins → parolni yangilang.
   Yangi parol: kamida 16 belgi, parol menejerda saqlang.
3. Mac'dagi `parfum-shop/.env` faylida `PB_ADMIN_PASS=SHU_YERGA_YANGI_PAROL`
   o'rniga yangi parolni yozing (bu fayl git'ga tushmaydi).

### 4-QADAM. Deploy qiling
Mac'da, `parfum-shop` papkasida:
```bash
./deploy-odengi.sh
```
Skript o'zi: server env'ni tekshiradi → hook'larni yuklaydi → build qiladi →
frontend'ni yuklaydi → PB'ni restart qiladi → **webhook himoyasini avtomatik
test qiladi** (oxirida `✅ Unsigned webhook rejected` chiqishi kerak).

### 5-QADAM. Settings'dagi eski parollarni o'chiring
```bash
npm run pb:remove-odengi-secrets
```
`✅ VERIFIED` chiqsa — ochiq API orqali parol ko'rinmaydigan bo'ldi.

### 6-QADAM. Haqiqiy to'lov bilan test
1. Ilovada arzon mahsulot bilan buyurtma yarating → "Онлайн оплата" → to'lang.
2. Parallel terminalda loglarni kuzating:
```bash
ssh root@145.223.100.16 'journalctl -u pocketbase -f | grep odengi'
```
3. Kutilgan natija: `odengi_wh_paid` logi + buyurtma statusi "confirmed".

**Agar** logda `odengi_wh_rejected_bad_hash` chiqsa-yu to'lov baribir
tasdiqlangan bo'lsa — bu polling (check-status) orqali tasdiqlangani, ya'ni
to'lovlar ishlayapti, lekin O!Dengi hash formulasi farq qilyapti. Bu holda
log'dagi `got`/`want` qiymatlarini menga ko'rsating — formulani moslab beraman.

---

## TEXNIK ESLATMALAR

- **Fail-closed:** `ODENGI_SID`/`ODENGI_PASSWORD` env'da bo'lmasa, to'lov
  endpointlari 503 `payment_not_configured` qaytaradi — pul yo'qolmaydi,
  shunchaki onlayn to'lov o'chiq turadi (naqd ishlayveradi).
- **Apple Review demo akkaunt** (`+996555000001`) soxta token ishlatadi —
  endi onlayn to'lov unga 401 beradi. Bu to'g'ri: reviewer naqd usulni tanlaydi.
- **API kontraktlar o'zgarmagan:** endpoint manzillari va javob shakllari
  avvalgidek — frontend'ning boshqa joylariga ta'sir yo'q.
- Git tarixida eski parollar qolgan — repo'ni public qilishdan OLDIN
  `git filter-repo` bilan tozalash yoki yangi repo ochish kerak (P1 vazifa).

---

## ✚ QO'SHIMCHA (P1/P2 bosqichi — 2026-06-10, ikkinchi sessiya)

Yana tuzatildi:
| # | Muammo | Tuzatish |
|---|---|---|
| 8 | otp.pb.js snake_case maydonlarga yozardi (sxema camelCase) — referral tizimi ishlamasdi | otp.pb.js v2: camelCase; bonuslar endi faqat birinchi yetkazib berishda (main.pb.js dizayni) |
| 9 | OTP kodi Math.random() bilan | $security crypto-random (fallback bilan) |
| 10 | #admin hash + oddiy mijoz tokeni bilan admin panel ochilardi | Faqat haqiqiy admin token; localStorage bypass o'chirildi |
| 11 | Admin paroli localStorage'da ochiq saqlanardi ("eslab qolish") | Endi faqat email eslab qolinadi |
| 12 | ios/build (3,487 fayl) git'da, venv 363MB, .bak/.broken/debug fayllar | Tozalandi; bir martalik skriptlar tools/ ga; puppeteer devDeps |
| 13 | WhatsApp endpoint'da rate-limit yo'q | 20 ta xabar / 10 daqiqa / foydalanuvchi |
| 14 | Audio fade setInterval to'planishi | _fadeTimer cleanup |

**5-QADAMdan keyin yana bitta buyruq:**
```bash
npm run pb:fix-bonus-fields
```
Bu `clients` sxemasini tekshiradi, kerak bo'lsa camelCase maydonlarni qo'shadi
va eski snake_case maydonlardagi ma'lumotni ko'chiradi (hech narsa o'chirilmaydi).

**6-QADAMdan keyin — avtomatik acceptance test:**
```bash
./scripts/test-security.sh
```
Hammasi ✅ bo'lsa — P0 acceptance rasman o'tdi.

**Demo akkaunt:** App Store approval'dan keyin `.env.production`ga
`VITE_DEMO_ACCOUNT=off` qo'shib qayta build qilsangiz, demo kirish o'chadi.

**Sentry (P1.5):** sentry.io'da bepul akkaunt oching → React loyiha yarating →
DSN'ni `.env.production`dagi `VITE_SENTRY_DSN=` ga qo'ying → qayta build.
Kod allaqachon tayyor, faqat DSN yetishmayapti.

---

## ✚ UCHINCHI SESSIYA (P1.6 + P2.1 + P2.2)

| # | Ish | Natija |
|---|---|---|
| 15 | i18n birlashtirildi | 240 qatorlik inline lug'at → `src/i18n/strings-ru.json` / `strings-kg.json` (yagona manba, kg 100% to'liq — 203/203 kalit). O'lik nested ru/kg/ky.json o'chirildi |
| 16 | ProductCard memoizatsiya | Katalogda 100+ karta endi keraksiz qayta render bo'lmaydi |
| 17 | Pul logikasiga 8 ta integration test | `npm run test:money` — narx tamper, bonus overflow, debit, welcome dublikat va h.k. |

**Deploy'dan keyin test tartibi:**
```bash
npm run test:security   # P0 acceptance (curl)
npm run test:money      # pul logikasi (8 test, +996700009999 ga yozadi va o'chiradi)
```

**Qasddan keyinga qoldirilgan** (jonli test talab qiladi, alohida sessiyada):
App.jsx'ni to'liq fayllarga bo'lish (P2.1 full), Sentry DSN (siz olishingiz kerak).
