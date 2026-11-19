# KanzUp → Next.js + React port

Branch: `nextjs`. Started 2026-11-19 at the owner's request: "change the site to React and
Next.js but same design". Owner chose to **keep every feature exactly as it works today**.

## Goal

Same site, new stack. A player or admin must not notice the switch:

- **Same URLs**, same forms posting to the same addresses, same redirects.
- **Same HTML/CSS**: every EJS view becomes a React server component that renders the same
  markup; `public/css/style.css` and `public/js/app.js` are reused unchanged (copied into
  `web/public/`). Bootstrap/Lucide/Chart.js stay on the CDN, as in `views/layout.ejs`.
- **Same data**: reads and writes the same `data/db.json` (same shape, same `migrate()`),
  same `public/uploads/`.
- **Same sessions**: the `kz.sid` cookie and `data/sessions/*.json` files stay
  express-session/session-file-store compatible, so nobody is logged out at cutover.

## Layout during the port

```
/            the live Express app (reference; untouched until cutover)
/web         the Next.js app (Next 16.3.7, React 19.2.8, TypeScript)
  src/lib/   ported logic (db, locales, email, game rules, session, request context)
  src/app/   pages (one per old route) + one route handler that runs every form POST
  src/views/ the converted EJS templates as React components
```

At cutover `web/` moves to the repo root and the Express files are deleted.

## How the Express behaviour maps onto Next

| Express | Next.js |
|---|---|
| `express-session` + file store | `src/lib/session.ts`: same cookie signing (`s:<sid>.<hmac>`), same JSON files |
| global middleware (`req.currentUser`, accrual, `res.locals.*`) | `src/lib/context.ts` → `getCtx()`, cached per request with React `cache()` |
| `app.post('/x')` handlers | `src/proxy.ts` rewrites every non-asset POST to `/api/form/<path>`; `src/app/api/form/[...path]/route.ts` dispatches to the ported handler |
| CSRF token in session + `_csrf` field | same token, checked in the form dispatcher |
| admin subdomain (root = admin, `/admin/` stripped from HTML) | proxy rewrites admin-host paths to `/admin/...`; links go through `adminHref()` |
| `setInterval` 60 s jobs | `src/instrumentation.ts` `register()` starts the same timer once |
| multer uploads | `request.formData()` + same file names, size and type limits |
| in-memory `db` cache | kept on `globalThis` so pages and route handlers share one instance |

The store is deliberately **mutable** (one shared object, atomic write on save), exactly
like `db.js`. Rewriting it to immutable updates would change behaviour; don't.

## Phases (tick when pushed)

- [ ] 0. Scaffold `web/`, plan doc
- [ ] 1. Core libs: db, locales, email, game rules, session, context, CSRF, proxy
- [ ] 2. Layout + public pages: landing, start, guide, terms, privacy, download, contact,
       signup, login, verify, forgot, reset, unsubscribe, pending, error/message/404
- [ ] 3. Player pages: dashboard, invest, withdraw, send, rewards, achievements, activity,
       referral, profile, support, verify-identity, leaderboard, invoice + all player POSTs
- [ ] 4. Admin pages (hub, users, user, deposits, withdrawals, apps, email, tickets, audit,
       invoices, data, test lab, admins, account, settings-*) + all admin POSTs, CSV/JSON
- [ ] 5. Background jobs, uploads, QR, Telegram, emails end-to-end
- [ ] 6. Fidelity check: run Express and Next on the same copy of the data and diff each
       page's HTML; fix every difference
- [ ] 7. Cutover: move `web/` to root, deploy with a build step, keep port 3830

## Running locally

```bash
cd web && npm install
DATA_DIR=../data UPLOAD_DIR=../public/uploads SESSION_SECRET=dev npm run dev   # :3031
```
