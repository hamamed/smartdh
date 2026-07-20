require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const ejsLayouts = require('express-ejs-layouts');
const { load, save, refCode, replaceAll, wipe } = require('./db');
const { sendMail, renderEmail, textToHtml } = require('./email');
const { locales, LANGS, DEFAULT_LANG, t } = require('./locales');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');

// ---------- Avatar uploads ----------
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_IMAGES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) =>
      cb(null, 'u' + req.session.userId + '-' + crypto.randomBytes(8).toString('hex') + (ALLOWED_IMAGES[file.mimetype] || '.jpg'))
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 }, // 3 MB
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED_IMAGES[file.mimetype]) // images only
});

// Remove a previously uploaded avatar (never touch anything outside /uploads).
function deleteUpload(avatar) {
  if (!avatar || !avatar.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(avatar));
  fs.unlink(file, () => {});
}

// Product images for investment apps.
const uploadAppImg = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, 'app-' + crypto.randomBytes(8).toString('hex') + (ALLOWED_IMAGES[file.mimetype] || '.jpg'))
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED_IMAGES[file.mimetype])
});

// Site logo (admin branding).
const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, 'logo-' + crypto.randomBytes(8).toString('hex') + (ALLOWED_IMAGES[file.mimetype] || '.png'))
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED_IMAGES[file.mimetype])
});

// Deposit receipt images (admin manual deposits).
const uploadReceipt = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, 'rcpt-' + crypto.randomBytes(8).toString('hex') + (ALLOWED_IMAGES[file.mimetype] || '.jpg'))
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED_IMAGES[file.mimetype])
});

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
// Optional admin subdomain (e.g. https://admin.kanzup.com). The subdomain's nginx
// sends its root to /admin, so we link to the bare host. Falls back to the /admin
// path on whatever host the user is on.
const ADMIN_URL_LINK = process.env.ADMIN_URL ? process.env.ADMIN_URL.replace(/\/+$/, '') : '/admin';
// Host of the admin subdomain (from ADMIN_URL), e.g. "admin.kanzup.com". When a
// request comes in on this host, admin pages are served at the ROOT (clean URLs
// like /users), while everything still works under /admin on every host.
const ADMIN_HOST = process.env.ADMIN_URL ? (() => { try { return new URL(process.env.ADMIN_URL).host.toLowerCase(); } catch (e) { return ''; } })() : '';
// A request is "on the admin host" if it matches ADMIN_URL's host, or simply if
// the hostname starts with "admin." (so it works even if ADMIN_URL is unset).
const onAdminHost = (req) => {
  const h = (req.hostname || '').toLowerCase();
  return (!!ADMIN_HOST && h === ADMIN_HOST) || h.startsWith('admin.');
};
// All admin routes live on this router — mounted at /admin everywhere, and at the
// root on the admin host (see the mounts near the bottom).
const adminRouter = express.Router();

// ---------- Admin roles (RBAC) ----------
// Each role grants a set of permissions. 'owner' has '*' (everything, incl. managing
// admins). Order here = order shown in the UI.
const ROLES = {
  owner:     { perms: ['*'] },
  manager:   { perms: ['users', 'deposits', 'withdrawals', 'email', 'apps', 'settings', 'audit', 'test'] },
  moderator: { perms: ['users', 'deposits', 'withdrawals', 'audit'] },
  support:   { perms: ['users', 'audit'] }
};
const PERMS = ['users', 'deposits', 'withdrawals', 'email', 'apps', 'settings', 'data', 'audit', 'test', 'admins'];

function roleOf(u) { return (u && u.isAdmin) ? (ROLES[u.role] ? u.role : 'owner') : null; }
function hasPerm(u, perm) {
  if (!u || !u.isAdmin) return false;
  const r = ROLES[roleOf(u)];
  return !!r && (r.perms.includes('*') || r.perms.includes(perm));
}
// Which permission an admin path needs (null = any admin: the hub, own account, invoices, charts).
function permForPath(p) {
  if (p === '/' || p === '' || p.startsWith('/account') || p.startsWith('/invoice')
      || p.startsWith('/stats.json') || p.startsWith('/analytics.json')) return null;
  if (p.startsWith('/admins') || p.startsWith('/toggle-admin')) return 'admins';
  if (p.startsWith('/users') || p.startsWith('/approve') || p.startsWith('/reject') || p.startsWith('/adjust') || p.startsWith('/delete')) return 'users';
  if (p.startsWith('/deposits') || p.startsWith('/deposit/') || p.startsWith('/schedules')) return 'deposits';
  if (p.startsWith('/withdrawals') || p.startsWith('/withdraw/')) return 'withdrawals';
  if (p.startsWith('/email')) return 'email';
  if (p.startsWith('/apps')) return 'apps';
  if (p.startsWith('/settings')) return 'settings';
  if (p.startsWith('/data') || p.startsWith('/export') || p.startsWith('/import') || p.startsWith('/restore') || p.startsWith('/wipe')) return 'data';
  if (p.startsWith('/audit')) return 'audit';
  if (p.startsWith('/test')) return 'test';
  return null;
}
// Enforce role permissions across the whole admin router. requireAdmin on each
// route still handles logged-out / non-admin; this adds the per-permission gate.
adminRouter.use((req, res, next) => {
  const u = req.currentUser;
  if (!u || !u.isAdmin) return next();
  const perm = permForPath(req.path);
  if (perm && !hasPerm(u, perm)) {
    return res.status(403).render('message', {
      title: req.t('forbidden_title'), heading: req.t('forbidden_h'), mBody: req.t('perm_denied'),
      mIcon: 'shield-alert', mTint: 'ti-coral'
    });
  }
  next();
});
const DAY = 1000 * 60 * 60 * 24;

// ---------- Session secret ----------
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (PROD) {
    console.error('FATAL: SESSION_SECRET must be set in production. See .env.example');
    process.exit(1);
  }
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠  No SESSION_SECRET in .env — using a random one (logins reset on restart).');
}

// Cache-busting stamp for /css/style.css and /js/app.js. nginx caches them for days
// and the service worker caches them cache-first, so without a changing URL a deploy
// would never reach browsers that already loaded the old files.
const ASSET_V = (() => {
  try {
    const h = crypto.createHash('sha1');
    for (const f of ['public/css/style.css', 'public/js/app.js']) {
      h.update(fs.readFileSync(path.join(__dirname, f)));
    }
    return h.digest('hex').slice(0, 8);
  } catch (e) {
    return String(Date.now()); // worst case: bust on every restart
  }
})();

// Who becomes admin. On a public URL "first signup wins" is dangerous — a stranger
// could claim admin before you. Set ADMIN_EMAIL in .env and only that address does.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (PROD && !ADMIN_EMAIL) {
  console.warn('⚠  ADMIN_EMAIL is not set — the FIRST account to sign up becomes admin. Set it in .env.');
}

// ---------- Achievements ----------
const ACHIEVEMENTS = {
  first_deposit:  { icon: 'sprout',    name: 'First Deposit', desc: 'Made your first investment' },
  first_withdraw: { icon: 'banknote',  name: 'Cashed Out',    desc: 'Made your first withdrawal' },
  generous:       { icon: 'gift',      name: 'Generous',      desc: 'Sent coins to a friend' },
  recruiter:      { icon: 'user-plus', name: 'Recruiter',     desc: 'Referred a new player' },
  saver_10k:      { icon: 'coins',     name: 'Saver',         desc: 'Reached 10,000 total' },
  saver_100k:     { icon: 'landmark',  name: 'Big Money',     desc: 'Reached 100,000 total' },
  millionaire:    { icon: 'crown',     name: 'Millionaire',   desc: 'Reached 1,000,000 total' },
  streak_7:       { icon: 'flame',     name: 'On Fire',       desc: '7-day login streak' }
};

// Transaction display metadata
const TX = {
  deposit_request:    { icon: 'hourglass',   label: 'Deposit requested',     cls: 'secondary', sign: '' },
  deposit:            { icon: 'arrow-up',     label: 'Invested',              cls: 'primary',   sign: '' },
  withdraw_request:   { icon: 'hourglass',    label: 'Withdrawal requested',  cls: 'warning',   sign: '-' },
  withdraw_paid:      { icon: 'banknote',     label: 'Withdrawal paid',       cls: 'success',   sign: '-' },
  withdraw_rejected:  { icon: 'rotate-ccw',   label: 'Withdrawal refunded',   cls: 'secondary', sign: '+' },
  transfer_out:       { icon: 'send',         label: 'Sent coins',            cls: 'danger',    sign: '-' },
  transfer_in:        { icon: 'inbox',        label: 'Received coins',        cls: 'success',   sign: '+' },
  daily_bonus:        { icon: 'gift',         label: 'Daily bonus',           cls: 'success',   sign: '+' },
  referral_bonus:     { icon: 'user-plus',    label: 'Referral bonus',        cls: 'success',   sign: '+' },
  achievement:        { icon: 'trophy',       label: 'Achievement unlocked',  cls: 'warning',   sign: '' },
  campaign_reward:    { icon: 'party-popper',  label: 'Challenge reward',      cls: 'success',   sign: '+' },
  campaign_invite:    { icon: 'user-check',    label: 'Invite bonus',          cls: 'success',   sign: '+' },
  admin_adjust:       { icon: 'shield',       label: 'Admin adjustment',      cls: 'secondary', sign: '' }
};

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// ---------- Middleware ----------
app.set('trust proxy', 1); // correct client IPs behind a host's proxy (rate limiting)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Sessions are stored on disk, so a restart/deploy doesn't log everyone out.
const FileStore = require('session-file-store')(session);
app.use(session({
  // Renamed from 'dv.sid' so any stale host-only cookie from before COOKIE_DOMAIN
  // is orphaned (ignored) instead of colliding with the new domain-wide cookie.
  name: 'kz.sid',
  store: new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 60 * 60 * 24 * 7,     // 7 days
    retries: 1,
    reapInterval: 60 * 60,     // clean expired sessions hourly
    logFn: () => {}            // its default logger is very noisy
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // COOKIE_DOMAIN=.kanzup.com shares the login across kanzup.com + admin.kanzup.com.
  // Unset (localhost / single domain) → host-only cookie, which is correct there.
  cookie: { maxAge: DAY * 7, httpOnly: true, sameSite: 'lax', secure: PROD, domain: process.env.COOKIE_DOMAIN || undefined }
}));

// ---------- CSRF protection ----------
// Every session gets a token; every POST must echo it back (form field or header).
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  res.locals.assetV = ASSET_V;
  next();
});
// (validation runs after the locals middleware below, so the error page can render)
function csrfGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  // query token supports multipart forms, which are verified before the body is parsed
  const sent = (req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token');
  const expected = req.session.csrf;
  const ok = !!sent && !!expected && sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) {
    return res.status(403).render('error', {
      title: req.t('err_csrf_t'), code: 403,
      heading: req.t('err_csrf_t'), mBody: req.t('err_csrf_d')
    });
  }
  next();
}

// ---------- Rate limiting ----------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,                       // 20 auth attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts. Please try again later.'
});

app.use((req, res, next) => {
  const db = load();
  let user = req.session.userId ? (db.users.find(u => u.id === req.session.userId) || null) : null;
  // Impersonation: an admin can view the game AS a player. currentUser becomes the
  // target; realAdmin remembers who it really is. Writes are blocked below.
  if (user && user.isAdmin && req.session.impersonate) {
    const target = db.users.find(u => u.id === req.session.impersonate);
    if (target) { res.locals.realAdmin = user; user = target; }
    else delete req.session.impersonate;
  }
  res.locals.impersonating = !!res.locals.realAdmin;
  if (user) { accrue(user, db); flushReferralTx(user); save(db); }
  // Language
  const lang = LANGS.includes(req.session.lang) ? req.session.lang : DEFAULT_LANG;
  const tr = (key, vars) => t(lang, key, vars);
  req.db = db;
  req.currentUser = user;
  req.t = tr;
  res.locals.lang = lang;
  res.locals.dir = locales[lang].dir;
  res.locals.LANGS = LANGS;
  res.locals.locales = locales;
  res.locals.t = tr;
  res.locals.currentUser = user;
  // Where the "Admin" button points. Set ADMIN_URL=https://admin.kanzup.com to
  // send admins to the subdomain; defaults to the /admin path on the same host.
  res.locals.adminUrl = ADMIN_URL_LINK;
  // The main game site — used by the admin panel to link back to the player area
  // (so "back to dashboard" leaves the admin subdomain).
  res.locals.appUrl = APP_URL;
  res.locals.can = (perm) => hasPerm(user, perm);   // gate admin UI by permission
  res.locals.roleOf = roleOf;
  res.locals.settings = db.settings;
  res.locals.plans = db.settings.plans;
  res.locals.ACH = ACHIEVEMENTS;
  res.locals.TX = TX;
  // Translation helpers for data-driven names
  res.locals.planName = (p) => { const k = 'plan_' + p.id; const v = tr(k); return v === k ? p.name : v; };
  res.locals.planDesc = (p) => { const k = 'plan_' + p.id + '_d'; const v = tr(k); return v === k ? p.desc : v; };
  res.locals.achName = (id) => { const k = 'ach_' + id; const v = tr(k); return v === k ? ACHIEVEMENTS[id].name : v; };
  res.locals.achDesc = (id) => { const k = 'ach_' + id + '_d'; const v = tr(k); return v === k ? ACHIEVEMENTS[id].desc : v; };
  res.locals.txLabel = (type) => tr('tx_' + type);
  res.locals.statusLabel = (s) => tr('st_' + s);
  // Language-aware currency label: Arabic shows درهم for the default DH; other
  // languages (or a custom currency) show the setting as-is.
  const curLabel = (lang === 'ar' && ['DH', 'MAD'].includes(db.settings.currency)) ? 'درهم' : db.settings.currency;
  res.locals.curLabel = curLabel;
  res.locals.money = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${curLabel}`;
  next();
});

// ---------- Admin subdomain: clean URLs ----------
// On the admin host the admin panel lives at the root, with no "/admin" in the
// URL. Templates keep their /admin/... links (so a single-domain deploy still
// works); on the admin host we transparently strip the prefix in three places:
//   1) "/" serves the hub (internally routed to /admin — the URL bar stays "/")
//   2) redirects to /admin/... become /...
//   3) rendered HTML has its /admin/ links rewritten to / (all paths are literal
//      strings by render time, so this is a safe, uniform swap)
app.use((req, res, next) => {
  if (onAdminHost(req)) {
    if (req.path === '/') req.url = '/admin' + req.url.slice(1);
    const origRedirect = res.redirect.bind(res);
    res.redirect = (url) => {
      if (typeof url === 'string' && (url === '/admin' || url.startsWith('/admin/'))) url = url.slice(6) || '/';
      return origRedirect(url);
    };
    const origRender = res.render.bind(res);
    res.render = (view, opts) => origRender(view, opts, (err, html) => {
      if (err) return next(err);
      res.send(html
        .replace(/\/admin\//g, '/')     // href/action="/admin/users" → "/users"
        .replace(/"\/admin"/g, '"/"')    // href="/admin" (hub) → "/"
        .replace(/'\/admin'/g, "'/'"));
    });
  }
  next();
});

// Verify CSRF on every state-changing request (locals are ready by now).
// Multipart bodies aren't parsed yet at this point, so those routes run csrfGuard
// again themselves right after multer — they are never left unchecked.
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  csrfGuard(req, res, next);
});

// While impersonating, the session is read-only — the only write allowed is Exit.
app.use((req, res, next) => {
  if (res.locals.impersonating &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.path !== '/admin/stop-impersonate') {
    return res.status(403).render('error', {
      title: req.t('imp_ro_t'), code: 403, heading: req.t('imp_ro_t'), mBody: req.t('imp_ro_d')
    });
  }
  next();
});

app.get('/lang/:code', (req, res) => {
  if (LANGS.includes(req.params.code)) {
    req.session.lang = req.params.code;
    // Remember it on the account too, so their emails go out in this language.
    if (req.currentUser && req.currentUser.lang !== req.params.code) {
      req.currentUser.lang = req.params.code;
      save(req.db);
    }
  }
  const back = req.get('referer');
  res.redirect(back && !back.includes('/lang/') ? back : '/');
});

// ---------- Game helpers ----------
function totalInvested(user) {
  return Object.values(user.invested || {}).reduce((a, b) => a + (b || 0), 0);
}
function totalBalance(user) {
  return totalInvested(user) + (user.earnings || 0);
}
// The daily bonus only unlocks once a player has at least one approved deposit.
function hasApprovedDeposit(db, user) {
  return db.deposits.some(d => d.userId === user.id && d.status === 'approved');
}
// Real (non-test) users. Test accounts are kept out of the live dashboard,
// totals and leaderboard so they never mix with real players and real coins.
function isRealUser(u) { return !u.isTest; }
// Does a deposit/withdrawal belong to a test account? (used to keep test money
// out of the live activity feed)
function isTestActivity(db, row) {
  const u = db.users.find(x => x.id === row.userId);
  return !!(u && u.isTest);
}
function accrue(user, db) {
  const settings = db.settings;
  const now = Date.now();
  const last = user.lastAccrual || now;
  const days = (now - last) / DAY;
  if (days > 0) {
    let gain = 0;
    for (const p of settings.plans) {
      const amt = (user.invested && user.invested[p.id]) || 0;
      if (amt > 0) gain += amt * (p.ratePer15Days / 15) * days;
    }
    if (gain > 0) {
      user.earnings = (user.earnings || 0) + gain;
      payReferrals(db, user, gain);
    }
  }
  user.lastAccrual = now;
}

// Pay the upline a cut of what this player just earned.
// Tier 1 = who invited them, tier 2 = who invited that person, tier 3 = one more up.
// Commission comes from app earnings only — commission never pays commission,
// so this can't compound or loop.
function payReferrals(db, earner, gain) {
  if (!(gain > 0)) return;
  const tiers = db.settings.referralTiers || [];
  let current = earner;
  const seen = new Set([earner.id]); // belt-and-braces against a broken chain
  for (let i = 0; i < tiers.length; i++) {
    if (!current.referredBy || seen.has(current.referredBy)) break;
    const up = db.users.find(u => u.id === current.referredBy);
    if (!up) break;
    seen.add(up.id);
    const cut = gain * (tiers[i] || 0);
    if (cut > 0) {
      up.earnings = (up.earnings || 0) + cut;
      up.referralEarnings = (up.referralEarnings || 0) + cut;
      up.refAccrued = (up.refAccrued || 0) + cut;
    }
    current = up;
  }
}

// ---------- Invite challenge (admin-controlled campaign) ----------
// A player must invite `inviteGoal` people who each deposited at least `minDeposit`
// (approved). Each completed set pays coins + XP. Repeatable up to `maxClaims`.
function campaignStatus(db, user) {
  const c = db.settings.campaign || {};
  const claims = user.campaignClaims || 0;
  const goal = Math.max(1, c.inviteGoal || 1);

  const invitees = db.users.filter(x =>
    x.referredBy === user.id && x.createdAt >= (c.countFrom || 0));
  const qualified = invitees.filter(x => {
    if (c.requireActive && x.status !== 'active') return false;
    const deposited = db.deposits
      .filter(d => d.userId === x.id && d.status === 'approved')
      .reduce((sum, d) => sum + d.amount, 0);
    return deposited >= (c.minDeposit || 0);
  });

  const required = goal * (claims + 1);            // each claim consumes a full set
  const maxed = (c.maxClaims || 0) > 0 && claims >= c.maxClaims;
  return {
    enabled: !!c.enabled,
    title: c.title || '',
    goal, claims, maxed, required,
    invited: invitees.length,
    qualified: qualified.length,
    inStage: Math.max(0, Math.min(goal, qualified.length - goal * claims)),
    canClaim: !!c.enabled && !maxed && qualified.length >= required,
    coinsPerInvite: c.coinsPerInvite || 0,
    xpPerInvite: c.xpPerInvite || 0,
    rewardCoins: c.rewardCoins || 0,
    rewardXp: c.rewardXp || 0,
    minDeposit: c.minDeposit || 0,
    maxClaims: c.maxClaims || 0
  };
}

// Pay the referrer the moment one of their invites first qualifies (approved +
// deposited enough). Guarded by invitee.campaignRewarded so it can only ever pay once
// per invited player, no matter how many deposits they make later.
function maybePayInvite(db, invitee) {
  const c = db.settings.campaign || {};
  if (!c.enabled || invitee.campaignRewarded) return;
  if (invitee.createdAt < (c.countFrom || 0)) return;
  if (c.requireActive && invitee.status !== 'active') return;

  const deposited = db.deposits
    .filter(d => d.userId === invitee.id && d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0);
  if (deposited < (c.minDeposit || 0)) return;

  const ref = invitee.referredBy ? db.users.find(u => u.id === invitee.referredBy) : null;
  if (!ref) return;

  invitee.campaignRewarded = true; // mark first — never pay twice
  const coins = c.coinsPerInvite || 0;
  const xp = c.xpPerInvite || 0;
  if (coins <= 0 && xp <= 0) return;

  accrue(ref, db);
  ref.earnings += coins;
  addXp(ref, xp);
  addTx(ref, 'campaign_invite', coins, invitee.name + (xp ? ' (+' + xp + ' XP)' : ''));
  checkState(ref);
}

// Commission trickles in every second, so roll it into one activity entry per day
// instead of flooding the feed.
function flushReferralTx(user) {
  const now = Date.now();
  if (!user.refAccrued || user.refAccrued < 0.01) return;
  if (user.refLastTx && now - user.refLastTx < DAY) return;
  addTx(user, 'referral_bonus', user.refAccrued, 'Team earnings');
  user.refAccrued = 0;
  user.refLastTx = now;
}
function earningPerSecond(user, settings) {
  let s = 0;
  for (const p of settings.plans) {
    const amt = (user.invested && user.invested[p.id]) || 0;
    s += amt * (p.ratePer15Days / 15) / 86400;
  }
  return s;
}

// ---------- Deposit lock (new deposits can't be withdrawn for N days) ----------
function depositLockDays(db) { return Math.max(0, Number(db.settings.depositLockDays) || 0); }

// When a deposit's funds became available. Manual/back-dated deposits use their
// chosen date; self-service ones use the approval time; older records fall back
// to createdAt.
function maturedAt(d) { return d.approvedAt || d.createdAt || 0; }

// How much of a player's holding in one app is still inside the lock window.
function lockedInApp(db, user, planId) {
  const days = depositLockDays(db);
  if (days <= 0) return 0;
  const cutoff = Date.now() - days * DAY;
  let locked = 0;
  for (const d of db.deposits) {
    if (d.userId !== user.id || d.plan !== planId || d.status !== 'approved') continue;
    if (maturedAt(d) > cutoff) locked += d.amount;
  }
  return Math.min(locked, (user.invested && user.invested[planId]) || 0);
}

function withdrawableInApp(db, user, planId) {
  return Math.max(0, ((user.invested && user.invested[planId]) || 0) - lockedInApp(db, user, planId));
}

// Per-app funds breakdown for the UI: held, locked, available, and when the
// earliest locked deposit unlocks.
function appFunds(db, user, planId) {
  const held = (user.invested && user.invested[planId]) || 0;
  const locked = lockedInApp(db, user, planId);
  let unlockAt = 0;
  if (locked > 0) {
    const days = depositLockDays(db);
    const cutoff = Date.now() - days * DAY;
    for (const d of db.deposits) {
      if (d.userId !== user.id || d.plan !== planId || d.status !== 'approved') continue;
      const m = maturedAt(d);
      if (m > cutoff) { const u = m + days * DAY; if (!unlockAt || u < unlockAt) unlockAt = u; }
    }
  }
  return { held, locked, available: Math.max(0, held - locked), unlockAt };
}
function addTx(user, type, amount, note, at) {
  user.transactions = user.transactions || [];
  user.transactions.push({ type, amount, note: note || '', at: at || Date.now() });
  // keep chronological even when a backdated entry is inserted
  user.transactions.sort((a, b) => a.at - b.at);
  if (user.transactions.length > 120) user.transactions = user.transactions.slice(-120);
}

// The one place a deposit is created + (optionally) credited. Manual entry, batch
// and recurring schedules all go through it so the crediting logic can't drift.
function creditDeposit(db, u, plan, amount, opts) {
  opts = opts || {};
  const status = opts.status === 'pending' ? 'pending' : 'approved';
  const when = opts.when || Date.now();
  const note = opts.note || '';
  db.deposits.push({
    id: db.nextDepositId++, userId: u.id, userName: u.name,
    plan: plan.id, planLabel: plan.name, amount, status, note,
    receipt: opts.receipt || '', byAdmin: true, createdAt: when,
    approvedAt: status === 'approved' ? when : null
  });
  if (status === 'approved') {
    accrue(u, db);
    u.invested[plan.id] = (u.invested[plan.id] || 0) + amount;
    addXp(u, Math.min(200, 10 + Math.floor(amount / 500)));
    addTx(u, 'deposit', amount, plan.name + (note ? ' · ' + note : ''), when);
    award(u, 'first_deposit');
    maybePayInvite(db, u);
    checkState(u);
  } else {
    addTx(u, 'deposit_request', amount, plan.name, when);
  }
}

// A YYYY-MM-DD from a date input → timestamp (noon, to dodge timezone edges).
// Falls back to now, and never allows a future date.
function parseWhen(v) {
  if (!v) return Date.now();
  const t = new Date(v + 'T12:00:00').getTime();
  if (!Number.isFinite(t)) return Date.now();
  return Math.min(t, Date.now());
}
// ---------- Levels & XP ----------
function levelForXp(xp) { return Math.floor(Math.sqrt((xp || 0) / 50)) + 1; }
function xpForLevel(l) { return 50 * (l - 1) * (l - 1); }
// Returns the new level if the user levelled up, otherwise 0.
function addXp(user, n) {
  const before = levelForXp(user.xp);
  user.xp = (user.xp || 0) + n;
  const after = levelForXp(user.xp);
  if (after > before) { notifyLevelUp(user, after); return after; }
  return 0;
}

// The ONE place a user record is created — signup and CSV import both use it, so a
// new field can never be added to one path and forgotten in the other.
function createUser(db, { name, email, passwordHash, isAdmin = false, status = 'pending', referredBy = null, lang = null, isTest = false, role = null }) {
  const id = db.nextUserId++;
  const user = {
    id, name, email, passwordHash,
    isAdmin, status, lang, isTest, role: role || (isAdmin ? 'owner' : null),
    invested: {},
    earnings: 0,
    xp: 0,
    lastAccrual: Date.now(),
    createdAt: Date.now(),
    transactions: [],
    achievements: [],
    history: [],
    streak: { count: 0, lastClaim: null },
    payout: { method: 'paypal', name: '', paypal: '', rib: '' },
    referralEarnings: 0,
    refAccrued: 0,
    refLastTx: 0,
    campaignClaims: 0,
    campaignRewarded: false,
    avatar: '',
    onboarded: false,
    reset: null,
    referralCode: refCode(id),
    referredBy,
    emailToken: crypto.randomBytes(16).toString('hex'),
    emailOptOut: false
  };
  db.users.push(user);
  return user;
}

// ---------- Audit log ----------
function logAudit(db, admin, action, details) {
  db.audit.push({
    id: db.nextAuditId++, at: Date.now(),
    adminId: admin ? admin.id : null,
    adminName: admin ? admin.name : 'system',
    action, details: details || ''
  });
  if (db.audit.length > 500) db.audit = db.audit.slice(-500);
}

// ---------- Notification emails ----------
// One place that builds a branded, on-design email and sends it. `broadcast: true`
// marks a non-essential message (admin newsletter) and is skipped for opted-out
// users; account/security mails leave it false so they always go out.
// The language an email should be written in: an explicit override (e.g. the
// session language at signup) wins, else the account's saved preference, else EN.
function langFor(user, override) {
  if (LANGS.includes(override)) return override;
  if (user && LANGS.includes(user.lang)) return user.lang;
  return DEFAULT_LANG;
}
// A translator bound to a recipient's language — used to build localized subjects/bodies.
function userT(user, override) {
  const l = langFor(user, override);
  return (k, v) => t(l, k, v);
}

function mailUser(user, { subject, heading, intro, lines, bodyHtml, cta, broadcast = false, lang }) {
  if (!user || !user.email) return Promise.resolve({ skipped: true });
  if (broadcast && user.emailOptOut) return Promise.resolve({ skipped: true, optOut: true });
  const uLang = langFor(user, lang);
  const tr = (k, v) => t(uLang, k, v);
  const settings = load().settings;
  const html = renderEmail({
    siteName: settings.siteName,
    appUrl: APP_URL,
    // Emails need an absolute URL for the logo (relative paths don't load in inboxes).
    logoUrl: (settings.brandMode === 'logo' && settings.logoUrl) ? APP_URL + settings.logoUrl : '',
    unsubscribeUrl: `${APP_URL}/unsubscribe/${user.emailToken}`,
    heading, intro: intro != null ? intro : tr('mail_hi', { name: user.name }),
    lines, bodyHtml, cta,
    dir: (locales[uLang] && locales[uLang].dir) || 'ltr',
    labels: {
      disclaimer: tr('email_disclaimer'),
      tagline: tr('email_tagline'),
      unsubscribe: tr('email_unsub'),
      visit: tr('email_visit')
    }
  });
  return sendMail(user.email, subject, html);
}

function emFmt(n, lang) {
  const s = load().settings;
  const cur = (lang === 'ar' && ['DH', 'MAD'].includes(s.currency)) ? 'درهم' : s.currency;
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`;
}

function notifyLevelUp(user, level) {
  const tr = userT(user);
  mailUser(user, {
    subject: tr('mail_lvl_subj', { level }),
    heading: tr('mail_lvl_h', { level }),
    lines: [tr('mail_lvl_b', { level })],
    cta: { text: tr('email_visit'), url: `${APP_URL}/dashboard` }
  });
}
function notifyDeposit(user, amount, planLabel, approved) {
  const tr = userT(user), lg = langFor(user);
  mailUser(user, {
    subject: approved ? tr('mail_dep_ok_subj') : tr('mail_dep_no_subj'),
    heading: approved ? tr('mail_dep_ok_h') : tr('mail_dep_no_h'),
    lines: [tr(approved ? 'mail_dep_ok_b' : 'mail_dep_no_b', { amount: emFmt(amount, lg), app: planLabel })],
    cta: { text: tr('mail_view_account'), url: `${APP_URL}/dashboard` }
  });
}
function notifyWithdrawal(user, w, status) {
  const tr = userT(user), lg = langFor(user);
  mailUser(user, {
    subject: status === 'paid' ? tr('mail_wd_ok_subj') : tr('mail_wd_no_subj'),
    heading: status === 'paid' ? tr('mail_wd_ok_h') : tr('mail_wd_no_h'),
    lines: [tr(status === 'paid' ? 'mail_wd_ok_b' : 'mail_wd_no_b', { amount: emFmt(w.amount, lg) })],
    cta: { text: tr('email_visit'), url: `${APP_URL}/dashboard` }
  });
}

// ---------- CSV ----------
function csvCell(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
// Minimal RFC-4180 CSV parser: handles quoted cells, escaped "" and CRLF.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  text = String(text).replace(/^﻿/, ''); // strip Excel's BOM
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

function csvReply(res, filename, rows) {
  const body = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + body); // BOM so Excel reads UTF-8 correctly
}
function award(user, id) {
  user.achievements = user.achievements || [];
  if (!user.achievements.includes(id)) {
    user.achievements.push(id);
    addTx(user, 'achievement', 0, ACHIEVEMENTS[id].name);
    addXp(user, 25);
    return true;
  }
  return false;
}
function checkState(user) {
  const bal = totalBalance(user);
  if (bal >= 10000) award(user, 'saver_10k');
  if (bal >= 100000) award(user, 'saver_100k');
  if (bal >= 1000000) award(user, 'millionaire');
  if (user.streak && user.streak.count >= 7) award(user, 'streak_7');
}
function dayStr(ts) { return new Date(ts).toISOString().slice(0, 10); }

// ---------- Guards ----------
function requireLogin(req, res, next) {
  if (!req.currentUser) return res.redirect('/login');
  next();
}
function requireActive(req, res, next) {
  if (!req.currentUser) return res.redirect('/login');
  if (req.currentUser.status !== 'active') return res.redirect('/pending');
  next();
}
function requireAdmin(req, res, next) {
  // Not logged in at all → send to login (login sends admins on to /admin).
  if (!req.currentUser) return res.redirect('/login');
  // Logged in but not an admin → access denied.
  if (!req.currentUser.isAdmin) return res.status(403).render('message', {
    title: req.t('forbidden_title'), heading: req.t('forbidden_h'), mBody: req.t('forbidden_b')
  });
  next();
}

// ---------- Public ----------
// Logged-in players don't need the landing page — send them to their dashboard.
app.get('/', (req, res) => {
  if (req.currentUser) return res.redirect('/dashboard');
  const db = req.db;
  const players = db.users.filter(u => u.status === 'active' && !u.isAdmin);
  // Real numbers only — and hidden entirely until there's something worth showing,
  // because "1 player" reads worse than no stats at all.
  const stats = players.length >= 3 ? {
    players: players.length,
    coins: players.reduce((s, u) => s + totalBalance(u), 0),
    apps: db.settings.plans.length,
    payouts: db.withdrawals.filter(w => w.status === 'paid').length
  } : null;
  res.render('landing', { title: req.t('hero_title'), stats });
});
// Public on purpose: new players can read it before signing up.
app.get('/guide', (req, res) => res.render('guide', { title: req.t('guide_title') }));

app.get('/terms', (req, res) => res.render('terms', { title: req.t('footer_terms') }));
app.get('/privacy', (req, res) => res.render('privacy', { title: req.t('footer_privacy') }));

// ---------- Auth ----------
app.get('/signup', (req, res) => {
  if (req.currentUser) return res.redirect('/dashboard');
  res.render('signup', { title: req.t('signup_title'), error: null, form: { ref: req.query.ref || '' } });
});

app.post('/signup', authLimiter, async (req, res) => {
  const db = req.db;
  const { name, email, password, agree, ref } = req.body;
  const form = { name, email, ref };
  if (!name || !email || !password) return res.render('signup', { title: req.t('signup_title'), error: req.t('err_fill'), form });
  if (!agree) return res.render('signup', { title: req.t('signup_title'), error: req.t('err_agree'), form });
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.render('signup', { title: req.t('signup_title'), error: req.t('err_email_taken'), form });

  const referrer = ref ? db.users.find(u => u.referralCode === ref.trim().toUpperCase()) : null;
  const hash = await bcrypt.hash(password, 10);
  // With ADMIN_EMAIL set, only that address gets admin (whenever it signs up).
  // Without it, we fall back to "first account wins" — fine locally, risky in public.
  const isFirstUser = ADMIN_EMAIL
    ? email.trim().toLowerCase() === ADMIN_EMAIL
    : db.users.length === 0;
  const user = createUser(db, {
    name, email, passwordHash: hash,
    isAdmin: isFirstUser,
    status: isFirstUser ? 'active' : 'pending',
    referredBy: referrer ? referrer.id : null,
    lang: res.locals.lang   // remember the language they signed up in
  });
  if (referrer) award(referrer, 'recruiter');
  save(db);

  if (isFirstUser) { req.session.userId = user.id; return res.redirect('/admin'); }

  await mailUser(user, {
    lang: res.locals.lang,
    subject: req.t('mail_pending_subj'),
    heading: req.t('mail_pending_h'),
    lines: [req.t('mail_pending_b')]
  });
  res.render('message', {
    title: req.t('msg_created_h'), heading: req.t('msg_created_h'), mBody: req.t('msg_created_b'),
    mIcon: 'mail-check', mTint: 'ti-mint', mPending: true
  });
});

app.get('/login', (req, res) => {
  if (req.currentUser) return res.redirect('/dashboard');
  res.render('login', { title: req.t('login_title'), error: null, form: {} });
});

app.post('/login', authLimiter, async (req, res) => {
  const db = req.db;
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
    return res.render('login', { title: req.t('login_title'), error: req.t('err_wrong'), form: { email } });
  req.session.userId = user.id;
  if (user.isAdmin) return res.redirect('/admin');
  if (user.status !== 'active') return res.redirect('/pending');
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => req.session.destroy(() => {
  // Clear the cookie explicitly with the SAME domain it was set with, otherwise
  // the browser keeps a .kanzup.com cookie and stays "logged in" on the other host.
  res.clearCookie('kz.sid', { path: '/', domain: process.env.COOKIE_DOMAIN || undefined });
  res.redirect('/');
}));

app.get('/pending', requireLogin, (req, res) => {
  if (req.currentUser.status === 'active') return res.redirect('/dashboard');
  res.render('pending', { title: req.t('pending_title') });
});

// ---------- Home (balances + level + grid menu) ----------
function levelData(u) {
  const lvl = levelForXp(u.xp);
  return { level: lvl, xp: u.xp || 0, xpCur: xpForLevel(lvl), xpNext: xpForLevel(lvl + 1) };
}

// Snapshot the player's total once an hour so we can chart their growth.
function recordHistory(user) {
  user.history = user.history || [];
  const last = user.history[user.history.length - 1];
  const now = Date.now();
  if (!last || now - last.t >= 60 * 60 * 1000) {
    user.history.push({ t: now, total: Math.round(totalBalance(user) * 100) / 100 });
    if (user.history.length > 90) user.history = user.history.slice(-90);
  }
}

app.get('/dashboard', requireActive, (req, res) => {
  const u = req.currentUser;
  const s = req.db.settings;
  checkState(u); recordHistory(u); save(req.db);
  const depositOk = hasApprovedDeposit(req.db, u);
  // Getting-started checklist for new players: clear next steps, each with a
  // done-state so it ticks off as they go. The whole card hides once complete.
  const hasDeposit = req.db.deposits.some(d => d.userId === u.id);
  const invitees = req.db.users.filter(x => x.referredBy === u.id).length;
  const checklist = [
    { key: 'payout',  done: !payoutMissing(u.payout),           icon: 'landmark',    tint: 'ti-mint',  href: '/profile' },
    { key: 'deposit', done: hasDeposit,                          icon: 'plus-circle', tint: 'ti-sky',   href: '/invest' },
    { key: 'invite',  done: invitees > 0,                        icon: 'user-plus',   tint: 'ti-lilac', href: '/referral' },
    { key: 'bonus',   done: !!(u.streak && u.streak.count > 0),  icon: 'gift',        tint: 'ti-yellow', href: '/rewards' }
  ];
  res.render('home', Object.assign({
    title: req.t('nav_home'),
    perSecond: earningPerSecond(u, s),
    totalInvested: totalInvested(u),
    totalBalance: totalBalance(u),
    bonusUnlocked: depositOk,
    canClaim: depositOk && !(u.streak && u.streak.lastClaim === dayStr(Date.now())),
    showTour: !u.onboarded || req.query.tour === '1',
    history: u.history || [],
    checklist, checklistDone: checklist.filter(c => c.done).length,
    checklistHidden: !!u.gsDismissed,
    campaign: campaignStatus(req.db, u)
  }, levelData(u)));
});

// Dismiss the getting-started checklist for good (per player).
app.post('/dismiss-getting-started', requireActive, (req, res) => {
  req.currentUser.gsDismissed = true;
  save(req.db);
  res.redirect('/dashboard');
});

// Mark the welcome tour as seen (so it won't auto-open again).
app.post('/onboarded', requireActive, (req, res) => {
  req.currentUser.onboarded = true;
  save(req.db);
  res.json({ ok: true });
});

// ---------- Invest (apps + how to deposit + your deposits) ----------
app.get('/invest', requireActive, async (req, res) => {
  const u = req.currentUser;
  const s = req.db.settings;
  const info = s.depositInfo;
  let qr = '';
  try {
    qr = await QRCode.toDataURL(`${info.bankName} | ${info.accountName} | RIB ${info.rib}`, { margin: 1, width: 200 });
  } catch (e) { qr = ''; }
  res.render('invest', Object.assign({
    title: req.t('plans_title'),
    depositInfo: info,
    depositQR: qr,
    myDeposits: req.db.deposits.filter(d => d.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  }, levelData(u)));
});

// ---------- Withdraw ----------
app.get('/withdraw', requireActive, (req, res) => {
  const u = req.currentUser;
  const db = req.db;
  accrue(u, db);
  // funds breakdown per app (held / locked / available) for the picker
  const funds = {};
  db.settings.plans.forEach(p => { funds[p.id] = appFunds(db, u, p.id); });
  res.render('withdraw', {
    title: req.t('withdraw_title'),
    payoutOk: !payoutMissing(u.payout),          // payout comes from the profile
    payoutAccount: payoutAccount(u.payout),
    lockDays: depositLockDays(db),
    funds,
    myWithdrawals: db.withdrawals.filter(w => w.userId === u.id).sort((a, b) => b.createdAt - a.createdAt)
  });
});

// ---------- Send coins ----------
app.get('/send', requireActive, (req, res) => {
  res.render('send', { title: req.t('send_title') });
});

// ---------- Rewards (daily bonus + streak) ----------
app.get('/rewards', requireActive, (req, res) => {
  const u = req.currentUser;
  const depositOk = hasApprovedDeposit(req.db, u);
  res.render('rewards', {
    title: req.t('db_title'),
    bonusUnlocked: depositOk,
    canClaim: depositOk && !(u.streak && u.streak.lastClaim === dayStr(Date.now()))
  });
});

// ---------- Achievements ----------
app.get('/achievements', requireActive, (req, res) => {
  res.render('achievements', { title: req.t('ach_title') });
});

// ---------- Activity feed ----------
app.get('/activity', requireActive, (req, res) => {
  const u = req.currentUser;
  res.render('activity', {
    title: req.t('activity_title'),
    txns: (u.transactions || []).slice().reverse().slice(0, 40)
  });
});

// ---------- Referral ----------
app.get('/referral', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  // Walk down the invite tree three levels: who I invited, who they invited, etc.
  const tiers = [];
  let level = [u.id];
  for (let i = 0; i < (db.settings.referralTiers || []).length; i++) {
    const members = db.users.filter(x => level.includes(x.referredBy));
    tiers.push({
      percent: db.settings.referralTiers[i] * 100,
      members: members.map(m => ({ name: m.name, avatar: m.avatar, active: m.status === 'active' }))
    });
    level = members.map(m => m.id);
    if (!level.length) { // no one deeper — still show the remaining tiers as empty
      for (let j = i + 1; j < db.settings.referralTiers.length; j++) {
        tiers.push({ percent: db.settings.referralTiers[j] * 100, members: [] });
      }
      break;
    }
  }
  res.render('referral', { title: req.t('invite_title'), tiers, campaign: campaignStatus(db, u) });
});

// Claim the invite-challenge reward.
app.post('/campaign/claim', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  const back = req.body.redirect === 'home' ? '/dashboard' : '/referral';
  const st = campaignStatus(db, u);
  if (!st.canClaim) return res.redirect(back + '?err=campaign');

  u.earnings += st.rewardCoins;
  addXp(u, st.rewardXp);
  u.campaignClaims = (u.campaignClaims || 0) + 1;
  addTx(u, 'campaign_reward', st.rewardCoins, 'Invited ' + st.goal + ' players (+' + st.rewardXp + ' XP)');
  checkState(u);
  save(db);
  res.redirect(back + '?ok=campaign&amt=' + st.rewardCoins);
});

// ---------- Profile / settings ----------
app.get('/profile', requireActive, (req, res) => {
  res.render('profile', { title: req.t('profile_title'), error: null, ok: req.query.ok || null, err: req.query.err || null });
});

// Photo upload. csrfGuard runs BEFORE multer (reading the token from the query string)
// so an unverified request can never write a file to disk.
app.post('/profile', requireActive, csrfGuard,
  (req, res, next) => upload.single('photo')(req, res, (err) => {
    if (err) return res.render('profile', {
      title: req.t('profile_title'), ok: null,
      error: err.code === 'LIMIT_FILE_SIZE' ? req.t('photo_too_big') : req.t('photo_bad_type')
    });
    // multer rejects non-images silently (fileFilter) — tell the user.
    if (req.body.hasPhoto === '1' && !req.file) return res.render('profile', {
      title: req.t('profile_title'), ok: null, error: req.t('photo_bad_type')
    });
    next();
  }),
  csrfGuard,
  (req, res) => {
    const u = req.currentUser;
    const name = (req.body.name || '').trim();
    if (name) u.name = name;
    if (req.file) {
      deleteUpload(u.avatar);                  // drop the old file
      u.avatar = '/uploads/' + req.file.filename;
    } else if (req.body.removePhoto === '1') {
      deleteUpload(u.avatar);
      u.avatar = '';
    }
    save(req.db);
    res.redirect('/profile?ok=saved');
  });

app.post('/profile/payout', requireActive, (req, res) => {
  const u = req.currentUser;
  u.payout = readPayout(req.body);
  save(req.db);
  res.redirect('/profile?ok=payout');
});

// Shared payout parsing/validation for the profile + withdraw forms.
function readPayout(body) {
  return {
    method: body.method === 'bank' ? 'bank' : 'paypal',
    name: (body.payoutName || '').trim(),
    paypal: (body.paypal || '').trim(),
    rib: (body.rib || '').trim()
  };
}
function payoutMissing(p) {
  if (!p.name) return true;
  return p.method === 'bank' ? !p.rib : !p.paypal;
}
function payoutAccount(p) { return p.method === 'bank' ? p.rib : p.paypal; }

// Change password — needs the current password AND a matching confirmation.
app.post('/profile/password', requireActive, async (req, res) => {
  const u = req.currentUser;
  const current = req.body.current || '', newPass = req.body.next || '', confirm = req.body.confirm || '';
  if (!(await bcrypt.compare(current, u.passwordHash))) return res.redirect('/profile?err=wrongpass');
  if (newPass.length < 6) return res.redirect('/profile?err=short');
  if (newPass !== confirm) return res.redirect('/profile?err=mismatch');
  u.passwordHash = await bcrypt.hash(newPass, 10);
  u.reset = null;
  save(req.db);
  res.redirect('/profile?ok=password');
});

// Change email — needs the current password to confirm it's really you.
app.post('/profile/email', requireActive, async (req, res) => {
  const db = req.db, u = req.currentUser;
  const current = req.body.current || '', email = (req.body.email || '').trim().toLowerCase();
  if (!(await bcrypt.compare(current, u.passwordHash))) return res.redirect('/profile?err=wrongpass');
  if (!email.includes('@')) return res.redirect('/profile?err=bademail');
  if (db.users.find(x => x.id !== u.id && x.email.toLowerCase() === email)) return res.redirect('/profile?err=dupemail');
  u.email = email;
  save(db);
  res.redirect('/profile?ok=email');
});

// Preferences: language + email notifications.
app.post('/profile/prefs', requireActive, (req, res) => {
  const u = req.currentUser;
  if (LANGS.includes(req.body.lang)) { u.lang = req.body.lang; req.session.lang = req.body.lang; }
  u.emailOptOut = req.body.emails !== '1';   // checkbox on = receive emails
  save(req.db);
  res.redirect('/profile?ok=prefs');
});

// ---------- Password reset ----------
app.get('/forgot', (req, res) => {
  if (req.currentUser) return res.redirect('/dashboard');
  res.render('forgot', { title: req.t('forgot_title'), sent: false });
});

app.post('/forgot', authLimiter, async (req, res) => {
  const db = req.db;
  const email = (req.body.email || '').trim().toLowerCase();
  const u = db.users.find(x => x.email.toLowerCase() === email);
  if (u) {
    const token = crypto.randomBytes(32).toString('hex');
    u.reset = { token, expires: Date.now() + 60 * 60 * 1000 }; // valid 1 hour
    save(db);
    const link = `${APP_URL}/reset/${token}`;
    await mailUser(u, {
      lang: res.locals.lang,
      subject: req.t('mail_reset_subject'),
      heading: req.t('mail_reset_subject'),
      lines: [req.t('mail_reset_body'), req.t('mail_reset_expire')],
      cta: { text: req.t('reset_save'), url: link }
    });
  }
  // Always show the same message — never reveal which emails exist.
  res.render('forgot', { title: req.t('forgot_title'), sent: true });
});

app.get('/reset/:token', (req, res) => {
  const u = req.db.users.find(x => x.reset && x.reset.token === req.params.token && x.reset.expires > Date.now());
  if (!u) return res.status(400).render('error', {
    title: req.t('reset_bad_t'), code: 400, heading: req.t('reset_bad_t'), mBody: req.t('reset_bad_d')
  });
  res.render('reset', { title: req.t('reset_title'), token: req.params.token, error: null });
});

app.post('/reset/:token', authLimiter, async (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.reset && x.reset.token === req.params.token && x.reset.expires > Date.now());
  if (!u) return res.status(400).render('error', {
    title: req.t('reset_bad_t'), code: 400, heading: req.t('reset_bad_t'), mBody: req.t('reset_bad_d')
  });
  const pass = req.body.password || '';
  if (pass.length < 6)
    return res.render('reset', { title: req.t('reset_title'), token: req.params.token, error: req.t('pw_too_short') });
  u.passwordHash = await bcrypt.hash(pass, 10);
  u.reset = null;
  save(db);
  res.render('message', {
    title: req.t('reset_done_t'), heading: req.t('reset_done_t'), mBody: req.t('reset_done_d')
  });
});

// ---------- Email unsubscribe / resubscribe ----------
// One-click link from every email footer. GET flips the flag (mail clients
// prefetch, so this is intentionally idempotent) and shows a confirmation with a
// resubscribe button. No login needed — the per-user token is the credential.
app.get('/unsubscribe/:token', (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.emailToken === req.params.token);
  if (!u) return res.status(404).render('message', {
    title: req.t('unsub_bad_t'), heading: req.t('unsub_bad_t'), mBody: req.t('unsub_bad_d'),
    mIcon: 'mail-x', mTint: 'ti-coral'
  });
  if (!u.emailOptOut) { u.emailOptOut = true; save(db); }
  res.render('message', {
    title: req.t('unsub_ok_t'), heading: req.t('unsub_ok_t'),
    mBody: req.t('unsub_ok_d', { email: u.email }),
    mIcon: 'mail-x', mTint: 'ti-yellow',
    mAction: { url: '/resubscribe/' + u.emailToken, text: req.t('unsub_resub'), icon: 'mail-check' }
  });
});

app.get('/resubscribe/:token', (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.emailToken === req.params.token);
  if (!u) return res.status(404).render('message', {
    title: req.t('unsub_bad_t'), heading: req.t('unsub_bad_t'), mBody: req.t('unsub_bad_d'),
    mIcon: 'mail-x', mTint: 'ti-coral'
  });
  if (u.emailOptOut) { u.emailOptOut = false; save(db); }
  res.render('message', {
    title: req.t('resub_ok_t'), heading: req.t('resub_ok_t'),
    mBody: req.t('resub_ok_d', { email: u.email }),
    mIcon: 'mail-check', mTint: 'ti-mint'
  });
});

// A deposit is a REQUEST — coins are only credited when the admin approves it.
app.post('/add-funds', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  const s = db.settings;
  const amount = Math.floor(Number(req.body.amount));
  const plan = s.plans.find(p => p.id === req.body.plan);
  if (!plan) return res.redirect('/invest?err=plan');
  if (!amount || amount < s.minAddFunds) return res.redirect('/invest?err=amount');
  if (levelForXp(u.xp) < (plan.minLevel || 1)) return res.redirect('/invest?err=locked');

  db.deposits.push({
    id: db.nextDepositId++, userId: u.id, userName: u.name,
    plan: plan.id, planLabel: plan.name,
    amount, status: 'pending', createdAt: Date.now()
  });
  addTx(u, 'deposit_request', amount, plan.name);
  save(db);
  res.redirect('/invest?ok=deprequested');
});

app.post('/withdraw', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  const s = db.settings;
  accrue(u, db);
  const amount = Math.floor(Number(req.body.amount));
  const from = req.body.from; // 'earnings' or a plan id
  const payout = u.payout;    // taken from the profile — not re-entered here
  if (!amount || amount < s.minWithdraw) return res.redirect('/withdraw?err=wamount');
  if (payoutMissing(payout)) return res.redirect('/withdraw?err=payout');

  const lastW = db.withdrawals.filter(w => w.userId === u.id && w.status !== 'rejected')
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (lastW && (Date.now() - lastW.createdAt) / DAY < s.withdrawEveryDays)
    return res.redirect('/withdraw?err=cadence');

  let available, label;
  if (from === 'earnings') { available = u.earnings; label = 'Earnings'; }
  else {
    const plan = s.plans.find(p => p.id === from);
    if (!plan) return res.redirect('/withdraw?err=wamount');
    // Only funds past the lock window can be withdrawn from an app.
    available = withdrawableInApp(db, u, plan.id); label = plan.name;
    if (amount > available && lockedInApp(db, u, plan.id) > 0)
      return res.redirect('/withdraw?err=wlocked');
  }
  if (amount > available) return res.redirect('/withdraw?err=insufficient');

  if (from === 'earnings') u.earnings -= amount;
  else u.invested[from] -= amount;

  db.withdrawals.push({
    id: db.nextWithdrawId++, userId: u.id, userName: u.name,
    amount, from, fromLabel: label,
    method: payout.method, payoutName: payout.name, payoutAccount: payoutAccount(payout),
    status: 'pending', createdAt: Date.now()
  });
  addTx(u, 'withdraw_request', amount, `From ${label}`);
  award(u, 'first_withdraw');
  save(db);
  res.redirect('/withdraw?ok=withdraw');
});

app.post('/daily-bonus', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  const back = req.body.redirect === 'home' ? '/dashboard' : '/rewards';
  // Locked until they've made at least one approved deposit.
  if (!hasApprovedDeposit(db, u)) return res.redirect(back + '?err=needdeposit');
  const today = dayStr(Date.now());
  u.streak = u.streak || { count: 0, lastClaim: null };
  if (u.streak.lastClaim === today) return res.redirect(back + '?err=claimed');
  u.streak.count = (u.streak.lastClaim === dayStr(Date.now() - DAY)) ? u.streak.count + 1 : 1;
  u.streak.lastClaim = today;
  const bonus = db.settings.dailyBonusBase * Math.min(u.streak.count, 7);
  u.earnings += bonus;
  addXp(u, 10);
  addTx(u, 'daily_bonus', bonus, `Day ${u.streak.count} streak`);
  checkState(u);
  save(db);
  res.redirect(back + '?ok=bonus&amt=' + bonus);
});

app.post('/transfer', requireActive, (req, res) => {
  const db = req.db;
  const u = req.currentUser;
  const s = db.settings;
  accrue(u, db);
  const amount = Math.floor(Number(req.body.amount));
  const to = (req.body.to || '').trim();
  if (!amount || amount < s.minTransfer) return res.redirect('/send?err=tamount');

  const recipient = db.users.find(x =>
    x.id !== u.id && x.status === 'active' &&
    (x.email.toLowerCase() === to.toLowerCase() || x.referralCode === to.toUpperCase()));
  if (!recipient) return res.redirect('/send?err=recipient');
  if (amount > u.earnings) return res.redirect('/send?err=insufficient');

  accrue(recipient, db);
  u.earnings -= amount;
  recipient.earnings += amount;
  addTx(u, 'transfer_out', amount, `To ${recipient.name}`);
  addTx(recipient, 'transfer_in', amount, `From ${u.name}`);
  addXp(u, 5);
  award(u, 'generous');
  checkState(recipient);
  save(db);
  res.redirect('/send?ok=sent');
});

// ---------- Leaderboard (masked names) ----------
app.get('/leaderboard', requireActive, (req, res) => {
  const db = req.db;
  db.users.forEach(x => accrue(x, db));
  save(db);
  const mask = (n) => n.slice(0, 1).toUpperCase() + '*'.repeat(Math.max(1, n.length - 1));
  const rows = db.users
    .filter(x => x.status === 'active' && !x.isAdmin && isRealUser(x)) // admins run the game; test accounts don't compete
    .map(x => ({ id: x.id, name: mask(x.name), total: totalBalance(x), isSelf: x.id === req.currentUser.id }))
    .sort((a, b) => b.total - a.total);
  res.render('leaderboard', { title: req.t('lb_title'), rows });
});

// ---------- Admin ----------
const PER_PAGE = 10;

const PER_PAGE_OPTIONS = [10, 50, 100, 200];

// Slice a list for the current page. `perReq` comes from the ?per query param and
// is clamped to the allowed options. Returns the resolved `per` so the view can
// mark the active choice and keep it in pager links.
function paginate(list, page, perReq) {
  const per = PER_PAGE_OPTIONS.includes(parseInt(perReq)) ? parseInt(perReq) : PER_PAGE;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(pages, Math.max(1, parseInt(page) || 1));
  return { items: list.slice((p - 1) * per, p * per), page: p, pages, per, total: list.length };
}

// { pending: 3, approved: 10, ... } for the filter-button badges
function countBy(list, key = 'status') {
  return list.reduce((acc, x) => { acc[x[key]] = (acc[x[key]] || 0) + 1; return acc; }, {});
}

// Counts shown as badges on the admin hub tiles.
function adminCounts(db) {
  const testIds = new Set(db.users.filter(u => u.isTest).map(u => u.id));
  return {
    // real (non-test) users only, so the "needs attention" badges stay honest
    pendingUsers: db.users.filter(u => u.status === 'pending' && isRealUser(u)).length,
    pendingDeposits: db.deposits.filter(d => d.status === 'pending' && !testIds.has(d.userId)).length,
    pendingWithdrawals: db.withdrawals.filter(w => w.status === 'pending' && !testIds.has(w.userId)).length,
    users: db.users.filter(isRealUser).length,
    testUsers: testIds.size,
    apps: db.settings.plans.length
  };
}

// ---------- Admin hub ----------
adminRouter.get('/', requireAdmin, (req, res) => {
  const db = req.db;
  db.users.forEach(u => accrue(u, db));
  save(db);
  const active = db.users.filter(u => u.status === 'active' && isRealUser(u)); // real players only
  const testIds = new Set(db.users.filter(u => u.isTest).map(u => u.id));
  res.render('admin/hub', {
    title: req.t('admin_title'),
    counts: adminCounts(db),
    stats: {
      players: active.length,
      invested: active.reduce((s, u) => s + totalInvested(u), 0),
      earnings: active.reduce((s, u) => s + (u.earnings || 0), 0),
      total: active.reduce((s, u) => s + totalBalance(u), 0),
      deposits: db.deposits.filter(d => d.status === 'approved' && !testIds.has(d.userId)).length,
      paid: db.withdrawals.filter(w => w.status === 'paid' && !testIds.has(w.userId)).length
    }
  });
});

// Live totals + recent deposit/withdraw events for the admin activity chart.
// Read-only and never saves — it projects each player's earnings forward from
// their last accrual instead of mutating, so polling it every second is cheap.
adminRouter.get('/stats.json', requireAdmin, (req, res) => {
  const db = req.db;
  const now = Date.now();
  let earnings = 0, invested = 0, perSecond = 0;
  const testIds = new Set(db.users.filter(u => u.isTest).map(u => u.id));
  for (const u of db.users) {
    if (u.status !== 'active' || u.isAdmin || u.isTest) continue; // exclude test accounts
    const ps = earningPerSecond(u, db.settings);
    const pending = ps * Math.max(0, (now - (u.lastAccrual || now)) / 1000);
    earnings += (u.earnings || 0) + pending;
    invested += totalInvested(u);
    perSecond += ps;
  }
  const events = db.deposits.filter(d => !testIds.has(d.userId)).map(d => ({ id: 'd' + d.id, t: d.createdAt, type: 'deposit', amount: d.amount, name: d.userName, status: d.status }))
    .concat(db.withdrawals.filter(w => !testIds.has(w.userId)).map(w => ({ id: 'w' + w.id, t: w.createdAt, type: 'withdraw', amount: w.amount, name: w.userName, status: w.status })))
    .sort((a, b) => b.t - a.t)
    .slice(0, 60);
  res.json({ now, totalCoins: earnings + invested, totalEarnings: earnings, totalInvested: invested, perSecond, events });
});

// Build contiguous time buckets for the trends chart, newest last. Each returns
// { start, end, label }. Ranges: hourly (24×1h), daily (30×1d), weekly (12×7d),
// monthly (12 calendar months).
function trendBuckets(range) {
  const HOUR = 3600e3, DAYMS = 24 * HOUR, out = [];
  const now = new Date();
  const fixed = (count, width, anchorEnd, labelFn) => {
    for (let i = count - 1; i >= 0; i--) {
      const end = anchorEnd - i * width, start = end - width;
      out.push({ start, end, label: labelFn(new Date(start)) });
    }
  };
  if (range === 'hourly') {
    const a = new Date(now); a.setMinutes(0, 0, 0);
    fixed(24, HOUR, +a + HOUR, d => String(d.getHours()).padStart(2, '0') + ':00');
  } else if (range === 'weekly') {
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    fixed(12, 7 * DAYMS, +a + DAYMS, d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  } else if (range === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ start: +s, end: +e, label: s.toLocaleDateString('en-US', { month: 'short' }) + " '" + String(s.getFullYear()).slice(-2) });
    }
  } else { // daily
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    fixed(30, DAYMS, +a + DAYMS, d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return out;
}

// Historical trends: settled deposits, paid withdrawals and new signups per
// bucket, over the chosen range. Test accounts are excluded.
adminRouter.get('/analytics.json', requireAdmin, (req, res) => {
  const db = req.db;
  const range = ['hourly', 'daily', 'weekly', 'monthly'].includes(req.query.range) ? req.query.range : 'daily';
  const testIds = new Set(db.users.filter(u => u.isTest).map(u => u.id));
  const buckets = trendBuckets(range).map(b => ({ ...b, depCount: 0, depSum: 0, wdCount: 0, wdSum: 0, signups: 0, referrals: 0 }));
  const first = buckets[0] ? buckets[0].start : 0;
  const place = (t) => {
    if (t < first) return null;
    for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start && t < buckets[i].end) return buckets[i];
    return null;
  };
  db.deposits.forEach(d => { if (d.status !== 'approved' || testIds.has(d.userId)) return; const b = place(d.createdAt); if (b) { b.depCount++; b.depSum += d.amount; } });
  db.withdrawals.forEach(w => { if (w.status !== 'paid' || testIds.has(w.userId)) return; const b = place(w.createdAt); if (b) { b.wdCount++; b.wdSum += w.amount; } });
  db.users.forEach(u => { if (u.isTest || u.isAdmin) return; const b = place(u.createdAt); if (b) { b.signups++; if (u.referredBy) b.referrals++; } });

  // Detailed activity within the same window (any status, newest first) so the
  // list under the chart matches the selected range.
  const winEnd = buckets.length ? buckets[buckets.length - 1].end : Date.now();
  const events = [];
  db.deposits.forEach(d => { if (testIds.has(d.userId) || d.createdAt < first || d.createdAt >= winEnd) return; events.push({ kind: 'deposit', id: d.id, userId: d.userId, name: d.userName, amount: d.amount, status: d.status, app: d.planLabel || '', at: d.createdAt }); });
  db.withdrawals.forEach(w => { if (testIds.has(w.userId) || w.createdAt < first || w.createdAt >= winEnd) return; events.push({ kind: 'withdraw', id: w.id, userId: w.userId, name: w.userName, amount: w.amount, status: w.status, app: w.fromLabel || '', at: w.createdAt }); });
  db.users.forEach(u => {
    if (u.isTest || u.isAdmin || u.createdAt < first || u.createdAt >= winEnd) return;
    const ref = u.referredBy ? db.users.find(x => x.id === u.referredBy) : null;
    events.push({ kind: 'signup', userId: u.id, name: u.name, amount: 0, status: u.status, app: '', at: u.createdAt, referred: !!u.referredBy, referrer: ref ? ref.name : '' });
  });
  events.sort((a, b) => b.at - a.at);

  res.json({
    range,
    buckets: buckets.map(b => ({ label: b.label, depCount: b.depCount, depSum: b.depSum, wdCount: b.wdCount, wdSum: b.wdSum, signups: b.signups, referrals: b.referrals })),
    events: events.slice(0, 150),
    eventTotal: events.length
  });
});

// ---------- Users ----------
adminRouter.get('/users', requireAdmin, (req, res) => {
  const db = req.db;
  db.users.forEach(u => accrue(u, db));
  save(db);
  const q = (req.query.q || '').trim().toLowerCase();
  const status = req.query.status || '';
  // real players only — test accounts live on the Test Lab page
  const realUsers = db.users.filter(isRealUser);
  let list = realUsers.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(u => u.status === status);
  if (q) list = list.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.referralCode || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page, req.query.per);
  res.render('admin/users', {
    title: req.t('tab_users'),
    users: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, totalUsers: pg.total,
    q, status,
    totalUsersAll: realUsers.length,
    statusCounts: countBy(realUsers),
    counts: adminCounts(db),
    done: req.query.done || null, doneN: parseInt(req.query.n) || 0,
    created: req.query.created || null,
    levelForXp, totalInvested, totalBalance
  });
});

// ---------- Single user ----------
adminRouter.get('/users/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u) return res.status(404).render('error', {
    title: req.t('err_404_t'), code: 404, heading: req.t('err_404_t'), mBody: req.t('err_404_d')
  });
  accrue(u, db); save(db);
  const lvl = levelForXp(u.xp);
  res.render('admin/user', {
    title: u.name,
    u, level: lvl, xpCur: xpForLevel(lvl), xpNext: xpForLevel(lvl + 1),
    invested: totalInvested(u), total: totalBalance(u),
    referrer: u.referredBy ? db.users.find(x => x.id === u.referredBy) : null,
    invitees: db.users.filter(x => x.referredBy === u.id),
    deposits: db.deposits.filter(d => d.userId === u.id).sort((a, b) => b.createdAt - a.createdAt),
    withdrawals: db.withdrawals.filter(w => w.userId === u.id).sort((a, b) => b.createdAt - a.createdAt),
    txns: (u.transactions || []).slice().reverse().slice(0, 25),
    payoutAccount: payoutAccount(u.payout),
    schedules: db.schedules.filter(s => s.userId === u.id),
    ok: req.query.ok || null, err: req.query.err || null
  });
});

// ---------- Test Lab: a sandbox of test accounts kept out of the real game ----------
adminRouter.get('/test', requireAdmin, (req, res) => {
  const db = req.db;
  db.users.forEach(u => accrue(u, db));
  save(db);
  const testUsers = db.users.filter(u => u.isTest).sort((a, b) => b.createdAt - a.createdAt);
  const stats = {
    count: testUsers.length,
    invested: testUsers.reduce((s, u) => s + totalInvested(u), 0),
    earnings: testUsers.reduce((s, u) => s + (u.earnings || 0), 0),
    total: testUsers.reduce((s, u) => s + totalBalance(u), 0)
  };
  res.render('admin/test', {
    title: req.t('tab_test'),
    counts: adminCounts(db),
    testUsers, stats,
    levelForXp, totalInvested, totalBalance,
    created: req.query.created || null,
    done: req.query.done || null, doneN: parseInt(req.query.n) || 0
  });
});

// Flip a user between real and test.
adminRouter.post('/users/:id/toggle-test', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u && !u.isAdmin) {           // never turn the admin into a test account
    u.isTest = !u.isTest;
    logAudit(db, req.currentUser, 'user.test', u.name + ' → ' + (u.isTest ? 'test' : 'real'));
    save(db);
  }
  res.redirect(req.get('referer') && req.get('referer').includes('/admin/users/') ? '/admin/users/' + req.params.id : '/admin/test');
});

// Delete every test account in one click (cascades their deposits/withdrawals).
adminRouter.post('/test/delete-all', requireAdmin, (req, res) => {
  const db = req.db;
  const ids = db.users.filter(u => u.isTest && !u.isAdmin).map(u => u.id);
  ids.forEach(id => deleteUserCascade(db, id));
  logAudit(db, req.currentUser, 'test.deleteAll', ids.length + ' test users removed');
  save(db);
  res.redirect('/admin/test?done=deleted&n=' + ids.length);
});

// Create an account directly from the admin panel.
adminRouter.post('/users/create', requireAdmin, async (req, res) => {
  const db = req.db;
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const status = ['active', 'pending', 'rejected'].includes(req.body.status) ? req.body.status : 'active';
  const isTest = req.body.isTest === '1';
  const backBase = isTest ? '/admin/test' : '/admin/users';
  if (!name || !email.includes('@') || password.length < 4) return res.redirect(backBase + '?created=err');
  if (db.users.find(u => u.email.toLowerCase() === email)) return res.redirect(backBase + '?created=dup');
  const u = createUser(db, { name, email, passwordHash: await bcrypt.hash(password, 10), isAdmin: false, status, isTest });
  logAudit(db, req.currentUser, 'user.create', name + ' <' + email + '>' + (isTest ? ' [test]' : ''));
  save(db);
  res.redirect('/admin/users/' + u.id + '?ok=created');
});

// Record a deposit on a player's behalf — any app, any date, approved or pending,
// with an optional bank reference and receipt image. csrfGuard runs before multer
// (token from the query) so a rejected upload never writes a file.
adminRouter.post('/users/:id/deposit', requireAdmin, csrfGuard,
  (req, res, next) => uploadReceipt.single('receipt')(req, res, () => next()),
  (req, res) => {
    const db = req.db;
    const u = db.users.find(x => x.id === Number(req.params.id));
    if (!u) return res.redirect('/admin/users');
    const amount = Math.floor(Number(req.body.amount));
    const plan = db.settings.plans.find(p => p.id === req.body.plan);
    const status = req.body.status === 'pending' ? 'pending' : 'approved';
    const note = (req.body.note || '').trim();
    const when = parseWhen(req.body.date);
    if (!plan || !amount || amount <= 0) return res.redirect('/admin/users/' + u.id + '?err=deposit');

    creditDeposit(db, u, plan, amount, {
      status, note, when,
      receipt: req.file ? '/uploads/' + req.file.filename : ''
    });
    logAudit(db, req.currentUser, 'admin.deposit', u.name + ' ' + amount + ' → ' + plan.name + ' (' + status + ')');
    save(db);
    res.redirect('/admin/users/' + u.id + '?ok=deposit');
  });

// Record a withdrawal on a player's behalf — with bank/PayPal details and a date.
adminRouter.post('/users/:id/withdraw', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u) return res.redirect('/admin/users');
  const amount = Math.floor(Number(req.body.amount));
  const from = req.body.from; // 'earnings' or a plan id
  const method = req.body.method === 'bank' ? 'bank' : 'paypal';
  const payoutName = (req.body.payoutName || '').trim();
  const account = (req.body.account || '').trim();
  const status = ['paid', 'pending', 'rejected'].includes(req.body.status) ? req.body.status : 'paid';
  const when = parseWhen(req.body.date);
  if (!amount || amount <= 0) return res.redirect('/admin/users/' + u.id + '?err=withdraw');

  accrue(u, db);
  let label;
  if (from === 'earnings') { label = 'Earnings'; }
  else { const p = db.settings.plans.find(x => x.id === from); if (!p) return res.redirect('/admin/users/' + u.id + '?err=withdraw'); label = p.name; }

  // paid/pending take the coins out now; rejected is just a record
  if (status !== 'rejected') {
    const have = from === 'earnings' ? u.earnings : (u.invested[from] || 0);
    if (amount > have) return res.redirect('/admin/users/' + u.id + '?err=insufficient');
    if (from === 'earnings') u.earnings -= amount; else u.invested[from] -= amount;
  }
  db.withdrawals.push({
    id: db.nextWithdrawId++, userId: u.id, userName: u.name,
    amount, from, fromLabel: label, method, payoutName, payoutAccount: account,
    status, byAdmin: true, createdAt: when
  });
  addTx(u, status === 'paid' ? 'withdraw_paid' : (status === 'rejected' ? 'withdraw_rejected' : 'withdraw_request'),
    amount, 'From ' + label, when);
  logAudit(db, req.currentUser, 'admin.withdraw', u.name + ' ' + amount + ' from ' + label + ' (' + status + ')');
  save(db);
  res.redirect('/admin/users/' + u.id + '?ok=withdraw');
});

// ----- Impersonation: view the game as a player (read-only) -----
adminRouter.post('/users/:id/impersonate', requireAdmin, (req, res) => {
  const target = req.db.users.find(x => x.id === Number(req.params.id));
  if (target && !target.isAdmin) {
    req.session.impersonate = target.id;
    logAudit(req.db, req.currentUser, 'admin.viewAs', target.name + ' <' + target.email + '>');
    save(req.db);
  }
  res.redirect('/dashboard');
});
adminRouter.post('/stop-impersonate', (req, res) => {
  // req.currentUser is the target while impersonating; the real admin is session.userId
  const id = req.session.impersonate;
  delete req.session.impersonate;
  res.redirect(id ? '/admin/users/' + id : '/admin');
});

// ----- Batch deposit to several selected players -----
adminRouter.post('/users/batch-deposit', requireAdmin, (req, res) => {
  const db = req.db;
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = [...new Set(ids.map(Number))].filter(Number.isFinite);
  const amount = Math.floor(Number(req.body.amount));
  const plan = db.settings.plans.find(p => p.id === req.body.plan);
  const status = req.body.status === 'pending' ? 'pending' : 'approved';
  if (!plan || !amount || amount <= 0 || !ids.length) return res.redirect('/admin/users?created=err');

  let n = 0;
  for (const id of ids) {
    const u = db.users.find(x => x.id === id);
    if (!u) continue;
    creditDeposit(db, u, plan, amount, { status, note: 'Batch', when: Date.now() });
    n++;
  }
  logAudit(db, req.currentUser, 'admin.batchDeposit', n + ' players · ' + amount + ' → ' + plan.name + ' (' + status + ')');
  save(db);
  res.redirect('/admin/users?done=deposit&n=' + n);
});

// ----- Recurring / scheduled deposits (salary-style) -----
const FREQ_MS = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY };

// Apply every schedule that is due. Returns how many payouts ran.
function runSchedules(db) {
  const now = Date.now();
  let ran = 0;
  for (const sc of db.schedules) {
    if (!sc.active) continue;
    const plan = db.settings.plans.find(p => p.id === sc.plan);
    if (!plan) continue;
    let guard = 0;
    while (sc.nextRun <= now && guard++ < 60) {   // don't backfill a huge gap
      const u = db.users.find(x => x.id === sc.userId);
      if (u) { creditDeposit(db, u, plan, sc.amount, { status: 'approved', note: 'Recurring', when: now }); ran++; }
      sc.lastRun = now;
      sc.nextRun += (FREQ_MS[sc.frequency] || DAY);
    }
  }
  return ran;
}

adminRouter.post('/users/:id/schedule', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u) return res.redirect('/admin/users');
  const amount = Math.floor(Number(req.body.amount));
  const plan = db.settings.plans.find(p => p.id === req.body.plan);
  const frequency = FREQ_MS[req.body.frequency] ? req.body.frequency : 'weekly';
  if (!plan || !amount || amount <= 0) return res.redirect('/admin/users/' + u.id + '?err=deposit');
  db.schedules.push({
    id: db.nextScheduleId++, userId: u.id, userName: u.name,
    amount, plan: plan.id, planLabel: plan.name, frequency,
    active: true, lastRun: null, nextRun: Date.now() + FREQ_MS[frequency], createdAt: Date.now()
  });
  logAudit(db, req.currentUser, 'schedule.add', u.name + ' ' + amount + ' → ' + plan.name + ' / ' + frequency);
  save(db);
  res.redirect('/admin/users/' + u.id + '?ok=schedule');
});

adminRouter.post('/schedules/:sid/delete', requireAdmin, (req, res) => {
  const db = req.db;
  const sc = db.schedules.find(s => s.id === Number(req.params.sid));
  db.schedules = db.schedules.filter(s => s.id !== Number(req.params.sid));
  if (sc) logAudit(db, req.currentUser, 'schedule.delete', sc.userName + ' ' + sc.amount + ' / ' + sc.frequency);
  save(db);
  res.redirect(sc ? '/admin/users/' + sc.userId : '/admin/users');
});

// Run all due schedules now (also runs automatically on a timer).
adminRouter.post('/schedules/run', requireAdmin, (req, res) => {
  const db = req.db;
  const n = runSchedules(db);
  logAudit(db, req.currentUser, 'schedule.run', n + ' payouts');
  save(db);
  res.redirect((req.body.back || '/admin/users') + '?ok=ran&n=' + n);
});

// Printable per-user statement (browser print → PDF).
adminRouter.get('/users/:id/statement', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u) return res.status(404).render('error', { title: req.t('err_404_t'), code: 404, heading: req.t('err_404_t'), mBody: req.t('err_404_d') });
  accrue(u, db); save(db);
  const rows = db.deposits.filter(d => d.userId === u.id).map(d => ({ t: d.createdAt, kind: 'deposit', label: d.planLabel, amount: d.amount, status: d.status, note: d.note }))
    .concat(db.withdrawals.filter(w => w.userId === u.id).map(w => ({ t: w.createdAt, kind: 'withdraw', label: w.fromLabel || w.from, amount: w.amount, status: w.status, note: (w.method ? (w.method + ' ' + (w.payoutAccount || '')) : '') })))
    .sort((a, b) => a.t - b.t);
  res.render('admin/statement', {
    layout: false, u, rows,
    invested: totalInvested(u), total: totalBalance(u),
    generatedAt: Date.now()
  });
});

// Printable invoice / receipt for a single deposit or withdrawal.
adminRouter.get('/invoice/:type/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const type = req.params.type === 'withdraw' ? 'withdraw' : 'deposit';
  const id = Number(req.params.id);
  const rec = (type === 'deposit' ? db.deposits : db.withdrawals).find(x => x.id === id);
  if (!rec) return res.status(404).render('error', { title: req.t('err_404_t'), code: 404, heading: req.t('err_404_t'), mBody: req.t('err_404_d') });
  const u = db.users.find(x => x.id === rec.userId) || null;
  res.render('admin/invoice', {
    layout: false, type, rec, u,
    // deposits carry planLabel + note + receipt; withdrawals carry method + payout
    detail: type === 'deposit'
      ? { source: rec.planLabel || '', note: rec.note || '', receipt: rec.receipt || '' }
      : { source: rec.fromLabel || rec.from || '', method: rec.method || '', account: rec.payoutAccount || '', payoutName: rec.payoutName || '' },
    generatedAt: Date.now()
  });
});

// Set a user's XP directly (level is derived from it).
adminRouter.post('/users/:id/xp', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u && req.body.xp !== '') {
    u.xp = Math.max(0, Math.floor(Number(req.body.xp) || 0));
    logAudit(db, req.currentUser, 'user.setXp', u.name + ' -> ' + u.xp + ' XP (level ' + levelForXp(u.xp) + ')');
    save(db);
  }
  res.redirect('/admin/users/' + req.params.id);
});

// Give a user a new password (they can change it later in their profile).
adminRouter.post('/users/:id/password', requireAdmin, async (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  const pass = req.body.password || '';
  if (u && pass.length >= 4) {
    u.passwordHash = await bcrypt.hash(pass, 10);
    u.reset = null;
    logAudit(db, req.currentUser, 'user.setPassword', u.name);
    save(db);
  }
  res.redirect('/admin/users/' + req.params.id + '?ok=1');
});

// ---------- Admin's own account (change email / password) ----------
adminRouter.get('/account', requireAdmin, (req, res) => {
  res.render('admin/account', {
    title: req.t('acct_title'), counts: adminCounts(req.db),
    adminEmailLocked: !!ADMIN_EMAIL && req.currentUser.email.toLowerCase() === ADMIN_EMAIL,
    ok: req.query.ok || null, err: req.query.err || null
  });
});

// Change your own profile (name + email) — requires your current password.
adminRouter.post('/account/profile', requireAdmin, async (req, res) => {
  const db = req.db, u = req.currentUser;
  const current = req.body.current || '';
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  if (!(await bcrypt.compare(current, u.passwordHash))) return res.redirect('/admin/account?err=wrongpass');
  if (!name) return res.redirect('/admin/account?err=noname');
  if (!email.includes('@')) return res.redirect('/admin/account?err=bademail');
  if (db.users.find(x => x.id !== u.id && x.email.toLowerCase() === email)) return res.redirect('/admin/account?err=dupemail');
  u.name = name;
  u.email = email;
  logAudit(db, u, 'admin.changeProfile', name + ' <' + email + '>');
  save(db);
  res.redirect('/admin/account?ok=profile');
});

// Change your own password — requires your current password + a confirmation.
adminRouter.post('/account/password', requireAdmin, async (req, res) => {
  const db = req.db, u = req.currentUser;
  const current = req.body.current || '', pass = req.body.password || '', confirm = req.body.confirm || '';
  if (!(await bcrypt.compare(current, u.passwordHash))) return res.redirect('/admin/account?err=wrongpass');
  if (pass.length < 6) return res.redirect('/admin/account?err=short');
  if (pass !== confirm) return res.redirect('/admin/account?err=mismatch');
  u.passwordHash = await bcrypt.hash(pass, 10);
  u.reset = null;
  logAudit(db, u, 'admin.changePassword', u.name);
  save(db);
  res.redirect('/admin/account?ok=password');
});

// ---------- Admins & roles (RBAC) ----------
adminRouter.get('/admins', requireAdmin, (req, res) => {
  const db = req.db;
  res.render('admin/admins', {
    title: req.t('tab_admins'), counts: adminCounts(db),
    admins: db.users.filter(u => u.isAdmin).sort((a, b) => a.id - b.id),
    roles: Object.keys(ROLES), ROLES, PERMS,
    adminEmail: ADMIN_EMAIL,
    ok: req.query.ok || null, err: req.query.err || null
  });
});

// Add an admin: promote an existing user by email, or create a new account.
adminRouter.post('/admins/add', requireAdmin, async (req, res) => {
  const db = req.db;
  const email = (req.body.email || '').trim().toLowerCase();
  const role = ROLES[req.body.role] ? req.body.role : 'moderator';
  if (!email.includes('@')) return res.redirect('/admin/admins?err=bademail');
  let u = db.users.find(x => x.email.toLowerCase() === email);
  if (u) {
    u.isAdmin = true; u.role = role; u.status = 'active';
  } else {
    const name = (req.body.name || '').trim();
    const password = req.body.password || '';
    if (!name || password.length < 4) return res.redirect('/admin/admins?err=needdetails');
    u = createUser(db, { name, email, passwordHash: await bcrypt.hash(password, 10), isAdmin: true, status: 'active', role });
  }
  logAudit(db, req.currentUser, 'admin.add', u.name + ' <' + u.email + '> as ' + role);
  save(db);
  res.redirect('/admin/admins?ok=added');
});

// Change an admin's role.
adminRouter.post('/admins/:id/role', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  const role = ROLES[req.body.role] ? req.body.role : null;
  if (!u || !u.isAdmin || !role) return res.redirect('/admin/admins?err=cantchange');
  if (u.id === req.currentUser.id) return res.redirect('/admin/admins?err=notself');
  if (ADMIN_EMAIL && u.email.toLowerCase() === ADMIN_EMAIL) return res.redirect('/admin/admins?err=locked');
  u.role = role;
  logAudit(db, req.currentUser, 'admin.role', u.name + ' → ' + role);
  save(db);
  res.redirect('/admin/admins?ok=role');
});

// Remove admin rights (back to a normal player).
adminRouter.post('/admins/:id/remove', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u || !u.isAdmin) return res.redirect('/admin/admins?err=cantchange');
  if (u.id === req.currentUser.id) return res.redirect('/admin/admins?err=notself');
  if (ADMIN_EMAIL && u.email.toLowerCase() === ADMIN_EMAIL) return res.redirect('/admin/admins?err=locked');
  if (roleOf(u) === 'owner' && db.users.filter(x => x.isAdmin && roleOf(x) === 'owner').length <= 1)
    return res.redirect('/admin/admins?err=lastowner');
  u.isAdmin = false; u.role = null;
  logAudit(db, req.currentUser, 'admin.remove', u.name + ' <' + u.email + '>');
  save(db);
  res.redirect('/admin/admins?ok=removed');
});

// ---------- Send email to players ----------
// Pick who a broadcast goes to. Admins are never included (you are the sender),
// and opted-out players are dropped unless you target them by exact email.
function emailAudience(db, kind) {
  const real = db.users.filter(u => !u.isAdmin && u.email && u.email.includes('@'));
  if (kind === 'pending') return real.filter(u => u.status === 'pending');
  if (kind === 'active') return real.filter(u => u.status === 'active');
  return real; // 'all'
}

adminRouter.get('/email', requireAdmin, (req, res) => {
  const db = req.db;
  const optedOut = db.users.filter(u => !u.isAdmin && u.emailOptOut).length;
  res.render('admin/email', {
    title: req.t('tab_email'),
    counts: adminCounts(db),
    audienceCounts: {
      active: emailAudience(db, 'active').length,
      pending: emailAudience(db, 'pending').length,
      all: emailAudience(db, 'all').length
    },
    optedOut,
    adminEmail: req.currentUser.email,
    sent: req.query.sent ? parseInt(req.query.sent) : null,
    skipped: parseInt(req.query.skipped) || 0,
    err: req.query.err || null,
    lang: res.locals.lang
  });
});

adminRouter.post('/email/send', requireAdmin, csrfGuard, async (req, res) => {
  const db = req.db;
  const subject = (req.body.subject || '').trim();
  const heading = (req.body.heading || '').trim() || subject;
  const message = (req.body.message || '').trim();
  const ctaText = (req.body.ctaText || '').trim();
  const ctaUrl = (req.body.ctaUrl || '').trim();
  const audience = ['active', 'pending', 'all'].includes(req.body.audience) ? req.body.audience : 'active';
  const specific = (req.body.specific || '').trim();
  const testOnly = req.body.testOnly === '1';
  if (!subject || !message) return res.redirect('/admin/email?err=empty');

  // Build the recipient list.
  let recipients;
  if (testOnly) {
    recipients = [req.currentUser];
  } else if (specific) {
    const wanted = specific.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    // targeting exact emails bypasses opt-out (you asked for these people specifically)
    recipients = db.users.filter(u => wanted.includes(u.email.toLowerCase()));
  } else {
    recipients = emailAudience(db, audience);
  }

  const bodyHtml = textToHtml(message);
  const cta = ctaUrl ? { text: ctaText || req.t('email_visit'), url: ctaUrl } : null;
  const broadcast = !testOnly && !specific; // audience blasts respect opt-out
  let sent = 0, skipped = 0;
  for (const u of recipients) {
    // No `lang` override → each player's greeting/disclaimer/unsubscribe render in
    // THEIR own language. The subject and body stay as the admin typed them.
    const r = await mailUser(u, {
      subject, heading, intro: userT(u)('mail_hi', { name: u.name }),
      bodyHtml, cta, broadcast
    });
    if (r && r.skipped) skipped++; else sent++;
  }
  logAudit(db, req.currentUser, 'email.broadcast',
    `"${subject}" → ${sent} sent` + (skipped ? `, ${skipped} skipped` : '') +
    (testOnly ? ' (test)' : specific ? ' (specific)' : ` (${audience})`));
  save(db);
  res.redirect('/admin/email?sent=' + sent + '&skipped=' + skipped);
});

// ---------- Section pages ----------
adminRouter.get('/apps', requireAdmin, (req, res) => {
  res.render('admin/apps', { title: req.t('tab_apps'), counts: adminCounts(req.db) });
});

adminRouter.get('/deposits', requireAdmin, (req, res) => {
  const db = req.db;
  const status = req.query.status || '';
  const q = (req.query.q || '').trim().toLowerCase();
  let list = db.deposits.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(d => d.status === status);
  if (q) list = list.filter(d => (d.userName || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page, req.query.per);
  res.render('admin/deposits', {
    title: req.t('tab_deposits'),
    counts: adminCounts(db),
    deposits: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
    status, q, statusCounts: countBy(db.deposits)
  });
});

adminRouter.get('/withdrawals', requireAdmin, (req, res) => {
  const db = req.db;
  const status = req.query.status || '';
  const q = (req.query.q || '').trim().toLowerCase();
  let list = db.withdrawals.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(w => w.status === status);
  if (q) list = list.filter(w => (w.userName || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page, req.query.per);
  res.render('admin/withdrawals', {
    title: req.t('tab_withdrawals'),
    counts: adminCounts(db),
    withdrawals: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
    status, q, statusCounts: countBy(db.withdrawals)
  });
});

adminRouter.get('/audit', requireAdmin, (req, res) => {
  const db = req.db;
  res.render('admin/audit', {
    title: req.t('tab_audit'),
    counts: adminCounts(db),
    audit: db.audit.slice().sort((a, b) => b.at - a.at).slice(0, 200)
  });
});

// ---------- Settings hub + focused settings pages ----------
adminRouter.get('/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { title: req.t('tab_settings'), counts: adminCounts(req.db) });
});
['general', 'economy', 'payments', 'announcement', 'campaign'].forEach(section => {
  adminRouter.get('/settings/' + section, requireAdmin, (req, res) => {
    res.render('admin/settings-' + section, {
      title: req.t('set_' + section + '_t'), counts: adminCounts(req.db), ok: req.query.ok || null
    });
  });
});

// ----- CSV exports -----
adminRouter.get('/export/users.csv', requireAdmin, (req, res) => {
  const db = req.db;
  const apps = db.settings.plans;
  // per-app columns mean an export can be edited and imported straight back
  const rows = [[
    'id', 'name', 'email', 'status', 'admin', 'is_test', 'level', 'xp', 'earnings',
    ...apps.map(p => 'invested_' + p.id),
    'invested_total', 'total', 'referralCode', 'referredBy', 'joined'
  ]];
  db.users.forEach(u => rows.push([
    u.id, u.name, u.email, u.status, u.isAdmin ? 'yes' : 'no', u.isTest ? 'yes' : 'no',
    levelForXp(u.xp), u.xp || 0, (u.earnings || 0).toFixed(2),
    ...apps.map(p => ((u.invested && u.invested[p.id]) || 0).toFixed(2)),
    totalInvested(u).toFixed(2), totalBalance(u).toFixed(2),
    u.referralCode, u.referredBy || '', new Date(u.createdAt).toISOString()
  ]));
  csvReply(res, 'users.csv', rows);
});

adminRouter.get('/export/deposits.csv', requireAdmin, (req, res) => {
  const rows = [['id', 'user', 'amount', 'app', 'status', 'date']];
  req.db.deposits.forEach(d => rows.push([d.id, d.userName, d.amount, d.planLabel, d.status, new Date(d.createdAt).toISOString()]));
  csvReply(res, 'deposits.csv', rows);
});

adminRouter.get('/export/withdrawals.csv', requireAdmin, (req, res) => {
  const rows = [['id', 'user', 'amount', 'from', 'method', 'payoutName', 'payoutAccount', 'status', 'date']];
  req.db.withdrawals.forEach(w => rows.push([w.id, w.userName, w.amount, w.fromLabel || w.from, w.method || '',
    w.payoutName || '', w.payoutAccount || w.details || '', w.status, new Date(w.createdAt).toISOString()]));
  csvReply(res, 'withdrawals.csv', rows);
});

// ---------- Data: export / import ----------
const uploadData = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

adminRouter.get('/data', requireAdmin, (req, res) => {
  res.render('admin/data', {
    title: req.t('tab_data'), counts: adminCounts(req.db),
    result: req.query.wiped ? { ok: true, wiped: true, created: [], updated: [], errors: [] }
          : req.query.restored ? { ok: true, restored: true, created: [], updated: [], errors: [] }
          : null
  });
});

// Whole database as JSON — the real "all data" backup.
adminRouter.get('/export/backup.json', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kanzup-backup-${stamp}.json"`);
  res.send(JSON.stringify(req.db, null, 2));
});

// A ready-to-fill template so the expected columns are obvious.
adminRouter.get('/export/users-template.csv', requireAdmin, (req, res) => {
  const apps = req.db.settings.plans;
  csvReply(res, 'users-template.csv', [
    ['name', 'email', 'status', 'xp', 'earnings', 'password', ...apps.map(p => 'invested_' + p.id)],
    ['Yassine', 'yassine@example.com', 'active', '250', '500', 'changeme', ...apps.map(() => '1000')],
    ['Amine', 'amine@example.com', 'pending', '', '', '', ...apps.map(() => '')]
  ]);
});

// Import/update players from CSV. Matches on email.
adminRouter.post('/import/users', requireAdmin, csrfGuard, uploadData.single('file'), async (req, res) => {
  const db = req.db;
  const render = (result) => res.render('admin/data', { title: req.t('tab_data'), counts: adminCounts(db), result });
  if (!req.file) return render({ ok: false, error: req.t('imp_nofile') });

  let rows;
  try { rows = parseCsv(req.file.buffer.toString('utf8')); }
  catch (e) { return render({ ok: false, error: req.t('imp_badcsv') }); }
  if (rows.length < 2) return render({ ok: false, error: req.t('imp_empty') });

  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  if (col('email') === -1) return render({ ok: false, error: req.t('imp_noemail') });
  const markAllTest = req.body.markTest === '1'; // "import as test accounts" checkbox

  const created = [], updated = [], errors = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (n) => { const c = col(n); return c === -1 ? '' : (r[c] || '').trim(); };
    const email = get('email').toLowerCase();
    if (!email || !email.includes('@')) { errors.push(req.t('imp_row', { n: i + 1 }) + ': ' + req.t('imp_bademail')); continue; }

    const name = get('name');
    const status = ['active', 'pending', 'rejected'].includes(get('status')) ? get('status') : 'pending';
    const xp = get('xp'), earnings = get('earnings'), password = get('password');
    const rowTest = ['yes', 'true', '1'].includes(get('is_test').toLowerCase());
    const isTest = markAllTest || rowTest;

    let u = db.users.find(x => x.email.toLowerCase() === email);
    let isNew = false;
    if (u) {
      if (name) u.name = name;
      if (get('status')) u.status = status;
      if (xp !== '') u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== '') u.earnings = Math.max(0, Number(earnings) || 0);
      if (password) u.passwordHash = await bcrypt.hash(password, 10);
      if ((markAllTest || col('is_test') !== -1) && !u.isAdmin) u.isTest = isTest;
      updated.push(u.email);
    } else {
      isNew = true;
      if (!name) { errors.push(req.t('imp_row', { n: i + 1 }) + ': ' + req.t('imp_noname')); continue; }
      // never import an admin by accident, and never store a blank password
      const pass = password || crypto.randomBytes(6).toString('base64url');
      u = createUser(db, {
        name, email, passwordHash: await bcrypt.hash(pass, 10),
        isAdmin: false, status, isTest
      });
      if (xp !== '') u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== '') u.earnings = Math.max(0, Number(earnings) || 0);
      created.push({ email: u.email, password: password ? null : pass });
    }

    // per-app holdings: one optional column per app, e.g. invested_safe
    let touchedInvested = false;
    for (const p of db.settings.plans) {
      const c = col('invested_' + p.id);
      if (c === -1) continue;
      const v = (r[c] || '').trim();
      if (v === '') continue;
      const amt = Math.max(0, Number(v) || 0);
      u.invested[p.id] = amt;
      touchedInvested = true;
      // For NEW players, back the holding with a real approved deposit + activity
      // entry, so the deposits tab and their activity feed look genuine. Updates
      // skip this so an export→import round-trip doesn't pile up duplicate history.
      if (isNew && amt > 0) {
        db.deposits.push({
          id: db.nextDepositId++, userId: u.id, userName: u.name,
          plan: p.id, planLabel: p.name, amount: amt,
          status: 'approved', createdAt: Date.now()
        });
        addTx(u, 'deposit', amt, p.name);
      }
    }
    if (touchedInvested) {
      u.lastAccrual = Date.now();     // start earning from import time
      if (isNew) award(u, 'first_deposit');
    }
    // Optional payout details (so imported players can test withdrawals).
    const payMethod = get('payout_method').toLowerCase();
    const payAccount = get('payout_account');
    if (payMethod || payAccount) {
      const bank = payMethod === 'bank';
      u.payout = {
        method: bank ? 'bank' : 'paypal',
        name: get('payout_name') || u.name,
        paypal: bank ? '' : payAccount,
        rib: bank ? payAccount : ''
      };
    }
    checkState(u); // balance-based achievements
  }

  logAudit(db, req.currentUser, 'data.importUsers', created.length + ' created, ' + updated.length + ' updated, ' + errors.length + ' errors');
  save(db);
  render({ ok: true, created, updated, errors });
});

// Wipe everything and start over. The most destructive action in the app, so it
// needs the typed phrase AND the admin's password — CSRF alone isn't enough here.
adminRouter.post('/wipe', requireAdmin, async (req, res) => {
  const db = req.db;
  const render = (result) => res.render('admin/data', { title: req.t('tab_data'), counts: adminCounts(db), result });

  if (req.body.confirm !== 'WIPE') return render({ ok: false, error: req.t('wipe_noconfirm') });
  if (!(await bcrypt.compare(req.body.password || '', req.currentUser.passwordHash))) {
    return render({ ok: false, error: req.t('wipe_badpass') });
  }

  const keepAdmin = req.body.keepAdmin !== '0';       // default: keep yourself
  const keepSettings = req.body.keepSettings === '1'; // default: reset settings too
  const me = req.currentUser;
  const before = db.users.length;

  // uploaded avatars belong to users that are about to vanish
  db.users.forEach(u => { if (!(keepAdmin && u.id === me.id)) deleteUpload(u.avatar); });

  const fresh = wipe({ keepUsers: keepAdmin ? [me.id] : [], keepSettings });
  logAudit(fresh, keepAdmin ? me : null, 'data.wipe',
    before + ' users removed · settings ' + (keepSettings ? 'kept' : 'reset') + ' · admin ' + (keepAdmin ? 'kept' : 'removed'));
  save(fresh);

  // if the admin deleted themselves there's no session to return to
  if (!keepAdmin) return req.session.destroy(() => res.redirect('/'));
  res.redirect('/admin/data?wiped=1');
});

// Restore the whole database from a backup JSON. Destructive.
adminRouter.post('/restore', requireAdmin, csrfGuard, uploadData.single('file'), (req, res) => {
  const render = (result) => res.render('admin/data', { title: req.t('tab_data'), counts: adminCounts(req.db), result });
  if (!req.file) return render({ ok: false, error: req.t('imp_nofile') });
  if (req.body.confirm !== 'RESTORE') return render({ ok: false, error: req.t('imp_noconfirm') });

  let data;
  try { data = JSON.parse(req.file.buffer.toString('utf8')); }
  catch (e) { return render({ ok: false, error: req.t('imp_badjson') }); }
  if (!data || !Array.isArray(data.users) || !data.settings) {
    return render({ ok: false, error: req.t('imp_notbackup') });
  }

  const before = req.db.users.length;
  const restored = replaceAll(data); // snapshots the current db first
  logAudit(restored, req.currentUser, 'data.restore', before + ' users replaced with ' + restored.users.length);
  save(restored);
  res.redirect('/admin/data?restored=1');
});

// ----- Manage investable apps -----
// image the app is invested in — an uploaded photo takes priority over a pasted URL
function appImage(req) {
  if (req.file) return '/uploads/' + req.file.filename;
  return (req.body.imageUrl || '').trim();
}

adminRouter.post('/apps/add', requireAdmin, csrfGuard,
  (req, res, next) => uploadAppImg.single('image')(req, res, () => next()),
  (req, res) => {
    const db = req.db;
    const name = (req.body.name || '').trim();
    if (name) {
      db.settings.plans.push({
        id: 'app' + (db.nextAppId++),
        name,
        icon: (req.body.icon || 'trending-up').trim() || 'trending-up',
        imageUrl: appImage(req),
        ratePer15Days: Math.max(0, Number(req.body.rate) / 100 || 0),
        color: req.body.color || 'primary',
        desc: (req.body.desc || '').trim(),
        minLevel: Math.max(1, Number(req.body.minLevel) || 1)
      });
      logAudit(db, req.currentUser, 'app.add', name);
      save(db);
    }
    res.redirect('/admin/apps');
  });

adminRouter.post('/apps/edit/:id', requireAdmin, csrfGuard,
  (req, res, next) => uploadAppImg.single('image')(req, res, () => next()),
  (req, res) => {
    const db = req.db;
    const p = db.settings.plans.find(x => x.id === req.params.id);
    if (p) {
      if (req.body.name) p.name = req.body.name.trim();
      if (req.body.icon !== undefined && req.body.icon.trim()) p.icon = req.body.icon.trim();
      if (req.body.rate !== undefined && req.body.rate !== '') p.ratePer15Days = Math.max(0, Number(req.body.rate) / 100);
      if (req.body.minLevel) p.minLevel = Math.max(1, Number(req.body.minLevel) || 1);
      if (req.body.color) p.color = req.body.color;
      if (req.body.desc !== undefined) p.desc = req.body.desc.trim();
      if (req.body.removeImage === '1') { deleteUpload(p.imageUrl); p.imageUrl = ''; }
      else if (req.file || (req.body.imageUrl && req.body.imageUrl.trim() !== p.imageUrl)) {
        deleteUpload(p.imageUrl);            // drop the old uploaded file if any
        p.imageUrl = appImage(req);
      }
      logAudit(db, req.currentUser, 'app.edit', p.name + ' @ ' + (p.ratePer15Days * 100).toFixed(1) + '% / L' + p.minLevel);
      save(db);
    }
    res.redirect('/admin/apps');
  });

adminRouter.post('/apps/delete/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const gone = db.settings.plans.find(x => x.id === id);
  const remaining = db.settings.plans.filter(x => x.id !== id);
  // Where holdings go: the most accessible remaining app (lowest minLevel).
  // If it was the last app, there's nowhere to move to, so refund to earnings.
  const dest = remaining.slice().sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1))[0] || null;

  let moved = 0, refunded = 0;
  db.users.forEach(u => {
    const amt = (u.invested && u.invested[id]) || 0;
    if (amt <= 0) return;
    accrue(u, db);
    delete u.invested[id];
    if (dest) {
      u.invested[dest.id] = (u.invested[dest.id] || 0) + amt;   // keep them invested
      addTx(u, 'admin_adjust', amt, 'App removed — moved to ' + dest.name);
      moved++;
    } else {
      u.earnings += amt;                                        // no apps left
      addTx(u, 'admin_adjust', amt, 'App removed — refunded');
      refunded++;
    }
  });

  if (gone) deleteUpload(gone.imageUrl);   // remove its product image file
  db.settings.plans = remaining;
  logAudit(db, req.currentUser, 'app.delete',
    (gone ? gone.name : id) + (dest ? ' → moved ' + moved + ' holders to ' + dest.name : ' → refunded ' + refunded));
  save(db);
  res.redirect('/admin/apps');
});

// Approving a deposit is where coins are actually credited.
adminRouter.post('/deposit/:id/:action', requireAdmin, (req, res) => {
  const db = req.db;
  const d = db.deposits.find(x => x.id === Number(req.params.id));
  if (d && d.status === 'pending') {
    const u = db.users.find(x => x.id === d.userId);
    if (req.params.action === 'approve') {
      d.status = 'approved';
      d.approvedAt = Date.now(); // lock window starts when funds become available
      if (u) {
        accrue(u, db);
        u.invested[d.plan] = (u.invested[d.plan] || 0) + d.amount;
        addXp(u, Math.min(200, 10 + Math.floor(d.amount / 500)));
        addTx(u, 'deposit', d.amount, d.planLabel);
        award(u, 'first_deposit');
        // No deposit commission — referrers earn from their team's daily earnings instead.
        checkState(u);
        maybePayInvite(db, u); // this deposit may make them count for their referrer's challenge
        notifyDeposit(u, d.amount, d.planLabel, true);
      }
      logAudit(db, req.currentUser, 'deposit.approve', '#' + d.id + ' ' + d.userName + ' ' + d.amount + ' -> ' + d.planLabel);
    } else if (req.params.action === 'reject') {
      d.status = 'rejected';
      if (u) notifyDeposit(u, d.amount, d.planLabel, false);
      logAudit(db, req.currentUser, 'deposit.reject', '#' + d.id + ' ' + d.userName + ' ' + d.amount);
    }
    save(db);
  }
  res.redirect('/admin/deposits');
});

adminRouter.post('/approve/:id', requireAdmin, async (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u) {
    u.status = 'active'; u.lastAccrual = Date.now();
    maybePayInvite(db, u); // approving them may complete their referrer's invite
    logAudit(db, req.currentUser, 'user.approve', u.name + ' <' + u.email + '>');
    save(db);
    const tr = userT(u);
    await mailUser(u, {
      subject: tr('mail_appr_subj'),
      heading: tr('mail_appr_h'),
      lines: [tr('mail_appr_b')],
      cta: { text: tr('mail_login_play'), url: `${APP_URL}/login` }
    });
  }
  res.redirect('/admin/users');
});

adminRouter.post('/reject/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u && !u.isAdmin) { u.status = 'rejected'; logAudit(db, req.currentUser, 'user.reject', u.name + ' <' + u.email + '>'); }
  save(db);
  res.redirect('/admin/users');
});

adminRouter.post('/adjust/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u) {
    accrue(u, db);
    if (req.body.earnings !== '') u.earnings = Math.max(0, Number(req.body.earnings));
    for (const p of db.settings.plans) {
      const key = 'plan_' + p.id;
      if (req.body[key] !== undefined && req.body[key] !== '')
        u.invested[p.id] = Math.max(0, Number(req.body[key]));
    }
    addTx(u, 'admin_adjust', 0, 'Balances changed by admin');
    logAudit(db, req.currentUser, 'user.adjust', u.name + ': earnings=' + Math.round(u.earnings) + ' invested=' + Math.round(totalInvested(u)));
    save(db);
  }
  res.redirect('/admin/users/' + req.params.id);
});

adminRouter.post('/toggle-admin/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u && u.id !== req.currentUser.id) {
    u.isAdmin = !u.isAdmin;
    logAudit(db, req.currentUser, 'user.toggleAdmin', u.name + ' -> ' + (u.isAdmin ? 'admin' : 'player'));
  }
  save(db);
  res.redirect('/admin/users/' + req.params.id);
});

// Remove a player and everything attached to them. Returns the deleted user or null.
function deleteUserCascade(db, id) {
  const u = db.users.find(x => x.id === id);
  if (!u) return null;
  deleteUpload(u.avatar);                                     // their photo file
  db.users = db.users.filter(x => x.id !== id);
  db.deposits = db.deposits.filter(d => d.userId !== id);     // was leaking orphans
  db.withdrawals = db.withdrawals.filter(w => w.userId !== id);
  db.users.forEach(x => { if (x.referredBy === id) x.referredBy = null; }); // no dangling upline
  return u;
}

adminRouter.post('/delete/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  if (id !== req.currentUser.id) {   // never delete yourself
    const gone = deleteUserCascade(db, id);
    if (gone) logAudit(db, req.currentUser, 'user.delete', gone.name + ' <' + gone.email + '>');
    save(db);
  }
  res.redirect('/admin/users');
});

// ----- Bulk actions from the users list -----
adminRouter.post('/users/bulk', requireAdmin, async (req, res) => {
  const db = req.db;
  const action = req.body.action;
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  // never let an admin act on their own account in bulk
  ids = [...new Set(ids.map(Number))].filter(n => Number.isFinite(n) && n !== req.currentUser.id);

  if (!ids.length) return res.redirect('/admin/users?done=none');

  let n = 0;
  if (action === 'approve') {
    for (const id of ids) {
      const u = db.users.find(x => x.id === id);
      if (!u || u.status === 'active') continue;
      u.status = 'active';
      u.lastAccrual = Date.now();
      maybePayInvite(db, u);
      const tr = userT(u);
      mailUser(u, {
        subject: tr('mail_appr_subj'),
        heading: tr('mail_appr_h'),
        lines: [tr('mail_appr_b')],
        cta: { text: tr('mail_login_play'), url: `${APP_URL}/login` }
      });
      n++;
    }
  } else if (action === 'reject') {
    for (const id of ids) {
      const u = db.users.find(x => x.id === id);
      if (!u || u.isAdmin) continue;           // admins are never rejected
      u.status = 'rejected';
      n++;
    }
  } else if (action === 'delete') {
    for (const id of ids) {
      if (deleteUserCascade(db, id)) n++;
    }
  } else {
    return res.redirect('/admin/users');
  }

  logAudit(db, req.currentUser, 'user.bulk' + action.charAt(0).toUpperCase() + action.slice(1), n + ' players');
  save(db);
  res.redirect('/admin/users?done=' + action + '&n=' + n);
});

// Each settings page posts only its own fields, so handlers are split per section
// (a single merged handler would wipe any field the form didn't include).
adminRouter.post('/settings/general', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.siteName = (req.body.siteName || '').trim() || s.siteName;
  s.currency = (req.body.currency || '').trim() || s.currency;
  logAudit(db, req.currentUser, 'settings.general', s.siteName + ' / ' + s.currency);
  save(db);
  res.redirect('/admin/settings/general?ok=1');
});

// Branding: upload/replace/remove the logo image and choose whether the navbar
// and emails show the logo or the text name. csrfGuard runs before multer.
adminRouter.post('/settings/logo', requireAdmin, csrfGuard,
  (req, res, next) => uploadLogo.single('logo')(req, res, () => next()),
  (req, res) => {
    const db = req.db, s = db.settings;
    if (req.body.remove === '1') {
      if (s.logoUrl) deleteUpload(s.logoUrl);
      s.logoUrl = '';
      s.brandMode = 'text';
    } else {
      if (req.file) {
        if (s.logoUrl) deleteUpload(s.logoUrl); // drop the previous file
        s.logoUrl = '/uploads/' + req.file.filename;
      }
      // Only allow 'logo' mode if there is actually a logo to show.
      s.brandMode = (req.body.brandMode === 'logo' && s.logoUrl) ? 'logo' : 'text';
    }
    logAudit(db, req.currentUser, 'settings.logo', s.brandMode + (s.logoUrl ? ' ' + s.logoUrl : ''));
    save(db);
    res.redirect('/admin/settings/general?ok=1');
  });

adminRouter.post('/settings/economy', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.minAddFunds = Math.max(0, Number(req.body.minAddFunds) || 0);
  s.minWithdraw = Math.max(0, Number(req.body.minWithdraw) || 0);
  s.minTransfer = Math.max(0, Number(req.body.minTransfer) || 0);
  s.withdrawEveryDays = Math.max(0, Number(req.body.withdrawEveryDays) || 0);
  s.depositLockDays = Math.max(0, Math.floor(Number(req.body.depositLockDays) || 0));
  s.referralTiers = [1, 2, 3].map(i => Math.max(0, Number(req.body['tier' + i]) / 100 || 0));
  s.dailyBonusBase = Math.max(0, Number(req.body.dailyBonusBase) || 0);
  logAudit(db, req.currentUser, 'settings.economy',
    'Limits, tiers (' + s.referralTiers.map(x => (x * 100).toFixed(2) + '%').join('/') + ') and daily bonus updated');
  save(db);
  res.redirect('/admin/settings/economy?ok=1');
});

adminRouter.post('/settings/payments', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.depositInfo = {
    bankName: (req.body.dep_bankName || '').trim(),
    accountName: (req.body.dep_accountName || '').trim(),
    rib: (req.body.dep_rib || '').trim(),
    note: (req.body.dep_note || '').trim()
  };
  logAudit(db, req.currentUser, 'settings.payments', 'Deposit payment info updated');
  save(db);
  res.redirect('/admin/settings/payments?ok=1');
});

adminRouter.post('/settings/campaign', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  const prev = s.campaign || {};
  s.campaign = {
    enabled: !!req.body.enabled,
    title: (req.body.title || '').trim(),
    inviteGoal: Math.max(1, Number(req.body.inviteGoal) || 1),
    minDeposit: Math.max(0, Number(req.body.minDeposit) || 0),
    requireActive: !!req.body.requireActive,
    coinsPerInvite: Math.max(0, Number(req.body.coinsPerInvite) || 0),
    xpPerInvite: Math.max(0, Number(req.body.xpPerInvite) || 0),
    rewardCoins: Math.max(0, Number(req.body.rewardCoins) || 0),
    rewardXp: Math.max(0, Number(req.body.rewardXp) || 0),
    maxClaims: Math.max(0, Number(req.body.maxClaims) || 0),
    // "start fresh" only counts players who join from now on
    countFrom: req.body.resetCount ? Date.now() : (prev.countFrom || 0)
  };
  if (req.body.resetProgress) {
    db.users.forEach(u => { u.campaignClaims = 0; });
  }
  logAudit(db, req.currentUser, 'settings.campaign',
    (s.campaign.enabled ? 'ON' : 'OFF') + ' · invite ' + s.campaign.inviteGoal +
    ' · min deposit ' + s.campaign.minDeposit + ' · reward ' + s.campaign.rewardCoins +
    ' + ' + s.campaign.rewardXp + ' XP' + (req.body.resetProgress ? ' · progress reset' : ''));
  save(db);
  res.redirect('/admin/settings/campaign?ok=1');
});

adminRouter.post('/settings/announcement', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.announcement = { text: (req.body.ann_text || '').trim(), enabled: !!req.body.ann_enabled };
  logAudit(db, req.currentUser, 'settings.announcement', s.announcement.enabled ? 'ON: ' + s.announcement.text : 'OFF');
  save(db);
  res.redirect('/admin/settings/announcement?ok=1');
});

adminRouter.post('/withdraw/:id/:action', requireAdmin, (req, res) => {
  const db = req.db;
  const w = db.withdrawals.find(x => x.id === Number(req.params.id));
  if (w && w.status === 'pending') {
    const u = db.users.find(x => x.id === w.userId);
    if (req.params.action === 'approve') {
      w.status = 'paid';
      if (u) { addTx(u, 'withdraw_paid', w.amount, 'From ' + (w.fromLabel || w.from)); notifyWithdrawal(u, w, 'paid'); }
      logAudit(db, req.currentUser, 'withdraw.paid', '#' + w.id + ' ' + w.userName + ' ' + w.amount + ' via ' + (w.method || '-'));
    } else if (req.params.action === 'reject') {
      if (u) {
        if (w.from === 'earnings') u.earnings += w.amount;
        else u.invested[w.from] = (u.invested[w.from] || 0) + w.amount;
        addTx(u, 'withdraw_rejected', w.amount, 'Refunded to ' + (w.fromLabel || w.from));
        notifyWithdrawal(u, w, 'rejected');
      }
      w.status = 'rejected';
      logAudit(db, req.currentUser, 'withdraw.reject', '#' + w.id + ' ' + w.userName + ' ' + w.amount);
    }
    save(db);
  }
  res.redirect('/admin/withdrawals');
});

// ---------- Mount the admin router ----------
// Everywhere: reachable under /admin (backward compatible, form posts, XHR).
app.use('/admin', adminRouter);
// On the admin host only: also reachable at the root, so /users, /deposits, … work
// as clean URLs. Placed after all the player routes above, so player pages (login,
// dashboard, impersonation view, language, …) still win on this host.
app.use((req, res, next) => onAdminHost(req) ? adminRouter(req, res, next) : next());

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('error', {
    title: req.t('err_404_t'), code: 404,
    heading: req.t('err_404_t'), mBody: req.t('err_404_d')
  });
});

// ---------- 500 ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', {
    title: req.t('err_500_t'), code: 500,
    heading: req.t('err_500_t'), mBody: req.t('err_500_d'),
    detail: PROD ? null : (err && err.stack) // never leak stack traces in production
  });
});

// Run due recurring deposits on a timer (and once shortly after boot).
setInterval(() => {
  const db = load();
  if (runSchedules(db)) save(db);
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`\n🎮  Investment game running at ${APP_URL}`);
  if (ADMIN_EMAIL) console.log(`    Admin: sign up with ${ADMIN_EMAIL} to claim the admin account.\n`);
  else console.log('    The FIRST account you sign up with becomes the admin.\n');
});
