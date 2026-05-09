# CURSOR TASK 14 — Desktop Hero Banner: Admin Settings + Image Fix

## PROBLEM

Desktop web (`kemalusman.kg`) da hero banner faqat qora fon + default
"KEMAL USMAN" matnini ko'rsatmoqda. 3 ta banner dot ko'rinmoqda
(bannerlar DB dan yuklanmoqda), lekin rasmlar chiqmayapti.

Sabab: Admin Banners panelida rasmlar production DB (port 8091) ga
yuklanmagan — faqat matn bor. Bundan tashqari, desktop hero uchun
alohida sozlamalar (subtitle, button text, overlay opacity) yo'q.

---

## ⚠️ QOIDALAR

1. `App.jsx` — bitta fayl, split qilma
2. Inline JS style objects — CSS/Tailwind yozma
3. `T` color tokens ishlatiladi — ranglarni hardcode qilma
4. PocketBase API contract o'zgartirma
5. `npm run build` — 0 error bilan tugashi shart
6. Mobile layout (`< 1024px`) o'zgartirilmasin

---

## CHANGE 1 — AdminBannersScreen ga Desktop Hero Preview qo'sh

`AdminBannersScreen` komponentida banner edit formiga quyidagi
maydonlarni qo'sh (agar mavjud bo'lmasa):

**Yangi maydonlar (settings obyektiga):**
- `heroSubtitle` — string, default: `'Bishkek · Parfum na razliv'`
- `heroButtonText` — string, default: `'ВЫБРАТЬ АРОМАТ'`
- `heroOverlayOpacity` — number 0–1, default: `0.72`

Bu maydonlarni `AdminSettingsScreen` da (Настройки tab) ko'rsat —
Desktop Hero sektsiyasi sarlavhasi ostida:

```
[ Desktop Hero — Subtitle matn         ]  ← input
[ Desktop Hero — Tugma matni           ]  ← input
[ Desktop Hero — Overlay qoralashtirish] ← range 0–1
```

---

## CHANGE 2 — Desktop hero banner image URL ni tekshir va tuzat

`src/App.jsx` — DesktopLayout ichidagi hero banner img src:

**FIND (line ~7051):**
```jsx
src={currentBanner?.collectionId
  ? fileUrl('banners', currentBanner, currentBanner.image)
  : currentBanner?.image}
```

**REPLACE WITH:**
```jsx
src={
  currentBanner?.collectionId && currentBanner?.image
    ? fileUrl('banners', currentBanner, currentBanner.image)
    : currentBanner?.image || null
}
```

Va `<img>` tagiga `onError` qo'sh:
```jsx
onError={e => { e.target.style.display = 'none'; }}
```

---

## CHANGE 3 — Desktop hero da NO banners holatida default ko'rinish

`currentBanner` null bo'lganda (bannerlar yuklanmagan yoki yo'q) —
hozir default matn ko'rinadi. Bu yaxshi. Lekin `activeHeroBanners`
bo'sh bo'lganda dots ko'rinmasligi kerak:

**FIND:**
```jsx
{activeHeroBanners.length > 1 && (
```
Bu to'g'ri — o'zgartirma.

---

## CHANGE 4 — AdminBannersScreen da rasm preview ko'rsat

Banner edit modalida qo'shilgan rasm preview ni ko'rsat:
```jsx
{editBanner?.image && (
  <img
    src={typeof editBanner.image === 'string'
      ? editBanner.image
      : URL.createObjectURL(editBanner.image)}
    style={{ width: '100%', height: 120, objectFit: 'cover',
      borderRadius: 8, marginBottom: 8 }}
    alt="preview"
  />
)}
```

---

## AFTER EDITING

```bash
npm run build
rsync -avz --checksum dist/ root@145.223.100.16:/var/www/parfum/
```

✅ 0 errors — done.

**Test:**
1. Admin → Баннеры → bannerni tahrirlash → rasm yuklash → saqlash
2. `kemalusman.kg` desktop da rasm ko'rinishi kerak
3. Admin → Настройки → Desktop Hero maydonlari ko'rinishi kerak
4. Mobile (`< 1024px`) o'zgarishsiz ishlashi kerak
