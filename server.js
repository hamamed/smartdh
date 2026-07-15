require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const ejsLayouts = require('express-ejs-layouts');
const { load, save, refCode, replaceAll } = require('./db');
const { sendMail } = require('./email');
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

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
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
  name: 'dv.sid',
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
  cookie: { maxAge: DAY * 7, httpOnly: true, sameSite: 'lax', secure: PROD }
}));

// ---------- CSRF protection ----------
// Every session gets a token; every POST must echo it back (form field or header).
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
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
      heading: req.t('err_csrf_t'), body: req.t('err_csrf_d')
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
  let user = null;
  if (req.session.userId) {
    user = db.users.find(u => u.id === req.session.userId) || null;
    if (user) { accrue(user, db); flushReferralTx(user); save(db); }
  }
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
  res.locals.money = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${db.settings.currency}`;
  next();
});

// Verify CSRF on every state-changing request (locals are ready by now).
// Multipart bodies aren't parsed yet at this point, so those routes run csrfGuard
// again themselves right after multer — they are never left unchecked.
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  csrfGuard(req, res, next);
});

app.get('/lang/:code', (req, res) => {
  if (LANGS.includes(req.params.code)) req.session.lang = req.params.code;
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
function addTx(user, type, amount, note) {
  user.transactions = user.transactions || [];
  user.transactions.push({ type, amount, note: note || '', at: Date.now() });
  if (user.transactions.length > 120) user.transactions = user.transactions.slice(-120);
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
function createUser(db, { name, email, passwordHash, isAdmin = false, status = 'pending', referredBy = null }) {
  const id = db.nextUserId++;
  const user = {
    id, name, email, passwordHash,
    isAdmin, status,
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
    referredBy
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
function notifyLevelUp(user, level) {
  sendMail(user.email, `You reached level ${level}!`,
    `<p>Hi ${user.name},</p><p>Congratulations — you just reached <b>level ${level}</b>. New apps may now be unlocked. Keep going!</p>`);
}
function notifyDeposit(user, amount, planLabel, approved) {
  sendMail(user.email, approved ? 'Your deposit was approved' : 'Your deposit was rejected',
    `<p>Hi ${user.name},</p><p>Your deposit of <b>${amount}</b> into <b>${planLabel}</b> was ${approved ? 'approved and credited' : 'rejected'}.</p>`);
}
function notifyWithdrawal(user, w, status) {
  sendMail(user.email, status === 'paid' ? 'Your withdrawal was paid' : 'Your withdrawal was rejected',
    `<p>Hi ${user.name},</p><p>Your withdrawal of <b>${w.amount}</b> was ${status === 'paid' ? 'marked as paid' : 'rejected and refunded to your balance'}.</p>`);
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
  if (!req.currentUser || !req.currentUser.isAdmin) return res.status(403).render('message', {
    title: req.t('forbidden_title'), heading: req.t('forbidden_h'), body: req.t('forbidden_b')
  });
  next();
}

// ---------- Public ----------
// Logged-in players don't need the landing page — send them to their dashboard.
app.get('/', (req, res) => {
  if (req.currentUser) return res.redirect('/dashboard');
  res.render('landing', { title: req.t('hero_title') });
});
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
    referredBy: referrer ? referrer.id : null
  });
  if (referrer) award(referrer, 'recruiter');
  save(db);

  if (isFirstUser) { req.session.userId = user.id; return res.redirect('/admin'); }

  await sendMail(email, 'Your account is pending approval',
    `<p>Hi ${name},</p><p>Thanks for joining! Your account is waiting for the admin to approve it. You'll be able to log in once approved.</p>`);
  res.render('message', {
    title: req.t('msg_created_h'), heading: req.t('msg_created_h'), body: req.t('msg_created_b')
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

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

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
  res.render('home', Object.assign({
    title: req.t('nav_home'),
    perSecond: earningPerSecond(u, s),
    totalInvested: totalInvested(u),
    totalBalance: totalBalance(u),
    canClaim: !(u.streak && u.streak.lastClaim === dayStr(Date.now())),
    showTour: !u.onboarded || req.query.tour === '1',
    history: u.history || [],
    campaign: campaignStatus(req.db, u)
  }, levelData(u)));
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
  res.render('withdraw', {
    title: req.t('withdraw_title'),
    payoutOk: !payoutMissing(u.payout),          // payout comes from the profile
    payoutAccount: payoutAccount(u.payout),
    myWithdrawals: req.db.withdrawals.filter(w => w.userId === u.id).sort((a, b) => b.createdAt - a.createdAt)
  });
});

// ---------- Send coins ----------
app.get('/send', requireActive, (req, res) => {
  res.render('send', { title: req.t('send_title') });
});

// ---------- Rewards (daily bonus + streak) ----------
app.get('/rewards', requireActive, (req, res) => {
  const u = req.currentUser;
  res.render('rewards', {
    title: req.t('db_title'),
    canClaim: !(u.streak && u.streak.lastClaim === dayStr(Date.now()))
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
  res.render('profile', { title: req.t('profile_title'), error: null, ok: req.query.ok || null });
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

app.post('/profile/password', requireActive, async (req, res) => {
  const u = req.currentUser;
  const { current, next: newPass } = req.body;
  if (!newPass || newPass.length < 4)
    return res.render('profile', { title: req.t('profile_title'), error: req.t('pw_too_short'), ok: null });
  if (!(await bcrypt.compare(current || '', u.passwordHash)))
    return res.render('profile', { title: req.t('profile_title'), error: req.t('pw_wrong_current'), ok: null });
  u.passwordHash = await bcrypt.hash(newPass, 10);
  save(req.db);
  res.redirect('/profile?ok=password');
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
    await sendMail(u.email, req.t('mail_reset_subject'),
      `<p>${req.t('mail_hi', { name: u.name })}</p><p>${req.t('mail_reset_body')}</p>
       <p><a href="${link}">${link}</a></p><p>${req.t('mail_reset_expire')}</p>`);
  }
  // Always show the same message — never reveal which emails exist.
  res.render('forgot', { title: req.t('forgot_title'), sent: true });
});

app.get('/reset/:token', (req, res) => {
  const u = req.db.users.find(x => x.reset && x.reset.token === req.params.token && x.reset.expires > Date.now());
  if (!u) return res.status(400).render('error', {
    title: req.t('reset_bad_t'), code: 400, heading: req.t('reset_bad_t'), body: req.t('reset_bad_d')
  });
  res.render('reset', { title: req.t('reset_title'), token: req.params.token, error: null });
});

app.post('/reset/:token', authLimiter, async (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.reset && x.reset.token === req.params.token && x.reset.expires > Date.now());
  if (!u) return res.status(400).render('error', {
    title: req.t('reset_bad_t'), code: 400, heading: req.t('reset_bad_t'), body: req.t('reset_bad_d')
  });
  const pass = req.body.password || '';
  if (pass.length < 4)
    return res.render('reset', { title: req.t('reset_title'), token: req.params.token, error: req.t('pw_too_short') });
  u.passwordHash = await bcrypt.hash(pass, 10);
  u.reset = null;
  save(db);
  res.render('message', {
    title: req.t('reset_done_t'), heading: req.t('reset_done_t'), body: req.t('reset_done_d')
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
    available = u.invested[plan.id] || 0; label = plan.name;
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
    .filter(x => x.status === 'active' && !x.isAdmin) // admins run the game — they don't compete
    .map(x => ({ id: x.id, name: mask(x.name), total: totalBalance(x), isSelf: x.id === req.currentUser.id }))
    .sort((a, b) => b.total - a.total);
  res.render('leaderboard', { title: req.t('lb_title'), rows });
});

// ---------- Admin ----------
const PER_PAGE = 10;

// Slice a list for the current page, clamping out-of-range page numbers.
function paginate(list, page, per = PER_PAGE) {
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(pages, Math.max(1, parseInt(page) || 1));
  return { items: list.slice((p - 1) * per, p * per), page: p, pages, total: list.length };
}

// { pending: 3, approved: 10, ... } for the filter-button badges
function countBy(list, key = 'status') {
  return list.reduce((acc, x) => { acc[x[key]] = (acc[x[key]] || 0) + 1; return acc; }, {});
}

// Counts shown as badges on the admin hub tiles.
function adminCounts(db) {
  return {
    pendingUsers: db.users.filter(u => u.status === 'pending').length,
    pendingDeposits: db.deposits.filter(d => d.status === 'pending').length,
    pendingWithdrawals: db.withdrawals.filter(w => w.status === 'pending').length,
    users: db.users.length,
    apps: db.settings.plans.length
  };
}

// ---------- Admin hub ----------
app.get('/admin', requireAdmin, (req, res) => {
  const db = req.db;
  db.users.forEach(u => accrue(u, db));
  save(db);
  const active = db.users.filter(u => u.status === 'active');
  res.render('admin/hub', {
    title: req.t('admin_title'),
    counts: adminCounts(db),
    stats: {
      players: active.length,
      invested: active.reduce((s, u) => s + totalInvested(u), 0),
      earnings: active.reduce((s, u) => s + (u.earnings || 0), 0),
      total: active.reduce((s, u) => s + totalBalance(u), 0),
      deposits: db.deposits.filter(d => d.status === 'approved').length,
      paid: db.withdrawals.filter(w => w.status === 'paid').length
    }
  });
});

// ---------- Users ----------
app.get('/admin/users', requireAdmin, (req, res) => {
  const db = req.db;
  db.users.forEach(u => accrue(u, db));
  save(db);
  const q = (req.query.q || '').trim().toLowerCase();
  const status = req.query.status || '';
  let list = db.users.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(u => u.status === status);
  if (q) list = list.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.referralCode || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page);
  res.render('admin/users', {
    title: req.t('tab_users'),
    users: pg.items, page: pg.page, pages: pg.pages, totalUsers: pg.total,
    q, status,
    totalUsersAll: db.users.length,
    statusCounts: countBy(db.users),
    counts: adminCounts(db),
    done: req.query.done || null, doneN: parseInt(req.query.n) || 0,
    levelForXp, totalInvested, totalBalance
  });
});

// ---------- Single user ----------
app.get('/admin/users/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (!u) return res.status(404).render('error', {
    title: req.t('err_404_t'), code: 404, heading: req.t('err_404_t'), body: req.t('err_404_d')
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
    payoutAccount: payoutAccount(u.payout)
  });
});

// Set a user's XP directly (level is derived from it).
app.post('/admin/users/:id/xp', requireAdmin, (req, res) => {
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
app.post('/admin/users/:id/password', requireAdmin, async (req, res) => {
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

// ---------- Section pages ----------
app.get('/admin/apps', requireAdmin, (req, res) => {
  res.render('admin/apps', { title: req.t('tab_apps'), counts: adminCounts(req.db) });
});

app.get('/admin/deposits', requireAdmin, (req, res) => {
  const db = req.db;
  const status = req.query.status || '';
  const q = (req.query.q || '').trim().toLowerCase();
  let list = db.deposits.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(d => d.status === status);
  if (q) list = list.filter(d => (d.userName || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page);
  res.render('admin/deposits', {
    title: req.t('tab_deposits'),
    counts: adminCounts(db),
    deposits: pg.items, page: pg.page, pages: pg.pages, total: pg.total,
    status, q, statusCounts: countBy(db.deposits)
  });
});

app.get('/admin/withdrawals', requireAdmin, (req, res) => {
  const db = req.db;
  const status = req.query.status || '';
  const q = (req.query.q || '').trim().toLowerCase();
  let list = db.withdrawals.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(w => w.status === status);
  if (q) list = list.filter(w => (w.userName || '').toLowerCase().includes(q));
  const pg = paginate(list, req.query.page);
  res.render('admin/withdrawals', {
    title: req.t('tab_withdrawals'),
    counts: adminCounts(db),
    withdrawals: pg.items, page: pg.page, pages: pg.pages, total: pg.total,
    status, q, statusCounts: countBy(db.withdrawals)
  });
});

app.get('/admin/audit', requireAdmin, (req, res) => {
  const db = req.db;
  res.render('admin/audit', {
    title: req.t('tab_audit'),
    counts: adminCounts(db),
    audit: db.audit.slice().sort((a, b) => b.at - a.at).slice(0, 200)
  });
});

// ---------- Settings hub + focused settings pages ----------
app.get('/admin/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { title: req.t('tab_settings'), counts: adminCounts(req.db) });
});
['general', 'economy', 'payments', 'announcement', 'campaign'].forEach(section => {
  app.get('/admin/settings/' + section, requireAdmin, (req, res) => {
    res.render('admin/settings-' + section, {
      title: req.t('set_' + section + '_t'), counts: adminCounts(req.db), ok: req.query.ok || null
    });
  });
});

// ----- CSV exports -----
app.get('/admin/export/users.csv', requireAdmin, (req, res) => {
  const db = req.db;
  const rows = [['id', 'name', 'email', 'status', 'admin', 'level', 'xp', 'invested', 'earnings', 'total', 'referralCode', 'referredBy', 'joined']];
  db.users.forEach(u => rows.push([
    u.id, u.name, u.email, u.status, u.isAdmin ? 'yes' : 'no',
    levelForXp(u.xp), u.xp || 0,
    totalInvested(u).toFixed(2), (u.earnings || 0).toFixed(2), totalBalance(u).toFixed(2),
    u.referralCode, u.referredBy || '', new Date(u.createdAt).toISOString()
  ]));
  csvReply(res, 'users.csv', rows);
});

app.get('/admin/export/deposits.csv', requireAdmin, (req, res) => {
  const rows = [['id', 'user', 'amount', 'app', 'status', 'date']];
  req.db.deposits.forEach(d => rows.push([d.id, d.userName, d.amount, d.planLabel, d.status, new Date(d.createdAt).toISOString()]));
  csvReply(res, 'deposits.csv', rows);
});

app.get('/admin/export/withdrawals.csv', requireAdmin, (req, res) => {
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

app.get('/admin/data', requireAdmin, (req, res) => {
  res.render('admin/data', {
    title: req.t('tab_data'), counts: adminCounts(req.db), result: null
  });
});

// Whole database as JSON — the real "all data" backup.
app.get('/admin/export/backup.json', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="smartdh-backup-${stamp}.json"`);
  res.send(JSON.stringify(req.db, null, 2));
});

// A ready-to-fill template so the expected columns are obvious.
app.get('/admin/export/users-template.csv', requireAdmin, (req, res) => {
  csvReply(res, 'users-template.csv', [
    ['name', 'email', 'status', 'xp', 'earnings', 'password'],
    ['Yassine', 'yassine@example.com', 'active', '0', '0', 'changeme'],
    ['Amine', 'amine@example.com', 'pending', '', '', '']
  ]);
});

// Import/update players from CSV. Matches on email.
app.post('/admin/import/users', requireAdmin, csrfGuard, uploadData.single('file'), async (req, res) => {
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

  const created = [], updated = [], errors = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (n) => { const c = col(n); return c === -1 ? '' : (r[c] || '').trim(); };
    const email = get('email').toLowerCase();
    if (!email || !email.includes('@')) { errors.push(req.t('imp_row', { n: i + 1 }) + ': ' + req.t('imp_bademail')); continue; }

    const name = get('name');
    const status = ['active', 'pending', 'rejected'].includes(get('status')) ? get('status') : 'pending';
    const xp = get('xp'), earnings = get('earnings'), password = get('password');

    let u = db.users.find(x => x.email.toLowerCase() === email);
    if (u) {
      if (name) u.name = name;
      if (get('status')) u.status = status;
      if (xp !== '') u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== '') u.earnings = Math.max(0, Number(earnings) || 0);
      if (password) u.passwordHash = await bcrypt.hash(password, 10);
      updated.push(u.email);
    } else {
      if (!name) { errors.push(req.t('imp_row', { n: i + 1 }) + ': ' + req.t('imp_noname')); continue; }
      // never import an admin by accident, and never store a blank password
      const pass = password || crypto.randomBytes(6).toString('base64url');
      u = createUser(db, {
        name, email, passwordHash: await bcrypt.hash(pass, 10),
        isAdmin: false, status
      });
      if (xp !== '') u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== '') u.earnings = Math.max(0, Number(earnings) || 0);
      created.push({ email: u.email, password: password ? null : pass });
    }
  }

  logAudit(db, req.currentUser, 'data.importUsers', created.length + ' created, ' + updated.length + ' updated, ' + errors.length + ' errors');
  save(db);
  render({ ok: true, created, updated, errors });
});

// Restore the whole database from a backup JSON. Destructive.
app.post('/admin/restore', requireAdmin, csrfGuard, uploadData.single('file'), (req, res) => {
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
app.post('/admin/apps/add', requireAdmin, (req, res) => {
  const db = req.db;
  const name = (req.body.name || '').trim();
  if (name) {
    db.settings.plans.push({
      id: 'app' + (db.nextAppId++),
      name,
      icon: (req.body.icon || 'trending-up').trim() || 'trending-up',
      imageUrl: (req.body.imageUrl || '').trim(),
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

app.post('/admin/apps/edit/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const p = db.settings.plans.find(x => x.id === req.params.id);
  if (p) {
    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.icon !== undefined && req.body.icon.trim()) p.icon = req.body.icon.trim();
    if (req.body.rate !== undefined && req.body.rate !== '') p.ratePer15Days = Math.max(0, Number(req.body.rate) / 100);
    if (req.body.minLevel) p.minLevel = Math.max(1, Number(req.body.minLevel) || 1);
    if (req.body.color) p.color = req.body.color;
    logAudit(db, req.currentUser, 'app.edit', p.name + ' @ ' + (p.ratePer15Days * 100).toFixed(1) + '% / L' + p.minLevel);
    save(db);
  }
  res.redirect('/admin/apps');
});

app.post('/admin/apps/delete/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const id = req.params.id;
  // Refund any coins invested in this app back to earnings so nothing is stranded.
  db.users.forEach(u => {
    if (u.invested && u.invested[id]) {
      accrue(u, db);
      u.earnings += u.invested[id];
      addTx(u, 'admin_adjust', u.invested[id], 'App removed — refunded');
      delete u.invested[id];
    }
  });
  const gone = db.settings.plans.find(x => x.id === id);
  db.settings.plans = db.settings.plans.filter(x => x.id !== id);
  logAudit(db, req.currentUser, 'app.delete', gone ? gone.name : id);
  save(db);
  res.redirect('/admin/apps');
});

// Approving a deposit is where coins are actually credited.
app.post('/admin/deposit/:id/:action', requireAdmin, (req, res) => {
  const db = req.db;
  const d = db.deposits.find(x => x.id === Number(req.params.id));
  if (d && d.status === 'pending') {
    const u = db.users.find(x => x.id === d.userId);
    if (req.params.action === 'approve') {
      d.status = 'approved';
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

app.post('/admin/approve/:id', requireAdmin, async (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u) {
    u.status = 'active'; u.lastAccrual = Date.now();
    maybePayInvite(db, u); // approving them may complete their referrer's invite
    logAudit(db, req.currentUser, 'user.approve', u.name + ' <' + u.email + '>');
    save(db);
    await sendMail(u.email, 'Your account is approved ✅',
      `<p>Hi ${u.name},</p><p>Good news — your account has been approved. You can now log in and start playing!</p>`);
  }
  res.redirect('/admin/users');
});

app.post('/admin/reject/:id', requireAdmin, (req, res) => {
  const db = req.db;
  const u = db.users.find(x => x.id === Number(req.params.id));
  if (u && !u.isAdmin) { u.status = 'rejected'; logAudit(db, req.currentUser, 'user.reject', u.name + ' <' + u.email + '>'); }
  save(db);
  res.redirect('/admin/users');
});

app.post('/admin/adjust/:id', requireAdmin, (req, res) => {
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

app.post('/admin/toggle-admin/:id', requireAdmin, (req, res) => {
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

app.post('/admin/delete/:id', requireAdmin, (req, res) => {
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
app.post('/admin/users/bulk', requireAdmin, async (req, res) => {
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
      sendMail(u.email, 'Your account is approved',
        `<p>Hi ${u.name},</p><p>Your account has been approved — you can log in and start playing.</p>`);
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
app.post('/admin/settings/general', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.siteName = (req.body.siteName || '').trim() || s.siteName;
  s.currency = (req.body.currency || '').trim() || s.currency;
  logAudit(db, req.currentUser, 'settings.general', s.siteName + ' / ' + s.currency);
  save(db);
  res.redirect('/admin/settings/general?ok=1');
});

app.post('/admin/settings/economy', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.minAddFunds = Math.max(0, Number(req.body.minAddFunds) || 0);
  s.minWithdraw = Math.max(0, Number(req.body.minWithdraw) || 0);
  s.minTransfer = Math.max(0, Number(req.body.minTransfer) || 0);
  s.withdrawEveryDays = Math.max(0, Number(req.body.withdrawEveryDays) || 0);
  s.referralTiers = [1, 2, 3].map(i => Math.max(0, Number(req.body['tier' + i]) / 100 || 0));
  s.dailyBonusBase = Math.max(0, Number(req.body.dailyBonusBase) || 0);
  logAudit(db, req.currentUser, 'settings.economy',
    'Limits, tiers (' + s.referralTiers.map(x => (x * 100).toFixed(2) + '%').join('/') + ') and daily bonus updated');
  save(db);
  res.redirect('/admin/settings/economy?ok=1');
});

app.post('/admin/settings/payments', requireAdmin, (req, res) => {
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

app.post('/admin/settings/campaign', requireAdmin, (req, res) => {
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

app.post('/admin/settings/announcement', requireAdmin, (req, res) => {
  const db = req.db, s = db.settings;
  s.announcement = { text: (req.body.ann_text || '').trim(), enabled: !!req.body.ann_enabled };
  logAudit(db, req.currentUser, 'settings.announcement', s.announcement.enabled ? 'ON: ' + s.announcement.text : 'OFF');
  save(db);
  res.redirect('/admin/settings/announcement?ok=1');
});

app.post('/admin/withdraw/:id/:action', requireAdmin, (req, res) => {
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

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('error', {
    title: req.t('err_404_t'), code: 404,
    heading: req.t('err_404_t'), body: req.t('err_404_d')
  });
});

// ---------- 500 ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', {
    title: req.t('err_500_t'), code: 500,
    heading: req.t('err_500_t'), body: req.t('err_500_d'),
    detail: PROD ? null : (err && err.stack) // never leak stack traces in production
  });
});

app.listen(PORT, () => {
  console.log(`\n🎮  Investment game running at ${APP_URL}`);
  if (ADMIN_EMAIL) console.log(`    Admin: sign up with ${ADMIN_EMAIL} to claim the admin account.\n`);
  else console.log('    The FIRST account you sign up with becomes the admin.\n');
});
