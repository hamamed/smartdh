// Builds the props a page renders with: the layout values every template used from
// res.locals, plus the view's own data. Props are made JSON-safe (Next requires it)
// and never carry secrets (password hashes, tokens, the Telegram bot token).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_URL_LINK, APP_URL } from "@/lib/config";
import { LANGS, locales, type Lang } from "@/lib/locales";
import { roleOf } from "@/lib/rbac";
import { currencyLabel } from "@/lib/text";
import type { Settings, User } from "@/lib/types";
import { PERMS } from "@/lib/constants";
import { hasPerm } from "@/lib/rbac";
import type { Ctx, Result } from "./ctx";

// Cache-busting stamp for /css/style.css, /js/app.js and the icons (same idea as Express).
const ASSET_V = (() => {
  try {
    const h = crypto.createHash("sha1");
    for (const f of ["public/css/style.css", "public/js/app.js", "public/icons/icon-192.png", "public/icons/icon-512.png"]) {
      try { h.update(fs.readFileSync(path.join(process.cwd(), f))); } catch { /* file may not exist */ }
    }
    return h.digest("hex").slice(0, 8);
  } catch {
    return String(Date.now());
  }
})();

export interface LayoutUser { id: number; name: string; isAdmin: boolean; status: User["status"]; role: string | null; avatar: string }

export interface LayoutData {
  lang: Lang;
  dir: string;
  title: string | null;
  langs: { code: Lang; name: string }[];
  settings: Omit<Settings, "telegram">;
  assetV: string;
  csrfToken: string;
  adminUrl: string;
  appUrl: string;
  adminHost: boolean;
  curLabel: string;
  user: LayoutUser | null;
  realAdminName: string | null;
  impersonating: boolean;
  /** Permissions of the signed-in admin (for gating admin UI), [] otherwise. */
  perms: string[];
  role: string | null;
  reqPath: string;
  gaEvent: { name: string; params: Record<string, unknown> } | null;
}

export interface PageProps {
  L: LayoutData;
  view: string;
  bare: boolean;
  data: Record<string, unknown>;
}

/** A user safe to hand to a template: no password hash, no secret tokens. */
export function publicUser(u: User): Omit<User, "passwordHash" | "verifyToken" | "emailToken" | "reset"> {
  const { passwordHash: _p, verifyToken: _v, emailToken: _e, reset: _r, ...rest } = u;
  void _p; void _v; void _e; void _r;
  return rest;
}

export function layoutData(ctx: Ctx, title: string | null): LayoutData {
  const { telegram: _tg, ...settings } = ctx.db.settings;
  void _tg;
  const u = ctx.user;
  return {
    lang: ctx.lang,
    dir: locales[ctx.lang].dir,
    title,
    langs: LANGS.map((code) => ({ code, name: locales[code].name })),
    settings,
    assetV: ASSET_V,
    csrfToken: ctx.session.csrf || "",
    adminUrl: ADMIN_URL_LINK,
    appUrl: APP_URL,
    adminHost: ctx.adminHost,
    curLabel: currencyLabel(ctx.db.settings, ctx.lang),
    user: u ? { id: u.id, name: u.name, isAdmin: !!u.isAdmin, status: u.status, role: u.role, avatar: u.avatar || "" } : null,
    realAdminName: ctx.realAdmin ? ctx.realAdmin.name : null,
    impersonating: ctx.impersonating,
    perms: u && u.isAdmin ? PERMS.filter((p) => hasPerm(u, p)) : [],
    role: roleOf(u),
    reqPath: ctx.originalPath,
    gaEvent: ctx.locals.gaEvent || null,
  };
}

export function buildPageProps(ctx: Ctx, r: Extract<Result, { kind: "render" }>): PageProps {
  // JSON round trip: drops undefined values and anything non-serialisable, as Next requires.
  const data = JSON.parse(JSON.stringify(r.props ?? {})) as Record<string, unknown>;
  return { L: layoutData(ctx, r.title ?? null), view: r.view, bare: !!r.bare, data };
}
