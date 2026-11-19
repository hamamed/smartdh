// Player pages (GET), ported from the Express app in the same order.
import QRCode from "qrcode";
import { save } from "@/lib/db";
import {
  accrue, appFunds, campaignStatus, checkState, depositLockDays, earningPerSecond, hasApprovedDeposit,
  isRealUser, levelData, recordHistory, totalBalance, totalInvested,
} from "@/lib/game";
import { payoutAccount, payoutMissing } from "@/lib/payout";
import { dayStr } from "@/lib/text";
import { redirect, render, type Ctx, type Result } from "../ctx";
import { guard, requireActive } from "../guards";
import { publicUser } from "../page-props";
import type { Router } from "../router";

// The problems a player can pick before opening a ticket; each shows a self-help answer first.
export const SUPPORT_TOPICS = [
  { key: "deposit", icon: "plus-circle", tint: "ti-mint" },
  { key: "withdrawal", icon: "arrow-down-to-line", tint: "ti-coral" },
  { key: "approval", icon: "user-check", tint: "ti-yellow" },
  { key: "account", icon: "lock", tint: "ti-sky" },
  { key: "earnings", icon: "trending-up", tint: "ti-mint" },
  { key: "payout", icon: "landmark", tint: "ti-navy" },
  { key: "referral", icon: "user-plus", tint: "ti-lilac" },
  { key: "bonus", icon: "gift", tint: "ti-yellow" },
  { key: "invest", icon: "layers", tint: "ti-coral" },
  { key: "bug", icon: "bug", tint: "ti-coral" },
  { key: "other", icon: "help-circle", tint: "ti-navy" },
];
export const topicOk = (k: string | undefined) => !!k && SUPPORT_TOPICS.some((t) => t.key === k);

export const notFound = (ctx: Ctx): Result =>
  render("error", { code: 404, heading: ctx.t("err_404_t"), mBody: ctx.t("err_404_d") }, { status: 404, title: ctx.t("err_404_t") });

/** Wraps a handler so it only runs for signed-in, approved players (requireActive). */
export const active = (fn: (ctx: Ctx) => Result | Promise<Result>) => (ctx: Ctx) => guard(ctx, requireActive) || fn(ctx);

const fundsByPlan = (ctx: Ctx) => {
  const funds: Record<string, ReturnType<typeof appFunds>> = {};
  ctx.db.settings.plans.forEach((p) => { funds[p.id] = appFunds(ctx.db, ctx.user!, p.id); });
  return funds;
};

function dashboard(ctx: Ctx): Result {
  const u = ctx.user!;
  const db = ctx.db;
  checkState(u); recordHistory(u); save(db);
  const depositOk = hasApprovedDeposit(db, u);
  const hasDeposit = db.deposits.some((d) => d.userId === u.id);
  const invitees = db.users.filter((x) => x.referredBy === u.id).length;
  const checklist = [
    { key: "payout", done: !payoutMissing(u.payout), icon: "landmark", tint: "ti-mint", href: "/profile" },
    { key: "deposit", done: hasDeposit, icon: "plus-circle", tint: "ti-sky", href: "/invest" },
    { key: "invite", done: invitees > 0, icon: "user-plus", tint: "ti-lilac", href: "/referral" },
    { key: "bonus", done: !!(u.streak && u.streak.count > 0), icon: "gift", tint: "ti-yellow", href: "/rewards" },
  ];
  return render("home", {
    user: publicUser(u),
    perSecond: earningPerSecond(u, db.settings),
    totalInvested: totalInvested(u),
    totalBalance: totalBalance(u),
    bonusUnlocked: depositOk,
    canClaim: depositOk && !(u.streak && u.streak.lastClaim === dayStr(Date.now())),
    showTour: !u.onboarded || ctx.query.tour === "1",
    history: u.history || [],
    recentActivity: (u.transactions || []).slice().reverse().slice(0, 5),
    activityCount: (u.transactions || []).length,
    checklist, checklistDone: checklist.filter((c) => c.done).length,
    checklistHidden: !!u.gsDismissed,
    campaign: campaignStatus(db, u),
    query: ctx.query,
    ...levelData(u),
  }, { title: ctx.t("nav_home") });
}

async function invest(ctx: Ctx): Promise<Result> {
  const u = ctx.user!;
  const info = ctx.db.settings.depositInfo;
  let qr = "";
  try {
    qr = await QRCode.toDataURL(`${info.bankName} | ${info.accountName} | RIB ${info.rib}`, { margin: 1, width: 200 });
  } catch { qr = ""; }
  return render("invest", {
    user: publicUser(u),
    depositInfo: info,
    depositQR: qr,
    funds: fundsByPlan(ctx),
    myDeposits: ctx.db.deposits.filter((d) => d.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    query: ctx.query,
    ...levelData(u),
  }, { title: ctx.t("plans_title") });
}

function withdrawPage(ctx: Ctx): Result {
  const u = ctx.user!;
  const db = ctx.db;
  accrue(u, db);
  return render("withdraw", {
    user: publicUser(u),
    payoutOk: !payoutMissing(u.payout),
    payoutAccount: payoutAccount(u.payout),
    depositOk: hasApprovedDeposit(db, u),
    lockDays: depositLockDays(db),
    funds: fundsByPlan(ctx),
    myWithdrawals: db.withdrawals.filter((w) => w.userId === u.id).sort((a, b) => b.createdAt - a.createdAt),
    query: ctx.query,
  }, { title: ctx.t("withdraw_title") });
}

// Printable receipt for a player's OWN deposit, withdrawal or transfer.
function invoice(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!;
  const type = ["withdraw", "transfer"].includes(ctx.params.type) ? ctx.params.type : "deposit";
  const id = Number(ctx.params.id);
  if (type === "transfer") {
    const t = (db.transfers || []).find((x) => x.id === id && (x.toId === u.id || x.fromId === u.id));
    if (!t) return notFound(ctx);
    const incoming = t.toId === u.id;
    return render("invoice", {
      type, rec: { id: t.id, amount: t.amount, createdAt: t.createdAt, status: "paid" }, u: publicUser(u),
      detail: { source: incoming ? t.fromName : t.toName, incoming },
      backUrl: "/send", backLabel: ctx.t("send_title"), generatedAt: Date.now(),
    }, { bare: true });
  }
  const rec = type === "deposit" ? db.deposits.find((x) => x.id === id && x.userId === u.id) : db.withdrawals.find((x) => x.id === id && x.userId === u.id);
  if (!rec) return notFound(ctx);
  const detail = type === "deposit"
    ? { source: (rec as { planLabel?: string }).planLabel || "", note: (rec as { note?: string }).note || "", receipt: (rec as { receipt?: string }).receipt || "" }
    : { source: (rec as { fromLabel?: string; from?: string }).fromLabel || (rec as { from?: string }).from || "", method: (rec as { method?: string }).method || "",
        account: (rec as { payoutAccount?: string }).payoutAccount || "", payoutName: (rec as { payoutName?: string }).payoutName || "" };
  return render("invoice", {
    type, rec, u: publicUser(u), detail,
    backUrl: type === "withdraw" ? "/withdraw" : "/invest",
    backLabel: ctx.t(type === "withdraw" ? "withdraw_title" : "plans_title"),
    generatedAt: Date.now(),
  }, { bare: true });
}

function referral(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!;
  // Walk down the invite tree three levels.
  const tiers: { percent: number; members: { name: string; avatar: string; active: boolean }[] }[] = [];
  let level = [u.id];
  const rates = db.settings.referralTiers || [];
  for (let i = 0; i < rates.length; i++) {
    const members = db.users.filter((x) => x.referredBy !== null && level.includes(x.referredBy));
    tiers.push({ percent: rates[i] * 100, members: members.map((m) => ({ name: m.name, avatar: m.avatar, active: m.status === "active" })) });
    level = members.map((m) => m.id);
    if (!level.length) {
      for (let j = i + 1; j < rates.length; j++) tiers.push({ percent: rates[j] * 100, members: [] });
      break;
    }
  }
  return render("referral", { user: publicUser(u), tiers, campaign: campaignStatus(db, u), query: ctx.query }, { title: ctx.t("invite_title") });
}

function leaderboard(ctx: Ctx): Result {
  const db = ctx.db;
  if (!db.settings.leaderboardEnabled) return redirect("/dashboard");
  db.users.forEach((x) => accrue(x, db));
  save(db);
  const mask = (n: string) => n.slice(0, 1).toUpperCase() + "*".repeat(Math.max(1, n.length - 1));
  const rows = db.users
    .filter((x) => x.status === "active" && !x.isAdmin && isRealUser(x))
    .map((x) => ({ id: x.id, name: mask(x.name), total: totalBalance(x), isSelf: x.id === ctx.user!.id }))
    .sort((a, b) => b.total - a.total);
  return render("leaderboard", { rows }, { title: ctx.t("lb_title") });
}

export function registerPlayerPages(r: Router): void {
  r.get("/dashboard", active(dashboard));
  r.get("/invest", active(invest));
  r.get("/withdraw", active(withdrawPage));
  r.get("/send", active((ctx) => {
    const transfers = (ctx.user!.transactions || []).filter((t) => t.type === "transfer_in" || t.type === "transfer_out").slice().reverse();
    return render("send", { user: publicUser(ctx.user!), transfers, query: ctx.query }, { title: ctx.t("send_title") });
  }));
  r.get("/rewards", active((ctx) => {
    if (!ctx.db.settings.dailyBonusEnabled) return redirect("/dashboard");
    const u = ctx.user!;
    const depositOk = hasApprovedDeposit(ctx.db, u);
    return render("rewards", {
      user: publicUser(u), bonusUnlocked: depositOk,
      canClaim: depositOk && !(u.streak && u.streak.lastClaim === dayStr(Date.now())), query: ctx.query,
    }, { title: ctx.t("db_title") });
  }));
  r.get("/received", active(() => redirect("/send")));
  r.get("/invoice/:type/:id", active(invoice));
  r.get("/achievements", active((ctx) => render("achievements", { achievements: ctx.user!.achievements || [] }, { title: ctx.t("ach_title") })));
  r.get("/activity", active((ctx) => render("activity", { txns: (ctx.user!.transactions || []).slice().reverse().slice(0, 40) }, { title: ctx.t("activity_title") })));
}

/** Support pages; registered with the support actions to keep /support/new before /support/:id. */
export function supportList(ctx: Ctx): Result {
  const my = ctx.db.tickets.filter((t) => t.userId === ctx.user!.id).sort((a, b) => b.updatedAt - a.updatedAt);
  return render("support", { topics: SUPPORT_TOPICS, myTickets: my }, { title: ctx.t("sup_title") });
}
export function supportNew(ctx: Ctx): Result {
  const topic = topicOk(ctx.query.topic) ? ctx.query.topic : "other";
  return render("support-new", { topic, topics: SUPPORT_TOPICS }, { title: ctx.t("sup_new") });
}
export function supportTicket(ctx: Ctx): Result {
  const ticket = ctx.db.tickets.find((t) => t.id === Number(ctx.params.id) && t.userId === ctx.user!.id);
  if (!ticket) return notFound(ctx);
  return render("support-ticket", { ticket }, { title: ctx.t("sup_title") });
}
export { referral, leaderboard };
