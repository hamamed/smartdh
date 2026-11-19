// Environment-driven settings, same variables and defaults as the Express app (.env).
import crypto from "node:crypto";
import path from "node:path";

export const PROD = process.env.NODE_ENV === "production";
export const PORT = Number(process.env.PORT || 3000);
export const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Where the "Admin" button points. ADMIN_URL=https://admin.kanzup.com sends admins to
// the subdomain; otherwise the /admin path on the same host.
export const ADMIN_URL_LINK = process.env.ADMIN_URL ? process.env.ADMIN_URL.replace(/\/+$/, "") : "/admin";
const ADMIN_HOST = (() => {
  if (!process.env.ADMIN_URL) return "";
  try { return new URL(process.env.ADMIN_URL).host.toLowerCase(); } catch { return ""; }
})();

/** On the admin subdomain the admin pages are served at the root (clean URLs). */
export function onAdminHost(hostname: string | null | undefined): boolean {
  const h = (hostname || "").toLowerCase().replace(/:\d+$/, "");
  return (!!ADMIN_HOST && h === ADMIN_HOST.replace(/:\d+$/, "")) || h.startsWith("admin.");
}

// Who becomes admin on signup. Empty → the first account wins (unsafe publicly).
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"));

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (PROD && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("FATAL: SESSION_SECRET must be set in production. See .env.example");
  }
  const g = globalThis as typeof globalThis & { __kanzupDevSecret?: string };
  if (!g.__kanzupDevSecret) {
    g.__kanzupDevSecret = crypto.randomBytes(32).toString("hex");
    console.warn("⚠  No SESSION_SECRET in .env — using a random one (logins reset on restart).");
  }
  return g.__kanzupDevSecret;
}
export const getSessionSecret = sessionSecret;

export const DAY = 1000 * 60 * 60 * 24;
