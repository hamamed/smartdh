// Pagination, status counts and the admin "needs attention" badges.
import { isRealUser } from "./game";
import type { Db } from "./types";

export const PER_PAGE = 10;
export const PER_PAGE_OPTIONS = [10, 50, 100, 200];

export function paginate<T>(list: T[], page: string | undefined, perReq: string | undefined) {
  const perN = parseInt(perReq || "");
  const per = PER_PAGE_OPTIONS.includes(perN) ? perN : PER_PAGE;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(pages, Math.max(1, parseInt(page || "") || 1));
  return { items: list.slice((p - 1) * per, p * per), page: p, pages, per, total: list.length };
}

export function countBy<T extends Record<string, unknown>>(list: T[], key = "status"): Record<string, number> {
  return list.reduce((acc: Record<string, number>, x) => { const k = String(x[key]); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
}

export function adminCounts(db: Db) {
  const testIds = new Set(db.users.filter((u) => u.isTest).map((u) => u.id));
  return {
    pendingUsers: db.users.filter((u) => u.status === "pending" && isRealUser(u)).length,
    pendingDeposits: db.deposits.filter((d) => d.status === "pending" && !testIds.has(d.userId)).length,
    pendingWithdrawals: db.withdrawals.filter((w) => w.status === "pending" && !testIds.has(w.userId)).length,
    users: db.users.filter(isRealUser).length,
    testUsers: testIds.size,
    openTickets: (db.tickets || []).filter((t) => t.status !== "closed" && t.status !== "answered").length,
    pendingKyc: db.users.filter((u) => u.kyc && u.kyc.status === "submitted" && !testIds.has(u.id)).length,
    apps: db.settings.plans.length,
  };
}
export type AdminCounts = ReturnType<typeof adminCounts>;
