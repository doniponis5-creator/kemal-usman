#!/bin/bash
# scripts/update-odengi-creds.sh — FAQAT O!Dengi parolini serverga yozadi.
#
# deploy-odengi.sh ning 0-qadami, alohida: kod, frontend, restart — hech biriga tegmaydi.
# PocketBase bu faylni har to'lovda qayta o'qiydi, shuning uchun restart shart emas.
# Eski fayl serverda zaxiraga olinadi (odengi_credentials.json.bak-SANA).
#
# Ishga tushirish (loyiha papkasida):  bash scripts/update-odengi-creds.sh

set -e
cd "$(dirname "$0")/.."

VPS="145.223.100.16"
F="/root/parfum-backend/pb_data/odengi_credentials.json"

ODENGI_SID=$(grep -E '^ODENGI_SID=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'")
ODENGI_PASSWORD=$(grep -E '^ODENGI_PASSWORD=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'")
if [ -z "$ODENGI_SID" ] || [ -z "$ODENGI_PASSWORD" ]; then
  echo "❌ .env da ODENGI_SID yoki ODENGI_PASSWORD yo'q."
  exit 1
fi

ssh root@$VPS "cp -p $F $F.bak-\$(date +%Y%m%d-%H%M%S) 2>/dev/null || true"
printf '{"sid":"%s","password":"%s","resultBaseUrl":"https://api.kemalusman.kg"}\n' "$ODENGI_SID" "$ODENGI_PASSWORD" | \
  ssh root@$VPS "cat > $F && chmod 600 $F"

echo "✅ O!Dengi paroli serverga yozildi (eski fayl zaxirada)."

# pb_hooks avval PocketBase jarayonining env'idan o'qiydi, fayl — faqat zaxira.
if ssh root@$VPS 'P=$(pgrep -f "pocketbase serve" | head -1); [ -n "$P" ] && tr "\0" "\n" < /proc/$P/environ | grep -q "^ODENGI_PASSWORD="'; then
  echo "⚠️  Server parolni systemd env'dan oladi — bu fayl hozir ishlatilmaydi."
  echo "   Yangi parol ishlashi uchun systemd env'dagi ODENGI_PASSWORD ni ham yangilab,"
  echo "   PocketBase'ni qayta ishga tushirish kerak (systemctl restart pocketbase)."
fi
echo "   Tekshirish:  npm run check:secrets"
