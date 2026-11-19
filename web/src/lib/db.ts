// JSON file store with a single shared in-memory instance, atomic writes and
// rotating backups — a straight port of the Express app's db.js. Same file, same
// migrate(), so both versions can run on the same data/db.json.
//
// The instance lives on globalThis: Next.js may load this module more than once
// (pages and route handlers are bundled separately), and two caches would let one
// overwrite the other's changes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db, User } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- migrate() repairs untyped legacy JSON */
type Loose = any;

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "data"));
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BACKUP_EVERY_MS = 1000 * 60 * 60; // at most one backup per hour
const KEEP_BACKUPS = 12;

const DEFAULTS: Loose = {
  users: [],
  withdrawals: [],
  deposits: [],
  transfers: [],
  audit: [],
  schedules: [],
  tickets: [],
  settings: {
    siteName: "KanzUp",
    logoUrl: "",
    brandMode: "text",
    emailLogoUrl: "",
    currency: "DH",
    announcement: { text: "", enabled: false },
    telegram: { enabled: false, botToken: "", chatId: "" },
    plans: [
      { id: "safe", name: "SafeSave", icon: "shield", imageUrl: "", ratePer15Days: 0.05, color: "success", desc: "Low but steady growth.", minLevel: 1 },
      { id: "balanced", name: "BalanceApp", icon: "scale", imageUrl: "", ratePer15Days: 0.10, color: "primary", desc: "The classic — solid returns.", minLevel: 1 },
      { id: "risky", name: "HighRoller", icon: "rocket", imageUrl: "", ratePer15Days: 0.20, color: "danger", desc: "Big risk, big reward.", minLevel: 3 },
    ],
    minAddFunds: 100,
    minWithdraw: 100,
    minTransfer: 10,
    withdrawEveryDays: 15,
    leaderboardEnabled: true,
    dailyBonusEnabled: true,
    homeStats: {
      enabled: true,
      start: 0,
      users: { base: 0, min: 70, spread: 80 },
      payouts: { base: 0, min: 70, spread: 80 },
      coins: { base: 0, min: 200, spread: 800 },
    },
    depositLockDays: 30,
    referralTiers: [0.02, 0.01, 0.005],
    campaign: {
      enabled: false,
      title: "",
      inviteGoal: 3,
      minDeposit: 1000,
      requireActive: true,
      coinsPerInvite: 100,
      xpPerInvite: 25,
      rewardCoins: 500,
      rewardXp: 100,
      maxClaims: 1,
      countFrom: 0,
    },
    dailyBonusBase: 50,
    depositInfo: {
      bankName: "Demo Bank (play money)",
      accountName: "Game Master",
      rib: "000 780 0000000000000000 42",
      note: "Demo only — never send real money. This is a game.",
    },
  },
  nextUserId: 1,
  nextWithdrawId: 1,
  nextDepositId: 1,
  nextTransferId: 1,
  nextAppId: 1,
  nextAuditId: 1,
  nextTicketId: 1,
};

interface StoreState { cache: Db | null; lastBackup: number }
const g = globalThis as typeof globalThis & { __kanzupStore?: StoreState };
const store: StoreState = (g.__kanzupStore ??= { cache: null, lastBackup: 0 });

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Old sequential code (derived from the id) — kept only to detect and upgrade
// existing codes to random ones during migration.
export function refCode(id: number): string {
  return "R" + id.toString(36).toUpperCase().padStart(4, "0");
}

// Random, unguessable referral code. Excludes easily-confused chars (0/O/1/I).
export function randomRefCode(db?: { users?: User[] } | null): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const taken = new Set(((db && db.users) || []).map((u) => u.referralCode).filter(Boolean));
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (taken.has(code));
  return code;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function migrate(db: Loose): Db {
  db.settings = Object.assign({}, DEFAULTS.settings, db.settings || {});
  if (db.settings.logoUrl === undefined) db.settings.logoUrl = "";
  if (db.settings.emailLogoUrl === undefined) db.settings.emailLogoUrl = "";
  if (!["text", "logo"].includes(db.settings.brandMode)) db.settings.brandMode = "text";
  if (db.settings.depositLockDays === undefined) db.settings.depositLockDays = 30;
  db.settings.depositInfo = Object.assign({}, DEFAULTS.settings.depositInfo, db.settings.depositInfo || {});
  db.settings.announcement = Object.assign({}, DEFAULTS.settings.announcement, db.settings.announcement || {});
  db.settings.telegram = Object.assign({}, DEFAULTS.settings.telegram, db.settings.telegram || {});
  (db.settings.plans || []).forEach((p: Loose) => { if (p.published === undefined) p.published = true; });
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
  db.tickets = db.tickets || [];
  db.nextTicketId = db.nextTicketId || 1;
  db.nextDepositId = db.nextDepositId || 1;
  db.transfers = db.transfers || [];
  db.nextTransferId = db.nextTransferId || 1;
  db.nextAppId = db.nextAppId || 1;
  db.nextAuditId = db.nextAuditId || 1;
  db.nextScheduleId = db.nextScheduleId || 1;
  if (db.settings.leaderboardEnabled === undefined) db.settings.leaderboardEnabled = true;
  if (db.settings.dailyBonusEnabled === undefined) db.settings.dailyBonusEnabled = true;
  {
    const hs = db.settings.homeStats && typeof db.settings.homeStats === "object" ? db.settings.homeStats : {};
    const dim = (d: Loose, def: Loose) => ({
      base: Math.max(0, Math.floor(Number(d && d.base) || def.base)),
      min: Math.max(0, Math.floor(Number(d && d.min) || def.min)),
      spread: Math.max(0, Math.floor(Number(d && d.spread) || def.spread)),
    });
    db.settings.homeStats = {
      enabled: hs.enabled !== false,
      start: hs.start || Date.now(),
      users: dim(hs.users, { base: 0, min: 70, spread: 80 }),
      payouts: dim(hs.payouts, { base: 0, min: 70, spread: 80 }),
      coins: dim(hs.coins, { base: 0, min: 200, spread: 800 }),
    };
  }
  db.settings.plans.forEach((p: Loose) => {
    if (p.minLevel === undefined) p.minLevel = 1;
    if (p.imageUrl === undefined) p.imageUrl = "";
    if (p.link === undefined) p.link = "";
    if (p.fixedAmount === undefined) p.fixedAmount = 0;
    if (!p.icon) p.icon = "trending-up";
  });
  (db.users || []).forEach((u: Loose) => migrateUser(db, u));
  return db as Db;
}

function migrateUser(db: Loose, u: Loose): void {
  if (typeof u.invested === "number") u.invested = { balanced: u.invested };
  if (!u.invested || typeof u.invested !== "object") u.invested = {};
  u.xp = u.xp || 0;
  u.earnings = u.earnings || 0;
  u.referralEarnings = u.referralEarnings || 0;
  u.refAccrued = u.refAccrued || 0;
  u.refLastTx = u.refLastTx || 0;
  u.campaignClaims = u.campaignClaims || 0;
  u.campaignRewarded = u.campaignRewarded || false;
  u.transactions = u.transactions || [];
  u.achievements = u.achievements || [];
  u.history = u.history || [];
  // Older snapshots only stored `total`: rebuild the invested/earnings/referral split.
  if (u.history.length) {
    const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
    const curInv = Object.values(u.invested || {}).reduce((a: number, b: Loose) => a + (b || 0), 0) as number;
    const curEarn = u.earnings || 0;
    const curRef = u.referralEarnings || 0;
    u.history.forEach((h: Loose) => {
      if (h && h.invested === undefined) {
        const earn = Math.min(curEarn, Math.max(0, (h.total || 0) - curInv));
        const ref = curEarn > 0 ? curRef * (earn / curEarn) : 0;
        h.invested = r2(curInv);
        h.earnings = r2(earn);
        h.referral = r2(Math.min(earn, curRef, ref));
      }
    });
  }
  u.streak = u.streak || { count: 0, lastClaim: null };
  u.payout = u.payout || {};
  if (u.payout.details !== undefined) {
    const old = u.payout.details || "";
    u.payout = {
      method: u.payout.method || "paypal",
      name: "",
      paypal: u.payout.method === "paypal" ? old : "",
      rib: u.payout.method === "bank" ? old : "",
    };
  }
  u.payout.method = u.payout.method === "bank" ? "bank" : "paypal";
  if (u.payout.name === undefined) u.payout.name = "";
  if (u.payout.paypal === undefined) u.payout.paypal = "";
  if (u.payout.rib === undefined) u.payout.rib = "";
  if (u.avatar === undefined) u.avatar = "";
  if (u.onboarded === undefined) u.onboarded = false;
  if (u.reset === undefined) u.reset = null;
  if (!u.referralCode || u.referralCode === refCode(u.id)) u.referralCode = randomRefCode(db);
  if (u.referredBy === undefined) u.referredBy = null;
  if (!u.emailToken) u.emailToken = crypto.randomBytes(16).toString("hex");
  if (u.emailOptOut === undefined) u.emailOptOut = false;
  if (u.emailVerified === undefined) u.emailVerified = true;
  if (u.verifyToken === undefined) u.verifyToken = null;
  if (u.lastLogin === undefined) u.lastLogin = null;
  if (u.lastSeen === undefined) u.lastSeen = null;
  if (!Array.isArray(u.logins)) u.logins = [];
  if (u.lang === undefined) u.lang = null;
  if (u.isTest === undefined) u.isTest = false;
  if (u.gsDismissed === undefined) u.gsDismissed = false;
  if (u.role === undefined) u.role = u.isAdmin ? "owner" : null;
  if (!Array.isArray(u.notices)) u.notices = [];
  if (!u.kyc || typeof u.kyc !== "object") u.kyc = {};
  if (!u.kyc.status) u.kyc.status = "none";
  ["fullName", "dob", "address", "cinFront", "cinBack", "reviewNote"].forEach((k) => { if (u.kyc[k] === undefined) u.kyc[k] = ""; });
  ["requestedAt", "submittedAt", "reviewedAt"].forEach((k) => { if (u.kyc[k] === undefined) u.kyc[k] = 0; });
}

function readFromDisk(): Db {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = migrate(clone(DEFAULTS));
    writeAtomic(fresh);
    return fresh;
  }
  try {
    return migrate(JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
  } catch (e) {
    // db.json unreadable — fall back to the newest backup rather than losing everything.
    console.error("db.json is corrupt:", (e as Error).message);
    for (const b of listBackups()) {
      try {
        const data = migrate(JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, b), "utf8")));
        console.warn("Recovered from backup:", b);
        return data;
      } catch { /* try the next one */ }
    }
    console.warn("No usable backup found — starting fresh.");
    return migrate(clone(DEFAULTS));
  }
}

export function listBackups(): string[] {
  ensureDirs();
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
}

// Write to a temp file then rename — rename is atomic, so db.json is never half-written.
function writeAtomic(db: Db): void {
  ensureDirs();
  const tmp = DB_FILE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function maybeBackup(db: Db, force: boolean): void {
  const now = Date.now();
  if (!force && now - store.lastBackup < BACKUP_EVERY_MS) return;
  store.lastBackup = now;
  try {
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(BACKUP_DIR, `db-${stamp}.json`), JSON.stringify(db));
    listBackups().slice(KEEP_BACKUPS).forEach((f) => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* already gone */ } });
  } catch (e) {
    console.error("Backup failed:", (e as Error).message);
  }
}

export function load(): Db {
  if (!store.cache) {
    store.cache = readFromDisk();
    maybeBackup(store.cache, true); // snapshot on startup
  }
  return store.cache;
}

export function save(db?: Db): void {
  store.cache = db || store.cache;
  if (!store.cache) return;
  writeAtomic(store.cache);
  maybeBackup(store.cache, false);
}

// Replace the entire database (restore from a backup file). Snapshots the current
// data first, then swaps the in-memory instance.
export function replaceAll(newData: unknown): Db {
  if (store.cache) maybeBackup(store.cache, true);
  store.cache = migrate(newData);
  writeAtomic(store.cache);
  return store.cache;
}

// Wipe the game back to a clean slate (snapshots first, so it is recoverable).
export function wipe({ keepUsers = [] as number[], keepSettings = true } = {}): Db {
  const cache = store.cache;
  if (cache) maybeBackup(cache, true);
  const fresh: Loose = migrate(clone(DEFAULTS));
  if (keepSettings && cache) fresh.settings = cache.settings;

  if (cache && keepUsers.length) {
    for (const id of keepUsers) {
      const u = cache.users.find((x) => x.id === id);
      if (!u) continue;
      fresh.users.push(Object.assign({}, u, {
        invested: {}, earnings: 0, xp: 0,
        transactions: [], achievements: [], history: [],
        streak: { count: 0, lastClaim: null },
        referralEarnings: 0, refAccrued: 0, refLastTx: 0,
        campaignClaims: 0, campaignRewarded: false,
        referredBy: null, lastAccrual: Date.now(),
      }));
    }
    fresh.nextUserId = Math.max(cache.nextUserId || 1, ...fresh.users.map((u: User) => u.id + 1));
  }

  store.cache = migrate(fresh);
  writeAtomic(store.cache);
  return store.cache;
}

/** Tests only: forget the in-memory instance so the next load() reads the disk again. */
export function resetCacheForTests(): void {
  store.cache = null;
  store.lastBackup = 0;
}
