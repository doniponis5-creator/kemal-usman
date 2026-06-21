# Capgo Live Updates — sozlash qo'llanmasi (Kemal Usman)

> Maqsad: JS/UI tuzatishlarni **App Store review'siz**, fonda iOS foydalanuvchilarga yetkazish.
> Native kod o'zgarmasa — App Store submit kerak emas. Faqat **birinchi marta** submit shart.

**Capacitor:** 8.3.1 -> `@capgo/capacitor-updater@latest` mos.
**Kod tomonidan tayyor:** `src/main.jsx` ga `notifyAppReady()` qo'shildi (webda no-op).

---

## 0. Talablar
- Mac + Xcode (iOS build uchun)
- Apple Developer akkaunt (App Store Connect)
- Ushbu repo (`parfum-shop`)

---

## 1. Capgo akkaunt + API key
1. https://capgo.app -> ro'yxatdan o'ting (GitHub bilan kirsa bo'ladi).
2. Account -> **API Keys** -> `all` (yoki `upload`) turidagi keyni nusxalang.

---

## 2. Plagin o'rnatish + loyihani ulash (Mac terminalda)
```bash
cd parfum-shop

# Plagin + CLI bitta init buyrug'i bilan: akkaunt, app, kanal, auto-update — hammasi
npx @capgo/cli@latest init <SIZNING_API_KEY>

# Agar init plaginni o'rnatmasa, qo'lda:
npm install @capgo/capacitor-updater@latest
npx cap sync ios
```
`init` quyidagilarni avtomatik qiladi: appni Capgo Cloud'ga qo'shadi, `production` kanal yaratadi, auto-update'ni yoqadi, va `notifyAppReady` ni tekshiradi.

> DIQQAT: `init` `notifyAppReady` ni qo'shishni so'rasa — **skip** qiling: biz uni `src/main.jsx` da allaqachon qo'shganmiz (bitta yetarli).

---

## 3. BIRINCHI App Store submission (bir martalik)
Capgo native plagin bo'lgani uchun, u **birinchi marta** App Store orqali ketishi shart.

```bash
# 1) Web build (loadAll tezlik fix + Capgo shu yerda)
npm run build

# 2) Native'ga sync
npx cap sync ios

# 3) Xcode'da oching
npx cap open ios
```
Xcode'da:
1. **Version** (Marketing Version) va **Build** raqamini oshiring (mas. 1.0.0 -> 1.0.1, build +1).
2. Signing & Capabilities — Team to'g'ri ekanini tekshiring.
3. **Product -> Archive** -> **Distribute App** -> **App Store Connect** -> Upload.
4. App Store Connect'da yangi build'ni **Submit for Review**.

Apple tasdiqlagach (odatda ~1-2 kun) — Capgo faollashadi.

---

## 4. Keyingi update'lar (App Store'SIZ — bir buyruq)
Bundan keyin har bir JS/UI tuzatishda:
```bash
npm run build
npx @capgo/cli@latest bundle upload -c production
```
- Foydalanuvchi appni ochganda update fonda yuklanadi -> keyingi ochilishda qo'llanadi.
- `notifyAppReady()` bo'lgani uchun: agar yangi bundle ishlamasa, Capgo avtomatik avvalgi ishlaydigan versiyaga **qaytaradi** (xavfsiz).

> Qachon yana App Store kerak: native o'zgarishlarda — yangi Capacitor plagin, native kod, ikonka, ruxsatlar (permissions), yoki ilovaning asosiy maqsadi o'zgarsa. Sof JS/CSS/UI — OTA yetarli.

---

## 5. Muhim eslatmalar
- **Tezlik:** OTA app'ni sekinlashtirmaydi — bundle lokal saqlanadi, app lokal fayldan ishlaydi (internetdan emas). Faqat update chiqqanda bir marta fonda yuklab oladi.
- **Apple qoidasi:** OTA JS update'lar ruxsat etilgan (ilovaning asl maqsadini o'zgartirmasa — Guideline 2.5.2 / 3.3.2). Capgo aynan shu uchun mo'ljallangan.
- **Narx:** Capgo Cloud'da bepul tarif bor (cheklangan MAU). Foydalanuvchi ko'paysa pullik tarifga o'tish kerak bo'lishi mumkin — capgo.app/pricing dan tekshiring.
- **Kanal:** `production` — barcha foydalanuvchilar. Test uchun alohida `beta` kanal ochib, faqat o'zingizda sinab ko'rsangiz bo'ladi.

---

## Rollback (kod o'zgarishini orqaga qaytarish)
```bash
cp main.jsx.backup src/main.jsx     # notifyAppReady ni qaytarish
cp App.jsx.backup  src/App.jsx       # loadAll fix ni qaytarish (kerak bo'lsa)
```
