#!/usr/bin/env bash
# Deploy KanzUp (the Next.js app in web/) to the koydam server (46.224.86.198).
#
#   deploy/push.sh --dry-run   # show what would change, touch nothing
#   deploy/push.sh             # back up data, copy code, install, build, restart, check
#
# Live state on the server is never touched: data/ (incl. sessions), public/uploads/,
# public/downloads/ and .env stay as they are. The server keeps no git checkout.
# If the build or the health check fails, the previous build is put back and restarted.
set -euo pipefail

HOST=${KANZUP_SSH_HOST:-root@46.224.86.198}
APP_DIR=/opt/kanzup

cd "$(dirname "$0")/../web"

RSYNC_OPTS=(-az --delete --itemize-changes
  --exclude=/node_modules/ --exclude=/.next/ --exclude=/tests/ --exclude=/tsconfig.tsbuildinfo --exclude=/next-env.d.ts
  --exclude=/data/ --exclude=/public/uploads/ --exclude=/public/downloads/ --exclude=/public/.well-known/ --exclude=/.env
  --exclude=.DS_Store)

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "==> Dry run: what would change on $HOST:$APP_DIR"
  rsync "${RSYNC_OPTS[@]}" --dry-run ./ "$HOST:$APP_DIR/"
  exit 0
fi

echo "==> Backing up data and the current build on the server"
ssh "$HOST" "set -e; cp -a $APP_DIR/data /root/kanzup-data-\$(date +%F-%H%M)
  rm -rf /opt/kanzup-previous && rsync -a --exclude=/data/ --exclude=/public/uploads/ --exclude=/public/downloads/ --exclude=/.env $APP_DIR/ /opt/kanzup-previous/"

echo "==> Copying code"
rsync "${RSYNC_OPTS[@]}" ./ "$HOST:$APP_DIR/"

echo "==> Installing, building, restarting"
ssh "$HOST" bash -s <<'REMOTE'
set -uo pipefail
APP_DIR=/opt/kanzup
restore() {
  echo "!! $1 — putting the previous build back"
  rsync -a --delete --exclude=/data/ --exclude=/public/uploads/ --exclude=/public/downloads/ --exclude=/.env /opt/kanzup-previous/ $APP_DIR/
  chown -R kanzup:kanzup $APP_DIR; systemctl restart kanzup; exit 1
}
cd $APP_DIR
npm ci --no-audit --no-fund >/tmp/kanzup-npm.log 2>&1 || restore "npm ci failed (see /tmp/kanzup-npm.log)"
npx next build >/tmp/kanzup-build.log 2>&1 || { tail -20 /tmp/kanzup-build.log; restore "build failed"; }
mkdir -p .next/cache && chown -R kanzup:kanzup $APP_DIR
systemctl restart kanzup
code=000
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: kanzup.com' http://127.0.0.1:3830/terms || true)
  [ "$code" = 200 ] && break
  sleep 1
done
[ "$code" = 200 ] || { journalctl -u kanzup -n 20 --no-pager; restore "health check failed ($code)"; }
echo "kanzup: $(systemctl is-active kanzup), /terms $code"
REMOTE
