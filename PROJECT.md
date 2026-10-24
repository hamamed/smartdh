# KanzUp — Project Guide

Everything needed to **understand, run, and move** this project to another device.

KanzUp is an investing‑style web app (Moroccan Dirham / درهم) for a private friends‑and‑family
audience. Players invest in admin‑managed "apps" (plans), earn over time, deposit/withdraw with
admin approval, send coins to each other, verify their identity, and more. Default language is
**Arabic (RTL)**; French and English are also built in.

- **Live:** https://kanzup.com (players) · https://admin.kanzup.com (admin)
- **Repo:** github.com/hamamed/smartdh (private)
- **Server path (VPS):** `/var/www/smartdh` · **systemd service:** `smartdh`

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (works on Node 18+; developed on Node 24) |
| Server | Express 4 |
| Views | EJS + `express-ejs-layouts` (layout local is `mBody`, not `body`) |
| Storage | **JSON file** at `data/db.json` (no database server) |
| Sessions | `express-session` + `session-file-store` (on disk in `data/sessions/`) |
| Auth | `bcryptjs` password hashes |
| Uploads | `multer` → `public/uploads/` (avatars, app images, receipts, CIN, tickets) |
| Email | `nodemailer` (optional SMTP; prints to console if unset) |
| QR codes | `qrcode` (deposit RIB QR) |
| Rate limiting | `express-rate-limit` (auth routes) |
| Front‑end | Bootstrap 5.3 (RTL), Lucide icons, Chart.js — all via CDN |
| PWA | `public/manifest.webmanifest` + `public/sw.js` |
| Telegram | Bot API via global `fetch` (no dependency) |

There is **no build step**. `npm install` then `node server.js`.

---

## 2. Quick start (fresh machine)

```bash
git clone https://github.com/hamamed/smartdh.git
cd smartdh
npm install
cp .env.example .env     # then edit .env (see §5)
npm start
```

Open **http://localhost:3000**. The **first account that signs up becomes the admin**
(or set `ADMIN_EMAIL` so only that address does).

---

## 3. Moving the project to another device ⭐

The code lives in git, but the **data does not** (`data/`, `.env`, and `public/uploads/` are
git‑ignored). To move a *working* instance with its users and money, copy these too.

**What to carry over:**

| Item | In git? | How to move |
|---|---|---|
| Source code | ✅ yes | `git clone` (or `git pull`) |
| `node_modules/` | ❌ no | recreate with `npm install` |
| `.env` | ❌ no | **copy manually** (secrets) |
| `data/db.json` | ❌ no | **copy** — this is all users, money, apps, tickets, settings |
| `data/backups/` | ❌ no | optional (hourly auto‑backups) |
| `data/sessions/` | ❌ no | optional — if skipped, everyone just logs in again |
| `public/uploads/` | ❌ no | **copy** — avatars, app images, receipts, CIN photos |
| `*.keystore` | ❌ no | the Android signing key, if you made one (keep private) |

**Steps on the new device:**

```bash
# 1. get the code
git clone https://github.com/hamamed/smartdh.git
cd smartdh
npm install

# 2. bring over the live state (from the old machine/VPS), e.g. with scp/rsync:
#    - .env
#    - data/            (at least data/db.json)
#    - public/uploads/
# Place them at the project root, preserving paths.

# 3. run
npm start            # or set up systemd (see §6)
```

On first start, `db.js` **migrates** the copied `db.json` forward automatically (adds any new
fields with safe defaults), so an older backup still works.

> **Tip:** the simplest full backup of a running instance is to stop the service and copy the
> whole `data/` folder + `.env` + `public/uploads/`.

---

## 4. Daily deploy to the VPS

The VPS checks out the repo and runs it under systemd. Normal deploy is:

```bash
cd /var/www/smartdh && git pull && systemctl restart smartdh
```

(If `git pull` complains about local changes to tracked files, commit/stash or `git checkout --`
those files first.) `data/` is untouched by pulls because it's git‑ignored.

---

## 5. Environment variables (`.env`)

Copy `.env.example` → `.env`. Full list:

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | **prod** | Signs session cookies. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` | recommended | Only this email becomes admin on signup. Empty = first signup wins (unsafe publicly). |
| `APP_URL` | prod | Public base URL (emails, reset/verify links, Telegram deep links). No trailing slash. |
| `ADMIN_URL` | optional | Where the "Admin" button points (e.g. `https://admin.kanzup.com`). |
| `COOKIE_DOMAIN` | if admin subdomain | Shares login across root + admin subdomain, e.g. `.kanzup.com` (leading dot). Empty on localhost. |
| `NODE_ENV` | prod | `production` → secure cookies + hides error stack traces. |
| `PORT` | optional | Listen port (default 3000). nginx proxies to it. |
| `CONTACT_EMAIL` | optional | Inbox for the contact form + ticket pings. |
| `APK_URL` | optional | Direct link for the Android APK download button (see §15). |
| `SMTP_HOST` | optional | SMTP server. **Empty = emails print to the log instead of sending.** |
| `SMTP_PORT` | optional | Usually 587. |
| `SMTP_SECURE` | optional | `true` for port 465, else `false`. |
| `SMTP_USER` / `SMTP_PASS` | optional | SMTP credentials. |
| `SMTP_FROM` | optional | From header, e.g. `KanzUp <no-reply@kanzup.com>`. |
| `TELEGRAM_BOT_TOKEN` | optional | Fallback bot token (can also be set in Admin → Telegram). |
| `TELEGRAM_CHAT_ID` | optional | Fallback chat ID (can also be set in Admin → Telegram). |

---

## 6. Running in production (systemd + nginx)

**systemd unit** (`/etc/systemd/system/smartdh.service`), roughly:

```ini
[Unit]
Description=KanzUp (smartdh)
After=network.target

[Service]
WorkingDirectory=/var/www/smartdh
ExecStart=/usr/bin/node server.js
Restart=always
EnvironmentFile=/var/www/smartdh/.env
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now smartdh
systemctl restart smartdh      # after each deploy
journalctl -u smartdh -f       # view logs
```

**nginx** reverse‑proxies `kanzup.com` and `admin.kanzup.com` to `http://127.0.0.1:3000`.
The admin subdomain sends its root to `/admin` (the app serves admin pages at the root on the
admin host, and under `/admin` everywhere). `app.set('trust proxy', 1)` is on for correct IPs.

---

## 7. Project structure

```
server.js                 # the whole app: routes, middleware, helpers, cron
db.js                     # JSON store: load/save/migrate/backup + DEFAULTS schema
email.js                  # sendMail (nodemailer) + renderEmail (branded HTML) + textToHtml
locales.js                # i18n: t(lang,key,vars); LANGS=['ar','en','fr']; DEFAULT_LANG='ar'
views/                    # EJS templates (player pages)
  layout.ejs              #   shell: header, footer, bottom-nav, window.MSG, GA tag
  home.ejs invest.ejs withdraw.ejs send.ejs activity.ejs ...
  verify-identity.ejs     #   KYC submission
  admin/                  #   admin pages (hub, users, deposits, withdrawals, apps, settings-*, …)
public/
  css/style.css           # Daylight theme (emerald + honey amber), tokens, components
  js/app.js               # client: charts, flash, timeAgo, PWA install, previews, pickers
  uploads/                # user uploads (git-ignored)
  manifest.webmanifest sw.js icons/   # PWA
scripts/                  # one-off helpers (see §17)
data/                     # db.json, backups/, sessions/  (git-ignored)
twa-manifest.json         # Android TWA (Bubblewrap) config
.github/workflows/build-apk.yml   # CI that builds the signed APK
```

---

## 8. Data model (`data/db.json`)

Single JSON object. Top‑level keys and the important shapes (defaults live in `db.js` → `DEFAULTS`,
and `migrate()` fills missing fields on load):

```
users: [ {
  id, name, email, passwordHash, isAdmin, role,          // role: owner|manager|moderator|support
  status: 'pending'|'active'|'rejected',
  earnings, invested: { <planId>: amount },              // balances
  xp, achievements: [], streak: { count, lastClaim },
  payout: { method:'paypal'|'bank', name, paypal, rib },
  referralCode, referredBy, referralEarnings, refAccrued,
  avatar, lang, isTest, onboarded, gsDismissed,
  emailVerified, verifyToken, emailToken, emailOptOut,
  lastLogin, logins: [{at,ip}], lastSeen,                // presence
  notices: [{ id, text, at, read }],                     // admin→player dashboard messages
  kyc: { status:'none'|'requested'|'submitted'|'approved'|'rejected',
         fullName, dob, address, cinFront, cinBack, reviewNote,
         requestedAt, submittedAt, reviewedAt },
  transactions: [{ type, amount, note, at, ref }]        // ref = transfer id for receipts
} ],
deposits:    [{ id, userId, plan, planLabel, amount, status, note, receipt,
                createdAt, approvedAt, expiresAt, cancelledAt }],
withdrawals: [{ id, userId, amount, from, fromLabel, method, payoutName, payoutAccount,
                status:'pending'|'paid'|'rejected', rejectReason, rejectNote, createdAt }],
transfers:   [{ id, fromId, fromName, toId, toName, amount, createdAt }],   // coin sends
tickets:     [{ id, userId, topic, subject, status, messages:[{from,authorName,text,at,file,…}],
                createdAt, updatedAt }],
schedules:   [{ id, userId, plan, amount, frequency, nextRun, active }],    // recurring deposits
audit:       [{ id, at, adminId, adminName, action, details }],
settings: {
  siteName, currency, brandMode, logoUrl, emailLogoUrl,
  plans: [{ id, name, icon, imageUrl, ratePer15Days, color, desc, link,
            fixedAmount, minLevel, published }],          // "apps"
  minAddFunds, minWithdraw, minTransfer, withdrawEveryDays, depositLockDays,
  referralTiers: [t1,t2,t3], dailyBonusBase,
  leaderboardEnabled, dailyBonusEnabled,
  depositInfo: { bankName, accountName, rib, note },
  announcement: { text, enabled },
  campaign: { enabled, title, inviteGoal, minDeposit, requireActive,
              coinsPerInvite, xpPerInvite, rewardCoins, rewardXp, maxClaims, countFrom },
  telegram: { enabled, botToken, chatId },
  homeStats: { enabled, start, users:{base,min,spread}, payouts:{…}, coins:{…} },  // landing growth
  payout: { method, name, paypal, rib }
},
next*Id: …   // nextUserId, nextWithdrawId, nextDepositId, nextTransferId, nextAppId, nextAuditId, nextTicketId, nextScheduleId
```

`db.js` API: `load()` (cached), `save(db)` (atomic write + hourly backup), `migrate(db)`,
`replaceAll()`, `wipe()`. **Note:** a Node script that writes `db.json` directly is not seen by the
running server until `systemctl restart smartdh` (the server holds one in‑memory cache).

---

## 9. Features — Players

- **Dashboard** with live‑ticking balances, wallet cards, balance‑history chart (hourly/daily/
  weekly/monthly), XP/level, getting‑started checklist, dismissible **admin messages (notices)**.
- **Invest** page: browse **published** apps only; invest a custom amount or a **fixed amount**
  (with a confirm modal). **Move investment** between apps (only unlocked funds; destination must
  be unlocked for the level). App color is automatic: **gold** = fixed‑amount, **red** = ≤30%/15d,
  **green** = above.
- **Deposits**: request a deposit → shown the bank/RIB + QR → must send money within **24h** or it
  **auto‑cancels** (notice + email). Admin approves to credit it.
- **Withdraw**: only after an approved deposit; respects min amount, cadence (every N days), and the
  **deposit lock** window. Payout details come from the profile. Rejections show a **reason** on the
  page + email (e.g. "deposit not cleared yet — up to 15 days").
- **Send coins** to another player (by email or referral code); **Transfer history** (sent +
  received, incl. old ones) is shown inline with **printable PDF receipts**.
- **Identity verification (KYC)**: when an admin requests it, submit name, date of birth, address,
  and **CIN front/back** photos; status shown on‑platform + email.
- **Rewards**: daily bonus + login streak (admin‑toggleable).
- **Referrals**: share a code; earn commission on team earnings via `referralTiers` (3 levels).
- **Invite challenge** (when admin enables it): invite N qualifying players for coin/XP rewards.
- **Achievements**, **activity feed**, **masked leaderboard** (admin‑toggleable), **guide**,
  **profile/settings** (language, email opt‑out, avatar, password, payout details), **contact form**,
  printable **invoices** for deposits/withdrawals/transfers.
- **PWA / Android**: installable; a `/download` page explains install + hosts the APK when built.

## 10. Features — Admin

Admin hub (`/admin`, or root on the admin subdomain):

- **Needs‑attention** panel first (pending users/deposits/withdrawals/KYC/tickets), **Online now**
  (live presence, polls every 45s, players only), site stats + trends chart + activity feed.
- **Users**: search, paginate, approve/reject, edit balances, **add earnings**, set XP/password,
  impersonate (read‑only), login history, presence, **send a message** (dashboard + email),
  **request/review KYC** (view CIN images, approve/reject).
- **Deposits / Withdrawals**: approve/pay/reject; reject‑with‑reason modal; KYC badge + request on
  pending withdrawals; manual deposit/withdrawal entry with dates & receipts.
- **Apps**: edit cards; **bulk‑generate** 100+ random apps (variable + fixed up to 100,000 MAD),
  **unpublished** until you **publish**; filter Published/Hidden/All.
- **Invoices** list, **Tickets** (support inbox + replies), **Email** broadcasts (audiences incl.
  "no deposit yet"; optional dashboard notice), **Audit log**, **Data** export/import, **Test Lab**
  (test users excluded from real stats), **Admins & roles** (RBAC), **Account**.
- **Settings** (one menu → sub‑pages): General, Economy (limits, tiers, daily bonus, leaderboard,
  landing‑number growth), Payments (bank/RIB/QR), Announcement, Invite challenge, **Telegram alerts**.

---

## 11. Economy mechanics (where to look in `server.js`)

- **Accrual** `accrue(user, db)`: earnings grow continuously from each app's `ratePer15Days`
  (per‑second), settled on every authenticated request.
- **Referral commission** `payReferrals`: a cut of what the team *earns* (not deposits), 3 tiers.
- **Deposit lock** `depositLockDays` / `withdrawableInApp`: new deposits can't be withdrawn (or
  moved) for N days.
- **Deposit 24h expiry**: self‑service deposit requests carry `expiresAt`; a 60‑second sweep
  (`expirePendingDeposits`) cancels unpaid ones. Admin‑made deposits never expire.
- **Plan color** `planColor(p)`: gold/red/green rule above.
- **Landing "social‑proof" growth** `homeStats`: shown Users/Payouts/Coins climb daily by a seeded
  random amount (deterministic, no cron). Admin‑tunable; can be disabled.

---

## 12. Internationalization

- `locales.js`: `t(lang, key, vars)` with `{var}` interpolation. `LANGS = ['ar','en','fr']`,
  `DEFAULT_LANG = 'ar'`. Arabic is RTL (Bootstrap RTL + `dir`).
- Data‑driven names use helpers: `planName`, `planDesc`, `achName`, `txLabel`, `statusLabel`,
  `rejectReason`, and **`txNote`** (translates stored English notes like "From X" / "Earnings" /
  achievement names at render time). Mixed‑direction names are wrapped in `<bdi>` to render
  correctly in RTL.

---

## 13. Email

`email.js` → `sendMail(to, subject, html, opts)`. If `SMTP_HOST` is **empty**, emails are **logged,
not sent** (dev‑friendly). `mailUser(user, {...})` builds a branded, localized email and respects
each user's `emailOptOut` for broadcasts. Account/security mails always send.

---

## 14. Telegram notifications

Admin → **Telegram alerts**: enable, paste **Bot token** (@BotFather) + **Chat ID** (@userinfobot
for a person, @getidsbot for a group → negative `-100…` id), **Send test**. Pushes: new signup,
deposit request, withdrawal request, KYC submitted, new ticket, contact message. Fire‑and‑forget
(never blocks or breaks a request). Token/chat can also come from env.

---

## 15. Android app / PWA

- **PWA**: installable from any browser (the `/download` page + an "Install app" button).
- **APK**: a **TWA** (Trusted Web Activity) built by **GitHub Actions**
  (`.github/workflows/build-apk.yml`) using Bubblewrap and `twa-manifest.json`. Requires signing
  secrets (`ANDROID_KEYSTORE_BASE64`, `KEY_ALIAS`, `KEY_STORE_PASSWORD`, `KEY_PASSWORD` — generate
  the keystore with `scripts/make-keystore.ps1`). The workflow commits the APK into
  `public/downloads/` so it ships with `git pull`; the `/download` button links to it (or set
  `APK_URL`). Served Digital Asset Links at `/.well-known/assetlinks.json`. See `ANDROID.md`.

---

## 16. Background jobs

One `setInterval` (60s) in `server.js`: runs due **recurring deposit schedules**
(`runSchedules`) and the **deposit‑expiry sweep** (`expirePendingDeposits`). Hourly DB backups are
handled inside `db.js` `save()`.

---

## 17. Helper scripts (`scripts/`)

Run with `node scripts/<file>` (they write `data/db.json` → **restart the server after**):

| Script | Purpose |
|---|---|
| `make-icons.js` | Generate PWA icons. |
| `make-email-pattern.js` | Generate the email header banner `public/email/pattern.png`. |
| `make-test-users.js` / `seed-test-users.js` | Seed users for testing. |
| `set-password.js` | Set a user's password from the CLI. |
| `make-keystore.ps1` | (PowerShell) Create the Android signing keystore + print the GitHub secrets. |

---

## 18. Backups & restore

- **Automatic:** `db.js` writes an hourly snapshot into `data/backups/` on save.
- **Manual:** copy `data/db.json` somewhere safe.
- **Restore:** stop the service, replace `data/db.json` with the backup, start the service.
- **Admin → Data:** export/import from the UI.

---

## 19. Testing locally (safe pattern)

The data dir is fixed to `data/`. To test without touching real data, move it aside first:

```bash
mv data data__BACKUP                       # hide real data
PORT=4599 SESSION_SECRET=test ADMIN_EMAIL=admin@test.com node server.js   # fresh db in data/
# ... test against http://localhost:4599 ; first signup (admin@test.com) is admin ...
# stop the server, then:
rm -rf data && mv data__BACKUP data        # restore real data
```

Kill a test server on Windows/PowerShell:
`Get-NetTCPConnection -LocalPort 4599 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`

---

## 20. Security notes

- **CSRF**: every state‑changing request must echo the session token. Multipart routes run
  `csrfGuard` *before* multer, reading the token from `?_csrf=` in the form action.
- **Sessions**: cookie `kz.sid`, HTTP‑only, `secure` in production, optional `COOKIE_DOMAIN`.
- **RBAC**: roles `owner|manager|moderator|support`; `res.locals.can(perm)` gates admin UI/routes.
- **Rate limiting** on auth routes; signup has a honeypot + min‑time bot trap + email verification.
- The deposit **bank/RIB/QR** are whatever the admin sets in Payments — treat with care.
- Never commit `.env`, `data/`, `public/uploads/`, or `*.keystore` (already git‑ignored).

---

## 21. Troubleshooting

| Symptom | Fix |
|---|---|
| `git pull` refuses (local changes) | commit/stash, or `git checkout -- <files>` on the VPS, then pull. |
| Emails not arriving | `SMTP_*` not set → they only print to the log. Configure SMTP. |
| Telegram test fails | You must message the bot once first; for groups use the negative `-100…` chat id. |
| Changes to `db.json` not showing | restart the service — the server caches the DB in memory. |
| Everyone logged out after deploy | normal if `data/sessions/` wasn't carried over; they just log back in. |
| New device "lost" users/money | you didn't copy `data/db.json` — see §3. |

---

*This file documents the project as it currently stands. Keep it updated as features change.*
