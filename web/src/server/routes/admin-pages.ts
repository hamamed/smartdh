// Admin pages and JSON/CSV endpoints (GET), ported from the Express admin router.
import { ADMIN_EMAIL } from "@/lib/config";
import { PERMS, ROLES, WITHDRAW_REJECT_REASONS } from "@/lib/constants";
import { csvBody } from "@/lib/csv";
import { save } from "@/lib/db";
import { PER_PAGE_OPTIONS, adminCounts, countBy, paginate } from "@/lib/admin-lists";
import { accrue, earningPerSecond, hasApprovedDeposit, isRealUser, levelForXp, totalBalance, totalInvested, xpForLevel } from "@/lib/game";
import { ONLINE_MS } from "@/lib/constants";
import { payoutAccount } from "@/lib/payout";
import type { Db, User } from "@/lib/types";
import { json, raw, render, type Ctx, type Result } from "../ctx";
import { guard, requireAdmin } from "../guards";
import { publicUser } from "../page-props";
import type { Router } from "../router";
import { notFound } from "./player-pages";

/** Wraps a handler so it only runs for admins (requireAdmin). */
export const admin = (fn: (ctx: Ctx) => Result | Promise<Result>) => (ctx: Ctx) => guard(ctx, requireAdmin) || fn(ctx);

type FeedEvent = { id: string; t: number; type: string; amount: number; name?: string; status: string };
type StatementRow = { t: number; kind: string; label: string; amount: number; status: string; note?: string };

const isOnline = (u: User) => !!u.lastSeen && Date.now() - u.lastSeen < ONLINE_MS;
const testIdsOf = (db: Db) => new Set(db.users.filter((u) => u.isTest).map((u) => u.id));
const accrueAll = (db: Db) => { db.users.forEach((u) => accrue(u, db)); save(db); };
/** Per-user numbers the user lists show (Express passed the helper functions). */
const withMoney = (u: User) => ({ ...publicUser(u), level: levelForXp(u.xp), invTotal: totalInvested(u), balTotal: totalBalance(u) });
const csv = (filename: string, rows: unknown[][]): Result =>
  raw(csvBody(rows), "text/csv; charset=utf-8", { headers: { "Content-Disposition": `attachment; filename="${filename}"` } });

// Contiguous time buckets for the trends chart, newest last.
function trendBuckets(range: string): { start: number; end: number; label: string }[] {
  const HOUR = 3600e3, DAYMS = 24 * HOUR;
  const out: { start: number; end: number; label: string }[] = [];
  const now = new Date();
  const fixed = (count: number, width: number, anchorEnd: number, labelFn: (d: Date) => string) => {
    for (let i = count - 1; i >= 0; i--) {
      const end = anchorEnd - i * width, start = end - width;
      out.push({ start, end, label: labelFn(new Date(start)) });
    }
  };
  if (range === "hourly") {
    const a = new Date(now); a.setMinutes(0, 0, 0);
    fixed(24, HOUR, +a + HOUR, (d) => String(d.getHours()).padStart(2, "0") + ":00");
  } else if (range === "weekly") {
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    fixed(12, 7 * DAYMS, +a + DAYMS, (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  } else if (range === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ start: +s, end: +e, label: s.toLocaleDateString("en-US", { month: "short" }) + " '" + String(s.getFullYear()).slice(-2) });
    }
  } else {
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    fixed(30, DAYMS, +a + DAYMS, (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }
  return out;
}

function hub(ctx: Ctx): Result {
  const db = ctx.db;
  accrueAll(db);
  const active = db.users.filter((u) => u.status === "active" && isRealUser(u));
  const testIds = testIdsOf(db);
  return render("admin/hub", {
    counts: adminCounts(db),
    stats: {
      players: active.length,
      invested: active.reduce((s, u) => s + totalInvested(u), 0),
      earnings: active.reduce((s, u) => s + (u.earnings || 0), 0),
      total: active.reduce((s, u) => s + totalBalance(u), 0),
      deposits: db.deposits.filter((d) => d.status === "approved" && !testIds.has(d.userId)).length,
      paid: db.withdrawals.filter((w) => w.status === "paid" && !testIds.has(w.userId)).length,
    },
    onlineCount: active.filter((u) => !u.isAdmin && isOnline(u)).length,
  }, { title: ctx.t("admin_title") });
}

function onlineJson(ctx: Ctx): Result {
  const users = ctx.db.users
    .filter((u) => isRealUser(u) && !u.isAdmin && isOnline(u))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar || "", lastSeen: u.lastSeen }));
  return json({ now: Date.now(), count: users.length, users });
}

// Live totals + recent events; read-only (projects earnings forward instead of saving).
function statsJson(ctx: Ctx): Result {
  const db = ctx.db;
  const now = Date.now();
  let earnings = 0, invested = 0, perSecond = 0;
  const testIds = testIdsOf(db);
  for (const u of db.users) {
    if (u.status !== "active" || u.isAdmin || u.isTest) continue;
    const ps = earningPerSecond(u, db.settings);
    const pending = ps * Math.max(0, (now - (u.lastAccrual || now)) / 1000);
    earnings += (u.earnings || 0) + pending;
    invested += totalInvested(u);
    perSecond += ps;
  }
  const events = db.deposits.filter((d) => !testIds.has(d.userId)).map((d): FeedEvent => ({ id: "d" + d.id, t: d.createdAt, type: "deposit", amount: d.amount, name: d.userName, status: d.status }))
    .concat(db.withdrawals.filter((w) => !testIds.has(w.userId)).map((w): FeedEvent => ({ id: "w" + w.id, t: w.createdAt, type: "withdraw", amount: w.amount, name: w.userName, status: w.status })))
    .sort((a, b) => b.t - a.t)
    .slice(0, 60);
  return json({ now, totalCoins: earnings + invested, totalEarnings: earnings, totalInvested: invested, perSecond, events });
}

function analyticsJson(ctx: Ctx): Result {
  const db = ctx.db;
  const range = ["hourly", "daily", "weekly", "monthly"].includes(ctx.query.range) ? ctx.query.range : "daily";
  const testIds = testIdsOf(db);
  const buckets = trendBuckets(range).map((b) => ({ ...b, depCount: 0, depSum: 0, wdCount: 0, wdSum: 0, signups: 0, referrals: 0 }));
  const first = buckets[0] ? buckets[0].start : 0;
  const place = (t: number) => {
    if (t < first) return null;
    for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start && t < buckets[i].end) return buckets[i];
    return null;
  };
  db.deposits.forEach((d) => { if (d.status !== "approved" || testIds.has(d.userId)) return; const b = place(d.createdAt); if (b) { b.depCount++; b.depSum += d.amount; } });
  db.withdrawals.forEach((w) => { if (w.status !== "paid" || testIds.has(w.userId)) return; const b = place(w.createdAt); if (b) { b.wdCount++; b.wdSum += w.amount; } });
  db.users.forEach((u) => { if (u.isTest || u.isAdmin) return; const b = place(u.createdAt); if (b) { b.signups++; if (u.referredBy) b.referrals++; } });
  const winEnd = buckets.length ? buckets[buckets.length - 1].end : Date.now();
  const events: Record<string, unknown>[] = [];
  db.deposits.forEach((d) => { if (testIds.has(d.userId) || d.createdAt < first || d.createdAt >= winEnd) return; events.push({ kind: "deposit", id: d.id, userId: d.userId, name: d.userName, amount: d.amount, status: d.status, app: d.planLabel || "", at: d.createdAt }); });
  db.withdrawals.forEach((w) => { if (testIds.has(w.userId) || w.createdAt < first || w.createdAt >= winEnd) return; events.push({ kind: "withdraw", id: w.id, userId: w.userId, name: w.userName, amount: w.amount, status: w.status, app: w.fromLabel || "", at: w.createdAt }); });
  db.users.forEach((u) => {
    if (u.isTest || u.isAdmin || u.createdAt < first || u.createdAt >= winEnd) return;
    const ref = u.referredBy ? db.users.find((x) => x.id === u.referredBy) : null;
    events.push({ kind: "signup", userId: u.id, name: u.name, amount: 0, status: u.status, app: "", at: u.createdAt, referred: !!u.referredBy, referrer: ref ? ref.name : "" });
  });
  events.sort((a, b) => (b.at as number) - (a.at as number));
  return json({
    range,
    buckets: buckets.map((b) => ({ label: b.label, depCount: b.depCount, depSum: b.depSum, wdCount: b.wdCount, wdSum: b.wdSum, signups: b.signups, referrals: b.referrals })),
    events: events.slice(0, 150),
    eventTotal: events.length,
  });
}

function users(ctx: Ctx): Result {
  const db = ctx.db;
  accrueAll(db);
  const q = (ctx.query.q || "").trim().toLowerCase();
  const status = ctx.query.status || "";
  const realUsers = db.users.filter(isRealUser);
  let list = realUsers.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter((u) => u.status === status);
  if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.referralCode || "").toLowerCase().includes(q));
  const pg = paginate(list, ctx.query.page, ctx.query.per);
  return render("admin/users", {
    users: pg.items.map(withMoney), page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, totalUsers: pg.total,
    q, status, totalUsersAll: realUsers.length, statusCounts: countBy(realUsers as unknown as Record<string, unknown>[]),
    counts: adminCounts(db), done: ctx.query.done || null, doneN: parseInt(ctx.query.n || "") || 0, created: ctx.query.created || null,
    query: ctx.query,
  }, { title: ctx.t("tab_users") });
}

function user(ctx: Ctx): Result {
  const db = ctx.db;
  const u = db.users.find((x) => x.id === Number(ctx.params.id));
  if (!u) return notFound(ctx);
  accrue(u, db); save(db);
  const lvl = levelForXp(u.xp);
  const referrer = u.referredBy ? db.users.find((x) => x.id === u.referredBy) : null;
  return render("admin/user", {
    u: publicUser(u), level: lvl, xpCur: xpForLevel(lvl), xpNext: xpForLevel(lvl + 1),
    invested: totalInvested(u), total: totalBalance(u),
    referrer: referrer ? publicUser(referrer) : null,
    invitees: db.users.filter((x) => x.referredBy === u.id).map(publicUser),
    deposits: db.deposits.filter((d) => d.userId === u.id).sort((a, b) => b.createdAt - a.createdAt),
    withdrawals: db.withdrawals.filter((w) => w.userId === u.id).sort((a, b) => b.createdAt - a.createdAt),
    txns: (u.transactions || []).slice().reverse().slice(0, 25),
    payoutAccount: payoutAccount(u.payout),
    schedules: db.schedules.filter((s) => s.userId === u.id),
    ok: ctx.query.ok || null, err: ctx.query.err || null, query: ctx.query,
  }, { title: u.name });
}

function testLab(ctx: Ctx): Result {
  const db = ctx.db;
  accrueAll(db);
  const testUsers = db.users.filter((u) => u.isTest).sort((a, b) => b.createdAt - a.createdAt);
  return render("admin/test", {
    counts: adminCounts(db),
    testUsers: testUsers.map(withMoney),
    stats: {
      count: testUsers.length,
      invested: testUsers.reduce((s, u) => s + totalInvested(u), 0),
      earnings: testUsers.reduce((s, u) => s + (u.earnings || 0), 0),
      total: testUsers.reduce((s, u) => s + totalBalance(u), 0),
    },
    created: ctx.query.created || null, done: ctx.query.done || null, doneN: parseInt(ctx.query.n || "") || 0,
  }, { title: ctx.t("tab_test") });
}

function statement(ctx: Ctx): Result {
  const db = ctx.db;
  const u = db.users.find((x) => x.id === Number(ctx.params.id));
  if (!u) return notFound(ctx);
  accrue(u, db); save(db);
  const rows = db.deposits.filter((d) => d.userId === u.id).map((d): StatementRow => ({ t: d.createdAt, kind: "deposit", label: d.planLabel, amount: d.amount, status: d.status, note: d.note }))
    .concat(db.withdrawals.filter((w) => w.userId === u.id).map((w): StatementRow => ({ t: w.createdAt, kind: "withdraw", label: w.fromLabel || w.from, amount: w.amount, status: w.status, note: w.method ? w.method + " " + (w.payoutAccount || "") : "" })))
    .sort((a, b) => a.t - b.t);
  return render("admin/statement", { u: publicUser(u), rows, invested: totalInvested(u), total: totalBalance(u), generatedAt: Date.now() }, { bare: true });
}

function adminInvoice(ctx: Ctx): Result {
  const db = ctx.db;
  const type = ctx.params.type === "withdraw" ? "withdraw" : "deposit";
  const id = Number(ctx.params.id);
  const dep = type === "deposit" ? db.deposits.find((x) => x.id === id) : undefined;
  const wd = type === "withdraw" ? db.withdrawals.find((x) => x.id === id) : undefined;
  const rec = dep || wd;
  if (!rec) return notFound(ctx);
  const u = db.users.find((x) => x.id === rec.userId) || null;
  return render("invoice", {
    type, rec, u: u ? publicUser(u) : null,
    detail: dep ? { source: dep.planLabel || "", note: dep.note || "", receipt: dep.receipt || "" }
      : { source: wd!.fromLabel || wd!.from || "", method: wd!.method || "", account: wd!.payoutAccount || "", payoutName: wd!.payoutName || "" },
    backUrl: u ? "/admin/users/" + u.id : null, backLabel: ctx.t("btn_manage"), generatedAt: Date.now(),
  }, { bare: true });
}

// Who a broadcast goes to. Admins never; opted-out players are dropped later unless targeted.
export function emailAudience(db: Db, kind: string): User[] {
  const real = db.users.filter((u) => !u.isAdmin && u.email && u.email.includes("@"));
  if (kind === "pending") return real.filter((u) => u.status === "pending");
  if (kind === "active") return real.filter((u) => u.status === "active");
  if (kind === "nodeposit") return real.filter((u) => u.status === "active" && !hasApprovedDeposit(db, u));
  return real;
}

function listPage(ctx: Ctx, view: string, titleKey: string, data: Record<string, unknown>): Result {
  return render(view, { counts: adminCounts(ctx.db), query: ctx.query, ...data }, { title: ctx.t(titleKey) });
}

export function registerAdminPages(r: Router): void {
  r.get("/", admin(hub));
  r.get("/online.json", admin(onlineJson));
  r.get("/stats.json", admin(statsJson));
  r.get("/analytics.json", admin(analyticsJson));
  r.get("/users", admin(users));
  r.get("/users/:id", admin(user));
  r.get("/test", admin(testLab));
}

/** Pages registered later in the Express file (after the user actions). */
export function registerAdminLaterPages(r: Router): void {
  r.get("/users/:id/statement", admin(statement));
  r.get("/invoice/:type/:id", admin(adminInvoice));
}

export function registerAdminSectionPages(r: Router): void {
  r.get("/account", admin((ctx) => listPage(ctx, "admin/account", "acct_title", {
    me: publicUser(ctx.user!),
    adminEmailLocked: !!ADMIN_EMAIL && ctx.user!.email.toLowerCase() === ADMIN_EMAIL,
    ok: ctx.query.ok || null, err: ctx.query.err || null,
  })));
  r.get("/admins", admin((ctx) => listPage(ctx, "admin/admins", "tab_admins", {
    admins: ctx.db.users.filter((u) => u.isAdmin).sort((a, b) => a.id - b.id).map(publicUser),
    roles: Object.keys(ROLES), ROLES, PERMS, adminEmail: ADMIN_EMAIL, meId: ctx.user!.id,
    ok: ctx.query.ok || null, err: ctx.query.err || null,
  })));
  r.get("/email", admin((ctx) => {
    const db = ctx.db;
    return listPage(ctx, "admin/email", "tab_email", {
      audienceCounts: {
        active: emailAudience(db, "active").length, pending: emailAudience(db, "pending").length,
        nodeposit: emailAudience(db, "nodeposit").length, all: emailAudience(db, "all").length,
      },
      optedOut: db.users.filter((u) => !u.isAdmin && u.emailOptOut).length,
      adminEmail: ctx.user!.email,
      sent: ctx.query.sent ? parseInt(ctx.query.sent) : null,
      skipped: parseInt(ctx.query.skipped || "") || 0,
      err: ctx.query.err || null,
    });
  }));
  r.get("/apps", admin((ctx) => {
    const all = ctx.db.settings.plans;
    const show = ["published", "unpublished", "all"].includes(ctx.query.show) ? ctx.query.show : "published";
    const appList = all.filter((p) => (show === "all" ? true : show === "unpublished" ? p.published === false : p.published !== false));
    return listPage(ctx, "admin/apps", "tab_apps", {
      appList, show, gen: parseInt(ctx.query.gen || "") || 0,
      appCounts: { published: all.filter((p) => p.published !== false).length, unpublished: all.filter((p) => p.published === false).length, all: all.length },
    });
  }));
}

export function registerAdminMoneyPages(r: Router): void {
  r.get("/deposits", admin((ctx) => {
    const db = ctx.db;
    const status = ctx.query.status || "";
    const q = (ctx.query.q || "").trim().toLowerCase();
    let list = db.deposits.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (status) list = list.filter((d) => d.status === status);
    if (q) list = list.filter((d) => (d.userName || "").toLowerCase().includes(q));
    const pg = paginate(list, ctx.query.page, ctx.query.per);
    return listPage(ctx, "admin/deposits", "tab_deposits", {
      deposits: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
      status, q, statusCounts: countBy(db.deposits as unknown as Record<string, unknown>[]),
    });
  }));
  r.get("/withdrawals", admin((ctx) => {
    const db = ctx.db;
    const status = ctx.query.status || "";
    const q = (ctx.query.q || "").trim().toLowerCase();
    let list = db.withdrawals.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (status) list = list.filter((w) => w.status === status);
    if (q) list = list.filter((w) => (w.userName || "").toLowerCase().includes(q));
    const pg = paginate(list, ctx.query.page, ctx.query.per);
    return listPage(ctx, "admin/withdrawals", "tab_withdrawals", {
      withdrawals: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
      status, q, statusCounts: countBy(db.withdrawals as unknown as Record<string, unknown>[]), wdReasons: WITHDRAW_REJECT_REASONS,
      ok: ctx.query.ok || "",
      kycByUser: Object.fromEntries(db.users.map((u) => [u.id, (u.kyc && u.kyc.status) || "none"])),
    });
  }));
  r.get("/invoices", admin((ctx) => {
    const db = ctx.db;
    const type = ["deposit", "withdraw"].includes(ctx.query.type) ? ctx.query.type : "";
    const q = (ctx.query.q || "").trim().toLowerCase();
    let list: { kind: string; id: number; amount: number; userName?: string; userId: number; source: string; status: string; at: number }[] = [];
    if (type !== "withdraw") list = list.concat(db.deposits.map((d) => ({ kind: "deposit", id: d.id, amount: d.amount, userName: d.userName, userId: d.userId, source: d.planLabel || "", status: d.status, at: d.createdAt })));
    if (type !== "deposit") list = list.concat(db.withdrawals.map((w) => ({ kind: "withdraw", id: w.id, amount: w.amount, userName: w.userName, userId: w.userId, source: w.fromLabel || w.from || "", status: w.status, at: w.createdAt })));
    if (q) list = list.filter((x) => (x.userName || "").toLowerCase().includes(q));
    list.sort((a, b) => b.at - a.at);
    const pg = paginate(list, ctx.query.page, ctx.query.per);
    return listPage(ctx, "admin/invoices", "tab_invoices", {
      invoices: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
      type, q, depCount: db.deposits.length, wdCount: db.withdrawals.length,
    });
  }));
  r.get("/audit", admin((ctx) => listPage(ctx, "admin/audit", "tab_audit", {
    audit: ctx.db.audit.slice().sort((a, b) => b.at - a.at).slice(0, 200),
  })));
  r.get("/tickets", admin((ctx) => {
    const db = ctx.db;
    const status = ctx.query.status || "";
    let list = db.tickets.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    if (status) list = list.filter((t) => t.status === status);
    const pg = paginate(list, ctx.query.page, ctx.query.per);
    return listPage(ctx, "admin/tickets", "tab_tickets", {
      tickets: pg.items, page: pg.page, pages: pg.pages, per: pg.per, perOptions: PER_PAGE_OPTIONS, total: pg.total,
      status, statusCounts: countBy(db.tickets as unknown as Record<string, unknown>[]),
    });
  }));
  r.get("/tickets/:id", admin((ctx) => {
    const ticket = ctx.db.tickets.find((t) => t.id === Number(ctx.params.id));
    if (!ticket) return notFound(ctx);
    const tuser = ctx.db.users.find((x) => x.id === ticket.userId);
    return listPage(ctx, "admin/ticket", "tab_tickets", { ticket, tuser: tuser ? publicUser(tuser) : null });
  }));
}

export function registerAdminSettingsPages(r: Router): void {
  r.get("/settings", admin((ctx) => listPage(ctx, "admin/settings", "tab_settings", {})));
  for (const section of ["general", "economy", "payments", "announcement", "campaign"]) {
    r.get("/settings/" + section, admin((ctx) => listPage(ctx, "admin/settings-" + section, "set_" + section + "_t", { ok: ctx.query.ok || null })));
  }
}

export function registerAdminDataPages(r: Router): void {
  r.get("/export/users.csv", admin((ctx) => {
    const db = ctx.db;
    const apps = db.settings.plans;
    const rows: unknown[][] = [["id", "name", "email", "status", "admin", "is_test", "level", "xp", "earnings",
      ...apps.map((p) => "invested_" + p.id), "invested_total", "total", "referralCode", "referredBy", "joined"]];
    db.users.forEach((u) => rows.push([
      u.id, u.name, u.email, u.status, u.isAdmin ? "yes" : "no", u.isTest ? "yes" : "no",
      levelForXp(u.xp), u.xp || 0, (u.earnings || 0).toFixed(2),
      ...apps.map((p) => ((u.invested && u.invested[p.id]) || 0).toFixed(2)),
      totalInvested(u).toFixed(2), totalBalance(u).toFixed(2),
      u.referralCode, u.referredBy || "", new Date(u.createdAt).toISOString(),
    ]));
    return csv("users.csv", rows);
  }));
  r.get("/export/deposits.csv", admin((ctx) => {
    const rows: unknown[][] = [["id", "user", "amount", "app", "status", "date"]];
    ctx.db.deposits.forEach((d) => rows.push([d.id, d.userName, d.amount, d.planLabel, d.status, new Date(d.createdAt).toISOString()]));
    return csv("deposits.csv", rows);
  }));
  r.get("/export/withdrawals.csv", admin((ctx) => {
    const rows: unknown[][] = [["id", "user", "amount", "from", "method", "payoutName", "payoutAccount", "status", "date"]];
    ctx.db.withdrawals.forEach((w) => rows.push([w.id, w.userName, w.amount, w.fromLabel || w.from, w.method || "",
      w.payoutName || "", w.payoutAccount || (w as { details?: string }).details || "", w.status, new Date(w.createdAt).toISOString()]));
    return csv("withdrawals.csv", rows);
  }));
  r.get("/data", admin((ctx) => listPage(ctx, "admin/data", "tab_data", {
    result: ctx.query.wiped ? { ok: true, wiped: true, created: [], updated: [], errors: [] }
      : ctx.query.restored ? { ok: true, restored: true, created: [], updated: [], errors: [] } : null,
  })));
  // The whole database as JSON — the real "all data" backup.
  r.get("/export/backup.json", admin((ctx) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return raw(JSON.stringify(ctx.db, null, 2), "application/json; charset=utf-8", { headers: { "Content-Disposition": `attachment; filename="kanzup-backup-${stamp}.json"` } });
  }));
  r.get("/export/users-template.csv", admin((ctx) => {
    const apps = ctx.db.settings.plans;
    return csv("users-template.csv", [
      ["name", "email", "status", "xp", "earnings", "password", ...apps.map((p) => "invested_" + p.id)],
      ["Yassine", "yassine@example.com", "active", "250", "500", "changeme", ...apps.map(() => "1000")],
      ["Amine", "amine@example.com", "pending", "", "", "", ...apps.map(() => "")],
    ]);
  }));
}

export function registerAdminTelegramPage(r: Router): void {
  r.get("/settings/telegram", admin((ctx) => listPage(ctx, "admin/settings-telegram", "set_telegram_t", {
    telegram: ctx.db.settings.telegram,
    ok: ctx.query.ok || null, test: ctx.query.test || null,
    envToken: !!process.env.TELEGRAM_BOT_TOKEN, envChat: !!process.env.TELEGRAM_CHAT_ID,
  })));
}
