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
  src/lib/     ported logic (db, locales, email, game rules, session) — pure where views need it
  src/server/  pipeline (the Express middleware chain), router, route handlers by area
  src/pages/   one catch-all page that runs the pipeline; _document/_app shells
  src/views/   the converted EJS templates as React components
```

At cutover `web/` moves to the repo root and the Express files are deleted.

## How the Express behaviour maps onto Next

**Pages Router, server-rendered only.** Every URL hits `src/pages/[[...path]].tsx`, whose
`getServerSideProps` runs the ported Express pipeline (`src/server/pipeline.ts`). A route
handler returns `render(view, data)`, `redirect(url)` (302, like Express), `json()` or `raw()`.
The page sets `unstable_runtimeJS: false`, so the browser gets plain HTML with **no React
runtime and no `__NEXT_DATA__`** — exactly like the EJS output, which is what lets
`public/js/app.js`, Lucide and Bootstrap keep owning the page. (Checked in Next 16.3.7:
`next/dist/pages/_document.js` drops all scripts and page data when the flag is false. It
only applies in production builds; `next dev` still hydrates.)

Why not the App Router: React hydration would fight Lucide/app.js rewriting the DOM, and
route handlers can't render React or re-render a form with its error the way `res.render`
does after a failed POST. `getServerSideProps` handles GET and POST at the same URL.

| Express | Here |
|---|---|
| `express-session` + file store | `src/lib/session.ts`: same cookie signing (`s:<sid>.<hmac>`), same JSON files, 7-day sliding expiry |
| middleware chain (`req.currentUser`, accrual, impersonation, lang, GA event) | `src/server/pipeline.ts`, same order |
| `app.get/post` + `adminRouter` | `src/server/router.ts` (Express matching rules) + `src/server/routes/*` in the same order |
| `res.render(view, locals)` | view components in `src/views/pages/*`, registered in `src/views/registry.ts`; layout values in `src/server/page-props.ts` |
| `res.locals` helpers (`t`, `money`, `planName`, …) | `src/views/helpers.ts` |
| CSRF token + `_csrf` field | same token in the session, checked for every POST (body, `?_csrf=` or `X-CSRF-Token`) |
| admin subdomain (root = admin, `/admin/` stripped from HTML and redirects) | pipeline routes `/` → `/admin` and tries the admin router at the root; redirects are stripped; views build links with `h.ah()` |
| `setInterval` 60 s jobs | `src/instrumentation.ts` (phase 5) |
| multer uploads | `src/server/body.ts` (`formData()`), same names/limits when saved |
| in-memory `db` cache | kept on `globalThis` so every bundle shares one instance |

Views must import only pure modules (`lib/locales`, `lib/text`, `lib/constants`,
`lib/plan-color`, types): the Pages Router also builds a browser bundle for each page, and
server modules (fs, nodemailer) would break it.

The store is deliberately **mutable** (one shared object, atomic write on save), exactly
like `db.js`. Rewriting it to immutable updates would change behaviour; don't.

Inline event handlers (`onsubmit="…"`, `onclick="…"`): React drops string handlers, so
views write `data-raw-onsubmit="…"` and `src/server/html-transform.ts` (run from
`_document.getInitialProps`) turns it back into `onsubmit="…"`. The same transform does the
admin-subdomain `/admin/` → `/` link rewrite over the whole page, exactly like Express.

Known, intentional differences (each one is a fix of an Express quirk; nothing a user relies on):
- `window.MSG` strings are JSON-encoded (EJS HTML-escaped apostrophes inside the JS strings,
  which showed up as `&#39;`).
- Admin → Apps: the EJS card closed the edit `<form>` in the middle of the button row (invalid
  HTML the browser repaired). Next renders valid markup; the Save button joins the edit form via
  `form="edit-<id>"`. Same look, same behaviour.
- Admin → Users: the row for yourself built `disabled title="…"` inside an escaped `<%= %>`, so the
  tooltip came out mangled. Next renders the intended tooltip (the checkbox is disabled in both).

## Phases (tick when pushed)

- [x] 0. Scaffold `web/`, plan doc
- [x] 1. Core libs: db, locales, email, game rules, session, pipeline, router, CSRF, layout
- [x] 2. Layout + public pages: landing, start, guide, terms, privacy, download, contact,
       signup, login, verify, forgot, reset, unsubscribe, pending, error/message/404
       (37 pages and form posts identical in `tests/fidelity/compare.mjs`)
- [x] 3. Player pages: dashboard, invest, withdraw, send, rewards, achievements, activity,
       referral, profile, support, verify-identity, leaderboard, invoice + all player POSTs
       (132 pages and posts identical; multipart uploads still to be exercised in phase 5)
- [x] 4. Admin pages (hub, users, user, deposits, withdrawals, apps, email, tickets, audit,
       invoices, data, test lab, admins, account, settings-*) + all admin POSTs, CSV/JSON
       (comparison: 271 identical, 10 known differences listed below)
- [x] 5. Background jobs (`src/instrumentation.ts` → `src/server/job-timer.ts`), uploads (all 9
       upload forms in the comparison; files saved with the same names and served), QR, emails
       (logged when SMTP is off, as before). Telegram uses the same calls; not sent in tests.
- [x] 6. Fidelity check (346 pages and form posts, Arabic/English/French: 334 identical,
       12 known differences = the two Express bugs below on 12 page variants): run Express and Next on the same copy of the data and diff each
       page's HTML; fix every difference. The tool exists since phase 2
       (`web/tests/fidelity/compare.mjs`, pages listed in `pages.mjs`, made-up data in
       `fixture.mjs`): add every page you port to `pages.mjs` and keep it at "same".
       It ignores only what can't matter: head tag order (React 19 hoists metas/links),
       React's image preload hints and comment separators, attribute order, CSRF/time values.
- [ ] 7. Cutover: move `web/` to root, deploy with a build step, keep port 3830

## Running locally

```bash
cd web && npm install
npm test                      # unit + differential tests against ../server.js
npm run build && node tests/fidelity/compare.mjs [filter]   # Express vs Next, page by page
npm run build && DATA_DIR=/tmp/kz SESSION_SECRET=dev npx next start -p 3031   # production mode (no hydration)
```
