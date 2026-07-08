#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Welcome-bonus test — demo akkaunt orqali (real SMS/nomer KERAK EMAS).
# Demo: +996555000001, kod doim 123456.
#
# TOZA TEST (tavsiya) — demo klientni avval o'chiradi, keyin qayta yaratib tekshiradi:
#   PB_ADMIN_EMAIL="admin@..." PB_ADMIN_PASSWORD="parol" bash scripts/test-welcome-bonus.sh
#
# Oddiy (o'chirmasdan) — faqat joriy holatni ko'rsatadi:
#   bash scripts/test-welcome-bonus.sh
# ─────────────────────────────────────────────────────────────────────────────
PB="https://api.kemalusman.kg"
PHONE="+996555000001"
CODE="123456"
CURL="curl -s --max-time 15"

# ── (ixtiyoriy) demo klientni o'chirish — toza "yangi klient" testi uchun ──
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "0) Admin auth + demo klientni tozalash..."
  TOK=$($CURL -X POST "$PB/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
  if [ -z "$TOK" ]; then
    echo "   ⚠️  Admin login o'tmadi — email/parolni tekshir. O'chirmasdan davom etamiz."
  else
    ID=$($CURL "$PB/api/collections/clients/records?filter=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("phone=\"+996555000001\""))')" \
      -H "Authorization: Bearer $TOK" \
      | python3 -c 'import sys,json;it=json.load(sys.stdin).get("items",[]);print(it[0]["id"] if it else "")' 2>/dev/null)
    if [ -n "$ID" ]; then
      $CURL -X DELETE "$PB/api/collections/clients/records/$ID" -H "Authorization: Bearer $TOK" -o /dev/null -w "   demo klient o'chirildi (id $ID), HTTP %{http_code}\n"
    else
      echo "   demo klient topilmadi (allaqachon yo'q) — davom etamiz."
    fi
  fi
  echo
fi

echo "1) OTP request (demo — SMS yuborilmaydi)..."
$CURL -X POST "$PB/api/custom/otp/request" -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE\"}"
echo; echo

echo "2) OTP verify (kod $CODE)..."
RESP=$($CURL -X POST "$PB/api/custom/otp/verify" -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\",\"name\":\"Welcome Test\"}")

echo "--- server javobi ---"
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo

echo "--- XULOSA ---"
echo "$RESP" | python3 -c '
import sys, json
d = json.load(sys.stdin); r = d.get("record", {})
new = d.get("isNewClient"); bal = r.get("bonusBalance")
types = [h.get("type") for h in (r.get("bonusHistory") or [])]
print("isNewClient :", new); print("bonusBalance:", bal); print("history     :", types); print()
if new and bal and bal >= 150 and "welcome" in types:
    print("OK ISHLADI — yangi klientga welcome bonus tushdi (150).")
elif not new:
    print("INFO: Demo avval royxatdan otgan. Toza test uchun admin creds bilan ishga tushir:")
    print("  PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... bash scripts/test-welcome-bonus.sh")
else:
    print("WARN: Kutilmagan holat — javobni tekshir.")
' 2>/dev/null || echo "(python3 yoq — JSON ni qolda oqing)"
