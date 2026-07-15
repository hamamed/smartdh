# 🎮 DirhamVest — play-money investing game

A fun investing **simulator** for friends & family. Invest virtual coins in admin-managed "apps",
earn over time, level up, and compete on the leaderboard.

> ⚠️ **Play money only.** No real money, no real investing. It's a game.
> The deposit bank/RIB/QR details are **demo placeholders** — never put real payment details there
> and never collect real money.

## Run it

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm start
```

Open **http://localhost:3000**. 👉 The **first account you sign up becomes the admin**.

### .env

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | **Required in production.** Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | Port (default 3000) |
| `NODE_ENV` | `production` enables secure cookies + hides error details |
| `APP_URL` | Public URL — used for password-reset links |
| `SMTP_*` | Optional. Without it, emails print to the console. |

## Features

**Players** — home dashboard with live-ticking balances, tinted wallet cards, balance history chart,
XP/levels, daily bonus + streaks, invest in apps, admin-approved deposits & withdrawals with payout
details, send coins, referrals (1% of referred deposits), achievements, activity feed, masked
leaderboard, profile/settings, first-time guided tour.

**Admin** — approve users/deposits/withdrawals, adjust balances, manage investable apps
(name, Lucide icon, rate, min level), game settings, announcements banner, audit log, CSV exports,
user search + pagination.

**Platform** — English/French/Arabic (RTL), light/dark theme, PWA (installs to phone home screen),
CSRF protection, login rate limiting, atomic writes + hourly rotating backups, 404/500 pages.

## Security & data

- **CSRF**: every state-changing request must carry a per-session token.
- **Rate limiting**: 20 auth attempts per IP per 15 minutes.
- **Passwords**: hashed with bcrypt. Reset tokens are single-use and expire in 1 hour.
- **Atomic writes**: `db.json` is written to a temp file then renamed, so a crash can't corrupt it.
- **Backups**: hourly snapshots in `data/backups/` (last 12 kept). If `db.json` is ever unreadable,
  the newest good backup is loaded automatically.

## Deploying

See **[deploy/DEPLOY.md](deploy/DEPLOY.md)** for a full VPS walkthrough (nginx + systemd + HTTPS).
Config lives in `.env` — see `.env.example`. Set **ADMIN_EMAIL** so only you can claim admin.

## Known limitations

- **JSON file storage** — great for a handful of players. Move to SQLite if this grows.

## Scripts

```bash
node scripts/make-icons.js   # regenerate the PWA icons
```

## Data

Everything lives in `data/db.json` (backups in `data/backups/`). Delete `data/` to reset the game.
