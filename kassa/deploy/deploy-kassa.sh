#!/bin/bash
# Касса Kemal Usman → сервер 145.223.100.16 (этап 4). Запуск из папки репозитория kemal-usman в Git Bash:
#   bash kassa/deploy/deploy-kassa.sh check     — только посмотреть сервер (ничего не меняет), вывод прислать в чат
#   bash kassa/deploy/deploy-kassa.sh           — поставить / обновить кассу
#
# Что делает установка (повторный запуск безопасен — секреты и база остаются):
#   1. код kassa/server → /root/kemal-kassa/app; Python-окружение /root/kemal-kassa/venv;
#   2. /root/kemal-kassa/.env — если его нет: случайные секреты 1С и клуба, адрес сайта, ключи Green API берёт из
#      /etc/pocketbase/env (тот же номер WhatsApp, что у сайта); в чат и на экран секреты не выводятся;
#   3. ключ клуба → /root/parfum-backend/pb_data/kassa_credentials.json (его читает pb_hooks/kassa.pb.js);
#   4. служба systemd «kemal-kassa» на 127.0.0.1:8095 (не Docker: Docker на сервере — у Smart Centr, не трогаем);
#   5. https://kassa.kemalusman.kg — блок в Caddy (если сайт отдаёт Caddy); иначе скрипт остановится и скажет, что делать;
#   6. секрет 1С → kassa/agent/agent.env на этом ПК (для программы кассы), в git он не попадает.
# Обработчики PocketBase (бонусы, наличие на сайте) выкладывает обычный ./deploy-odengi.sh — после этого скрипта.
set -e
VPS="145.223.100.16"
DIR="/root/kemal-kassa"
PB_DIR="/root/parfum-backend"
DOMAIN="kassa.kemalusman.kg"
HERE="$(cd "$(dirname "$0")/.." && pwd)"          # папка kassa/

if [ "$1" = "check" ]; then
  echo "=== Касса Kemal: проверка сервера (ничего не меняю) ==="
  ssh root@$VPS "
    echo '--- python:'; python3 --version; python3 -c 'import venv' 2>/dev/null && echo 'venv: есть' || echo 'venv: НЕТ (нужен python3-venv)'
    echo '--- службы:'; for s in caddy nginx pocketbase kemal-kassa; do printf '%s: ' \$s; systemctl is-active \$s 2>/dev/null || true; done
    echo '--- кто слушает 80/443:'; ss -ltnp 2>/dev/null | grep -E ':(80|443) ' || true
    echo '--- где описан api.kemalusman.kg:'; grep -ls 'kemalusman' /etc/caddy/Caddyfile /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null || echo 'не найдено в caddy/nginx на хосте'
    echo '--- касса уже стоит?'; ls -d $DIR 2>/dev/null || echo 'нет'
    echo '--- DNS $DOMAIN:'; getent hosts $DOMAIN || echo 'имя ещё не настроено'
    echo '--- место:'; df -h / | tail -1
  "
  exit 0
fi

echo "=== Касса Kemal Usman → $VPS ==="
echo "1) Код кассы на сервер..."
tar -C "$HERE/server" --exclude='data' --exclude='tests' --exclude='__pycache__' -czf - kassa_server requirements.txt | \
  ssh root@$VPS "set -e; mkdir -p $DIR/data $DIR/app.incoming; rm -rf $DIR/app.incoming/*; tar --no-same-owner -xzf - -C $DIR/app.incoming; \
                 rm -rf $DIR/app.old; [ -d $DIR/app ] && mv $DIR/app $DIR/app.old; mv $DIR/app.incoming $DIR/app"

echo "2) Python, секреты, служба, адрес..."
ssh root@$VPS "DIR=$DIR PB_DIR=$PB_DIR DOMAIN=$DOMAIN bash -s" <<'REMOTE'
set -e
cd "$DIR"
python3 -c 'import venv' 2>/dev/null || { echo '   ставлю python3-venv'; apt-get install -y -qq python3-venv >/dev/null; }
[ -x venv/bin/python ] || python3 -m venv venv
venv/bin/pip install -q --disable-pip-version-check -r app/requirements.txt
if [ ! -f .env ]; then
  GI=$(grep -E '^GREEN_API_INSTANCE=' /etc/pocketbase/env 2>/dev/null | cut -d= -f2- || true)
  GT=$(grep -E '^GREEN_API_TOKEN=' /etc/pocketbase/env 2>/dev/null | cut -d= -f2- || true)
  umask 077
  cat > .env <<EOF
KASSA_DB=$DIR/data/kassa.db
KASSA_1C_SECRET=$(openssl rand -hex 24)
KASSA_CLUB_URL=https://api.kemalusman.kg
KASSA_CLUB_KEY=$(openssl rand -hex 24)
KASSA_PUBLIC_URL=https://$DOMAIN
KASSA_SHOP_TITLE=Kemal Usman Parfume
KASSA_SELLER=Kemal Usman Parfume
GREEN_API_INSTANCE=$GI
GREEN_API_TOKEN=$GT
EOF
  echo "   .env создан (секреты новые)"; [ -n "$GI" ] && echo "   WhatsApp: ключи взяты у сайта" || echo "   WhatsApp: ключей у сайта нет — чеки в пробном режиме"
else
  echo "   .env уже есть — секреты не меняю"
fi
chmod 600 .env
KEY=$(grep -E '^KASSA_CLUB_KEY=' .env | cut -d= -f2-)
if [ -d "$PB_DIR/pb_data" ]; then
  printf '{"key":"%s"}\n' "$KEY" > "$PB_DIR/pb_data/kassa_credentials.json"
  chmod 600 "$PB_DIR/pb_data/kassa_credentials.json"
  echo "   ключ клуба положен рядом с базой сайта (pb_data/kassa_credentials.json)"
else
  echo "   ВНИМАНИЕ: нет $PB_DIR/pb_data — бонусы и наличие на сайте работать не будут"
fi
cat > /etc/systemd/system/kemal-kassa.service <<EOF
[Unit]
Description=Kassa Kemal Usman (phone till)
After=network.target
[Service]
WorkingDirectory=$DIR/app
EnvironmentFile=$DIR/.env
ExecStart=$DIR/venv/bin/uvicorn kassa_server.app:app --host 127.0.0.1 --port 8095 --proxy-headers --forwarded-allow-ips 127.0.0.1
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q kemal-kassa
systemctl restart kemal-kassa
sleep 3
curl -fsS http://127.0.0.1:8095/health >/dev/null && echo "   служба kemal-kassa работает" || { echo "   ОШИБКА: служба не отвечает"; journalctl -u kemal-kassa -n 30 --no-pager; exit 1; }
if systemctl is-active -q caddy && [ -f /etc/caddy/Caddyfile ]; then
  if ! grep -q "^$DOMAIN" /etc/caddy/Caddyfile; then
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak_kassa_$(date +%Y%m%d_%H%M%S)
    printf '\n%s {\n    encode gzip\n    reverse_proxy 127.0.0.1:8095\n}\n' "$DOMAIN" >> /etc/caddy/Caddyfile
    CADDY=$(command -v caddy || echo /usr/local/bin/caddy)
    if $CADDY validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
      systemctl reload caddy && echo "   Caddy: $DOMAIN добавлен (копия старого файла сохранена)"
    else
      LAST=$(ls -t /etc/caddy/Caddyfile.bak_kassa_* | head -1); cp "$LAST" /etc/caddy/Caddyfile
      echo "   Caddy не принял новый блок — вернул старый файл. Пришлите этот вывод в чат."; exit 1
    fi
  else
    echo "   Caddy: $DOMAIN уже есть"
  fi
else
  echo "   ВНИМАНИЕ: Caddy на сервере не работает — адрес https://$DOMAIN не настроен. Пришлите вывод «check» в чат."
fi
REMOTE

echo "3) Секрет 1С → kassa/agent/agent.env на этом ПК..."
SECRET=$(ssh root@$VPS "grep -E '^KASSA_1C_SECRET=' $DIR/.env | cut -d= -f2-")
ENVF="$HERE/agent/agent.env"
if [ -f "$ENVF" ]; then
  grep -v -E '^(KASSA_URL|KASSA_1C_SECRET)=' "$ENVF" > "$ENVF.tmp" || true
else
  grep -v -E '^(KASSA_URL|KASSA_1C_SECRET)=' "$HERE/agent/agent.env.example" > "$ENVF.tmp"
fi
{ echo "KASSA_URL=https://$DOMAIN"; echo "KASSA_1C_SECRET=$SECRET"; cat "$ENVF.tmp"; } > "$ENVF"
rm -f "$ENVF.tmp"
SECRET=""
echo "   готово: $ENVF (в нём ещё нужно вписать ONEC_USER и ONEC_PASSWORD — пользователь 1С Kemal)"

echo "4) Проверка снаружи..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/health" || echo "000")
if [ "$CODE" = "200" ]; then echo "   ✅ https://$DOMAIN/kassa/ открывается"; else echo "   ⏳ https://$DOMAIN пока не открывается (HTTP $CODE) — проверьте DNS и подождите 5–10 минут"; fi
echo ""
echo "=== Готово. Дальше: ./deploy-odengi.sh (обработчики бонусов и наличия на сайте) ==="
