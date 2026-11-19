// Player form posts and the remaining player pages, ported in the Express order.
import bcrypt from "bcryptjs";
import { APP_URL, DAY } from "@/lib/config";
import { DEPOSIT_EXPIRY_MS } from "@/lib/constants";
import { save } from "@/lib/db";
import { renderEmail, sendMail } from "@/lib/email";
import {
  accrue, addTx, addXp, award, campaignStatus, checkState, hasApprovedDeposit, levelForXp, lockedInApp, withdrawableInApp,
} from "@/lib/game";
import { isLang } from "@/lib/locales";
import { emFmt, langFor, mailUser, pushNotice, tgNotify, userT } from "@/lib/notify";
import { payoutAccount, payoutMissing, readPayout } from "@/lib/payout";
import { dayStr, escapeHtml } from "@/lib/text";
import { RULES, deleteUpload, saveUpload } from "@/lib/uploads";
import type { TicketMessage } from "@/lib/types";
import { field, firstFile, json, redirect, render, type Ctx, type Result } from "../ctx";
import { authLimiter, guard, requireActive } from "../guards";
import { publicUser } from "../page-props";
import type { Router } from "../router";
import { active, leaderboard, notFound, referral, supportList, supportNew, supportTicket, topicOk } from "./player-pages";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@kanzup.com";

/** A ticket attachment saved like multer's uploadTicket (errors ignored, as before). */
function ticketAttachment(ctx: Ctx): Partial<TicketMessage> {
  const saved = saveUpload(firstFile(ctx, "file"), RULES.ticket);
  return saved.kind === "saved" ? { file: saved.url, fileName: saved.originalName, fileType: saved.mimeType } : {};
}

async function supportCreate(ctx: Ctx): Promise<Result> {
  const db = ctx.db, u = ctx.user!;
  const topic = topicOk(field(ctx, "topic")) ? field(ctx, "topic") : "other";
  const subject = field(ctx, "subject").trim().slice(0, 140) || ctx.t("sup_t_" + topic);
  const message = field(ctx, "message").trim().slice(0, 4000);
  const attach = ticketAttachment(ctx);
  if (!message && !attach.file) return redirect("/support/new?topic=" + topic);
  const now = Date.now();
  const ticket = {
    id: db.nextTicketId++, userId: u.id, userName: u.name, email: u.email,
    topic, subject, status: "open" as const,
    messages: [{ from: "user" as const, authorName: u.name, text: message, at: now, ...attach }],
    createdAt: now, updatedAt: now,
  };
  db.tickets.push(ticket);
  save(db);
  await sendMail(CONTACT_EMAIL, `[Ticket #${ticket.id}] ${subject}`,
    renderEmail({ siteName: db.settings.siteName, appUrl: APP_URL, heading: "New support ticket",
      lines: [`#${ticket.id} · ${u.name} <${u.email}>`, ctx.t("sup_t_" + topic), "", message] }),
    { replyTo: `${u.name} <${u.email}>` });
  tgNotify(db, `🎫 New ticket #${ticket.id}: ${escapeHtml(subject)} — ${escapeHtml(u.name)}`);
  return redirect("/support/" + ticket.id);
}

function supportReply(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!;
  const ticket = db.tickets.find((t) => t.id === Number(ctx.params.id) && t.userId === u.id);
  if (!ticket) return notFound(ctx);
  const text = field(ctx, "message").trim().slice(0, 4000);
  const attach = ticketAttachment(ctx);
  if ((text || attach.file) && ticket.status !== "closed") {
    ticket.messages.push({ from: "user", authorName: u.name, text, at: Date.now(), ...attach });
    ticket.status = "open"; ticket.updatedAt = Date.now();
    save(db);
  }
  return redirect("/support/" + ticket.id);
}

function campaignClaim(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!;
  const back = field(ctx, "redirect") === "home" ? "/dashboard" : "/referral";
  const st = campaignStatus(db, u);
  if (!st.canClaim) return redirect(back + "?err=campaign");
  u.earnings += st.rewardCoins;
  addXp(u, st.rewardXp);
  u.campaignClaims = (u.campaignClaims || 0) + 1;
  addTx(u, "campaign_reward", st.rewardCoins, "Invited " + st.goal + " players (+" + st.rewardXp + " XP)");
  checkState(u);
  save(db);
  ctx.session.gaEvent = { name: "challenge_reward", params: { value: st.rewardCoins } };
  return redirect(back + "?ok=campaign&amt=" + st.rewardCoins);
}

const profilePage = (ctx: Ctx, extra: Record<string, unknown> = {}): Result =>
  render("profile", { user: publicUser(ctx.user!), error: null, ok: ctx.query.ok || null, err: ctx.query.err || null, ...extra }, { title: ctx.t("profile_title") });

function profileSave(ctx: Ctx): Result {
  const u = ctx.user!;
  const saved = saveUpload(firstFile(ctx, "photo"), RULES.avatar(u.id));
  if (saved.kind === "too-big") return profilePage(ctx, { ok: null, error: ctx.t("photo_too_big") });
  // multer drops non-images silently — tell the user.
  if (field(ctx, "hasPhoto") === "1" && saved.kind !== "saved") return profilePage(ctx, { ok: null, error: ctx.t("photo_bad_type") });
  const name = field(ctx, "name").trim();
  if (name) u.name = name;
  if (saved.kind === "saved") {
    deleteUpload(u.avatar);
    u.avatar = saved.url;
  } else if (field(ctx, "removePhoto") === "1") {
    deleteUpload(u.avatar);
    u.avatar = "";
  }
  save(ctx.db);
  return redirect("/profile?ok=saved");
}

async function profilePassword(ctx: Ctx): Promise<Result> {
  const u = ctx.user!;
  const current = field(ctx, "current"), newPass = field(ctx, "next"), confirm = field(ctx, "confirm");
  if (!(await bcrypt.compare(current, u.passwordHash))) return redirect("/profile?err=wrongpass");
  if (newPass.length < 6) return redirect("/profile?err=short");
  if (newPass !== confirm) return redirect("/profile?err=mismatch");
  u.passwordHash = await bcrypt.hash(newPass, 10);
  u.reset = null;
  save(ctx.db);
  return redirect("/profile?ok=password");
}

async function profileEmail(ctx: Ctx): Promise<Result> {
  const db = ctx.db, u = ctx.user!;
  const current = field(ctx, "current"), email = field(ctx, "email").trim().toLowerCase();
  if (!(await bcrypt.compare(current, u.passwordHash))) return redirect("/profile?err=wrongpass");
  if (!email.includes("@")) return redirect("/profile?err=bademail");
  if (db.users.find((x) => x.id !== u.id && x.email.toLowerCase() === email)) return redirect("/profile?err=dupemail");
  u.email = email;
  save(db);
  return redirect("/profile?ok=email");
}

function profilePrefs(ctx: Ctx): Result {
  const u = ctx.user!;
  const lang = field(ctx, "lang");
  if (isLang(lang)) { u.lang = lang; ctx.session.lang = lang; }
  u.emailOptOut = field(ctx, "emails") !== "1";
  save(ctx.db);
  return redirect("/profile?ok=prefs");
}

// A deposit is a REQUEST — coins are only credited when the admin approves it.
function addFunds(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!, s = db.settings;
  const plan = s.plans.find((p) => p.id === field(ctx, "plan"));
  if (!plan || plan.published === false) return redirect("/invest?err=plan");
  const amount = plan.fixedAmount > 0 ? plan.fixedAmount : Math.floor(Number(field(ctx, "amount")));
  if (!amount || (plan.fixedAmount <= 0 && amount < s.minAddFunds)) return redirect("/invest?err=amount");
  if (levelForXp(u.xp) < (plan.minLevel || 1)) return redirect("/invest?err=locked");
  const now = Date.now();
  db.deposits.push({
    id: db.nextDepositId++, userId: u.id, userName: u.name, plan: plan.id, planLabel: plan.name,
    amount, status: "pending", createdAt: now, expiresAt: now + DEPOSIT_EXPIRY_MS,
  });
  addTx(u, "deposit_request", amount, plan.name);
  const tr = userT(u), lg = langFor(u);
  pushNotice(u, tr("notice_dep_pending", { amount: emFmt(amount, lg) }));
  void mailUser(u, {
    subject: tr("mail_deppend_subj"), heading: tr("mail_deppend_h"),
    lines: [tr("mail_deppend_b", { amount: emFmt(amount, lg) })],
    cta: { text: tr("notice_cta"), url: `${APP_URL}/invest` },
  });
  save(db);
  tgNotify(db, `💰 Deposit request: ${escapeHtml(u.name)} — ${emFmt(amount, "en")} → ${escapeHtml(plan.name)}`);
  ctx.session.gaEvent = { name: "deposit_request", params: { value: amount, currency: "MAD", plan: plan.id } };
  return redirect("/invest?ok=deprequested");
}

// Move unlocked funds between plans (they stay invested, earning the new rate).
function moveFunds(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!, s = db.settings;
  const from = s.plans.find((p) => p.id === field(ctx, "from"));
  const to = s.plans.find((p) => p.id === field(ctx, "to"));
  if (!from || !to || from.id === to.id || to.published === false) return redirect("/invest?err=move");
  const amount = Math.floor(Number(field(ctx, "amount")));
  if (!amount || amount <= 0) return redirect("/invest?err=amount");
  if (levelForXp(u.xp) < (to.minLevel || 1)) return redirect("/invest?err=locked");
  accrue(u, db);
  const available = withdrawableInApp(db, u, from.id);
  if (amount > available) return redirect("/invest?err=" + (lockedInApp(db, u, from.id) > 0 ? "wlocked" : "insufficient"));
  u.invested[from.id] = (u.invested[from.id] || 0) - amount;
  u.invested[to.id] = (u.invested[to.id] || 0) + amount;
  addTx(u, "move_funds", amount, from.name + " → " + to.name);
  save(db);
  return redirect("/invest?ok=moved");
}

function withdraw(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!, s = db.settings;
  accrue(u, db);
  if (!hasApprovedDeposit(db, u)) return redirect("/withdraw?err=needdeposit");
  const amount = Math.floor(Number(field(ctx, "amount")));
  const from = field(ctx, "from");
  const payout = u.payout;
  if (!amount || amount < s.minWithdraw) return redirect("/withdraw?err=wamount");
  if (payoutMissing(payout)) return redirect("/withdraw?err=payout");
  const lastW = db.withdrawals.filter((w) => w.userId === u.id && w.status !== "rejected").sort((a, b) => b.createdAt - a.createdAt)[0];
  if (lastW && (Date.now() - lastW.createdAt) / DAY < s.withdrawEveryDays) return redirect("/withdraw?err=cadence");
  let available: number, label: string;
  if (from === "earnings") { available = u.earnings; label = "Earnings"; }
  else {
    const plan = s.plans.find((p) => p.id === from);
    if (!plan) return redirect("/withdraw?err=wamount");
    available = withdrawableInApp(db, u, plan.id); label = plan.name;
    if (amount > available && lockedInApp(db, u, plan.id) > 0) return redirect("/withdraw?err=wlocked");
  }
  if (amount > available) return redirect("/withdraw?err=insufficient");
  if (from === "earnings") u.earnings -= amount;
  else u.invested[from] -= amount;
  db.withdrawals.push({
    id: db.nextWithdrawId++, userId: u.id, userName: u.name, amount, from, fromLabel: label,
    method: payout.method, payoutName: payout.name, payoutAccount: payoutAccount(payout),
    status: "pending", createdAt: Date.now(),
  });
  addTx(u, "withdraw_request", amount, `From ${label}`);
  award(u, "first_withdraw");
  save(db);
  tgNotify(db, `🏧 Withdrawal request: ${escapeHtml(u.name)} — ${emFmt(amount, "en")} (from ${escapeHtml(label)})`);
  ctx.session.gaEvent = { name: "withdraw_request", params: { value: amount, currency: "MAD" } };
  return redirect("/withdraw?ok=withdraw");
}

function verifyIdentitySubmit(ctx: Ctx): Result {
  const u = ctx.user!;
  const front = saveUpload(firstFile(ctx, "cinFront"), RULES.cin);
  const back = saveUpload(firstFile(ctx, "cinBack"), RULES.cin);
  if (front.kind === "too-big" || back.kind === "too-big") return redirect("/verify-identity?err=big");
  const k = u.kyc;
  if (k.status === "approved") return redirect("/verify-identity?ok=already");
  const fullName = field(ctx, "fullName").trim().slice(0, 120);
  const dob = field(ctx, "dob").trim().slice(0, 20);
  const address = field(ctx, "address").trim().slice(0, 300);
  const newFront = front.kind === "saved" ? front.url : "";
  const newBack = back.kind === "saved" ? back.url : "";
  const cinFront = newFront || k.cinFront;
  const cinBack = newBack || k.cinBack;
  if (!fullName || !dob || !address || !cinFront || !cinBack) return redirect("/verify-identity?err=fill");
  if (newFront && k.cinFront && k.cinFront !== newFront) deleteUpload(k.cinFront);
  if (newBack && k.cinBack && k.cinBack !== newBack) deleteUpload(k.cinBack);
  Object.assign(k, { fullName, dob, address, cinFront, cinBack, status: "submitted", submittedAt: Date.now(), reviewNote: "" });
  save(ctx.db);
  tgNotify(ctx.db, `🪪 ID verification submitted: ${escapeHtml(u.name)}`);
  return redirect("/verify-identity?ok=submitted");
}

function dailyBonus(ctx: Ctx): Result {
  const db = ctx.db;
  if (!db.settings.dailyBonusEnabled) return redirect("/dashboard");
  const u = ctx.user!;
  const back = field(ctx, "redirect") === "home" ? "/dashboard" : "/rewards";
  if (!hasApprovedDeposit(db, u)) return redirect(back + "?err=needdeposit");
  const today = dayStr(Date.now());
  u.streak = u.streak || { count: 0, lastClaim: null };
  if (u.streak.lastClaim === today) return redirect(back + "?err=claimed");
  u.streak.count = u.streak.lastClaim === dayStr(Date.now() - DAY) ? u.streak.count + 1 : 1;
  u.streak.lastClaim = today;
  const bonus = db.settings.dailyBonusBase * Math.min(u.streak.count, 7);
  u.earnings += bonus;
  addXp(u, 10);
  addTx(u, "daily_bonus", bonus, `Day ${u.streak.count} streak`);
  checkState(u);
  save(db);
  ctx.session.gaEvent = { name: "daily_bonus", params: { value: bonus, streak: u.streak.count } };
  return redirect(back + "?ok=bonus&amt=" + bonus);
}

function transfer(ctx: Ctx): Result {
  const db = ctx.db, u = ctx.user!, s = db.settings;
  accrue(u, db);
  const amount = Math.floor(Number(field(ctx, "amount")));
  const to = field(ctx, "to").trim();
  if (!amount || amount < s.minTransfer) return redirect("/send?err=tamount");
  const recipient = db.users.find((x) =>
    x.id !== u.id && x.status === "active" && (x.email.toLowerCase() === to.toLowerCase() || x.referralCode === to.toUpperCase()));
  if (!recipient) return redirect("/send?err=recipient");
  if (amount > u.earnings) return redirect("/send?err=insufficient");
  accrue(recipient, db);
  u.earnings -= amount;
  recipient.earnings += amount;
  const tid = db.nextTransferId++;
  db.transfers.push({ id: tid, fromId: u.id, fromName: u.name, toId: recipient.id, toName: recipient.name, amount, createdAt: Date.now() });
  addTx(u, "transfer_out", amount, `To ${recipient.name}`);
  addTx(recipient, "transfer_in", amount, `From ${u.name}`);
  u.transactions[u.transactions.length - 1].ref = tid;
  recipient.transactions[recipient.transactions.length - 1].ref = tid;
  addXp(u, 5);
  award(u, "generous");
  checkState(recipient);
  save(db);
  ctx.session.gaEvent = { name: "coins_sent", params: {} };
  return redirect("/send?ok=sent");
}

export function registerPlayerActions(r: Router): void {
  r.post("/dismiss-getting-started", active((ctx) => { ctx.user!.gsDismissed = true; save(ctx.db); return redirect("/dashboard"); }));
  r.post("/onboarded", active((ctx) => { ctx.user!.onboarded = true; save(ctx.db); return json({ ok: true }); }));

  // Support: the static "/support/new" must come before "/support/:id".
  r.get("/support", active(supportList));
  r.get("/support/new", active(supportNew));
  r.post("/support/new", (ctx) => guard(ctx, requireActive, authLimiter) || supportCreate(ctx));
  r.get("/support/:id", active(supportTicket));
  r.post("/support/:id/reply", active(supportReply));

  r.get("/referral", active(referral));
  r.post("/campaign/claim", active(campaignClaim));

  r.get("/profile", active((ctx) => profilePage(ctx)));
  r.post("/profile", active(profileSave));
  r.post("/profile/payout", active((ctx) => {
    ctx.user!.payout = readPayout({ method: field(ctx, "method"), payoutName: field(ctx, "payoutName"), paypal: field(ctx, "paypal"), rib: field(ctx, "rib") });
    save(ctx.db);
    return redirect("/profile?ok=payout");
  }));
  r.post("/profile/password", active(profilePassword));
  r.post("/profile/email", active(profileEmail));
  r.post("/profile/prefs", active(profilePrefs));
}

/** Registered after the password-reset/unsubscribe routes, as in server.js. */
export function registerMoneyActions(r: Router): void {
  r.post("/add-funds", active(addFunds));
  r.post("/move-funds", active(moveFunds));
  r.post("/withdraw", active(withdraw));
  r.get("/verify-identity", active((ctx) => render("verify-identity", {
    kyc: ctx.user!.kyc || { status: "none" }, userName: ctx.user!.name, ok: ctx.query.ok || "", err: ctx.query.err || "",
  }, { title: ctx.t("kyc_title") })));
  r.post("/verify-identity", active(verifyIdentitySubmit));
  r.post("/notices/:id/read", active((ctx) => {
    const n = (ctx.user!.notices || []).find((x) => x.id === Number(ctx.params.id));
    if (n && !n.read) { n.read = true; save(ctx.db); }
    return redirect("/dashboard");
  }));
  r.post("/daily-bonus", active(dailyBonus));
  r.post("/transfer", active(transfer));
  r.get("/leaderboard", active(leaderboard));
}
