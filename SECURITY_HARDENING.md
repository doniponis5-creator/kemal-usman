# 🛡️ Kemal Usman — Xavfsizlik Holati (2026-06-11)

To'liq hardening yakunidagi himoya xaritasi. Har bir qatlam tekshirildi.

## 1. Pul va to'lov (eng muhim)
- ✅ To'lov webhook'i HMAC imzoni MAJBURIY tekshiradi — soxta "to'landi" mumkin emas
- ✅ Webhook summa + valyutani buyurtma bilan solishtiradi
- ✅ Narx/bonus 100% server tomonda qayta hisoblanadi — mijoz buza olmaydi (test: 8/8)
- ✅ Bonus ikki fazali tranzaksiyada yechiladi (yo'qolmaydi/dublikatlanmaydi)
- ✅ To'lov endpointlari auth + buyurtma egaligini talab qiladi
- ✅ O!Dengi kredensiallari faqat serverda (env/pb_data fayl), kodda yo'q

## 2. Autentifikatsiya
- ✅ OTP kriptografik random (Math.random emas)
- ✅ OTP rate-limit: 5/soat (telefon), 5 urinish (kod), hash bilan saqlanadi, 5 daq TTL
- ✅ Admin gating server token turiga asoslanadi (localStorage bypass yo'q)
- ✅ Admin paroli hech qayerda saqlanmaydi (localStorage'dan olib tashlangan)

## 3. Ma'lumotlar bazasi (PocketBase qoidalari)
Barcha 8 kolleksiya qulflangan:
- products: o'qish ochiq, yozish faqat admin
- clients: har kim faqat o'zini
- orders: mijoz faqat o'z buyurtmalarini (clientPhone)
- notifications: shaxsiy xabarlar faqat egasiga, yozish faqat admin
- reviews: o'qish ochiq, yozish/moderatsiya faqat admin
- settings/otp_codes/site_media: qulflangan

## 4. Klient (brauzer/ilova)
- ✅ Bundle'da hech qanday sir yo'q (tekshirildi)
- ✅ XSS yo'q: dangerouslySetInnerHTML / innerHTML / eval ishlatilmaydi
- ✅ CSP qo'shildi: faqat o'z API + O!Dengi + green-api'ga ulanish, object-src none, frame-ancestors none
- ✅ X-Content-Type-Options nosniff
- ✅ target=_blank havolalarda noopener
- ✅ npm audit: 0 zaiflik

## 5. Server (Caddy reverse-proxy)
- ✅ HTTPS majburiy (Let's Encrypt), HSTS 1 yil + preload
- ✅ X-Frame-Options DENY, Referrer-Policy, Permissions-Policy
- ✅ CORS faqat https://kemalusman.kg
- ✅ Rate-limit zonalari: OTP, admin-login, barcha yozishlar
- ✅ PocketBase faqat 127.0.0.1 (loopback) — to'g'ridan tashqariga ochiq emas
- ✅ systemd hardening (NoNewPrivileges, ProtectSystem, PrivateTmp)

## 6. DoS / abuse himoyasi
- ✅ Buyurtmada max 100 pozitsiya, qty 1–999
- ✅ Erkin matn maydonlari (manzil/komment) 1000 belgida kesiladi
- ✅ WhatsApp xabar 4000 belgida cheklangan
- ✅ Klientlar ro'yxati admin'da sahifalangan (100 tadan)

---

## ⚠️ SIZ BAJARISHINGIZ SHART (kod bilan qilib bo'lmaydi)

1. **O!Dengi merchant parolini ROTATE qiling** — git tarixiga oqqan
2. **Green API tokenini ROTATE qiling** — admin bundle'da oqqan edi
3. **PB admin parolini** kuchli qiling (16+ belgi, parol menejer)
4. Caddy rate-limit moduli o'rnatilganini tasdiqlang (Caddyfile'dagi izohga qarang) — aks holda `rate_limit` direktivasi Caddy'ni ishga tushirmaydi
5. Git tarixini tozalash (repo public bo'lsa) — `git filter-repo` bilan eski parollarni o'chirish, yoki repo private qolsin

## Qoldiq past-xavf eslatmalar
- Demo akkaunt (+996555000001) yoqiq — App Store approval'dan keyin `.env.production`da `VITE_DEMO_ACCOUNT=off`
- Sentry DSN bo'sh — crash monitoring uchun to'ldiring (xavfsizlik emas, kuzatuv)
