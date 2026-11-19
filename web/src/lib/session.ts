// Sessions compatible with the Express app (express-session + session-file-store):
//  - cookie `kz.sid` = "s:" + id + "." + base64(HMAC-SHA256(id, SESSION_SECRET)) without "=" padding
//  - data in DATA_DIR/sessions/<id>.json, plain JSON with `cookie` and `__lastAccess`
//  - a session expires 7 days after its last access
// So a player signed in on the old version stays signed in on this one, and back.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { COOKIE_DOMAIN, PROD, getSessionSecret } from "./config";
import { DATA_DIR } from "./db";

export const COOKIE_NAME = "kz.sid";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const SID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export interface SessionCookieMeta {
  originalMaxAge: number; expires: string; secure: boolean; httpOnly: boolean;
  domain?: string; path: string; sameSite: string;
}

/** What the Express app keeps in a session; unknown keys are preserved untouched. */
export interface SessionData {
  cookie: SessionCookieMeta;
  __lastAccess?: number;
  csrf?: string;
  userId?: number;
  lang?: string;
  impersonate?: number;
  gaEvent?: { name: string; params: Record<string, unknown> } | null;
  [key: string]: unknown;
}

export function signSid(sid: string, secret = getSessionSecret()): string {
  const mac = crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  return "s:" + sid + "." + mac;
}

/** The session id inside a signed cookie value, or null when missing or forged. */
export function unsignSid(value: string | null | undefined, secret = getSessionSecret()): string | null {
  if (!value || !value.startsWith("s:")) return null;
  const body = value.slice(2);
  const dot = body.lastIndexOf(".");
  if (dot <= 0) return null;
  const sid = body.slice(0, dot);
  const expected = Buffer.from(signSid(sid, secret));
  const given = Buffer.from(value);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return SID_RE.test(sid) ? sid : null;
}

const fileOf = (sid: string) => path.join(SESSIONS_DIR, sid + ".json");

function cookieMeta(now: number): SessionCookieMeta {
  return {
    originalMaxAge: SESSION_TTL_MS,
    expires: new Date(now + SESSION_TTL_MS).toISOString(),
    secure: PROD,
    httpOnly: true,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    path: "/",
    sameSite: "lax",
  };
}

function isExpired(s: SessionData, now: number): boolean {
  const ttl = s.cookie && s.cookie.originalMaxAge ? s.cookie.originalMaxAge : SESSION_TTL_MS;
  return !s.__lastAccess || s.__lastAccess + ttl < now;
}

export function readSession(sid: string): SessionData | null {
  if (!SID_RE.test(sid)) return null;
  try {
    const s = JSON.parse(fs.readFileSync(fileOf(sid), "utf8")) as SessionData;
    if (isExpired(s, Date.now())) { destroySession(sid); return null; }
    return s;
  } catch {
    return null;
  }
}

/** Saves the session, stamping last access like session-file-store does (atomic rename). */
export function writeSession(sid: string, data: SessionData): void {
  if (!SID_RE.test(sid)) return;
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const now = Date.now();
  const out: SessionData = { ...data, cookie: { ...cookieMeta(now), ...(data.cookie || {}), expires: new Date(now + SESSION_TTL_MS).toISOString() }, __lastAccess: now };
  const tmp = fileOf(sid) + "." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(out));
  fs.renameSync(tmp, fileOf(sid));
}

export function destroySession(sid: string): void {
  if (!SID_RE.test(sid)) return;
  try { fs.unlinkSync(fileOf(sid)); } catch { /* already gone */ }
}

/** A brand-new session with its CSRF token, saved to disk. */
export function createSession(): { sid: string; data: SessionData } {
  const sid = crypto.randomBytes(24).toString("base64url");
  const data: SessionData = { cookie: cookieMeta(Date.now()), csrf: crypto.randomBytes(24).toString("hex") };
  writeSession(sid, data);
  return { sid, data };
}

/** Cookie attributes for Set-Cookie, matching the Express cookie. */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: PROD,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
}
