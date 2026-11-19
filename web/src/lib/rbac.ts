// Admin roles and permissions — same rules as the Express app.
import { ROLES } from "./constants";
import type { User } from "./types";

export function roleOf(u: User | null | undefined): string | null {
  return u && u.isAdmin ? (u.role && ROLES[u.role] ? u.role : "owner") : null;
}

export function hasPerm(u: User | null | undefined, perm: string): boolean {
  if (!u || !u.isAdmin) return false;
  const r = ROLES[roleOf(u) as string];
  return !!r && (r.perms.includes("*") || r.perms.includes(perm));
}

/** Which permission an admin path (relative to /admin) needs; null = any admin. */
export function permForPath(p: string): string | null {
  if (p === "/" || p === "" || p.startsWith("/account") || p.startsWith("/invoice")
      || p.startsWith("/stats.json") || p.startsWith("/analytics.json")) return null;
  if (p.startsWith("/admins") || p.startsWith("/toggle-admin")) return "admins";
  if (p.startsWith("/users") || p.startsWith("/approve") || p.startsWith("/reject") || p.startsWith("/adjust") || p.startsWith("/delete")) return "users";
  if (p.startsWith("/deposits") || p.startsWith("/deposit/") || p.startsWith("/schedules")) return "deposits";
  if (p.startsWith("/withdrawals") || p.startsWith("/withdraw/")) return "withdrawals";
  if (p.startsWith("/email")) return "email";
  if (p.startsWith("/apps")) return "apps";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/data") || p.startsWith("/export") || p.startsWith("/import") || p.startsWith("/restore") || p.startsWith("/wipe")) return "data";
  if (p.startsWith("/audit")) return "audit";
  if (p.startsWith("/test")) return "test";
  if (p.startsWith("/tickets")) return "tickets";
  return null;
}
