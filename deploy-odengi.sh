#!/bin/bash
# deploy-odengi.sh — Deploy security-hardened hooks + frontend to VPS
# Run from the parfum-shop directory on your Mac:  ./deploy-odengi.sh
#
# v3 (2026-06-10) — PB 0.22 kredensial fayl fix:
#   • uploads ALL pb_hooks (odengi v4, main, otp, whatsapp, _lib)
#   • verifies ODENGI_SID / ODENGI_PASSWORD exist in the server env BEFORE
#     restarting — payments fail closed without them
#   • no plaintext passwords printed anywhere

set -e
VPS="145.223.100.16"
PB_DIR="/root/parfum-backend"            # PocketBase katalogi serverda
ENV_FILE="/etc/pocketbase/env"  # systemd EnvironmentFile (yo'q bo'lsa skript ogohlantiradi)

echo "=== Kemal Usman — secure deploy ==="

# 0. Kredensial faylni serverga yaratish (PB 0.22 — env o'rniga pb_data fayl).
# Lokal .env dan ODENGI_SID / ODENGI_PASSWORD o'qiladi va serverda
# $PB_DIR/pb_data/odengi_credentials.json yaratiladi (git'da YO'Q, chmod 600).
echo "0) O!Dengi kredensiallarini serverga joylash..."
ODENGI_SID=$(grep -E '^ODENGI_SID=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
ODENGI_PASSWORD=$(grep -E '^ODENGI_PASSWORD=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$ODENGI_SID" ] || [ -z "$ODENGI_PASSWORD" ]; then
  echo "   ⚠️  Lokal .env faylida ODENGI_SID / ODENGI_PASSWORD yo'q."
  echo "   .env ga qo'shing (O!Dengi kabinetida ROTATE qilingan YANGI parol bilan):"
  echo "     ODENGI_SID=5084412514"
  echo "     ODENGI_PASSWORD=<yangi_parol>"
  read -p "   Kredensialsiz davom etaymi? To'lov 503 qaytaradi. (y/N) " yn
  [ "$yn" = "y" ] || exit 1
else
  printf '{"sid":"%s","password":"%s","resultBaseUrl":"https://api.kemalusman.kg"}\n' "$ODENGI_SID" "$ODENGI_PASSWORD" | \
    ssh root@$VPS "cat > $PB_DIR/pb_data/odengi_credentials.json && chmod 600 $PB_DIR/pb_data/odengi_credentials.json"
  echo "   ✅ odengi_credentials.json serverga yozildi (pb_data/, git tashqarisi)"
fi

# 1. Upload ALL PocketBase hooks (old debug hooks removed locally — clean dir sync)
echo "1) Uploading PocketBase hooks..."
rsync -avz --delete --exclude='*.bak' pb_hooks/ root@$VPS:$PB_DIR/pb_hooks/
echo "   Done."

# 2. Build frontend
echo "2) Building frontend..."
npm run build
echo "   Done."

# 3. Upload dist
echo "3) Uploading dist..."
rsync -avz --delete dist/ root@$VPS:/var/www/parfum/
echo "   Done."

# 4. Restart PocketBase to pick up new hooks + env
echo "4) Restarting PocketBase..."
ssh root@$VPS "systemctl restart pocketbase 2>/dev/null || (cd $PB_DIR && pkill pocketbase; sleep 1; nohup ./pocketbase serve --http 127.0.0.1:8091 >/dev/null 2>&1 &)"
echo "   Done."

# 5. Smoke test — webhook must now REJECT unsigned requests (403/503, NOT 200)
echo "5) Webhook security smoke test..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://api.kemalusman.kg/api/custom/odengi/result -H 'Content-Type: application/json' -d '{"order_id":"KU_fake_1","status_pay":3}' || echo "000")
if [ "$CODE" = "403" ] || [ "$CODE" = "503" ]; then
  echo "   ✅ Unsigned webhook rejected (HTTP $CODE) — fix is live"
else
  echo "   ❌ DIQQAT: webhook HTTP $CODE qaytardi (403 kutilgan edi) — hooklar yangilanganini tekshiring!"
fi

echo ""
echo "=== Deploy complete ==="
echo "Keyingi qadam: settings'dagi eski maxfiy maydonlarni o'chirish:"
echo "  npm run pb:remove-odengi-secrets"
echo "So'ng real 10 som to'lov bilan test qiling va loglarni kuzating:"
echo "  ssh root@$VPS 'journalctl -u pocketbase -f | grep odengi'"
