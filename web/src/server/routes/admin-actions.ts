// Admin form posts, ported from the Express admin router in the same order.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL, APP_URL } from "@/lib/config";
import { ROLES, WITHDRAW_REJECT_REASONS } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { replaceAll, save, wipe } from "@/lib/db";
import { textToHtml } from "@/lib/email";
import { adminCounts } from "@/lib/admin-lists";
import {
  accrue, addTx, addXp, award, checkState, createUser, creditDeposit, levelForXp, logAudit, maybePayInvite, parseWhen, parseWhenTime, totalInvested,
} from "@/lib/game";
import { FREQ_MS, applyWithdrawAction, deleteUserCascade, runSchedules } from "@/lib/jobs";
import { mailUser, notifyDeposit, notifyKyc, notifyMessage, pushNotice, sendCampaignInvites, tgConfig, tgSend, userT } from "@/lib/notify";
import { payoutAccount } from "@/lib/payout";
import { roleOf } from "@/lib/rbac";
import { escapeHtml } from "@/lib/text";
import { RULES, deleteUpload, saveUpload } from "@/lib/uploads";
import type { TicketMessage, User } from "@/lib/types";
import { field, fieldList, firstFile, redirect, referer, render, type Ctx, type Result } from "../ctx";
import type { Router } from "../router";
import { admin, emailAudience } from "./admin-pages";
import { notFound } from "./player-pages";

const findUser = (ctx: Ctx) => ctx.db.users.find((x) => x.id === Number(ctx.params.id));
const withQuery = (back: string, q: string) => back + (back.includes("?") ? "&" : "?") + q;
const idList = (ctx: Ctx) => [...new Set(fieldList(ctx, "ids").map(Number))].filter(Number.isFinite);

function savedUpload(ctx: Ctx, name: string, rule: typeof RULES.receipt): string {
  // Like the Express multer chains here, upload errors are ignored (no file).
  const r = saveUpload(firstFile(ctx, name), rule);
  return r.kind === "saved" ? r.url : "";
}

async function createAccount(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const name = field(ctx, "name").trim();
  const email = field(ctx, "email").trim().toLowerCase();
  const password = field(ctx, "password");
  const status = (["active", "pending", "rejected"].includes(field(ctx, "status")) ? field(ctx, "status") : "active") as User["status"];
  const isTest = field(ctx, "isTest") === "1";
  const backBase = isTest ? "/admin/test" : "/admin/users";
  if (!name || !email.includes("@") || password.length < 4) return redirect(backBase + "?created=err");
  if (db.users.find((u) => u.email.toLowerCase() === email)) return redirect(backBase + "?created=dup");
  const u = createUser(db, { name, email, passwordHash: await bcrypt.hash(password, 10), isAdmin: false, status, isTest });
  logAudit(db, ctx.user, "user.create", name + " <" + email + ">" + (isTest ? " [test]" : ""));
  save(db);
  return redirect("/admin/users/" + u.id + "?ok=created");
}

function manualDeposit(ctx: Ctx): Result {
  const db = ctx.db;
  const u = findUser(ctx);
  if (!u) return redirect("/admin/users");
  const receipt = savedUpload(ctx, "receipt", RULES.receipt);
  const amount = Math.floor(Number(field(ctx, "amount")));
  const plan = db.settings.plans.find((p) => p.id === field(ctx, "plan"));
  const status = field(ctx, "status") === "pending" ? "pending" : "approved";
  const note = field(ctx, "note").trim();
  const when = parseWhen(field(ctx, "date"));
  if (!plan || !amount || amount <= 0) return redirect("/admin/users/" + u.id + "?err=deposit");
  creditDeposit(db, u, plan, amount, { status, note, when, receipt });
  logAudit(db, ctx.user, "admin.deposit", u.name + " " + amount + " → " + plan.name + " (" + status + ")");
  save(db);
  return redirect("/admin/users/" + u.id + "?ok=deposit");
}

function manualWithdraw(ctx: Ctx): Result {
  const db = ctx.db;
  const u = findUser(ctx);
  if (!u) return redirect("/admin/users");
  const amount = Math.floor(Number(field(ctx, "amount")));
  const from = field(ctx, "from");
  const method = field(ctx, "method") === "bank" ? "bank" : "paypal";
  const payoutName = field(ctx, "payoutName").trim();
  const account = field(ctx, "account").trim();
  const status = (["paid", "pending", "rejected"].includes(field(ctx, "status")) ? field(ctx, "status") : "paid") as "paid" | "pending" | "rejected";
  const when = parseWhen(field(ctx, "date"));
  if (!amount || amount <= 0) return redirect("/admin/users/" + u.id + "?err=withdraw");
  accrue(u, db);
  let label: string;
  if (from === "earnings") label = "Earnings";
  else {
    const p = db.settings.plans.find((x) => x.id === from);
    if (!p) return redirect("/admin/users/" + u.id + "?err=withdraw");
    label = p.name;
  }
  if (status !== "rejected") {
    const have = from === "earnings" ? u.earnings : u.invested[from] || 0;
    if (amount > have) return redirect("/admin/users/" + u.id + "?err=insufficient");
    if (from === "earnings") u.earnings -= amount; else u.invested[from] -= amount;
  }
  db.withdrawals.push({
    id: db.nextWithdrawId++, userId: u.id, userName: u.name, amount, from, fromLabel: label, method, payoutName,
    payoutAccount: account, status, byAdmin: true, createdAt: when,
  } as Parameters<typeof db.withdrawals.push>[0]);
  addTx(u, status === "paid" ? "withdraw_paid" : status === "rejected" ? "withdraw_rejected" : "withdraw_request", amount, "From " + label, when);
  logAudit(db, ctx.user, "admin.withdraw", u.name + " " + amount + " from " + label + " (" + status + ")");
  save(db);
  return redirect("/admin/users/" + u.id + "?ok=withdraw");
}

function batchDeposit(ctx: Ctx): Result {
  const db = ctx.db;
  const ids = idList(ctx);
  const amount = Math.floor(Number(field(ctx, "amount")));
  const plan = db.settings.plans.find((p) => p.id === field(ctx, "plan"));
  const status = field(ctx, "status") === "pending" ? "pending" : "approved";
  if (!plan || !amount || amount <= 0 || !ids.length) return redirect("/admin/users?created=err");
  let n = 0;
  for (const id of ids) {
    const u = db.users.find((x) => x.id === id);
    if (!u) continue;
    creditDeposit(db, u, plan, amount, { status, note: "Batch", when: Date.now() });
    n++;
  }
  logAudit(db, ctx.user, "admin.batchDeposit", n + " players · " + amount + " → " + plan.name + " (" + status + ")");
  save(db);
  return redirect("/admin/users?done=deposit&n=" + n);
}

function addSchedule(ctx: Ctx): Result {
  const db = ctx.db;
  const u = findUser(ctx);
  if (!u) return redirect("/admin/users");
  const amount = Math.floor(Number(field(ctx, "amount")));
  const plan = db.settings.plans.find((p) => p.id === field(ctx, "plan"));
  const frequency = (FREQ_MS[field(ctx, "frequency")] ? field(ctx, "frequency") : "weekly") as "daily" | "weekly" | "monthly";
  if (!plan || !amount || amount <= 0) return redirect("/admin/users/" + u.id + "?err=deposit");
  db.schedules.push({
    id: db.nextScheduleId++, userId: u.id, userName: u.name, amount, plan: plan.id, planLabel: plan.name, frequency,
    active: true, lastRun: null, nextRun: Date.now() + FREQ_MS[frequency], createdAt: Date.now(),
  } as unknown as Parameters<typeof db.schedules.push>[0]);
  logAudit(db, ctx.user, "schedule.add", u.name + " " + amount + " → " + plan.name + " / " + frequency);
  save(db);
  return redirect("/admin/users/" + u.id + "?ok=schedule");
}

async function sendBroadcast(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const subject = field(ctx, "subject").trim();
  const heading = field(ctx, "heading").trim() || subject;
  const message = field(ctx, "message").trim();
  const ctaText = field(ctx, "ctaText").trim();
  const ctaUrl = field(ctx, "ctaUrl").trim();
  const audience = ["active", "pending", "nodeposit", "all"].includes(field(ctx, "audience")) ? field(ctx, "audience") : "active";
  const specific = field(ctx, "specific").trim();
  const testOnly = field(ctx, "testOnly") === "1";
  const alsoNotice = field(ctx, "alsoNotice") === "1";
  if (!subject || !message) return redirect("/admin/email?err=empty");
  let recipients: User[];
  if (testOnly) recipients = [ctx.user!];
  else if (specific) {
    const wanted = specific.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    recipients = db.users.filter((u) => wanted.includes(u.email.toLowerCase()));
  } else recipients = emailAudience(db, audience);
  const bodyHtml = textToHtml(message);
  const cta = ctaUrl ? { text: ctaText || ctx.t("email_visit"), url: ctaUrl } : null;
  const broadcast = !testOnly && !specific;
  let sent = 0, skipped = 0, noticed = 0;
  for (const u of recipients) {
    const r = await mailUser(u, { subject, heading, intro: userT(u)("mail_hi", { name: u.name }), bodyHtml, cta, broadcast });
    if (r && r.skipped) skipped++; else sent++;
    if (alsoNotice && !testOnly) { pushNotice(u, message.slice(0, 1000)); noticed++; }
  }
  logAudit(db, ctx.user, "email.broadcast",
    `"${subject}" → ${sent} sent` + (skipped ? `, ${skipped} skipped` : "") + (noticed ? `, ${noticed} notices` : "") +
    (testOnly ? " (test)" : specific ? " (specific)" : ` (${audience})`));
  save(db);
  return redirect("/admin/email?sent=" + sent + "&skipped=" + skipped);
}

function generateApps(ctx: Ctx): Result {
  const db = ctx.db;
  const count = Math.min(500, Math.max(1, Math.floor(Number(field(ctx, "count")) || 100)));
  const A = ["Nova", "Atlas", "Zenith", "Orbit", "Pulse", "Vertex", "Lumen", "Astra", "Quant", "Flux", "Apex", "Terra", "Delta", "Solace", "Nimbus", "Cobalt", "Ember", "Vega", "Onyx", "Halo"];
  const B = ["Capital", "Fund", "Invest", "Growth", "Yield", "Finance", "Assets", "Partners", "Holdings", "Markets"];
  const ICONS = ["trending-up", "rocket", "gem", "landmark", "bar-chart-3", "coins", "briefcase", "piggy-bank", "line-chart", "wallet"];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  for (let i = 0; i < count; i++) {
    const fixed = Math.random() < 0.5;
    const fixedAmount = fixed ? Math.round(rnd(1, 1000)) * 100 : 0;
    const rate = Math.round(rnd(5, 60)) / 100;
    db.settings.plans.push({
      id: "app" + db.nextAppId++,
      name: pick(A) + " " + pick(B) + " " + db.nextAppId,
      icon: pick(ICONS), imageUrl: "", ratePer15Days: rate, color: "primary", desc: "", link: "",
      fixedAmount, minLevel: 1, published: false,
    });
  }
  logAudit(db, ctx.user, "app.generate", count + " apps (unpublished)");
  save(db);
  return redirect("/admin/apps?show=unpublished&gen=" + count);
}

async function ticketReply(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const ticket = db.tickets.find((t) => t.id === Number(ctx.params.id));
  if (!ticket) return notFound(ctx);
  const saved = saveUpload(firstFile(ctx, "file"), RULES.ticket);
  const attach: Partial<TicketMessage> = saved.kind === "saved" ? { file: saved.url, fileName: saved.originalName, fileType: saved.mimeType } : {};
  const text = field(ctx, "message").trim().slice(0, 4000);
  const close = field(ctx, "close") === "1";
  if (text || attach.file) {
    ticket.messages.push({ from: "admin", authorName: ctx.user!.name, text, at: Date.now(), ...attach });
    ticket.status = close ? "closed" : "answered";
    ticket.updatedAt = Date.now();
    logAudit(db, ctx.user, "ticket.reply", "#" + ticket.id + (close ? " (closed)" : ""));
    save(db);
    const tu = db.users.find((x) => x.id === ticket.userId);
    if (tu) await mailUser(tu, {
      subject: ctx.t("sup_reply_subj", { id: ticket.id }), heading: ctx.t("sup_reply_subj", { id: ticket.id }),
      lines: [ticket.subject, "", text], cta: { text: ctx.t("sup_view_ticket"), url: APP_URL + "/support/" + ticket.id },
    });
  }
  return redirect("/admin/tickets/" + ticket.id);
}

const dataPage = (ctx: Ctx, result: Record<string, unknown>): Result =>
  render("admin/data", { counts: adminCounts(ctx.db), result, query: ctx.query }, { title: ctx.t("tab_data") });

async function importUsers(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const file = firstFile(ctx, "file");
  if (!file || file.size > 10 * 1024 * 1024) return dataPage(ctx, { ok: false, error: ctx.t("imp_nofile") });
  let rows: string[][];
  try { rows = parseCsv(file.data.toString("utf8")); } catch { return dataPage(ctx, { ok: false, error: ctx.t("imp_badcsv") }); }
  if (rows.length < 2) return dataPage(ctx, { ok: false, error: ctx.t("imp_empty") });
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (col("email") === -1) return dataPage(ctx, { ok: false, error: ctx.t("imp_noemail") });
  const markAllTest = field(ctx, "markTest") === "1";
  const created: { email: string; password: string | null }[] = [], updated: string[] = [], errors: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (n: string) => { const c = col(n); return c === -1 ? "" : (r[c] || "").trim(); };
    const email = get("email").toLowerCase();
    if (!email || !email.includes("@")) { errors.push(ctx.t("imp_row", { n: i + 1 }) + ": " + ctx.t("imp_bademail")); continue; }
    const name = get("name");
    const status = (["active", "pending", "rejected"].includes(get("status")) ? get("status") : "pending") as User["status"];
    const xp = get("xp"), earnings = get("earnings"), password = get("password");
    const rowTest = ["yes", "true", "1"].includes(get("is_test").toLowerCase());
    const isTest = markAllTest || rowTest;
    let u = db.users.find((x) => x.email.toLowerCase() === email);
    let isNew = false;
    if (u) {
      if (name) u.name = name;
      if (get("status")) u.status = status;
      if (xp !== "") u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== "") u.earnings = Math.max(0, Number(earnings) || 0);
      if (password) u.passwordHash = await bcrypt.hash(password, 10);
      if ((markAllTest || col("is_test") !== -1) && !u.isAdmin) u.isTest = isTest;
      updated.push(u.email);
    } else {
      isNew = true;
      if (!name) { errors.push(ctx.t("imp_row", { n: i + 1 }) + ": " + ctx.t("imp_noname")); continue; }
      const pass = password || crypto.randomBytes(6).toString("base64url");
      u = createUser(db, { name, email, passwordHash: await bcrypt.hash(pass, 10), isAdmin: false, status, isTest });
      if (xp !== "") u.xp = Math.max(0, Number(xp) || 0);
      if (earnings !== "") u.earnings = Math.max(0, Number(earnings) || 0);
      created.push({ email: u.email, password: password ? null : pass });
    }
    let touchedInvested = false;
    for (const p of db.settings.plans) {
      const c = col("invested_" + p.id);
      if (c === -1) continue;
      const v = (r[c] || "").trim();
      if (v === "") continue;
      const amt = Math.max(0, Number(v) || 0);
      u.invested[p.id] = amt;
      touchedInvested = true;
      if (isNew && amt > 0) {
        db.deposits.push({ id: db.nextDepositId++, userId: u.id, userName: u.name, plan: p.id, planLabel: p.name, amount: amt, status: "approved", createdAt: Date.now() });
        addTx(u, "deposit", amt, p.name);
      }
    }
    if (touchedInvested) {
      u.lastAccrual = Date.now();
      if (isNew) award(u, "first_deposit");
    }
    const payMethod = get("payout_method").toLowerCase();
    const payAccount = get("payout_account");
    if (payMethod || payAccount) {
      const bank = payMethod === "bank";
      u.payout = { method: bank ? "bank" : "paypal", name: get("payout_name") || u.name, paypal: bank ? "" : payAccount, rib: bank ? payAccount : "" };
    }
    if (isNew) {
      const now = Date.now(), D = 86400000;
      const curInv = totalInvested(u), curEarn = u.earnings || 0;
      if (curInv > 0 || curEarn > 0) {
        u.history = [];
        for (let d = 90; d >= 0; d -= 2) {
          const earn = Math.round(curEarn * ((90 - d) / 90) * 100) / 100;
          u.history.push({ t: now - d * D, total: Math.round((curInv + earn) * 100) / 100, invested: curInv, earnings: earn, referral: 0 });
        }
        const uid = u.id;
        db.deposits.filter((x) => x.userId === uid).forEach((dep) => { dep.createdAt = now - 90 * D; dep.approvedAt = now - 90 * D; });
      }
      let withdrawn = Math.max(0, Number(get("withdrawn")) || 0);
      const uid = u.id;
      const hasDeposit = db.deposits.some((x) => x.userId === uid);
      if (withdrawn > 0 && hasDeposit) {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n && withdrawn > 0; k++) {
          const amount = k === n - 1 ? withdrawn : Math.max(1, Math.round(withdrawn / (n - k) * (0.5 + Math.random())));
          const amt = Math.min(withdrawn, amount);
          withdrawn -= amt;
          const at = now - (2 + Math.floor(Math.random() * 88)) * D;
          db.withdrawals.push({
            id: db.nextWithdrawId++, userId: u.id, userName: u.name, amount: amt, from: "earnings", fromLabel: "Earnings",
            method: u.payout.method, payoutName: u.payout.name, payoutAccount: payoutAccount(u.payout),
            status: "paid", createdAt: at, paidAt: at,
          } as Parameters<typeof db.withdrawals.push>[0]);
          addTx(u, "withdraw_paid", amt, "Withdrawal");
        }
      }
    }
    checkState(u);
  }
  logAudit(db, ctx.user, "data.importUsers", created.length + " created, " + updated.length + " updated, " + errors.length + " errors");
  save(db);
  return dataPage(ctx, { ok: true, created, updated, errors });
}

async function wipeAll(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  if (field(ctx, "confirm") !== "WIPE") return dataPage(ctx, { ok: false, error: ctx.t("wipe_noconfirm") });
  if (!(await bcrypt.compare(field(ctx, "password"), ctx.user!.passwordHash))) return dataPage(ctx, { ok: false, error: ctx.t("wipe_badpass") });
  const keepAdmin = field(ctx, "keepAdmin") !== "0";
  const keepSettings = field(ctx, "keepSettings") === "1";
  const me = ctx.user!;
  const before = db.users.length;
  db.users.forEach((u) => { if (!(keepAdmin && u.id === me.id)) deleteUpload(u.avatar); });
  const fresh = wipe({ keepUsers: keepAdmin ? [me.id] : [], keepSettings });
  logAudit(fresh, keepAdmin ? me : null, "data.wipe",
    before + " users removed · settings " + (keepSettings ? "kept" : "reset") + " · admin " + (keepAdmin ? "kept" : "removed"));
  save(fresh);
  if (!keepAdmin) { ctx.destroySession = true; return redirect("/"); }
  return redirect("/admin/data?wiped=1");
}

function restoreBackup(ctx: Ctx): Result {
  const file = firstFile(ctx, "file");
  if (!file || file.size > 10 * 1024 * 1024) return dataPage(ctx, { ok: false, error: ctx.t("imp_nofile") });
  if (field(ctx, "confirm") !== "RESTORE") return dataPage(ctx, { ok: false, error: ctx.t("imp_noconfirm") });
  let data: { users?: unknown; settings?: unknown };
  try { data = JSON.parse(file.data.toString("utf8")); } catch { return dataPage(ctx, { ok: false, error: ctx.t("imp_badjson") }); }
  if (!data || !Array.isArray(data.users) || !data.settings) return dataPage(ctx, { ok: false, error: ctx.t("imp_notbackup") });
  const before = ctx.db.users.length;
  const restored = replaceAll(data);
  logAudit(restored, ctx.user, "data.restore", before + " users replaced with " + restored.users.length);
  save(restored);
  return redirect("/admin/data?restored=1");
}

// Image for an app: an uploaded photo wins over a pasted URL.
function appImage(ctx: Ctx, uploaded: string): string {
  return uploaded || field(ctx, "imageUrl").trim();
}

function addApp(ctx: Ctx): Result {
  const db = ctx.db;
  const uploaded = savedUpload(ctx, "image", RULES.appImage);
  const name = field(ctx, "name").trim();
  if (name) {
    db.settings.plans.push({
      id: "app" + db.nextAppId++, name,
      icon: (field(ctx, "icon") || "trending-up").trim() || "trending-up",
      imageUrl: appImage(ctx, uploaded),
      ratePer15Days: Math.max(0, Number(field(ctx, "rate")) / 100 || 0),
      color: field(ctx, "color") || "primary",
      desc: field(ctx, "desc").trim(),
      link: field(ctx, "link").trim(),
      fixedAmount: Math.max(0, Math.floor(Number(field(ctx, "fixedAmount")) || 0)),
      minLevel: Math.max(1, Number(field(ctx, "minLevel")) || 1),
      published: field(ctx, "published") !== "0",
    });
    logAudit(db, ctx.user, "app.add", name);
    save(db);
  }
  return redirect("/admin/apps");
}

function editApp(ctx: Ctx): Result {
  const db = ctx.db;
  const uploaded = savedUpload(ctx, "image", RULES.appImage);
  const p = db.settings.plans.find((x) => x.id === ctx.params.id);
  const has = (k: string) => ctx.body[k] !== undefined;
  if (p) {
    if (field(ctx, "name")) p.name = field(ctx, "name").trim();
    if (has("icon") && field(ctx, "icon").trim()) p.icon = field(ctx, "icon").trim();
    if (has("rate") && field(ctx, "rate") !== "") p.ratePer15Days = Math.max(0, Number(field(ctx, "rate")) / 100);
    if (field(ctx, "minLevel")) p.minLevel = Math.max(1, Number(field(ctx, "minLevel")) || 1);
    if (has("fixedAmount")) p.fixedAmount = Math.max(0, Math.floor(Number(field(ctx, "fixedAmount")) || 0));
    if (field(ctx, "color")) p.color = field(ctx, "color");
    if (has("desc")) p.desc = field(ctx, "desc").trim();
    if (has("link")) p.link = field(ctx, "link").trim();
    if (field(ctx, "removeImage") === "1") { deleteUpload(p.imageUrl); p.imageUrl = ""; }
    else if (uploaded || (field(ctx, "imageUrl") && field(ctx, "imageUrl").trim() !== p.imageUrl)) {
      deleteUpload(p.imageUrl);
      p.imageUrl = appImage(ctx, uploaded);
    }
    logAudit(db, ctx.user, "app.edit", p.name + " @ " + (p.ratePer15Days * 100).toFixed(1) + "% / L" + p.minLevel);
    save(db);
  }
  return redirect("/admin/apps");
}

function deleteApp(ctx: Ctx): Result {
  const db = ctx.db;
  const id = ctx.params.id;
  const gone = db.settings.plans.find((x) => x.id === id);
  const remaining = db.settings.plans.filter((x) => x.id !== id);
  // Holdings move to the most accessible remaining app, or are refunded if none is left.
  const dest = remaining.slice().sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1))[0] || null;
  let moved = 0, refunded = 0;
  db.users.forEach((u) => {
    const amt = (u.invested && u.invested[id]) || 0;
    if (amt <= 0) return;
    accrue(u, db);
    delete u.invested[id];
    if (dest) {
      u.invested[dest.id] = (u.invested[dest.id] || 0) + amt;
      addTx(u, "admin_adjust", amt, "App removed — moved to " + dest.name);
      moved++;
    } else {
      u.earnings += amt;
      addTx(u, "admin_adjust", amt, "App removed — refunded");
      refunded++;
    }
  });
  if (gone) deleteUpload(gone.imageUrl);
  db.settings.plans = remaining;
  logAudit(db, ctx.user, "app.delete", (gone ? gone.name : id) + (dest ? " → moved " + moved + " holders to " + dest.name : " → refunded " + refunded));
  save(db);
  return redirect("/admin/apps");
}

// Approving a deposit is where coins are actually credited.
function depositAction(ctx: Ctx): Result {
  const db = ctx.db;
  const d = db.deposits.find((x) => x.id === Number(ctx.params.id));
  if (d && d.status === "pending") {
    const u = db.users.find((x) => x.id === d.userId);
    if (ctx.params.action === "approve") {
      d.status = "approved";
      d.approvedAt = Date.now();
      if (u) {
        accrue(u, db);
        u.invested[d.plan] = (u.invested[d.plan] || 0) + d.amount;
        addXp(u, Math.min(200, 10 + Math.floor(d.amount / 500)));
        addTx(u, "deposit", d.amount, d.planLabel);
        award(u, "first_deposit");
        checkState(u);
        maybePayInvite(db, u);
        notifyDeposit(u, d.amount, d.planLabel, true);
      }
      logAudit(db, ctx.user, "deposit.approve", "#" + d.id + " " + d.userName + " " + d.amount + " -> " + d.planLabel);
    } else if (ctx.params.action === "reject") {
      d.status = "rejected";
      if (u) notifyDeposit(u, d.amount, d.planLabel, false);
      logAudit(db, ctx.user, "deposit.reject", "#" + d.id + " " + d.userName + " " + d.amount);
    }
    save(db);
  }
  return redirect("/admin/deposits");
}

function approvalMail(u: User): Promise<unknown> {
  const tr = userT(u);
  return mailUser(u, { subject: tr("mail_appr_subj"), heading: tr("mail_appr_h"), lines: [tr("mail_appr_b")], cta: { text: tr("mail_login_play"), url: `${APP_URL}/login` } });
}

async function bulk(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const action = field(ctx, "action");
  const ids = idList(ctx).filter((n) => n !== ctx.user!.id);
  if (!ids.length) return redirect("/admin/users?done=none");
  let n = 0;
  if (action === "approve") {
    for (const id of ids) {
      const u = db.users.find((x) => x.id === id);
      if (!u || u.status === "active") continue;
      u.status = "active"; u.lastAccrual = Date.now();
      maybePayInvite(db, u);
      void approvalMail(u);
      n++;
    }
  } else if (action === "reject") {
    for (const id of ids) {
      const u = db.users.find((x) => x.id === id);
      if (!u || u.isAdmin) continue;
      u.status = "rejected"; n++;
    }
  } else if (action === "delete") {
    for (const id of ids) if (deleteUserCascade(db, id)) n++;
  } else return redirect("/admin/users");
  logAudit(db, ctx.user, "user.bulk" + action.charAt(0).toUpperCase() + action.slice(1), n + " players");
  save(db);
  return redirect("/admin/users?done=" + action + "&n=" + n);
}

function economy(ctx: Ctx): Result {
  const db = ctx.db, s = db.settings;
  const num = (k: string) => Number(field(ctx, k));
  s.minAddFunds = Math.max(0, num("minAddFunds") || 0);
  s.minWithdraw = Math.max(0, num("minWithdraw") || 0);
  s.minTransfer = Math.max(0, num("minTransfer") || 0);
  s.withdrawEveryDays = Math.max(0, num("withdrawEveryDays") || 0);
  s.depositLockDays = Math.max(0, Math.floor(num("depositLockDays") || 0));
  s.referralTiers = [1, 2, 3].map((i) => Math.max(0, num("tier" + i) / 100 || 0));
  s.dailyBonusBase = Math.max(0, num("dailyBonusBase") || 0);
  s.dailyBonusEnabled = field(ctx, "dailyBonusEnabled") === "1";
  s.leaderboardEnabled = field(ctx, "leaderboardEnabled") === "1";
  const hs = s.homeStats;
  const dim = (k: string) => ({
    base: Math.max(0, Math.floor(num(k + "Base") || 0)),
    min: Math.max(0, Math.floor(num(k + "Min") || 0)),
    spread: Math.max(0, Math.floor(num(k + "Spread") || 0)),
  });
  hs.enabled = field(ctx, "growthEnabled") === "1";
  hs.users = dim("gUsers");
  hs.payouts = dim("gPayouts");
  hs.coins = dim("gCoins");
  if (!hs.start) hs.start = Date.now();
  logAudit(db, ctx.user, "settings.economy", "Limits, tiers (" + s.referralTiers.map((x) => (x * 100).toFixed(2) + "%").join("/") + ") and daily bonus updated");
  save(db);
  return redirect("/admin/settings/economy?ok=1");
}

function campaignSettings(ctx: Ctx): Result {
  const db = ctx.db, s = db.settings;
  const prev = s.campaign || ({} as typeof s.campaign);
  const num = (k: string) => Number(field(ctx, k));
  s.campaign = {
    enabled: !!field(ctx, "enabled"),
    title: field(ctx, "title").trim(),
    inviteGoal: Math.max(1, num("inviteGoal") || 1),
    minDeposit: Math.max(0, num("minDeposit") || 0),
    requireActive: !!field(ctx, "requireActive"),
    coinsPerInvite: Math.max(0, num("coinsPerInvite") || 0),
    xpPerInvite: Math.max(0, num("xpPerInvite") || 0),
    rewardCoins: Math.max(0, num("rewardCoins") || 0),
    rewardXp: Math.max(0, num("rewardXp") || 0),
    maxClaims: Math.max(0, num("maxClaims") || 0),
    countFrom: field(ctx, "resetCount") ? Date.now() : prev.countFrom || 0,
  };
  if (field(ctx, "resetProgress")) db.users.forEach((u) => { u.campaignClaims = 0; });
  logAudit(db, ctx.user, "settings.campaign",
    (s.campaign.enabled ? "ON" : "OFF") + " · invite " + s.campaign.inviteGoal + " · min deposit " + s.campaign.minDeposit +
    " · reward " + s.campaign.rewardCoins + " + " + s.campaign.rewardXp + " XP" + (field(ctx, "resetProgress") ? " · progress reset" : ""));
  save(db);
  const justEnabled = !prev.enabled && s.campaign.enabled;
  if (justEnabled && field(ctx, "notifyAll") === "1") {
    const actor = ctx.user;
    sendCampaignInvites(db)
      .then((r) => { logAudit(db, actor, "campaign.invites", r.sent + " emailed" + (r.skipped ? ", " + r.skipped + " skipped" : "")); save(db); })
      .catch((e) => console.error("Campaign invite emails failed:", e));
    return redirect("/admin/settings/campaign?ok=invited");
  }
  return redirect("/admin/settings/campaign?ok=1");
}

function telegramFromForm(ctx: Ctx) {
  return { enabled: field(ctx, "enabled") === "1", botToken: field(ctx, "botToken").trim(), chatId: field(ctx, "chatId").trim() };
}

export function registerAdminUserActions(r: Router): void {
  r.post("/users/:id/toggle-test", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (u && !u.isAdmin) {
      u.isTest = !u.isTest;
      logAudit(db, ctx.user, "user.test", u.name + " → " + (u.isTest ? "test" : "real"));
      save(db);
    }
    const ref = referer(ctx);
    return redirect(ref && ref.includes("/admin/users/") ? "/admin/users/" + ctx.params.id : "/admin/test");
  }));
  r.post("/test/delete-all", admin((ctx) => {
    const db = ctx.db;
    const ids = db.users.filter((u) => u.isTest && !u.isAdmin).map((u) => u.id);
    ids.forEach((id) => deleteUserCascade(db, id));
    logAudit(db, ctx.user, "test.deleteAll", ids.length + " test users removed");
    save(db);
    return redirect("/admin/test?done=deleted&n=" + ids.length);
  }));
  r.post("/users/create", admin(createAccount));
  r.post("/users/:id/deposit", admin(manualDeposit));
  r.post("/users/:id/withdraw", admin(manualWithdraw));
  r.post("/users/:id/impersonate", admin((ctx) => {
    const target = findUser(ctx);
    if (target && !target.isAdmin) {
      ctx.session.impersonate = target.id;
      logAudit(ctx.db, ctx.user, "admin.viewAs", target.name + " <" + target.email + ">");
      save(ctx.db);
    }
    return redirect("/dashboard");
  }));
  // Not admin-guarded: while viewing as a player, the current user is the player.
  r.post("/stop-impersonate", (ctx) => {
    const id = ctx.session.impersonate;
    delete ctx.session.impersonate;
    return redirect(id ? "/admin/users/" + id : "/admin");
  });
  r.post("/users/batch-deposit", admin(batchDeposit));
  r.post("/users/:id/schedule", admin(addSchedule));
  r.post("/schedules/:sid/delete", admin((ctx) => {
    const db = ctx.db;
    const sid = Number(ctx.params.sid);
    const sc = db.schedules.find((s) => s.id === sid) as (typeof db.schedules[number] & { userName?: string }) | undefined;
    db.schedules = db.schedules.filter((s) => s.id !== sid);
    if (sc) logAudit(db, ctx.user, "schedule.delete", sc.userName + " " + sc.amount + " / " + sc.frequency);
    save(db);
    return redirect(sc ? "/admin/users/" + sc.userId : "/admin/users");
  }));
  r.post("/schedules/run", admin((ctx) => {
    const n = runSchedules(ctx.db);
    logAudit(ctx.db, ctx.user, "schedule.run", n + " payouts");
    save(ctx.db);
    return redirect((field(ctx, "back") || "/admin/users") + "?ok=ran&n=" + n);
  }));
}

export function registerAdminMoreUserActions(r: Router): void {
  r.post("/users/:id/xp", admin((ctx) => {
    const u = findUser(ctx);
    if (u && field(ctx, "xp") !== "") {
      u.xp = Math.max(0, Math.floor(Number(field(ctx, "xp")) || 0));
      logAudit(ctx.db, ctx.user, "user.setXp", u.name + " -> " + u.xp + " XP (level " + levelForXp(u.xp) + ")");
      save(ctx.db);
    }
    return redirect("/admin/users/" + ctx.params.id);
  }));
  r.post("/users/:id/password", admin(async (ctx) => {
    const u = findUser(ctx);
    const pass = field(ctx, "password");
    if (u && pass.length >= 4) {
      u.passwordHash = await bcrypt.hash(pass, 10);
      u.reset = null;
      logAudit(ctx.db, ctx.user, "user.setPassword", u.name);
      save(ctx.db);
    }
    return redirect("/admin/users/" + ctx.params.id + "?ok=1");
  }));
}

export function registerAdminTeamActions(r: Router): void {
  r.post("/account/profile", admin(async (ctx) => {
    const db = ctx.db, u = ctx.user!;
    const name = field(ctx, "name").trim();
    const email = field(ctx, "email").trim().toLowerCase();
    if (!(await bcrypt.compare(field(ctx, "current"), u.passwordHash))) return redirect("/admin/account?err=wrongpass");
    if (!name) return redirect("/admin/account?err=noname");
    if (!email.includes("@")) return redirect("/admin/account?err=bademail");
    if (db.users.find((x) => x.id !== u.id && x.email.toLowerCase() === email)) return redirect("/admin/account?err=dupemail");
    u.name = name; u.email = email;
    logAudit(db, u, "admin.changeProfile", name + " <" + email + ">");
    save(db);
    return redirect("/admin/account?ok=profile");
  }));
  r.post("/account/password", admin(async (ctx) => {
    const db = ctx.db, u = ctx.user!;
    const pass = field(ctx, "password"), confirm = field(ctx, "confirm");
    if (!(await bcrypt.compare(field(ctx, "current"), u.passwordHash))) return redirect("/admin/account?err=wrongpass");
    if (pass.length < 6) return redirect("/admin/account?err=short");
    if (pass !== confirm) return redirect("/admin/account?err=mismatch");
    u.passwordHash = await bcrypt.hash(pass, 10);
    u.reset = null;
    logAudit(db, u, "admin.changePassword", u.name);
    save(db);
    return redirect("/admin/account?ok=password");
  }));
  r.post("/admins/add", admin(async (ctx) => {
    const db = ctx.db;
    const email = field(ctx, "email").trim().toLowerCase();
    const role = ROLES[field(ctx, "role")] ? field(ctx, "role") : "moderator";
    if (!email.includes("@")) return redirect("/admin/admins?err=bademail");
    let u = db.users.find((x) => x.email.toLowerCase() === email);
    if (u) { u.isAdmin = true; u.role = role; u.status = "active"; }
    else {
      const name = field(ctx, "name").trim();
      const password = field(ctx, "password");
      if (!name || password.length < 4) return redirect("/admin/admins?err=needdetails");
      u = createUser(db, { name, email, passwordHash: await bcrypt.hash(password, 10), isAdmin: true, status: "active", role });
    }
    logAudit(db, ctx.user, "admin.add", u.name + " <" + u.email + "> as " + role);
    save(db);
    return redirect("/admin/admins?ok=added");
  }));
  r.post("/admins/:id/role", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    const role = ROLES[field(ctx, "role")] ? field(ctx, "role") : null;
    if (!u || !u.isAdmin || !role) return redirect("/admin/admins?err=cantchange");
    if (u.id === ctx.user!.id) return redirect("/admin/admins?err=notself");
    if (ADMIN_EMAIL && u.email.toLowerCase() === ADMIN_EMAIL) return redirect("/admin/admins?err=locked");
    u.role = role;
    logAudit(db, ctx.user, "admin.role", u.name + " → " + role);
    save(db);
    return redirect("/admin/admins?ok=role");
  }));
  r.post("/admins/:id/remove", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (!u || !u.isAdmin) return redirect("/admin/admins?err=cantchange");
    if (u.id === ctx.user!.id) return redirect("/admin/admins?err=notself");
    if (ADMIN_EMAIL && u.email.toLowerCase() === ADMIN_EMAIL) return redirect("/admin/admins?err=locked");
    if (roleOf(u) === "owner" && db.users.filter((x) => x.isAdmin && roleOf(x) === "owner").length <= 1) return redirect("/admin/admins?err=lastowner");
    u.isAdmin = false; u.role = null;
    logAudit(db, ctx.user, "admin.remove", u.name + " <" + u.email + ">");
    save(db);
    return redirect("/admin/admins?ok=removed");
  }));
  r.post("/email/send", admin(sendBroadcast));
  r.post("/apps/publish/:id", admin((ctx) => {
    const db = ctx.db;
    const p = db.settings.plans.find((x) => x.id === ctx.params.id);
    if (p) {
      p.published = !(field(ctx, "current") === "1");
      logAudit(db, ctx.user, "app.publish", p.name + " → " + (p.published ? "published" : "hidden"));
      save(db);
    }
    const back = ["published", "unpublished", "all"].includes(field(ctx, "back")) ? field(ctx, "back") : "all";
    return redirect("/admin/apps?show=" + back);
  }));
  r.post("/apps/generate", admin(generateApps));
}

export function registerAdminTicketActions(r: Router): void {
  r.post("/tickets/:id/reply", admin(ticketReply));
  r.post("/tickets/:id/close", admin((ctx) => {
    const db = ctx.db;
    const ticket = db.tickets.find((t) => t.id === Number(ctx.params.id));
    if (ticket) { ticket.status = "closed"; ticket.updatedAt = Date.now(); logAudit(db, ctx.user, "ticket.close", "#" + ticket.id); save(db); }
    return redirect("/admin/tickets" + (ticket ? "/" + ticket.id : ""));
  }));
}

export function registerAdminDataActions(r: Router): void {
  r.post("/import/users", admin(importUsers));
  r.post("/wipe", admin(wipeAll));
  r.post("/restore", admin(restoreBackup));
  r.post("/apps/add", admin(addApp));
  r.post("/apps/edit/:id", admin(editApp));
  r.post("/apps/delete/:id", admin(deleteApp));
  r.post("/deposit/:id/:action", admin(depositAction));
  r.post("/approve/:id", admin(async (ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (u) {
      u.status = "active"; u.lastAccrual = Date.now();
      maybePayInvite(db, u);
      logAudit(db, ctx.user, "user.approve", u.name + " <" + u.email + ">");
      save(db);
      await approvalMail(u);
    }
    return redirect("/admin/users");
  }));
  r.post("/reject/:id", admin((ctx) => {
    const u = findUser(ctx);
    if (u && !u.isAdmin) { u.status = "rejected"; logAudit(ctx.db, ctx.user, "user.reject", u.name + " <" + u.email + ">"); }
    save(ctx.db);
    return redirect("/admin/users");
  }));
  r.post("/adjust/:id", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (u) {
      accrue(u, db);
      if (field(ctx, "earnings") !== "") u.earnings = Math.max(0, Number(field(ctx, "earnings")));
      for (const p of db.settings.plans) {
        const key = "plan_" + p.id;
        if (ctx.body[key] !== undefined && field(ctx, key) !== "") u.invested[p.id] = Math.max(0, Number(field(ctx, key)));
      }
      addTx(u, "admin_adjust", 0, "Balances changed by admin");
      logAudit(db, ctx.user, "user.adjust", u.name + ": earnings=" + Math.round(u.earnings) + " invested=" + Math.round(totalInvested(u)));
      save(db);
    }
    return redirect("/admin/users/" + ctx.params.id);
  }));
  r.post("/users/:id/earnings", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (!u) return redirect("/admin/users");
    const amount = Math.floor(Number(field(ctx, "amount")));
    if (!amount) return redirect("/admin/users/" + u.id + "?err=earnings");
    const note = field(ctx, "note").trim();
    accrue(u, db);
    u.earnings = Math.max(0, (u.earnings || 0) + amount);
    if (amount > 0) addTx(u, "earnings_credit", amount, note || "Added by admin");
    else addTx(u, "admin_adjust", Math.abs(amount), note || "Earnings removed by admin");
    logAudit(db, ctx.user, "user.earnings", u.name + " " + (amount > 0 ? "+" : "") + amount + (note ? " (" + note + ")" : ""));
    save(db);
    return redirect("/admin/users/" + u.id + "?ok=earnings");
  }));
  r.post("/users/:id/notify", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    const back = field(ctx, "back").startsWith("/") ? field(ctx, "back") : "/admin/users/" + ctx.params.id;
    if (!u) return redirect("/admin/users");
    const text = field(ctx, "message").trim().slice(0, 1000);
    if (!text) return redirect(withQuery(back, "err=empty"));
    pushNotice(u, text);
    notifyMessage(u, text);
    logAudit(db, ctx.user, "user.notify", u.name + ": " + text.slice(0, 60));
    save(db);
    return redirect(withQuery(back, "ok=notified"));
  }));
  r.post("/users/:id/request-verify", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    const back = field(ctx, "back").startsWith("/") ? field(ctx, "back") : "/admin/users/" + ctx.params.id;
    if (!u) return redirect("/admin/users");
    const k = u.kyc;
    k.status = "requested"; k.requestedAt = Date.now(); k.reviewNote = "";
    notifyKyc(u, "requested");
    logAudit(db, ctx.user, "kyc.request", u.name);
    save(db);
    return redirect(withQuery(back, "ok=kyc_req"));
  }));
  r.post("/users/:id/kyc/:action", admin((ctx) => {
    const db = ctx.db;
    const u = findUser(ctx);
    if (!u) return redirect("/admin/users");
    const k = u.kyc;
    if (ctx.params.action === "approve") {
      k.status = "approved"; k.reviewedAt = Date.now(); k.reviewNote = "";
      notifyKyc(u, "approved");
      logAudit(db, ctx.user, "kyc.approve", u.name);
    } else if (ctx.params.action === "reject") {
      k.status = "rejected"; k.reviewedAt = Date.now(); k.reviewNote = field(ctx, "note").trim().slice(0, 300);
      notifyKyc(u, "rejected", k.reviewNote);
      logAudit(db, ctx.user, "kyc.reject", u.name + (k.reviewNote ? " — " + k.reviewNote : ""));
    }
    save(db);
    return redirect("/admin/users/" + u.id + "?ok=kyc");
  }));
  r.post("/toggle-admin/:id", admin((ctx) => {
    const u = findUser(ctx);
    if (u && u.id !== ctx.user!.id) {
      u.isAdmin = !u.isAdmin;
      logAudit(ctx.db, ctx.user, "user.toggleAdmin", u.name + " -> " + (u.isAdmin ? "admin" : "player"));
    }
    save(ctx.db);
    return redirect("/admin/users/" + ctx.params.id);
  }));
  r.post("/delete/:id", admin((ctx) => {
    const id = Number(ctx.params.id);
    if (id !== ctx.user!.id) {
      const gone = deleteUserCascade(ctx.db, id);
      if (gone) logAudit(ctx.db, ctx.user, "user.delete", gone.name + " <" + gone.email + ">");
      save(ctx.db);
    }
    return redirect("/admin/users");
  }));
  r.post("/users/bulk", admin(bulk));
}

export function registerAdminSettingsActions(r: Router): void {
  r.post("/settings/general", admin((ctx) => {
    const db = ctx.db, s = db.settings;
    s.siteName = field(ctx, "siteName").trim() || s.siteName;
    s.currency = field(ctx, "currency").trim() || s.currency;
    logAudit(db, ctx.user, "settings.general", s.siteName + " / " + s.currency);
    save(db);
    return redirect("/admin/settings/general?ok=1");
  }));
  r.post("/settings/logo", admin((ctx) => {
    const db = ctx.db, s = db.settings;
    const uploaded = savedUpload(ctx, "logo", RULES.logo);
    if (field(ctx, "remove") === "1") {
      if (s.logoUrl) deleteUpload(s.logoUrl);
      s.logoUrl = ""; s.brandMode = "text";
    } else {
      if (uploaded) { if (s.logoUrl) deleteUpload(s.logoUrl); s.logoUrl = uploaded; }
      s.brandMode = field(ctx, "brandMode") === "logo" && s.logoUrl ? "logo" : "text";
    }
    logAudit(db, ctx.user, "settings.logo", s.brandMode + (s.logoUrl ? " " + s.logoUrl : ""));
    save(db);
    return redirect("/admin/settings/general?ok=1");
  }));
  r.post("/settings/email-logo", admin((ctx) => {
    const db = ctx.db, s = db.settings;
    const uploaded = savedUpload(ctx, "emailLogo", RULES.logo);
    if (field(ctx, "remove") === "1") {
      if (s.emailLogoUrl) deleteUpload(s.emailLogoUrl);
      s.emailLogoUrl = "";
    } else if (uploaded) {
      if (s.emailLogoUrl) deleteUpload(s.emailLogoUrl);
      s.emailLogoUrl = uploaded;
    }
    logAudit(db, ctx.user, "settings.emailLogo", s.emailLogoUrl || "removed");
    save(db);
    return redirect("/admin/settings/general?ok=1");
  }));
  r.post("/settings/economy", admin(economy));
  r.post("/settings/payments", admin((ctx) => {
    const db = ctx.db;
    db.settings.depositInfo = {
      bankName: field(ctx, "dep_bankName").trim(), accountName: field(ctx, "dep_accountName").trim(),
      rib: field(ctx, "dep_rib").trim(), note: field(ctx, "dep_note").trim(),
    };
    logAudit(db, ctx.user, "settings.payments", "Deposit payment info updated");
    save(db);
    return redirect("/admin/settings/payments?ok=1");
  }));
  r.post("/settings/campaign", admin(campaignSettings));
  r.post("/settings/announcement", admin((ctx) => {
    const db = ctx.db, s = db.settings;
    s.announcement = { text: field(ctx, "ann_text").trim(), enabled: !!field(ctx, "ann_enabled") };
    logAudit(db, ctx.user, "settings.announcement", s.announcement.enabled ? "ON: " + s.announcement.text : "OFF");
    save(db);
    return redirect("/admin/settings/announcement?ok=1");
  }));
}

export function registerAdminTelegramAndWithdrawActions(r: Router): void {
  r.post("/settings/telegram", admin((ctx) => {
    const db = ctx.db;
    db.settings.telegram = telegramFromForm(ctx);
    logAudit(db, ctx.user, "settings.telegram", db.settings.telegram.enabled ? "ON" : "OFF");
    save(db);
    return redirect("/admin/settings/telegram?ok=1");
  }));
  r.post("/settings/telegram/test", admin(async (ctx) => {
    const db = ctx.db;
    db.settings.telegram = telegramFromForm(ctx); // test what's in the form, not a stale value
    save(db);
    const res = await tgSend(tgConfig(db), `✅ <b>${escapeHtml(db.settings.siteName || "KanzUp")}</b>\n${ctx.t("tg_test_msg")}`);
    return redirect("/admin/settings/telegram?test=" + (res.ok ? "ok" : "fail"));
  }));
  // Schedules first, so "schedule"/"unschedule" aren't taken by the generic /:action route.
  r.post("/withdraw/:id/schedule", admin((ctx) => {
    const db = ctx.db;
    const w = db.withdrawals.find((x) => x.id === Number(ctx.params.id));
    const action = ["approve", "reject"].includes(field(ctx, "action")) ? (field(ctx, "action") as "approve" | "reject") : null;
    const at = parseWhenTime(field(ctx, "at"));
    if (w && w.status === "pending" && action && at) {
      w.scheduled = {
        action, at,
        reason: action === "reject" ? (WITHDRAW_REJECT_REASONS.includes(field(ctx, "reason")) ? field(ctx, "reason") : "") : "",
        reasonNote: action === "reject" ? field(ctx, "reasonNote").trim().slice(0, 300) : "",
        byName: ctx.user!.name,
      };
      logAudit(db, ctx.user, "withdraw.schedule", "#" + w.id + " " + action + " @ " + new Date(at).toLocaleString());
      save(db);
    }
    return redirect("/admin/withdrawals");
  }));
  r.post("/withdraw/:id/unschedule", admin((ctx) => {
    const db = ctx.db;
    const w = db.withdrawals.find((x) => x.id === Number(ctx.params.id));
    if (w && w.scheduled) { w.scheduled = null; logAudit(db, ctx.user, "withdraw.unschedule", "#" + w.id); save(db); }
    return redirect("/admin/withdrawals");
  }));
  r.post("/withdraw/:id/:action", admin((ctx) => {
    const db = ctx.db;
    const w = db.withdrawals.find((x) => x.id === Number(ctx.params.id));
    if (applyWithdrawAction(db, w, ctx.params.action, { reason: field(ctx, "reason"), reasonNote: field(ctx, "reasonNote") }, ctx.user!)) save(db);
    return redirect("/admin/withdrawals");
  }));
}
