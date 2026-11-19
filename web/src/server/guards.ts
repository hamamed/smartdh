// Route guards and the auth rate limiter, as in the Express app.
import { render, redirect, raw, type Ctx, type Result } from "./ctx";

/** Not signed in → /login. Returns null when the request may continue. */
export function requireLogin(ctx: Ctx): Result | null {
  return ctx.user ? null : redirect("/login");
}

/** Signed in and approved, else /login or /pending. */
export function requireActive(ctx: Ctx): Result | null {
  if (!ctx.user) return redirect("/login");
  if (ctx.user.status !== "active") return redirect("/pending");
  return null;
}

export function requireAdmin(ctx: Ctx): Result | null {
  if (!ctx.user) return redirect("/login");
  if (!ctx.user.isAdmin) {
    return render("message", { heading: ctx.t("forbidden_h"), mBody: ctx.t("forbidden_b") }, { status: 403, title: ctx.t("forbidden_title") });
  }
  return null;
}

// express-rate-limit: 20 auth attempts per IP per 15 minutes, then 429 with a text message.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
type Hits = Map<string, { count: number; resetAt: number }>;
const g = globalThis as typeof globalThis & { __kanzupAuthHits?: Hits };
const hits: Hits = (g.__kanzupAuthHits ??= new Map());

export function authLimiter(ctx: Ctx): Result | null {
  const now = Date.now();
  const key = ctx.ip || "unknown";
  let h = hits.get(key);
  if (!h || h.resetAt <= now) { h = { count: 0, resetAt: now + WINDOW_MS }; hits.set(key, h); }
  h.count++;
  ctx.res.setHeader("RateLimit-Policy", `${MAX_ATTEMPTS};w=${WINDOW_MS / 1000}`);
  ctx.res.setHeader("RateLimit", `limit=${MAX_ATTEMPTS}, remaining=${Math.max(0, MAX_ATTEMPTS - h.count)}, reset=${Math.ceil((h.resetAt - now) / 1000)}`);
  if (h.count > MAX_ATTEMPTS) {
    ctx.res.setHeader("Retry-After", String(Math.ceil((h.resetAt - now) / 1000)));
    return raw("Too many attempts. Please try again later.", "text/html; charset=utf-8", { status: 429 });
  }
  if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  return null;
}

/** Runs guards in order; the first one that returns a result wins (Express middleware chain). */
export function guard(ctx: Ctx, ...checks: Array<(c: Ctx) => Result | null>): Result | null {
  for (const check of checks) {
    const r = check(ctx);
    if (r) return r;
  }
  return null;
}
