import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { legacy } from "../../tests/legacy";
import * as game from "./game";
import { translateNote } from "./text";
import type { Db, User } from "./types";

vi.mock("./notify", () => ({ notifyLevelUp: () => {} }));

const DAY = 86400000;

function makeDb(): Db {
  const now = Date.now();
  const user = (id: number, referredBy: number | null, invested: Record<string, number>): Partial<User> => ({
    id, name: "P" + id, referredBy, invested, earnings: 10, referralEarnings: 0, refAccrued: 0,
    lastAccrual: now - 3.5 * DAY, status: "active", createdAt: now - 40 * DAY, campaignClaims: 0,
  });
  return {
    users: [user(1, null, { safe: 1000 }), user(2, 1, { balanced: 5000 }), user(3, 2, { safe: 200, risky: 3000 }), user(4, 3, { risky: 10000 })],
    deposits: [
      { id: 1, userId: 4, plan: "risky", planLabel: "HighRoller", amount: 6000, status: "approved", createdAt: now - 40 * DAY, approvedAt: now - 10 * DAY },
      { id: 2, userId: 4, plan: "risky", planLabel: "HighRoller", amount: 4000, status: "approved", createdAt: now - 50 * DAY },
      { id: 3, userId: 3, plan: "safe", planLabel: "SafeSave", amount: 1500, status: "approved", createdAt: now - 5 * DAY },
    ],
    withdrawals: [], transfers: [], audit: [], schedules: [], tickets: [],
    settings: {
      plans: [
        { id: "safe", ratePer15Days: 0.05 }, { id: "balanced", ratePer15Days: 0.1 }, { id: "risky", ratePer15Days: 0.2, fixedAmount: 0 },
      ],
      referralTiers: [0.02, 0.01, 0.005], depositLockDays: 30,
      campaign: { enabled: true, inviteGoal: 1, minDeposit: 1000, requireActive: true, countFrom: 0, maxClaims: 2 },
      homeStats: { enabled: true, start: now - 90 * DAY, users: { base: 5, min: 70, spread: 80 }, payouts: { base: 0, min: 70, spread: 80 }, coins: { base: 0, min: 200, spread: 800 } },
    },
  } as unknown as Db;
}

const strip = (db: Db) => db.users.map((u) => [u.earnings, u.referralEarnings, u.refAccrued]);

describe("economy matches the Express app", () => {
  // One frozen clock for both versions; the originals are loaded after it is frozen
  // so their Date.now() is the same fake one.
  let old: Record<string, (...a: never[]) => unknown>;
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date("2026-11-19T12:00:00Z") });
    old = legacy(["accrue", "payReferrals", "lockedInApp", "depositLockDays", "maturedAt", "dailyGrowth", "levelForXp", "xpForLevel", "campaignStatus", "planColor"],
      { Date: globalThis.Date });
  });
  afterAll(() => vi.useRealTimers());

  it("accrues earnings and pays three referral tiers identically", () => {
    const a = makeDb(), b = makeDb();
    for (const u of a.users) game.accrue(u, a);
    for (const u of b.users) (old.accrue as (u: User, db: Db) => void)(u, b);
    expect(strip(a)).toEqual(strip(b));
    expect(a.users[0].referralEarnings).toBeGreaterThan(0);
  });

  it("computes the deposit lock identically", () => {
    const db = makeDb();
    for (const [u, plan] of [[3, "risky"], [3, "safe"], [2, "balanced"]] as const) {
      const user = db.users.find((x) => x.id === u) as User;
      expect(game.lockedInApp(db, user, plan)).toBe((old.lockedInApp as (d: Db, u: User, p: string) => number)(db, user, plan));
    }
    const p4 = db.users[3];
    expect(game.lockedInApp(db, p4, "risky")).toBe(6000);
  });

  it("grows the landing numbers by the same seeded amounts", () => {
    const db = makeDb();
    const hs = db.settings.homeStats;
    for (const [dim, salt] of [[hs.users, 1], [hs.payouts, 2], [hs.coins, 3]] as const) {
      expect(game.dailyGrowth(dim, hs.start, salt)).toBe((old.dailyGrowth as (c: unknown, s: number, n: number) => number)(dim, hs.start, salt));
    }
  });

  it("levels, campaign status and plan colours agree", () => {
    for (const xp of [0, 49, 50, 199, 200, 12345]) expect(game.levelForXp(xp)).toBe((old.levelForXp as (n: number) => number)(xp));
    const db = makeDb();
    for (const u of db.users) expect(game.campaignStatus(db, u)).toEqual((old.campaignStatus as (d: Db, u: User) => unknown)(db, u));
    for (const p of db.settings.plans) expect(game.planColor(p)).toBe((old.planColor as (p: unknown) => string)(p));
  });
});

describe("translateNote matches the Express app", () => {
  const tr = (k: string, v?: Record<string, string | number>) => k + (v ? JSON.stringify(v) : "");
  const old = legacy<{ translateNote: (t: typeof tr, tx: unknown) => string }>(["translateNote"]);
  it.each([
    { type: "achievement", note: "First Deposit" }, { type: "transfer_in", note: "From Ali" },
    { type: "transfer_out", note: "To Earnings" }, { type: "withdraw_rejected", note: "Refunded to SafeSave · reason here" },
    { type: "referral_bonus", note: "Team earnings" }, { type: "deposit", note: "Something custom" }, { type: "x", note: "" },
  ])("$type / $note", (tx) => {
    expect(translateNote(tr, tx as never)).toBe(old.translateNote(tr, tx));
  });
});
