// A made-up database for comparing the Express and Next versions page by page.
// Nothing here is real data. Everyone's password is "test1234".
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const DAY = 86400000;
export const PASSWORD = "test1234";
export const ADMIN_EMAIL = "owner@kanzup.test";

export function buildFixture(now = Date.now()) {
  const hash = bcrypt.hashSync(PASSWORD, 4);
  const plans = [
    { id: "safe", name: "SafeSave", icon: "shield", imageUrl: "", ratePer15Days: 0.05, color: "success", desc: "Low but steady growth.", minLevel: 1, link: "", fixedAmount: 0, published: true },
    { id: "balanced", name: "BalanceApp", icon: "scale", imageUrl: "", ratePer15Days: 0.10, color: "primary", desc: "The classic — solid returns.", minLevel: 1, link: "", fixedAmount: 0, published: true },
    { id: "risky", name: "HighRoller", icon: "rocket", imageUrl: "", ratePer15Days: 0.35, color: "danger", desc: "Big risk, big reward.", minLevel: 3, link: "https://example.test", fixedAmount: 0, published: true },
    { id: "app1", name: "GoldBox", icon: "box", imageUrl: "", ratePer15Days: 0.25, color: "warning", desc: "Fixed ticket.", minLevel: 1, link: "", fixedAmount: 5000, published: true },
    { id: "app2", name: "HiddenOne", icon: "eye-off", imageUrl: "", ratePer15Days: 0.4, color: "info", desc: "Not published yet.", minLevel: 1, link: "", fixedAmount: 0, published: false },
  ];
  const tx = (type, amount, note, daysAgo) => ({ type, amount, note, at: now - daysAgo * DAY });
  const user = (id, name, extra) => ({
    id, name, email: name.toLowerCase().replace(/\s+/g, ".") + "@kanzup.test", passwordHash: hash,
    isAdmin: false, role: null, status: "active", lang: null, isTest: false,
    invested: {}, earnings: 0, xp: 0, lastAccrual: now, createdAt: now - 60 * DAY,
    transactions: [], achievements: [], history: [], streak: { count: 0, lastClaim: null },
    payout: { method: "paypal", name: "", paypal: "", rib: "" },
    referralEarnings: 0, refAccrued: 0, refLastTx: 0, campaignClaims: 0, campaignRewarded: false,
    avatar: "", onboarded: true, gsDismissed: false, reset: null,
    referralCode: "REF" + String(id).padStart(4, "0"), referredBy: null,
    emailToken: "tok" + id, emailOptOut: false, emailVerified: true, verifyToken: null,
    lastLogin: now - DAY, lastSeen: now - 2 * DAY, logins: [{ at: now - DAY, ip: "10.0.0." + id }],
    notices: [], kyc: { status: "none", fullName: "", dob: "", address: "", cinFront: "", cinBack: "", reviewNote: "", requestedAt: 0, submittedAt: 0, reviewedAt: 0 },
    ...extra,
  });
  const history = (base) => Array.from({ length: 48 }, (_, i) => ({ t: now - (48 - i) * 3600000, total: base + i * 3, invested: base, earnings: i * 3, referral: i }));
  const users = [
    user(1, "Owner Admin", { email: ADMIN_EMAIL, isAdmin: true, role: "owner", xp: 0 }),
    user(2, "Sara Test", { invested: { safe: 1000, balanced: 4000 }, earnings: 321.5, xp: 260, referralEarnings: 12.4,
      payout: { method: "bank", name: "Sara Test", paypal: "", rib: "011 780 0000123456789012 34" },
      transactions: [tx("deposit", 1000, "SafeSave", 40), tx("deposit", 4000, "BalanceApp", 20), tx("daily_bonus", 50, "", 3), tx("transfer_in", 100, "From Omar Test", 2), tx("achievement", 0, "First Deposit", 40)],
      achievements: ["first_deposit"], history: history(5000), streak: { count: 3, lastClaim: new Date(now - DAY).toISOString().slice(0, 10) },
      notices: [{ id: 1, text: "Welcome to the test game!", at: now - DAY, read: false }] }),
    user(3, "Omar Test", { referredBy: 2, invested: { risky: 6000 }, earnings: 820, xp: 520, lang: "fr",
      transactions: [tx("deposit", 6000, "HighRoller", 10), tx("transfer_out", 100, "To Sara Test", 2)], history: history(6000),
      kyc: { status: "submitted", fullName: "Omar Test", dob: "1990-01-01", address: "1 Test St", cinFront: "", cinBack: "", reviewNote: "", requestedAt: now - 5 * DAY, submittedAt: now - 4 * DAY, reviewedAt: 0 } }),
    user(4, "Lina Test", { referredBy: 3, invested: { app1: 5000 }, earnings: 90, xp: 60, lang: "en", lastSeen: now - 60000 }),
    user(5, "Youssef Test", { referredBy: 2, invested: { balanced: 2000 }, earnings: 40, xp: 10 }),
    user(6, "Nadia Pending", { status: "pending", emailVerified: true }),
    user(7, "Test Bot", { isTest: true, invested: { safe: 500 } }),
  ];
  const deposits = [
    { id: 1, userId: 2, userName: "Sara Test", plan: "safe", planLabel: "SafeSave", amount: 1000, status: "approved", note: "", receipt: "", byAdmin: false, createdAt: now - 40 * DAY, approvedAt: now - 40 * DAY },
    { id: 2, userId: 2, userName: "Sara Test", plan: "balanced", planLabel: "BalanceApp", amount: 4000, status: "approved", note: "", receipt: "", byAdmin: false, createdAt: now - 20 * DAY, approvedAt: now - 20 * DAY },
    { id: 3, userId: 3, userName: "Omar Test", plan: "risky", planLabel: "HighRoller", amount: 6000, status: "approved", note: "", receipt: "", byAdmin: true, createdAt: now - 10 * DAY, approvedAt: now - 10 * DAY },
    { id: 4, userId: 4, userName: "Lina Test", plan: "app1", planLabel: "GoldBox", amount: 5000, status: "approved", note: "", receipt: "", byAdmin: false, createdAt: now - 50 * DAY, approvedAt: now - 50 * DAY },
    { id: 5, userId: 5, userName: "Youssef Test", plan: "balanced", planLabel: "BalanceApp", amount: 2000, status: "approved", note: "", receipt: "", byAdmin: false, createdAt: now - 35 * DAY, approvedAt: now - 35 * DAY },
    { id: 6, userId: 5, userName: "Youssef Test", plan: "safe", planLabel: "SafeSave", amount: 1500, status: "pending", note: "", receipt: "", byAdmin: false, createdAt: now - 3600000, expiresAt: now + 20 * 3600000 },
    { id: 7, userId: 4, userName: "Lina Test", plan: "safe", planLabel: "SafeSave", amount: 700, status: "cancelled", note: "", receipt: "", byAdmin: false, createdAt: now - 5 * DAY, cancelledAt: now - 4 * DAY },
  ];
  const withdrawals = [
    { id: 1, userId: 2, userName: "Sara Test", amount: 200, from: "earnings", fromLabel: "Earnings", method: "bank", payoutName: "Sara Test", payoutAccount: "011 780 0000123456789012 34", status: "paid", createdAt: now - 15 * DAY },
    { id: 2, userId: 3, userName: "Omar Test", amount: 500, from: "earnings", fromLabel: "Earnings", method: "paypal", payoutName: "Omar Test", payoutAccount: "omar@paypal.test", status: "pending", createdAt: now - DAY },
    { id: 3, userId: 5, userName: "Youssef Test", amount: 150, from: "balanced", fromLabel: "BalanceApp", method: "paypal", payoutName: "Y", payoutAccount: "y@paypal.test", status: "rejected", rejectReason: "clearing", rejectNote: "wait a bit", createdAt: now - 6 * DAY },
  ];
  const transfers = [{ id: 1, fromId: 3, fromName: "Omar Test", toId: 2, toName: "Sara Test", amount: 100, createdAt: now - 2 * DAY }];
  const tickets = [{ id: 1, userId: 2, topic: "deposit", subject: "Where is my deposit?", status: "answered", createdAt: now - 3 * DAY, updatedAt: now - 2 * DAY,
    messages: [{ from: "user", authorName: "Sara Test", text: "Hello, I sent it yesterday.", at: now - 3 * DAY }, { from: "admin", authorName: "Owner Admin", text: "Approved now.", at: now - 2 * DAY }] }];
  return {
    users, deposits, withdrawals, transfers, tickets,
    audit: [{ id: 1, at: now - DAY, adminId: 1, adminName: "Owner Admin", action: "deposit.approve", details: "#3 Omar Test 6000" }],
    schedules: [{ id: 1, userId: 5, plan: "balanced", amount: 100, frequency: "weekly", nextRun: now + 3 * DAY, active: true }],
    settings: {
      siteName: "KanzUp", logoUrl: "", brandMode: "text", emailLogoUrl: "", currency: "DH",
      announcement: { text: "Test announcement for the comparison run.", enabled: true },
      telegram: { enabled: false, botToken: "", chatId: "" },
      plans, minAddFunds: 100, minWithdraw: 100, minTransfer: 10, withdrawEveryDays: 15,
      leaderboardEnabled: true, dailyBonusEnabled: true,
      homeStats: { enabled: true, start: now - 30 * DAY, users: { base: 10, min: 70, spread: 80 }, payouts: { base: 0, min: 70, spread: 80 }, coins: { base: 0, min: 200, spread: 800 } },
      depositLockDays: 30, referralTiers: [0.02, 0.01, 0.005],
      campaign: { enabled: true, title: "", inviteGoal: 2, minDeposit: 1000, requireActive: true, coinsPerInvite: 100, xpPerInvite: 25, rewardCoins: 500, rewardXp: 100, maxClaims: 1, countFrom: 0 },
      dailyBonusBase: 50,
      depositInfo: { bankName: "Demo Bank (play money)", accountName: "Game Master", rib: "000 780 0000000000000000 42", note: "Demo only." },
    },
    nextUserId: 8, nextWithdrawId: 4, nextDepositId: 8, nextTransferId: 2, nextAppId: 3, nextAuditId: 2, nextTicketId: 2, nextScheduleId: 2,
  };
}
