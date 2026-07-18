// JSON file store with a single shared in-memory instance, atomic writes and
// rotating backups. Single instance => no read-modify-write clobbering between
// concurrent requests. Atomic rename => a crash mid-write can never corrupt db.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_EVERY_MS = 1000 * 60 * 60; // at most one backup per hour
const KEEP_BACKUPS = 12;

const DEFAULTS = {
  users: [],
  withdrawals: [],
  deposits: [],
  audit: [],
  schedules: [],
  settings: {
    siteName: 'DirhamVest',
    // Branding: show the text name, or an uploaded logo image, in the navbar/emails.
    logoUrl: '',
    brandMode: 'text',   // 'text' | 'logo'
    currency: 'DH',
    announcement: { text: '', enabled: false },
    plans: [
      { id: 'safe',     name: 'SafeSave',    icon: 'shield', imageUrl: '', ratePer15Days: 0.05, color: 'success', desc: 'Low but steady growth.',       minLevel: 1 },
      { id: 'balanced', name: 'BalanceApp',  icon: 'scale',  imageUrl: '', ratePer15Days: 0.10, color: 'primary', desc: 'The classic — solid returns.', minLevel: 1 },
      { id: 'risky',    name: 'HighRoller',  icon: 'rocket', imageUrl: '', ratePer15Days: 0.20, color: 'danger',  desc: 'Big risk, big reward.',        minLevel: 3 }
    ],
    minAddFunds: 100,
    minWithdraw: 100,
    minTransfer: 10,
    withdrawEveryDays: 15,
    // Referral commission taken from what your team EARNS (not from their deposits).
    // [direct, 2nd level, 3rd level]
    referralTiers: [0.02, 0.01, 0.005],
    // Admin-controlled invite challenge. Off until the admin switches it on.
    campaign: {
      enabled: false,
      title: '',            // optional custom name
      inviteGoal: 3,        // how many qualifying players to invite per reward
      minDeposit: 1000,     // each invited player must have deposited at least this (approved)
      requireActive: true,  // only count approved players
      // paid immediately for EACH qualifying invite
      coinsPerInvite: 100,
      xpPerInvite: 25,
      // paid once the whole set is completed
      rewardCoins: 500,
      rewardXp: 100,
      maxClaims: 1,         // 0 = unlimited (repeatable)
      countFrom: 0          // only count players who joined after this time
    },
    dailyBonusBase: 50,
    // DEMO payment details shown on the deposit screen. Keep these FAKE —
    // this is a play-money game, no real money should ever be sent.
    depositInfo: {
      bankName: 'Demo Bank (play money)',
      accountName: 'Game Master',
      rib: '000 780 0000000000000000 42',
      note: 'Demo only — never send real money. This is a game.'
    }
  },
  nextUserId: 1,
  nextWithdrawId: 1,
  nextDepositId: 1,
  nextAppId: 1,
  nextAuditId: 1
};

let cache = null;
let lastBackup = 0;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function refCode(id) {
  return 'R' + id.toString(36).toUpperCase().padStart(4, '0');
}

function migrate(db) {
  db.settings = Object.assign({}, DEFAULTS.settings, db.settings || {});
  if (db.settings.logoUrl === undefined) db.settings.logoUrl = '';
  if (!['text', 'logo'].includes(db.settings.brandMode)) db.settings.brandMode = 'text';
  db.settings.depositInfo = Object.assign({}, DEFAULTS.settings.depositInfo, db.settings.depositInfo || {});
  db.settings.announcement = Object.assign({}, DEFAULTS.settings.announcement, db.settings.announcement || {});
  // migrate the old single deposit-based percent to the new earnings-based tiers
  if (!Array.isArray(db.settings.referralTiers) || db.settings.referralTiers.length !== 3) {
    db.settings.referralTiers = DEFAULTS.settings.referralTiers.slice();
  }
  delete db.settings.referralPercent;
  db.settings.campaign = Object.assign({}, DEFAULTS.settings.campaign, db.settings.campaign || {});
  if (!db.settings.plans || !db.settings.plans.length) db.settings.plans = DEFAULTS.settings.plans;
  db.deposits = db.deposits || [];
  db.withdrawals = db.withdrawals || [];
  db.audit = db.audit || [];
  db.schedules = db.schedules || [];
  db.nextDepositId = db.nextDepositId || 1;
  db.nextAppId = db.nextAppId || 1;
  db.nextAuditId = db.nextAuditId || 1;
  db.nextScheduleId = db.nextScheduleId || 1;
  db.settings.plans.forEach(p => {
    if (p.minLevel === undefined) p.minLevel = 1;
    if (p.imageUrl === undefined) p.imageUrl = '';
    if (!p.icon) p.icon = 'trending-up';
  });
  (db.users || []).forEach(u => {
    if (typeof u.invested === 'number') u.invested = { balanced: u.invested };
    if (!u.invested || typeof u.invested !== 'object') u.invested = {};
    u.xp = u.xp || 0;
    u.earnings = u.earnings || 0;
    u.referralEarnings = u.referralEarnings || 0; // lifetime commission from the team
    u.refAccrued = u.refAccrued || 0;             // buffered until the daily activity entry
    u.refLastTx = u.refLastTx || 0;
    u.campaignClaims = u.campaignClaims || 0;
    // true once this player's referrer has been paid the per-invite bonus for them
    u.campaignRewarded = u.campaignRewarded || false;
    u.transactions = u.transactions || [];
    u.achievements = u.achievements || [];
    u.history = u.history || [];
    u.streak = u.streak || { count: 0, lastClaim: null };
    // Payout used to be { method, details }. Split it into named fields.
    u.payout = u.payout || {};
    if (u.payout.details !== undefined) {
      const old = u.payout.details || '';
      u.payout = {
        method: u.payout.method || 'paypal',
        name: '',
        paypal: u.payout.method === 'paypal' ? old : '',
        rib: u.payout.method === 'bank' ? old : ''
      };
    }
    u.payout.method = u.payout.method === 'bank' ? 'bank' : 'paypal';
    if (u.payout.name === undefined) u.payout.name = '';
    if (u.payout.paypal === undefined) u.payout.paypal = '';
    if (u.payout.rib === undefined) u.payout.rib = '';
    if (u.avatar === undefined) u.avatar = '';
    if (u.onboarded === undefined) u.onboarded = false;
    if (u.reset === undefined) u.reset = null;
    if (!u.referralCode) u.referralCode = refCode(u.id);
    if (u.referredBy === undefined) u.referredBy = null;
    // Email preferences: a per-user token for one-click unsubscribe links, and an
    // opt-out flag honoured by admin broadcasts (account/security mails still send).
    if (!u.emailToken) u.emailToken = crypto.randomBytes(16).toString('hex');
    if (u.emailOptOut === undefined) u.emailOptOut = false;
    // Preferred language (for the UI on their next visit and for their emails).
    if (u.lang === undefined) u.lang = null;
  });
  return db;
}

function readFromDisk() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = migrate(JSON.parse(JSON.stringify(DEFAULTS)));
    writeAtomic(fresh);
    return fresh;
  }
  try {
    return migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) {
    // db.json unreadable — fall back to the newest backup rather than losing everything.
    console.error('db.json is corrupt:', e.message);
    const backups = listBackups();
    for (const b of backups) {
      try {
        const data = migrate(JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, b), 'utf8')));
        console.warn('Recovered from backup:', b);
        return data;
      } catch (_) { /* try the next one */ }
    }
    console.warn('No usable backup found — starting fresh.');
    return migrate(JSON.parse(JSON.stringify(DEFAULTS)));
  }
}

function listBackups() {
  ensureDirs();
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse();
}

// Write to a temp file then rename — rename is atomic, so db.json is never half-written.
function writeAtomic(db) {
  ensureDirs();
  const tmp = DB_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function maybeBackup(db, force) {
  const now = Date.now();
  if (!force && now - lastBackup < BACKUP_EVERY_MS) return;
  lastBackup = now;
  try {
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(BACKUP_DIR, `db-${stamp}.json`), JSON.stringify(db));
    const extra = listBackups().slice(KEEP_BACKUPS);
    extra.forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (_) {} });
  } catch (e) {
    console.error('Backup failed:', e.message);
  }
}

function load() {
  if (!cache) {
    cache = readFromDisk();
    maybeBackup(cache, true); // snapshot on startup
  }
  return cache;
}

function save(db) {
  cache = db || cache;
  writeAtomic(cache);
  maybeBackup(cache, false);
}

// Replace the entire database (restore from a backup file).
// Snapshots the current data first, then swaps the in-memory instance so the very
// next request sees the restored data.
function replaceAll(newData) {
  if (cache) maybeBackup(cache, true); // force a snapshot of what we're about to drop
  cache = migrate(newData);
  writeAtomic(cache);
  return cache;
}

// Wipe the game back to a clean slate.
//  keepUsers  – user ids to preserve (used to keep the admin logged in)
//  keepSettings – keep apps/limits/payment info, only clear players and activity
// Always snapshots first, so a wipe is recoverable from data/backups.
function wipe({ keepUsers = [], keepSettings = true } = {}) {
  if (cache) maybeBackup(cache, true);
  const fresh = migrate(JSON.parse(JSON.stringify(DEFAULTS)));
  if (keepSettings && cache) fresh.settings = cache.settings;

  if (cache && keepUsers.length) {
    for (const id of keepUsers) {
      const u = cache.users.find(x => x.id === id);
      if (!u) continue;
      // keep who they are; drop everything they did
      fresh.users.push(Object.assign({}, u, {
        invested: {}, earnings: 0, xp: 0,
        transactions: [], achievements: [], history: [],
        streak: { count: 0, lastClaim: null },
        referralEarnings: 0, refAccrued: 0, refLastTx: 0,
        campaignClaims: 0, campaignRewarded: false,
        referredBy: null, lastAccrual: Date.now()
      }));
    }
    // don't reuse ids of deleted players
    fresh.nextUserId = Math.max(cache.nextUserId || 1, ...fresh.users.map(u => u.id + 1));
  }

  cache = migrate(fresh);
  writeAtomic(cache);
  return cache;
}

module.exports = { load, save, refCode, listBackups, replaceAll, wipe };
