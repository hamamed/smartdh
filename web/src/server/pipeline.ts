// The request pipeline: the Express app's middleware chain, in the same order.
//   session + CSRF token → body → current user (presence, impersonation, accrual)
//   → language → GA event → admin-host rules → CSRF check → read-only impersonation
//   → player routes → admin routes (/admin, and the root on the admin host) → 404
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { APP_URL, COOKIE_DOMAIN, PROD, onAdminHost } from "@/lib/config";
import { load, save } from "@/lib/db";
import { accrue, flushReferralTx } from "@/lib/game";
import { DEFAULT_LANG, isLang, t, type Lang } from "@/lib/locales";
import { hasPerm, permForPath } from "@/lib/rbac";
import { COOKIE_NAME, cookieOptions, createSession, destroySession, readSession, signSid, unsignSid, writeSession, type SessionData } from "@/lib/session";
import type { User } from "@/lib/types";
import { parseBody } from "./body";
import { render, type Ctx, type Result } from "./ctx";
import { buildPageProps, type PageProps } from "./page-props";
import { adminRouter, playerRouter } from "./routes";

export type Outcome = { kind: "page"; status: number; props: PageProps } | { kind: "sent" };

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    const v = part.slice(i + 1).trim().replace(/^"|"$/g, "");
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function serializeCookie(name: string, value: string, o: { maxAge?: number; expires?: Date; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: string }): string {
  let s = `${name}=${encodeURIComponent(value)}`;
  if (o.maxAge !== undefined) s += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.domain) s += `; Domain=${o.domain}`;
  s += `; Path=${o.path || "/"}`;
  if (o.expires) s += `; Expires=${o.expires.toUTCString()}`;
  if (o.httpOnly) s += "; HttpOnly";
  if (o.secure) s += "; Secure";
  if (o.sameSite) s += `; SameSite=${o.sameSite[0].toUpperCase()}${o.sameSite.slice(1)}`;
  return s;
}

// Express "trust proxy 1": the client IP is the last X-Forwarded-For entry (added by nginx).
function clientIp(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const list = (Array.isArray(xff) ? xff.join(",") : xff || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list[list.length - 1] : req.socket.remoteAddress || "";
}

function csrfOk(ctx: Ctx): boolean {
  const fromBody = ctx.body._csrf;
  const header = ctx.req.headers["x-csrf-token"];
  const sent = (Array.isArray(fromBody) ? fromBody[0] : fromBody) || ctx.query._csrf || (Array.isArray(header) ? header[0] : header) || "";
  const expected = ctx.session.csrf || "";
  return !!sent && !!expected && sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

function errorPage(ctx: Ctx, status: number, titleKey: string, bodyKey: string, detail?: string | null): Result {
  return render("error", { code: status, heading: ctx.t(titleKey), mBody: ctx.t(bodyKey), detail: detail ?? null }, { status, title: ctx.t(titleKey) });
}

function forbidden(ctx: Ctx, bodyKey: string): Result {
  return render("message", { heading: ctx.t("forbidden_h"), mBody: ctx.t(bodyKey), mIcon: "shield-alert", mTint: "ti-coral" }, { status: 403, title: ctx.t("forbidden_title") });
}

// Admin router entry: the per-permission gate, then the admin routes.
async function runAdmin(ctx: Ctx, subPath: string): Promise<Result | null> {
  const u = ctx.user;
  if (u && u.isAdmin) {
    const perm = permForPath(subPath);
    if (perm && !hasPerm(u, perm)) return forbidden(ctx, "perm_denied");
  }
  const hit = adminRouter.match(ctx.method, subPath);
  if (!hit) return null;
  ctx.params = hit.params;
  const r = await hit.handler(ctx);
  return r.kind === "next" ? null : r;
}

async function dispatch(ctx: Ctx): Promise<Result> {
  const hit = playerRouter.match(ctx.method, ctx.path);
  if (hit) {
    ctx.params = hit.params;
    const r = await hit.handler(ctx);
    if (r.kind !== "next") return r;
  }
  if (/^\/admin(\/|$)/i.test(ctx.path)) {
    const r = await runAdmin(ctx, ctx.path.slice(6) || "/");
    if (r) return r;
  } else if (ctx.adminHost) {
    const r = await runAdmin(ctx, ctx.path);
    if (r) return r;
  }
  return errorPage(ctx, 404, "err_404_t", "err_404_d");
}

/** Strip "/admin" from redirect targets on the admin host (clean URLs), as Express did. */
function redirectTarget(ctx: Ctx, to: string): string {
  if (ctx.adminHost && (to === "/admin" || to.startsWith("/admin/"))) return to.slice(6) || "/";
  return to;
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<Outcome> {
  const url = new URL(req.url || "/", "http://local");
  const method = (req.method || "GET").toUpperCase();
  const adminHost = onAdminHost(req.headers.host);

  // ---- session (express-session compatible) ----
  const cookies = parseCookies(req.headers.cookie);
  const existingSid = unsignSid(cookies[COOKIE_NAME]);
  let sid = existingSid || "";
  let session: SessionData | null = sid ? readSession(sid) : null;
  let newSession = false;
  if (!session) {
    const fresh = createSession();
    sid = fresh.sid; session = fresh.data; newSession = true;
  }
  if (!session.csrf) session.csrf = crypto.randomBytes(24).toString("hex");

  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { if (!(k in query)) query[k] = v; });

  const db = load();
  let user: User | null = session.userId ? db.users.find((u) => u.id === session!.userId) || null : null;
  // Presence: stamp the REAL logged-in account, before any impersonation swap.
  if (user) user.lastSeen = Date.now();
  let realAdmin: User | null = null;
  if (user && user.isAdmin && session.impersonate) {
    const target = db.users.find((u) => u.id === session!.impersonate);
    if (target) { realAdmin = user; user = target; }
    else delete session.impersonate;
  }
  if (user) { accrue(user, db); flushReferralTx(user); save(db); }

  const lang: Lang = isLang(session.lang) ? session.lang : DEFAULT_LANG;
  const ctx: Ctx = {
    req, res, method,
    path: url.pathname,
    originalPath: url.pathname,
    query, body: {}, files: {}, params: {},
    sid, session, db, user, realAdmin, impersonating: !!realAdmin,
    lang, t: (key, vars) => t(lang, key, vars),
    adminHost, ip: clientIp(req), destroySession: false,
    locals: { gaEvent: session.gaEvent || null },
  };
  if (session.gaEvent) delete session.gaEvent;
  if (adminHost && ctx.path === "/") ctx.path = "/admin";

  let result: Result;
  try {
    if (method === "POST") {
      const parsed = await parseBody(req);
      ctx.body = parsed.fields; ctx.files = parsed.files;
    }
    const originalUrl = url.pathname + url.search;
    if (adminHost && user && !user.isAdmin && !ctx.impersonating && !originalUrl.startsWith("/logout")) {
      result = { kind: "redirect", to: APP_URL + (originalUrl === "/" ? "/dashboard" : originalUrl) };
    } else if (method === "POST" && !csrfOk(ctx)) {
      result = errorPage(ctx, 403, "err_csrf_t", "err_csrf_d");
    } else if (ctx.impersonating && method === "POST" && !ctx.path.endsWith("/stop-impersonate")) {
      result = errorPage(ctx, 403, "imp_ro_t", "imp_ro_d");
    } else {
      result = await dispatch(ctx);
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 413) result = errorPage(ctx, 413, "err_500_t", "err_500_d");
    else {
      console.error("Unhandled error:", err);
      result = errorPage(ctx, 500, "err_500_t", "err_500_d", PROD ? null : (err as Error).stack || String(err));
    }
  }

  // ---- persist the session, set or clear the cookie ----
  if (ctx.destroySession) {
    destroySession(ctx.sid);
    res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, "", { path: "/", domain: COOKIE_DOMAIN, expires: new Date(1) }));
  } else {
    writeSession(ctx.sid, ctx.session);
    if (newSession || ctx.sid !== existingSid) {
      res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, signSid(ctx.sid), cookieOptions()));
    }
  }

  switch (result.kind) {
    case "redirect": {
      res.statusCode = result.status || 302;
      res.setHeader("Location", redirectTarget(ctx, result.to));
      res.end();
      return { kind: "sent" };
    }
    case "json": {
      res.statusCode = result.status || 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(result.data));
      return { kind: "sent" };
    }
    case "raw": {
      res.statusCode = result.status || 200;
      res.setHeader("Content-Type", result.contentType);
      for (const [k, v] of Object.entries(result.headers || {})) res.setHeader(k, v);
      res.end(result.body);
      return { kind: "sent" };
    }
    case "render":
      return { kind: "page", status: result.status || 200, props: buildPageProps(ctx, result) };
    default:
      return { kind: "page", status: 404, props: buildPageProps(ctx, errorPage(ctx, 404, "err_404_t", "err_404_d") as Extract<Result, { kind: "render" }>) };
  }
}
