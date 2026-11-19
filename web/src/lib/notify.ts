// Emails, Telegram alerts and dashboard notices — ported from the Express app.
// All sends are fire-and-forget, exactly as before: they never block a request.
import { APP_URL } from "./config";
import { load } from "./db";
import { renderEmail, sendMail } from "./email";
import { DEFAULT_LANG, isLang, locales, t, type Lang, type Translator } from "./locales";
import { currencyLabel, escapeHtml, formatMoney, rejectReasonText } from "./text";
import type { Db, User, Withdrawal } from "./types";

// The language an email is written in: explicit override, then the account's saved
// preference, then the default.
export function langFor(user: User | null | undefined, override?: string | null): Lang {
  if (isLang(override)) return override;
  if (user && isLang(user.lang)) return user.lang;
  return DEFAULT_LANG;
}

export function userT(user: User | null | undefined, override?: string | null): Translator {
  const l = langFor(user, override);
  return (k, v) => t(l, k, v);
}

export interface MailOptions {
  subject: string; heading?: string; intro?: string; lines?: string[]; bodyHtml?: string;
  cta?: { text?: string; url: string } | null; broadcast?: boolean; lang?: string | null;
}

// `broadcast: true` marks a non-essential message and is skipped for opted-out users;
// account/security mails leave it false so they always go out.
export function mailUser(user: User | null | undefined, o: MailOptions): Promise<{ skipped?: boolean; optOut?: boolean; ok?: boolean }> {
  if (!user || !user.email) return Promise.resolve({ skipped: true });
  if (o.broadcast && user.emailOptOut) return Promise.resolve({ skipped: true, optOut: true });
  const uLang = langFor(user, o.lang);
  const tr: Translator = (k, v) => t(uLang, k, v);
  const settings = load().settings;
  const html = renderEmail({
    siteName: settings.siteName,
    appUrl: APP_URL,
    logoUrl: settings.emailLogoUrl ? APP_URL + settings.emailLogoUrl : "",
    unsubscribeUrl: `${APP_URL}/unsubscribe/${user.emailToken}`,
    heading: o.heading,
    intro: o.intro != null ? o.intro : tr("mail_hi", { name: user.name }),
    lines: o.lines, bodyHtml: o.bodyHtml, cta: o.cta,
    dir: (locales[uLang] && locales[uLang].dir) || "ltr",
    labels: {
      tagline: tr("email_tagline"),
      unsubscribe: tr("email_unsub"),
      visit: tr("email_visit", { site: settings.siteName }),
    },
  });
  return sendMail(user.email, o.subject, html);
}

export function emFmt(n: number, lang: string): string {
  return formatMoney(n, currencyLabel(load().settings, lang));
}

export function notifyLevelUp(user: User, level: number): void {
  const tr = userT(user);
  void mailUser(user, {
    subject: tr("mail_lvl_subj", { level }),
    heading: tr("mail_lvl_h", { level }),
    lines: [tr("mail_lvl_b", { level })],
    cta: { text: tr("email_visit"), url: `${APP_URL}/dashboard` },
  });
}

export function notifyDeposit(user: User, amount: number, planLabel: string, approved: boolean): void {
  const tr = userT(user), lg = langFor(user);
  void mailUser(user, {
    subject: approved ? tr("mail_dep_ok_subj") : tr("mail_dep_no_subj"),
    heading: approved ? tr("mail_dep_ok_h") : tr("mail_dep_no_h"),
    lines: [tr(approved ? "mail_dep_ok_b" : "mail_dep_no_b", { amount: emFmt(amount, lg), app: planLabel })],
    cta: { text: tr("mail_view_account"), url: `${APP_URL}/dashboard` },
  });
}

export function notifyWithdrawal(user: User, w: Withdrawal, status: "paid" | "rejected"): void {
  const tr = userT(user), lg = langFor(user);
  const lines = [tr(status === "paid" ? "mail_wd_ok_b" : "mail_wd_no_b", { amount: emFmt(w.amount, lg) })];
  if (status === "rejected") {
    const reason = rejectReasonText(tr, w);
    if (reason) lines.push(tr("mail_wd_no_reason", { reason }));
  }
  void mailUser(user, {
    subject: status === "paid" ? tr("mail_wd_ok_subj") : tr("mail_wd_no_subj"),
    heading: status === "paid" ? tr("mail_wd_ok_h") : tr("mail_wd_no_h"),
    lines,
    cta: { text: tr("email_visit"), url: `${APP_URL}/dashboard` },
  });
}

// Identity-verification (KYC) emails: requested / approved / rejected.
export function notifyKyc(user: User, status: "requested" | "approved" | "rejected", note?: string): void {
  const tr = userT(user);
  const lines = [tr("mail_kyc_" + status + "_b")];
  if (status === "rejected" && note) lines.push(tr("mail_wd_no_reason", { reason: note }));
  void mailUser(user, {
    subject: tr("mail_kyc_" + status + "_subj"),
    heading: tr("mail_kyc_" + status + "_h"),
    lines,
    cta: { text: status === "approved" ? tr("email_visit") : tr("mail_kyc_cta"), url: `${APP_URL}/verify-identity` },
  });
}

// A personal message an admin sends to one player (emailed; also shown on the dashboard).
export function notifyMessage(user: User, text: string): void {
  const tr = userT(user);
  void mailUser(user, {
    subject: tr("mail_msg_subj"),
    heading: tr("mail_msg_h"),
    lines: [text],
    cta: { text: tr("mail_msg_cta"), url: `${APP_URL}/invest` },
  });
}

// Add a dismissible dashboard notice to a player (capped to the last 20).
export function pushNotice(user: User, text: string): number {
  user.notices = user.notices || [];
  const id = user.notices.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;
  user.notices.push({ id, text, at: Date.now(), read: false });
  if (user.notices.length > 20) user.notices = user.notices.slice(-20);
  return id;
}

// ---------- Telegram ----------
export interface TgConfig { enabled: boolean; token: string; chatId: string }

export function tgConfig(db: Db): TgConfig {
  const c = (db.settings && db.settings.telegram) || { enabled: false, botToken: "", chatId: "" };
  return {
    enabled: !!c.enabled,
    token: (c.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chatId: (c.chatId || process.env.TELEGRAM_CHAT_ID || "").trim(),
  };
}

export async function tgSend(cfg: TgConfig, text: string): Promise<{ ok: boolean; error: string }> {
  if (!cfg.token || !cfg.chatId) return { ok: false, error: "Bot token or chat ID missing" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return { ok: !!j.ok, error: j.description || (res.ok ? "" : "HTTP " + res.status) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Fire-and-forget event notification to the admin's Telegram (no-op if disabled).
export function tgNotify(db: Db, text: string): void {
  const cfg = tgConfig(db);
  if (!cfg.enabled) return;
  tgSend(cfg, `<b>${escapeHtml(db.settings.siteName || "KanzUp")}</b>\n${text}`).catch(() => {});
}

// When the invite challenge is switched ON, email every confirmed active player.
export async function sendCampaignInvites(db: Db): Promise<{ sent: number; skipped: number }> {
  const c = db.settings.campaign;
  const recipients = db.users.filter((u) =>
    !u.isAdmin && !u.isTest && u.status === "active" && u.emailVerified && u.email && u.email.includes("@"));
  let sent = 0, skipped = 0;
  for (const u of recipients) {
    const tr = userT(u), lg = langFor(u);
    const lines = [tr("mail_invite_b")];
    if (c.coinsPerInvite > 0) lines.push(tr("mail_invite_reward", { coins: emFmt(c.coinsPerInvite, lg) }));
    const r = await mailUser(u, {
      subject: tr("mail_invite_subj"),
      heading: c.title ? c.title : tr("mail_invite_h"),
      intro: tr("mail_hi", { name: u.name }),
      lines,
      cta: { text: tr("mail_invite_cta"), url: `${APP_URL}/referral` },
      broadcast: true,
    });
    if (r && r.skipped) skipped++; else sent++;
  }
  return { sent, skipped };
}
