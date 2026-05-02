#!/usr/bin/env bash
# One-shot server provisioning for the PocketBase + Caddy stack.
# Tested on Ubuntu 22.04. Run as root on a fresh VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/.../setup-server.sh | bash
#   # or: scp setup-server.sh root@server:/tmp && ssh root@server bash /tmp/setup-server.sh

set -euo pipefail

DOMAIN="${PUBLIC_DOMAIN:-api.kemalusman.kg}"
PB_VERSION="${PB_VERSION:-0.22.21}"
PB_USER="pocketbase"
PB_DIR="/opt/pocketbase"

echo "▶ Provisioning $DOMAIN with PocketBase $PB_VERSION"

# --- 1. Caddy + ratelimit module --------------------------------------------
# We build a custom Caddy binary that includes caddy-ratelimit so the rate
# limit blocks in our Caddyfile load. The stock apt package does NOT include it.
if [ ! -x /usr/local/bin/caddy ]; then
    echo "▶ Building Caddy with rate-limit module"
    apt-get update -qq
    apt-get install -y -qq curl golang-go ca-certificates
    GO_BIN="/root/go/bin"
    GOBIN="$GO_BIN" go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
    "$GO_BIN/xcaddy" build \
        --with github.com/mholt/caddy-ratelimit \
        --output /usr/local/bin/caddy
    /usr/local/bin/caddy version
    # Create a minimal systemd unit for our custom binary.
    cat > /etc/systemd/system/caddy.service <<'EOF'
[Unit]
Description=Caddy
After=network.target
[Service]
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=on-failure
LimitNOFILE=1048576
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable caddy
fi

# --- 2. PocketBase user + dir -----------------------------------------------
id -u "$PB_USER" >/dev/null 2>&1 || useradd -r -s /bin/false "$PB_USER"
mkdir -p "$PB_DIR" "$PB_DIR/pb_hooks" "$PB_DIR/pb_data" /etc/pocketbase /var/log/caddy
chown -R "$PB_USER:$PB_USER" "$PB_DIR"

# --- 3. Download PocketBase --------------------------------------------------
if [ ! -x "$PB_DIR/pocketbase" ]; then
    echo "▶ Downloading PocketBase $PB_VERSION"
    cd /tmp
    curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
    unzip -o pb.zip -d pb_extract
    install -o "$PB_USER" -g "$PB_USER" -m 0755 pb_extract/pocketbase "$PB_DIR/pocketbase"
    rm -rf pb_extract pb.zip
fi

# --- 4. Env file -------------------------------------------------------------
if [ ! -f /etc/pocketbase/env ]; then
    echo "▶ Creating /etc/pocketbase/env (FILL IN VALUES)"
    cat > /etc/pocketbase/env <<EOF
PB_ADMIN_EMAIL=admin@${DOMAIN}
PB_ADMIN_PASSWORD=CHANGE_ME

GREEN_API_INSTANCE=
GREEN_API_TOKEN=

SMS_PROVIDER=smsc
SMS_API_LOGIN=
SMS_API_PASSWORD=
SMS_SENDER=KemalUsman
EOF
    chmod 600 /etc/pocketbase/env
    chown root:root /etc/pocketbase/env
fi

# --- 5. systemd service ------------------------------------------------------
cp "$(dirname "$0")/pocketbase.service" /etc/systemd/system/pocketbase.service
systemctl daemon-reload
systemctl enable --now pocketbase

# --- 6. Caddyfile ------------------------------------------------------------
sed "s/api\.kemalusman\.kg/$DOMAIN/g" "$(dirname "$0")/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy

# --- 7. UFW firewall ---------------------------------------------------------
if command -v ufw >/dev/null; then
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

# --- 8. Daily backup cron ----------------------------------------------------
cat > /etc/cron.daily/pb-backup <<'EOF'
#!/bin/bash
DEST=/opt/pocketbase/pb_backup
mkdir -p "$DEST"
DATE=$(date +%Y-%m-%d)
sqlite3 /opt/pocketbase/pb_data/data.db ".backup $DEST/data-$DATE.db"
find "$DEST" -name 'data-*.db' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/pb-backup

echo
echo "✅ Setup complete."
echo "   1. Point DNS A record for $DOMAIN to this server's IP."
echo "   2. Edit /etc/pocketbase/env to set PB_ADMIN_PASSWORD + SMS keys."
echo "   3. Visit https://$DOMAIN/_/ and create your superadmin."
echo "   4. From your laptop: cd parfum-shop && node scripts/pb-secure-rules.js"
