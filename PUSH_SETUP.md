# Push Notifications — Deploy & Ishlatish qo'llanmasi (OneSignal)

App yopiq / svernut / ekran qulflangan bo'lsa ham keladigan native push.
Admin panelдан ("Уведомления" → **Всем** → 🔔 **Push**) yuboriladi.

- **OneSignal App ID:** `4cdb1d97-6eed-428c-bead-901fd6069d55` (maxfiy emas, `.env`да)
- **REST API Key:** `os_v2_app_...` — **maxfiy!** faqat **serverда** (env), kodда emas.
- **Server:** `root@145.223.100.16`, PB katalogi `/root/parfum-backend`, service `pocketbase`

---

## Nima allaqachon qilingan (kod)

- `src/api/onesignal.js` — qurilmani ro'yxatga oladi, ruxsat so'raydi, user'ga bog'laydi (`external_id = telefon`), bosilганда ekranga o'tadi. `sendPushBroadcast()`.
- `src/App.jsx` — ochilishда init, login/logout'да user link.
- `src/screens/AdminScreens.jsx` — "Уведомления"да **Push toggle** (Всем uchun). Xabar yuborilганда native push ham ketadi.
- `pb_hooks/push.pb.js` — server route `POST /api/custom/push/send` (faqat admin) → OneSignal REST API (`Key` auth, `api.onesignal.com`).
- `Info.plist` — `UIBackgroundModes = remote-notification`. Xcode'да **Push Notifications** capability qo'shilган.
- `.env` / `.env.production` — `VITE_ONESIGNAL_APP_ID`.

---

## Bir martalik server sozlash

> ⚠️ **`./deploy-odengi.sh` ни ishlatMANG** — u `--delete` bilan hamma narsani sync qiladi (odengi'ga ta'sir qilishi mumkin). Quyidagi buyruqlar **faqat kerakli narsaga** tegadi.

### 1. REST API Key'ни env'ga qo'yish

OneSignal → **Settings → Keys & IDs** → **REST API Key** (`os_v2_app_...`) nusxa oling.
Mac terminalда (`<SIZNING_KEY>` o'rniga qo'ying):

```bash
ssh root@145.223.100.16 "mkdir -p /etc/systemd/system/pocketbase.service.d && printf '[Service]\nEnvironment=\"ONESIGNAL_REST_API_KEY=<SIZNING_KEY>\"\n' > /etc/systemd/system/pocketbase.service.d/onesignal.conf && systemctl daemon-reload && systemctl restart pocketbase && echo DONE"
```

`DONE` chiqsa ✅

### 2. Hook'ни serverга yuklash (faqat push.pb.js — xavfsiz)

```bash
scp pb_hooks/push.pb.js root@145.223.100.16:/root/parfum-backend/pb_hooks/push.pb.js && ssh root@145.223.100.16 "systemctl restart pocketbase && echo DONE"
```

Bu **bitta** fayl qo'shadi + PB restart qiladi. odengi / whatsapp / main / dist — tegilmaydi ✅

### 3. App'ни yangilash (admin Push toggle uchun)

```bash
npm run build && npx cap sync ios && npx cap open ios
```

Xcode'да ▶️ Run.

---

## Test qilish

1. **Haqiqiy iPhone**да app'ни ishga tushiring (simulyator emas).
2. Ruxsat bering (bildirishnoma so'raydi).
3. Tekshiring: OneSignal → **Audience → Subscriptions** ≥ 1 bo'lsin.
4. Admin panel → **Уведомления** → **Всем** → 🔔 **Push** yoqing → sarlavha+matn → **Yubor**.
5. App'ни **yoping** → banner kelishi kerak 🔔

---

## REST API Key'ни yangilash (agar screenshot'да ko'ringan bo'lsa yoki xato)

1. OneSignal → Settings → Keys & IDs → **New API Key** → **Copy To Clipboard**.
2. Yuqoridagi **1-qadam** buyrug'ини yangi kalit bilan qayta ishga tushiring.
3. Eski kalitни OneSignal'да **o'chiring (revoke)**.

---

## Troubleshooting

| Belgi | Sabab / yechim |
|---|---|
| Admin'да push yuborsam "unauthorized" | REST API Key noto'g'ri/eski → 1-qadamni yangi kalit bilan qayta bajaring |
| "onesignal_not_configured" | Serverда `ONESIGNAL_REST_API_KEY` env yo'q → 1-qadam |
| Push kelmayapti, xato yo'q | Obunachi yo'q (0) → iPhone'да app'ни ochib ruxsat bering; yoki APNs kalit OneSignal'да noto'g'ri |
| Faqat "Всем"да Push chiqadi | To'g'ri — push hozir hammaga broadcast. Bitta userga — keyingi versiyada |
| Server log ko'rish | `ssh root@145.223.100.16 "journalctl -u pocketbase -f \| grep push"` |

---

## Eslatma
- App push **bo'lmasa ham to'liq ishlaydi** — bu qo'shimcha imkoniyat.
- REST API Key **hech qachon** React/`.env`/GitHub'ga qo'yilmaydi — faqat server env.
- OneSignal App ID (`4cdb1d97-...`) — maxfiy emas, `.env`да bo'lishi normal.
