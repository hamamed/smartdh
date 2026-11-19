// Sign up, log in/out, email verification, password reset, unsubscribe — ported from
// the Express app's "Auth" section with the same responses.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL, APP_URL } from "@/lib/config";
import { save } from "@/lib/db";
import { award, createUser } from "@/lib/game";
import { mailUser, tgNotify } from "@/lib/notify";
import { escapeHtml } from "@/lib/text";
import { field, redirect, render, type Ctx, type Result } from "../ctx";
import { authLimiter, guard, requireLogin } from "../guards";
import type { Router } from "../router";

const loginPage = (ctx: Ctx, data: Record<string, unknown>): Result =>
  render("login", { error: null, form: {}, ...data }, { title: ctx.t("login_title") });
const signupPage = (ctx: Ctx, error: string | null, form: Record<string, string>): Result =>
  render("signup", { error, form, now: Date.now() }, { title: ctx.t("signup_title") });

function badLink(ctx: Ctx, titleKey: string, bodyKey: string): Result {
  return render("error", { code: 400, heading: ctx.t(titleKey), mBody: ctx.t(bodyKey) }, { status: 400, title: ctx.t(titleKey) });
}

function unsubBad(ctx: Ctx): Result {
  return render("message", { heading: ctx.t("unsub_bad_t"), mBody: ctx.t("unsub_bad_d"), mIcon: "mail-x", mTint: "ti-coral" }, { status: 404, title: ctx.t("unsub_bad_t") });
}

async function signup(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const name = field(ctx, "name"), email = field(ctx, "email"), password = field(ctx, "password");
  const agree = field(ctx, "agree"), ref = field(ctx, "ref");
  const form = { name, email, ref };
  // Bot traps: a honeypot only bots fill, and a minimum time-to-submit. Pretend it worked.
  const tooFast = Date.now() - Number(field(ctx, "_t") || 0) < 2000;
  if (field(ctx, "website").trim() || tooFast) {
    return render("message", {
      heading: ctx.t("msg_verify_h"), mBody: ctx.t("msg_verify_b", { email: email.trim() }), mIcon: "mail-check", mTint: "ti-mint",
    }, { title: ctx.t("msg_verify_h") });
  }
  if (!name || !email || !password) return signupPage(ctx, ctx.t("err_fill"), form);
  if (!agree) return signupPage(ctx, ctx.t("err_agree"), form);
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) return signupPage(ctx, ctx.t("err_email_taken"), form);

  const referrer = ref ? db.users.find((u) => u.referralCode === ref.trim().toUpperCase()) : null;
  const hash = await bcrypt.hash(password, 10);
  // With ADMIN_EMAIL set, only that address gets admin; otherwise the first account wins.
  const isFirstUser = ADMIN_EMAIL ? email.trim().toLowerCase() === ADMIN_EMAIL : db.users.length === 0;
  const user = createUser(db, {
    name, email, passwordHash: hash, isAdmin: isFirstUser,
    status: isFirstUser ? "active" : "pending",
    referredBy: referrer ? referrer.id : null,
    lang: ctx.lang,
  });
  if (referrer) award(referrer, "recruiter");
  save(db);

  if (isFirstUser) { ctx.session.userId = user.id; return redirect("/admin"); }

  ctx.locals.gaEvent = { name: "sign_up", params: { referred: !!referrer } };
  tgNotify(db, `🆕 New signup: ${escapeHtml(user.name)} &lt;${escapeHtml(user.email)}&gt;${referrer ? " (ref: " + escapeHtml(referrer.name) + ")" : ""}`);

  // The account stays unverified until the emailed link is clicked; with SMTP off we
  // can't deliver it, so auto-verify rather than lock the player out.
  const verifyToken = crypto.randomBytes(24).toString("hex");
  user.emailVerified = false;
  user.verifyToken = verifyToken;
  save(db);
  const sent = await mailUser(user, {
    lang: ctx.lang,
    subject: ctx.t("mail_verify_subj"), heading: ctx.t("mail_verify_h"),
    lines: [ctx.t("mail_verify_b")],
    cta: { text: ctx.t("mail_verify_btn"), url: `${APP_URL}/verify/${verifyToken}` },
  }) as { disabled?: boolean };
  if (sent && sent.disabled) {
    user.emailVerified = true; user.verifyToken = null; save(db);
    return render("message", {
      heading: ctx.t("msg_created_h"), mBody: ctx.t("msg_created_b"), mIcon: "mail-check", mTint: "ti-mint", mPending: true,
    }, { title: ctx.t("msg_created_h") });
  }
  return render("message", {
    heading: ctx.t("msg_verify_h"), mBody: ctx.t("msg_verify_b", { email: user.email }), mIcon: "mail-check", mTint: "ti-mint",
  }, { title: ctx.t("msg_verify_h") });
}

async function login(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const email = field(ctx, "email"), password = field(ctx, "password");
  const user = db.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return loginPage(ctx, { error: ctx.t("err_wrong"), form: { email } });
  }
  if (!user.emailVerified) return loginPage(ctx, { error: ctx.t("login_verify"), form: { email }, unverified: user.email });
  ctx.session.userId = user.id;
  const nowLogin = Date.now();
  user.lastLogin = nowLogin;
  user.logins = user.logins || [];
  user.logins.push({ at: nowLogin, ip: ctx.ip || "" });
  if (user.logins.length > 30) user.logins = user.logins.slice(-30);
  save(db);
  ctx.session.gaEvent = { name: "login", params: { role: user.isAdmin ? "admin" : "player" } };
  if (user.isAdmin) return redirect("/admin");
  const dest = user.status !== "active" ? "/pending" : "/dashboard";
  return redirect(ctx.adminHost ? APP_URL + dest : dest);
}

async function resendVerification(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const email = field(ctx, "email").trim().toLowerCase();
  const u = db.users.find((x) => x.email.toLowerCase() === email);
  if (u && !u.emailVerified) {
    if (!u.verifyToken) u.verifyToken = crypto.randomBytes(24).toString("hex");
    save(db);
    await mailUser(u, {
      lang: ctx.lang,
      subject: ctx.t("mail_verify_subj"), heading: ctx.t("mail_verify_h"),
      lines: [ctx.t("mail_verify_b")],
      cta: { text: ctx.t("mail_verify_btn"), url: `${APP_URL}/verify/${u.verifyToken}` },
    });
  }
  // Always the same response, so this can't be used to probe which emails exist.
  return loginPage(ctx, { notice: ctx.t("verify_resent"), form: { email } });
}

async function forgot(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const email = field(ctx, "email").trim().toLowerCase();
  const u = db.users.find((x) => x.email.toLowerCase() === email);
  if (u) {
    const token = crypto.randomBytes(32).toString("hex");
    // A 6-digit code is emailed with the link and required on the reset page.
    const code = String(crypto.randomInt(100000, 1000000));
    u.reset = { token, code, expires: Date.now() + 60 * 60 * 1000 };
    save(db);
    await mailUser(u, {
      lang: ctx.lang,
      subject: ctx.t("mail_reset_subject"), heading: ctx.t("mail_reset_subject"),
      lines: [ctx.t("mail_reset_body"), ctx.t("mail_reset_code", { code }), ctx.t("mail_reset_expire")],
      cta: { text: ctx.t("reset_save"), url: `${APP_URL}/reset/${token}` },
    });
  }
  return render("forgot", { sent: true }, { title: ctx.t("forgot_title") });
}

const findReset = (ctx: Ctx) =>
  ctx.db.users.find((x) => x.reset && x.reset.token === ctx.params.token && x.reset.expires > Date.now());

async function resetPassword(ctx: Ctx): Promise<Result> {
  const u = findReset(ctx);
  if (!u || !u.reset) return badLink(ctx, "reset_bad_t", "reset_bad_d");
  const fail = (msg: string) => render("reset", { token: ctx.params.token, error: msg }, { title: ctx.t("reset_title") });
  const code = field(ctx, "code").trim();
  const pass = field(ctx, "password");
  const confirm = field(ctx, "confirm");
  if (!u.reset.code || code !== u.reset.code) return fail(ctx.t("reset_code_bad"));
  if (pass.length < 6) return fail(ctx.t("pw_too_short"));
  if (pass !== confirm) return fail(ctx.t("pw_mismatch"));
  u.passwordHash = await bcrypt.hash(pass, 10);
  u.reset = null;
  save(ctx.db);
  return render("message", { heading: ctx.t("reset_done_t"), mBody: ctx.t("reset_done_d") }, { title: ctx.t("reset_done_t") });
}

export function registerAuthRoutes(r: Router): void {
  r.get("/signup", (ctx) => {
    if (ctx.user) return redirect("/dashboard");
    return signupPage(ctx, null, { ref: ctx.query.ref || "" });
  });
  r.post("/signup", (ctx) => guard(ctx, authLimiter) || signup(ctx));

  r.get("/login", (ctx) => (ctx.user ? redirect("/dashboard") : loginPage(ctx, {})));

  r.get("/verify/:token", (ctx) => {
    const u = ctx.db.users.find((x) => x.verifyToken && x.verifyToken === ctx.params.token);
    if (!u) return badLink(ctx, "verify_bad_t", "verify_bad_d");
    u.emailVerified = true;
    u.verifyToken = null;
    save(ctx.db);
    ctx.locals.gaEvent = { name: "email_verified", params: {} };
    return render("message", {
      heading: ctx.t("verify_done_h"), mBody: ctx.t("verify_done_b"), mIcon: "mail-check", mTint: "ti-mint", mPending: true,
    }, { title: ctx.t("verify_done_h") });
  });

  r.post("/resend-verification", (ctx) => guard(ctx, authLimiter) || resendVerification(ctx));
  r.post("/login", (ctx) => guard(ctx, authLimiter) || login(ctx));

  r.post("/logout", (ctx) => {
    ctx.destroySession = true;
    return redirect("/");
  });

  r.get("/pending", (ctx) => {
    const g = guard(ctx, requireLogin);
    if (g) return g;
    if (ctx.user!.status === "active") return redirect("/dashboard");
    return render("pending", {}, { title: ctx.t("pending_title") });
  });
}

/** Routes that sit later in the Express file (after the player pages). */
export function registerAccountRecoveryRoutes(r: Router): void {
  r.get("/forgot", (ctx) => (ctx.user ? redirect("/dashboard") : render("forgot", { sent: false }, { title: ctx.t("forgot_title") })));
  r.post("/forgot", (ctx) => guard(ctx, authLimiter) || forgot(ctx));

  r.get("/reset/:token", (ctx) => {
    if (!findReset(ctx)) return badLink(ctx, "reset_bad_t", "reset_bad_d");
    return render("reset", { token: ctx.params.token, error: null }, { title: ctx.t("reset_title") });
  });
  r.post("/reset/:token", (ctx) => guard(ctx, authLimiter) || resetPassword(ctx));

  // One-click link from every email footer (idempotent: mail clients prefetch).
  r.get("/unsubscribe/:token", (ctx) => {
    const u = ctx.db.users.find((x) => x.emailToken === ctx.params.token);
    if (!u) return unsubBad(ctx);
    if (!u.emailOptOut) { u.emailOptOut = true; save(ctx.db); }
    return render("message", {
      heading: ctx.t("unsub_ok_t"), mBody: ctx.t("unsub_ok_d", { email: u.email }), mIcon: "mail-x", mTint: "ti-yellow",
      mAction: { url: "/resubscribe/" + u.emailToken, text: ctx.t("unsub_resub"), icon: "mail-check" },
    }, { title: ctx.t("unsub_ok_t") });
  });

  r.get("/resubscribe/:token", (ctx) => {
    const u = ctx.db.users.find((x) => x.emailToken === ctx.params.token);
    if (!u) return unsubBad(ctx);
    if (u.emailOptOut) { u.emailOptOut = false; save(ctx.db); }
    return render("message", {
      heading: ctx.t("resub_ok_t"), mBody: ctx.t("resub_ok_d", { email: u.email }), mIcon: "mail-check", mTint: "ti-mint",
    }, { title: ctx.t("resub_ok_t") });
  });
}
