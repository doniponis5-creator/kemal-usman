#!/bin/bash
# scripts/test-security.sh — P0 ACCEPTANCE testlari (deploy'dan KEYIN ishga tushiring)
# Usage: ./scripts/test-security.sh [API_URL]
API="${1:-https://api.kemalusman.kg}"
PASS=0; FAIL=0

check() { # check <nomi> <kutilgan_kodlar> <olingan_kod>
  if echo "$2" | grep -qw "$3"; then echo "  ✅ $1 (HTTP $3)"; PASS=$((PASS+1));
  else echo "  ❌ $1 — kutilgan: $2, olingan: $3"; FAIL=$((FAIL+1)); fi
}

echo "═══ P0 Security Acceptance — $API ═══"

echo "[P0.1] Webhook imzo tekshiruvi:"
C=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$API/api/custom/odengi/result" -H 'Content-Type: application/json' -d '{"order_id":"KU_fake_1","status_pay":3,"amount":100}')
check "hash'siz webhook rad etildi" "403 503" "$C"
C=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$API/api/custom/odengi/result" -H 'Content-Type: application/json' -d '{"order_id":"KU_fake_1","status_pay":3,"amount":100,"hash":"deadbeef"}')
check "noto'g'ri hash rad etildi" "403 503" "$C"

echo "[P0.5] Debug endpointlar o'chirilgan:"
C=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$API/api/custom/debug-odengi-schema")
check "debug-odengi-schema = 404" "404" "$C"
C=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$API/api/custom/debug-variant" -H 'Content-Type: application/json' -d '{}')
check "debug-variant = 404" "404" "$C"

echo "[P0.6] Odengi endpointlari auth talab qiladi:"
for EP in create-invoice check-status cancel; do
  C=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$API/api/custom/odengi/$EP" -H 'Content-Type: application/json' -d '{"orderId":"x"}')
  check "$EP token'siz = 401" "401" "$C"
done

echo "[P0.3] Settings'da sir yo'q:"
BODY=$(curl -s -m 15 "$API/api/collections/settings/records?perPage=5")
if echo "$BODY" | grep -q "odengiPassword\|odengiSid"; then
  echo "  ❌ settings javobida odengiSid/odengiPassword KO'RINYAPTI — npm run pb:remove-odengi-secrets ishga tushiring!"; FAIL=$((FAIL+1))
else
  echo "  ✅ settings javobida sir maydonlar yo'q"; PASS=$((PASS+1))
fi

echo "═══ Natija: $PASS passed, $FAIL failed ═══"
[ $FAIL -eq 0 ] && echo "🎉 HAMMA ACCEPTANCE TESTLAR O'TDI" || echo "⚠️  Muammolar bor — yuqoridagi ❌ larni ko'ring"
exit $FAIL
