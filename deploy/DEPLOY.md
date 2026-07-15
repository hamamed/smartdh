# Deploying SmartDH to your VPS

Target: **46.224.32.64** · domain **smartdh.ma**
Stack: Node + systemd, nginx reverse proxy, Let's Encrypt TLS.

Run everything below **on the VPS as root** (or with `sudo`), unless it says "on your PC".

---

## 1. DNS (do this first — TLS needs it)

At your domain registrar for `smartdh.ma`, add:

| Type | Name | Value |
|------|------|-------|
| A    | `@`  | `46.224.32.64` |
| A    | `www`| `46.224.32.64` |

Check it resolves before continuing (wait a few minutes if not):

```bash
dig +short smartdh.ma        # must print 46.224.32.64
```

---

## 2. Server packages

```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx ufw

node -v    # should print v20.x
```

## 3. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

> The app itself listens on `127.0.0.1:3000` and is **not** exposed directly — nginx fronts it.

## 4. App user + folder

```bash
adduser --system --group --home /var/www/smartdh smartdh
mkdir -p /var/www/smartdh
```

## 5. Get the code from GitHub

```bash
apt install -y git
git clone https://github.com/hamamed/smartdh.git /var/www/smartdh
cd /var/www/smartdh
```

> Private repo? Either use a
> [personal access token](https://github.com/settings/tokens):
> `git clone https://<TOKEN>@github.com/hamamed/smartdh.git /var/www/smartdh`
> or add a deploy key (`ssh-keygen -t ed25519` → add the `.pub` to the repo's Deploy keys)
> and clone with `git@github.com:hamamed/smartdh.git`.

## 6. Install + configure (back on the VPS)

```bash
cd /var/www/smartdh
npm ci --omit=dev

# generate a session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

cp .env.example .env
nano .env
```

Fill in `.env`:

```ini
SESSION_SECRET=<paste the generated value>
ADMIN_EMAIL=your@email.com        # ONLY this address becomes admin
APP_URL=https://smartdh.ma
NODE_ENV=production
PORT=3000
```

Then fix ownership (the app writes to `data/` and `public/uploads/`):

```bash
mkdir -p /var/www/smartdh/data /var/www/smartdh/public/uploads
chown -R smartdh:smartdh /var/www/smartdh
chmod 600 /var/www/smartdh/.env
```

## 7. Run it as a service

```bash
cp /var/www/smartdh/deploy/smartdh.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now smartdh
systemctl status smartdh --no-pager       # should say active (running)
curl -I http://127.0.0.1:3000             # should return 200/302
```

Logs: `journalctl -u smartdh -f`

## 8. nginx + HTTPS

```bash
cp /var/www/smartdh/deploy/nginx.conf /etc/nginx/sites-available/smartdh.ma
ln -sf /etc/nginx/sites-available/smartdh.ma /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

The file already references certificates that don't exist yet, so get them first —
certbot will write the SSL config itself:

```bash
# temporarily comment out the whole 443 server block, then:
nginx -t && systemctl reload nginx
certbot --nginx -d smartdh.ma -d www.smartdh.ma --agree-tos -m your@email.com --redirect
nginx -t && systemctl reload nginx
```

Renewal is automatic (`systemctl status certbot.timer`).

## 9. Claim your admin account — do this immediately

Open **https://smartdh.ma/signup** and register with the **exact `ADMIN_EMAIL`** from `.env`.
That account becomes admin automatically; everyone else lands in *pending* until you approve them.

> Because `ADMIN_EMAIL` is set, nobody else can take admin even if they sign up first.

---

## Updating later

On your PC — push your changes:

```bash
git add -A
git commit -m "what changed"
git push
```

On the VPS — one command:

```bash
cd /var/www/smartdh && sudo bash deploy/update.sh
```

That backs up `data/`, pulls, reinstalls, fixes ownership and restarts.
Player logins survive restarts (sessions live in `data/sessions`), and `.env`
+ `data/` are untouched by `git pull` because they're gitignored.

## Backups

The app keeps hourly rotating snapshots in `data/backups/` (last 12).
Pull a copy to your PC now and then:

```bash
scp -r root@46.224.32.64:/var/www/smartdh/data ./backup-$(date +%F)
```

## Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `systemctl status smartdh` · `journalctl -u smartdh -n 50` |
| Login loops / won't stay logged in | `X-Forwarded-Proto` header present in nginx? `NODE_ENV=production` set? |
| "FATAL: SESSION_SECRET must be set" | `.env` missing or unreadable by the `smartdh` user |
| Uploads fail | `chown -R smartdh:smartdh /var/www/smartdh/public/uploads` · `client_max_body_size` |
| Icons/fonts missing | The server needs outbound internet (Bootstrap/Lucide/Chart.js load from CDN) |
