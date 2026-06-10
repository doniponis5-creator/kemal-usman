#!/bin/bash
# deploy-odengi.sh — Deploy security-hardened hooks + frontend to VPS
# Run from the parfum-shop directory on your Mac:  ./deploy-odengi.sh
#
# v2 (2026-06-10) — security fix release:
#   • uploads ALL pb_hooks (odengi v4, main, otp, whatsapp, _lib)
#   • verifies ODENGI_SID / ODENGI_PASSWORD exist in the server env BEFORE
#     restarting — payments fail closed without them
#   • no plaintext passwords printed anywhere

set -e
VPS="145.223.100.16"
PB_DIR="/root/parfum-backend"            # PocketBase katalogi serverda
ENV_FILE="/etc/pocketbase/env"  # systemd EnvironmentFile (yo'q bo'lsa skript ogohlantiradi)

echo "=== Kemal Usman — secure deploy ==="

# 0. Server env check — payments will NOT work without these
echo "0) Checking O!Dengi env on server..."
if ssh root@$VPS "grep -qs '^ODENGI_SID=.\+' $ENV_FILE && grep -qs '^ODENGI_PASSWORD=.\+' $ENV_FILE"; then
  echo "   ✅ ODENGI_SID + ODENGI_PASSWORD set in $ENV_FILE"
else
  echo "   ⚠️  ODENGI_SID / ODENGI_PASSWORD NOT found in $ENV_FILE"
  echo "   To'lovlar ishlamaydi! Avval serverda quyidagini bajaring:"
  echo "     ssh root@$VPS"
  echo "     mkdir -p /etc/pocketbase && nano $ENV_FILE   # quyidagilarni yozing:"
  echo "       ODENGI_SID=<merchant sid>"
  echo "       ODENGI_PASSWORD=<YANGI rotated parol>"
  echo "     # systemd ishlatilsa unit faylda EnvironmentFile=$ENV_FILE bo'lishi shart"
  read -p "   Davom etaymi baribir? (y/N) " yn
  [ "$yn" = "y" ] || exit 1
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
