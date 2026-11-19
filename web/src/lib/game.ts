// Game economy rules, ported line for line from the Express app's server.js.
// These mutate the shared db object in place, as the original does; callers save().
import crypto from "node:crypto";
import { DAY } from "./config";
import { ACHIEVEMENTS } from "./constants";
import { randomRefCode } from "./db";
import { notifyLevelUp } from "./notify";
import type { Db, Deposit, Plan, User } from "./types";

export { planColor } from "./plan-color";

export function totalInvested(user: User): number {
  return Object.values(user.invested || {}).reduce((a, b) => a + (b || 0), 0);
}


export function totalBalance(user: User): number {
  return totalInvested(user) + (user.earnings || 0);
}

// The daily bonus only unlocks once a player has at least one approved deposit.
export function hasApprovedDeposit(db: Db, user: User): boolean {
  return db.deposits.some((d) => d.userId === user.id && d.status === "approved");
}

// Test accounts are kept out of live stats, totals and the leaderboard.
export function isRealUser(u: User): boolean { return !u.isTest; }

export function isTestActivity(db: Db, row: { userId: number }): boolean {
  const u = db.users.find((x) => x.id === row.userId);
  return !!(u && u.isTest);
}

export function accrue(user: User, db: Db): void {
  const now = Date.now();
  const last = user.lastAccrual || now;
  const days = (now - last) / DAY;
  if (days > 0) {
    let gain = 0;
    for (const p of db.settings.plans) {
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

// Pay the upline a cut of what this player just earned (3 tiers, from earnings only,
// so commission never pays commission).
export function payReferrals(db: Db, earner: User, gain: number): void {
  if (!(gain > 0)) return;
  const tiers = db.settings.referralTiers || [];
  let current = earner;
  const seen = new Set([earner.id]);
  for (let i = 0; i < tiers.length; i++) {
    if (!current.referredBy || seen.has(current.referredBy)) break;
    const up = db.users.find((u) => u.id === current.referredBy);
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

const approvedTotal = (db: Db, userId: number) =>
  db.deposits.filter((d) => d.userId === userId && d.status === "approved").reduce((sum, d) => sum + d.amount, 0);

// ---------- Invite challenge ----------
export function campaignStatus(db: Db, user: User) {
  const c = db.settings.campaign;
  const claims = user.campaignClaims || 0;
  const goal = Math.max(1, c.inviteGoal || 1);
  const invitees = db.users.filter((x) => x.referredBy === user.id && x.createdAt >= (c.countFrom || 0));
  const qualified = invitees.filter((x) => {
    if (c.requireActive && x.status !== "active") return false;
    return approvedTotal(db, x.id) >= (c.minDeposit || 0);
  });
  const required = goal * (claims + 1);
  const maxed = (c.maxClaims || 0) > 0 && claims >= c.maxClaims;
  return {
    enabled: !!c.enabled,
    title: c.title || "",
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
    maxClaims: c.maxClaims || 0,
  };
}
export type CampaignStatus = ReturnType<typeof campaignStatus>;

// Pay the referrer once, the moment one of their invites first qualifies.
export function maybePayInvite(db: Db, invitee: User): void {
  const c = db.settings.campaign;
  if (!c.enabled || invitee.campaignRewarded) return;
  if (invitee.createdAt < (c.countFrom || 0)) return;
  if (c.requireActive && invitee.status !== "active") return;
  if (approvedTotal(db, invitee.id) < (c.minDeposit || 0)) return;
  const ref = invitee.referredBy ? db.users.find((u) => u.id === invitee.referredBy) : null;
  if (!ref) return;
  invitee.campaignRewarded = true; // mark first — never pay twice
  const coins = c.coinsPerInvite || 0;
  const xp = c.xpPerInvite || 0;
  if (coins <= 0 && xp <= 0) return;
  accrue(ref, db);
  ref.earnings += coins;
  addXp(ref, xp);
  addTx(ref, "campaign_invite", coins, invitee.name + (xp ? " (+" + xp + " XP)" : ""));
  checkState(ref);
}

// Commission trickles in every second; roll it into one activity entry per day.
export function flushReferralTx(user: User): void {
  const now = Date.now();
  if (!user.refAccrued || user.refAccrued < 0.01) return;
  if (user.refLastTx && now - user.refLastTx < DAY) return;
  addTx(user, "referral_bonus", user.refAccrued, "Team earnings");
  user.refAccrued = 0;
  user.refLastTx = now;
}

export function earningPerSecond(user: User, settings: Db["settings"]): number {
  let s = 0;
  for (const p of settings.plans) {
    const amt = (user.invested && user.invested[p.id]) || 0;
    s += amt * (p.ratePer15Days / 15) / 86400;
  }
  return s;
}

// ---------- Deposit lock ----------
export function depositLockDays(db: Db): number { return Math.max(0, Number(db.settings.depositLockDays) || 0); }
export function maturedAt(d: Deposit): number { return d.approvedAt || d.createdAt || 0; }

export function lockedInApp(db: Db, user: User, planId: string): number {
  const days = depositLockDays(db);
  if (days <= 0) return 0;
  const cutoff = Date.now() - days * DAY;
  let locked = 0;
  for (const d of db.deposits) {
    if (d.userId !== user.id || d.plan !== planId || d.status !== "approved") continue;
    if (maturedAt(d) > cutoff) locked += d.amount;
  }
  return Math.min(locked, (user.invested && user.invested[planId]) || 0);
}

export function withdrawableInApp(db: Db, user: User, planId: string): number {
  return Math.max(0, ((user.invested && user.invested[planId]) || 0) - lockedInApp(db, user, planId));
}

export function appFunds(db: Db, user: User, planId: string) {
  const held = (user.invested && user.invested[planId]) || 0;
  const locked = lockedInApp(db, user, planId);
  let unlockAt = 0;
  if (locked > 0) {
    const days = depositLockDays(db);
    const cutoff = Date.now() - days * DAY;
    for (const d of db.deposits) {
      if (d.userId !== user.id || d.plan !== planId || d.status !== "approved") continue;
      const m = maturedAt(d);
      if (m > cutoff) { const u = m + days * DAY; if (!unlockAt || u < unlockAt) unlockAt = u; }
    }
  }
  return { held, locked, available: Math.max(0, held - locked), unlockAt };
}

export function addTx(user: User, type: string, amount: number, note?: string, at?: number): void {
  user.transactions = user.transactions || [];
  user.transactions.push({ type, amount, note: note || "", at: at || Date.now() });
  user.transactions.sort((a, b) => a.at - b.at); // chronological even when backdated
  if (user.transactions.length > 120) user.transactions = user.transactions.slice(-120);
}

// The one place a deposit is created + (optionally) credited.
export function creditDeposit(db: Db, u: User, plan: Plan, amount: number,
  opts: { status?: string; when?: number; note?: string; receipt?: string } = {}): void {
  const status = opts.status === "pending" ? "pending" : "approved";
  const when = opts.when || Date.now();
  const note = opts.note || "";
  db.deposits.push({
    id: db.nextDepositId++, userId: u.id, userName: u.name,
    plan: plan.id, planLabel: plan.name, amount, status, note,
    receipt: opts.receipt || "", byAdmin: true, createdAt: when,
    approvedAt: status === "approved" ? when : null,
  });
  if (status === "approved") {
    accrue(u, db);
    u.invested[plan.id] = (u.invested[plan.id] || 0) + amount;
    addXp(u, Math.min(200, 10 + Math.floor(amount / 500)));
    addTx(u, "deposit", amount, plan.name + (note ? " · " + note : ""), when);
    award(u, "first_deposit");
    maybePayInvite(db, u);
    checkState(u);
  } else {
    addTx(u, "deposit_request", amount, plan.name, when);
  }
}

// A date (YYYY-MM-DD → noon) or datetime-local value → timestamp; never in the future.
export function parseWhen(v: string | null | undefined): number {
  if (!v) return Date.now();
  const ts = new Date(v.includes("T") ? v : v + "T12:00:00").getTime();
  if (!Number.isFinite(ts)) return Date.now();
  return Math.min(ts, Date.now());
}

// A datetime-local value → timestamp in the future (for scheduling); 0 when invalid/past.
export function parseWhenTime(v: string | null | undefined): number {
  if (!v) return 0;
  const ts = new Date(v).getTime();
  if (!Number.isFinite(ts) || ts <= Date.now()) return 0;
  return ts;
}

// ---------- Levels & XP ----------
export function levelForXp(xp: number): number { return Math.floor(Math.sqrt((xp || 0) / 50)) + 1; }
export function xpForLevel(l: number): number { return 50 * (l - 1) * (l - 1); }

export function levelData(u: User) {
  const lvl = levelForXp(u.xp);
  return { level: lvl, xp: u.xp || 0, xpCur: xpForLevel(lvl), xpNext: xpForLevel(lvl + 1) };
}

// Returns the new level if the user levelled up, otherwise 0.
export function addXp(user: User, n: number): number {
  const before = levelForXp(user.xp);
  user.xp = (user.xp || 0) + n;
  const after = levelForXp(user.xp);
  if (after > before) { notifyLevelUp(user, after); return after; }
  return 0;
}

// Snapshot the player's totals once an hour for the balance chart (~30 days kept).
export function recordHistory(user: User): void {
  user.history = user.history || [];
  const last = user.history[user.history.length - 1];
  const now = Date.now();
  if (!last || now - (last.t || 0) >= 60 * 60 * 1000) {
    const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
    user.history.push({
      t: now,
      total: r2(totalBalance(user)),
      invested: r2(totalInvested(user)),
      earnings: r2(user.earnings),
      referral: r2(user.referralEarnings),
    });
    if (user.history.length > 720) user.history = user.history.slice(-720);
  }
}

// The ONE place a user record is created (signup, import, admin create).
export function createUser(db: Db, o: {
  name: string; email: string; passwordHash: string; isAdmin?: boolean; status?: User["status"];
  referredBy?: number | null; lang?: string | null; isTest?: boolean; role?: string | null;
}): User {
  const isAdmin = o.isAdmin ?? false;
  const id = db.nextUserId++;
  const user: User = {
    id, name: o.name, email: o.email, passwordHash: o.passwordHash,
    isAdmin, status: o.status ?? "pending", lang: o.lang ?? null, isTest: o.isTest ?? false,
    role: o.role || (isAdmin ? "owner" : null),
    invested: {}, earnings: 0, xp: 0,
    lastAccrual: Date.now(), createdAt: Date.now(),
    transactions: [], achievements: [], history: [],
    streak: { count: 0, lastClaim: null },
    payout: { method: "paypal", name: "", paypal: "", rib: "" },
    referralEarnings: 0, refAccrued: 0, refLastTx: 0,
    campaignClaims: 0, campaignRewarded: false,
    avatar: "", onboarded: false, gsDismissed: false, reset: null,
    referralCode: randomRefCode(db),
    referredBy: o.referredBy ?? null,
    emailToken: crypto.randomBytes(16).toString("hex"),
    emailOptOut: false,
    emailVerified: true,
    verifyToken: null,
    lastLogin: null, lastSeen: null, logins: [], notices: [],
    kyc: { status: "none", fullName: "", dob: "", address: "", cinFront: "", cinBack: "", reviewNote: "", requestedAt: 0, submittedAt: 0, reviewedAt: 0 },
  };
  db.users.push(user);
  return user;
}

export function logAudit(db: Db, admin: { id?: number; name: string } | null, action: string, details?: string): void {
  db.audit.push({
    id: db.nextAuditId++, at: Date.now(),
    adminId: admin && admin.id !== undefined ? admin.id : null,
    adminName: admin ? admin.name : "system",
    action, details: details || "",
  });
  if (db.audit.length > 500) db.audit = db.audit.slice(-500);
}

export function award(user: User, id: string): boolean {
  user.achievements = user.achievements || [];
  if (!user.achievements.includes(id)) {
    user.achievements.push(id);
    addTx(user, "achievement", 0, ACHIEVEMENTS[id].name);
    addXp(user, 25);
    return true;
  }
  return false;
}

export function checkState(user: User): void {
  const bal = totalBalance(user);
  if (bal >= 10000) award(user, "saver_10k");
  if (bal >= 100000) award(user, "saver_100k");
  if (bal >= 1000000) award(user, "millionaire");
  if (user.streak && user.streak.count >= 7) award(user, "streak_7");
}

// Deterministic daily growth for the landing numbers: each day since `start` adds a
// seeded increment in [min, min+spread]; `salt` keeps the metrics apart.
export function dailyGrowth(cfg: { base?: number; min?: number; spread?: number } | null | undefined, start: number, salt: number): number {
  if (!cfg) return 0;
  const days = Math.min(3650, Math.max(0, Math.floor((Date.now() - (start || 0)) / DAY)));
  const min = cfg.min || 0, spread = cfg.spread || 0;
  let total = cfg.base || 0;
  for (let d = 1; d <= days; d++) {
    const x = Math.sin((d + salt * 7919) * 2.399963) * 43758.5453;
    total += min + Math.floor((x - Math.floor(x)) * (spread + 1));
  }
  return total;
}

// Landing/ad-page stats, with the daily growth added to users, coins and payouts.
// Hidden until there are at least 3 active players.
export function landingStats(db: Db) {
  const players = db.users.filter((u) => u.status === "active" && !u.isAdmin);
  if (players.length < 3) return null;
  const hs = db.settings.homeStats;
  const grow = hs.enabled !== false;
  return {
    players: players.length + (grow ? dailyGrowth(hs.users, hs.start, 1) : 0),
    coins: players.reduce((s, u) => s + totalBalance(u), 0) + (grow ? dailyGrowth(hs.coins, hs.start, 3) : 0),
    apps: db.settings.plans.length,
    payouts: db.withdrawals.filter((w) => w.status === "paid").length + (grow ? dailyGrowth(hs.payouts, hs.start, 2) : 0),
  };
}
export type LandingStats = ReturnType<typeof landingStats>;
