#!/usr/bin/env bash
# Install or update JPPhone (dashboard + API) on Ubuntu 22.04 / 24.04. Run from the project folder:
#   sudo bash deploy/install-app.sh your-domain.com
# Safe to re-run: it updates the code, rebuilds and restarts, and keeps /etc/jpphone.env and server/data.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash deploy/install-app.sh your-domain.com}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/jpphone
SVC_HOME=/var/lib/jpphone
ENV_FILE=/etc/jpphone.env

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> System packages"
apt-get update -q
apt-get install -y -q curl ca-certificates gnupg rsync openssl adb docker.io debian-keyring debian-archive-keyring apt-transport-https

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

echo "==> Service user"
id jpphone >/dev/null 2>&1 || useradd --system --create-home --home-dir "$SVC_HOME" --shell /usr/sbin/nologin jpphone
usermod -aG docker jpphone
# SSH key for reaching a separate phone host (docker -H ssh://…). Harmless if phones run here.
if [ ! -f "$SVC_HOME/.ssh/id_ed25519" ]; then
  install -d -m 700 -o jpphone -g jpphone "$SVC_HOME/.ssh"
  sudo -u jpphone ssh-keygen -q -t ed25519 -N "" -C "jpphone@$(hostname)" -f "$SVC_HOME/.ssh/id_ed25519"
fi

echo "==> Code and build"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude dist --exclude server/node_modules --exclude server/data --exclude .git "$SRC/" "$APP_DIR/"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build:backend
npm --prefix server ci --omit=dev --no-audit --no-fund
install -d -o jpphone -g jpphone "$APP_DIR/server/data"

echo "==> Settings ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  install -m 640 -o root -g jpphone deploy/jpphone.env.example "$ENV_FILE"
  sed -i "s#^APP_URL=.*#APP_URL=https://$DOMAIN#; s#^ADMIN_TOKEN=.*#ADMIN_TOKEN=$(openssl rand -hex 32)#; s#your-domain.com#$DOMAIN#g" "$ENV_FILE"
  echo "    Created. Your admin token: $(grep '^ADMIN_TOKEN=' "$ENV_FILE" | cut -d= -f2)"
else
  echo "    Kept the existing file."
fi

echo "==> systemd service"
install -m 644 deploy/jpphone.service /etc/systemd/system/jpphone.service
systemctl daemon-reload
systemctl enable jpphone >/dev/null
systemctl restart jpphone

echo "==> Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
sed "s/your-domain.com/$DOMAIN/" deploy/Caddyfile > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Firewall"
if command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80,443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

sleep 2
if systemctl is-active --quiet jpphone; then
  echo
  echo "Done: https://$DOMAIN"
  echo "  Logs:      journalctl -u jpphone -f"
  echo "  Settings:  sudo nano $ENV_FILE   then   sudo systemctl restart jpphone"
  echo "  Phone-host SSH key (only if phones run on another server):"
  echo "    $(cat "$SVC_HOME/.ssh/id_ed25519.pub")"
else
  echo "The service didn't start. See: journalctl -u jpphone -n 50"
  exit 1
fi
