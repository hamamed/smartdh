#!/usr/bin/env bash
# Pull the latest code and restart. Run on the VPS:  sudo bash deploy/update.sh
set -euo pipefail

APP_DIR=/var/www/smartdh
APP_USER=smartdh

cd "$APP_DIR"

# The files are owned by $APP_USER but we run as root — git refuses that unless told
# the directory is trusted.
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

echo "==> Backing up data first"
cp -r data "/root/smartdh-data-$(date +%F-%H%M)" 2>/dev/null || echo "    (no data yet, skipping)"

echo "==> Pulling latest code"
git pull --ff-only origin main

echo "==> Installing dependencies"
npm ci --omit=dev

echo "==> Fixing ownership"
mkdir -p data public/uploads
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Restarting"
systemctl restart smartdh
sleep 2
systemctl --no-pager --lines=0 status smartdh

echo "==> Done. Logs: journalctl -u smartdh -f"
