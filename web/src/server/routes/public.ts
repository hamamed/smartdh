// Public pages: landing, ad landing, guide, terms, privacy, download, contact.
import fs from "node:fs";
import path from "node:path";
import { APP_URL } from "@/lib/config";
import { renderEmail, sendMail } from "@/lib/email";
import { landingStats } from "@/lib/game";
import { tgNotify } from "@/lib/notify";
import { escapeHtml } from "@/lib/text";
import { field, redirect, render, type Ctx, type Result } from "../ctx";
import { authLimiter, guard } from "../guards";
import type { Router } from "../router";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@kanzup.com";

function contactPage(ctx: Ctx, extra: Record<string, unknown>): Result {
  return render("contact", { contactEmail: CONTACT_EMAIL, form: {}, sent: false, error: null, now: Date.now(), ...extra }, { title: ctx.t("contact_title") });
}

async function contact(ctx: Ctx): Promise<Result> {
  const db = ctx.db;
  const name = field(ctx, "name").trim();
  const email = field(ctx, "email").trim();
  const subjectIn = field(ctx, "subject").trim();
  const message = field(ctx, "message").trim();
  const form = { name, email, subject: subjectIn };
  // Bot traps (honeypot + min time): pretend success, send nothing.
  if (field(ctx, "website").trim() || Date.now() - Number(field(ctx, "_t") || 0) < 2000) return contactPage(ctx, { sent: true, form: {} });
  if (!name || !email || !message) return contactPage(ctx, { form, error: ctx.t("err_fill") });
  const lines = [`${ctx.t("contact_from")}: ${name} <${email}>`];
  if (subjectIn) lines.push(`${ctx.t("contact_subject")}: ${subjectIn}`);
  lines.push(message);
  const html = renderEmail({ siteName: db.settings.siteName, appUrl: APP_URL, heading: ctx.t("contact_title"), lines });
  // To the support inbox, reply-to the sender so admins answer directly.
  await sendMail(CONTACT_EMAIL, `[Contact] ${subjectIn || name}`, html, { replyTo: `${name} <${email}>` });
  tgNotify(db, `✉️ Contact: ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;${subjectIn ? " — " + escapeHtml(subjectIn) : ""}`);
  return contactPage(ctx, { sent: true, form: {} });
}

export function registerPublicRoutes(r: Router): void {
  // Logged-in players don't need the landing page.
  r.get("/", (ctx) => {
    if (ctx.user) return redirect("/dashboard");
    return render("landing", { stats: landingStats(ctx.db), plans: ctx.db.settings.plans }, { title: ctx.t("hero_title") });
  });

  // High-conversion page for ad campaigns; keeps ?ref so paid signups credit a referrer.
  for (const p of ["/start", "/join", "/go"]) {
    r.get(p, (ctx) => {
      if (ctx.user) return redirect("/dashboard");
      const ref = (ctx.query.ref || "").trim().toUpperCase().slice(0, 16);
      const signup = "/signup" + (ref ? "?ref=" + encodeURIComponent(ref) : "");
      return render("start", { stats: landingStats(ctx.db), ref, signup, plans: ctx.db.settings.plans }, { title: ctx.t("start_h1"), bare: true });
    });
  }

  r.get("/guide", (ctx) => render("guide", { plans: ctx.db.settings.plans }, { title: ctx.t("guide_title") }));
  r.get("/terms", (ctx) => render("legal", { kind: "terms" }, { title: ctx.t("footer_terms") }));
  r.get("/privacy", (ctx) => render("legal", { kind: "privacy" }, { title: ctx.t("footer_privacy") }));

  // The APK button shows once the CI build has committed the file (or APK_URL is set).
  r.get("/download", (ctx) => {
    const apkExists = fs.existsSync(path.join(process.cwd(), "public", "downloads", "kanzup.apk"));
    const apkUrl = process.env.APK_URL || (apkExists ? "/downloads/kanzup.apk" : "");
    return render("download", { apkUrl }, { title: ctx.t("dl_title") });
  });

  r.get("/contact", (ctx) => {
    const u = ctx.user;
    return contactPage(ctx, { form: { name: u ? u.name : "", email: u ? u.email : "" } });
  });
  r.post("/contact", (ctx) => guard(ctx, authLimiter) || contact(ctx));
}
