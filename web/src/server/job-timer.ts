// The background timer (started from instrumentation.ts), same work as Express's setInterval.
import { load, save } from "@/lib/db";
import { expirePendingDeposits, runSchedules, runWithdrawSchedules } from "@/lib/jobs";

const EVERY_MS = 60 * 1000;
const g = globalThis as typeof globalThis & { __kanzupJobTimer?: NodeJS.Timeout };

export function runJobsOnce(): boolean {
  const db = load();
  let dirty = !!runSchedules(db);
  if (expirePendingDeposits(db)) dirty = true;
  if (runWithdrawSchedules(db)) dirty = true;
  if (dirty) save(db);
  return dirty;
}

export function startJobTimer(): void {
  if (g.__kanzupJobTimer) return; // one timer per process
  g.__kanzupJobTimer = setInterval(() => {
    try { runJobsOnce(); } catch (e) { console.error("Background jobs failed:", e); }
  }, EVERY_MS);
}
