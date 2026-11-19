// Scheduled work and shared admin money actions, ported from the Express app:
// recurring deposits, the 24h expiry of unpaid deposit requests, withdrawal
// approve/reject (manual and scheduled), and deleting a player with their records.
import { APP_URL, DAY } from "./config";
import { WITHDRAW_REJECT_REASONS } from "./constants";
import { addTx, creditDeposit, logAudit } from "./game";
import { emFmt, langFor, mailUser, notifyWithdrawal, pushNotice, tgNotify, userT } from "./notify";
import { escapeHtml, rejectReasonText } from "./text";
import { deleteUpload } from "./uploads";
import type { Db, User, Withdrawal } from "./types";

export const FREQ_MS: Record<string, number> = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY };

/** Apply every recurring deposit that is due. Returns how many payouts ran. */
export function runSchedules(db: Db): number {
  const now = Date.now();
  let ran = 0;
  for (const sc of db.schedules) {
    if (!sc.active) continue;
    const plan = db.settings.plans.find((p) => p.id === sc.plan);
    if (!plan) continue;
    let guard = 0;
    while (sc.nextRun <= now && guard++ < 60) { // don't backfill a huge gap
      const u = db.users.find((x) => x.id === sc.userId);
      if (u) { creditDeposit(db, u, plan, sc.amount, { status: "approved", note: "Recurring", when: now }); ran++; }
      sc.lastRun = now;
      sc.nextRun += FREQ_MS[sc.frequency] || DAY;
    }
  }
  return ran;
}

/** Cancel self-service deposit requests whose 24h payment window has passed. */
export function expirePendingDeposits(db: Db): number {
  const now = Date.now();
  let changed = 0;
  for (const d of db.deposits) {
    if (d.status !== "pending" || !d.expiresAt || d.expiresAt > now) continue;
    d.status = "cancelled";
    d.cancelledAt = now;
    const u = db.users.find((x) => x.id === d.userId);
    if (u) {
      const tr = userT(u), lg = langFor(u);
      addTx(u, "deposit_cancelled", d.amount, d.planLabel || "");
      pushNotice(u, tr("notice_dep_cancelled", { amount: emFmt(d.amount, lg) }));
      void mailUser(u, {
        subject: tr("mail_depcancel_subj"), heading: tr("mail_depcancel_h"),
        lines: [tr("mail_depcancel_b", { amount: emFmt(d.amount, lg) })],
        cta: { text: tr("notice_cta"), url: `${APP_URL}/invest` },
      });
    }
    changed++;
  }
  return changed;
}

/** Approve (pay) or reject a pending withdrawal; shared by the buttons and the scheduler. */
export function applyWithdrawAction(db: Db, w: Withdrawal | undefined, action: string,
  opts: { reason?: string; reasonNote?: string } = {}, actor: { id?: number; name: string } = { name: "system" }): boolean {
  if (!w || w.status !== "pending") return false;
  const u = db.users.find((x) => x.id === w.userId);
  if (action === "approve") {
    w.status = "paid";
    if (u) { addTx(u, "withdraw_paid", w.amount, "From " + (w.fromLabel || w.from)); notifyWithdrawal(u, w, "paid"); }
    logAudit(db, actor, "withdraw.paid", "#" + w.id + " " + w.userName + " " + w.amount + " via " + (w.method || "-"));
    tgNotify(db, `✅ Withdrawal paid: ${escapeHtml(w.userName)} — ${emFmt(w.amount, "en")}`);
  } else if (action === "reject") {
    w.rejectReason = WITHDRAW_REJECT_REASONS.includes(opts.reason || "") ? opts.reason : "";
    w.rejectNote = (opts.reasonNote || "").trim().slice(0, 300);
    if (u) {
      if (w.from === "earnings") u.earnings += w.amount;
      else u.invested[w.from] = (u.invested[w.from] || 0) + w.amount;
      const rtxt = rejectReasonText(userT(u), w);
      addTx(u, "withdraw_rejected", w.amount, "Refunded to " + (w.fromLabel || w.from) + (rtxt ? " · " + rtxt : ""));
      notifyWithdrawal(u, w, "rejected");
    }
    w.status = "rejected";
    logAudit(db, actor, "withdraw.reject", "#" + w.id + " " + w.userName + " " + w.amount + (w.rejectReason ? " (" + w.rejectReason + ")" : ""));
  } else return false;
  w.scheduled = null; // a completed action clears any pending schedule
  return true;
}

/** Run scheduled withdrawal actions that are due. */
export function runWithdrawSchedules(db: Db): number {
  const now = Date.now();
  let done = 0;
  for (const w of db.withdrawals) {
    if (w.status !== "pending" || !w.scheduled || !w.scheduled.at || w.scheduled.at > now) continue;
    const s = w.scheduled;
    if (applyWithdrawAction(db, w, s.action, { reason: s.reason, reasonNote: s.reasonNote }, { name: (s.byName || "scheduler") + " (scheduled)" })) done++;
  }
  return done;
}

/** Remove a player and everything attached to them. Returns the deleted user or null. */
export function deleteUserCascade(db: Db, id: number): User | null {
  const u = db.users.find((x) => x.id === id);
  if (!u) return null;
  deleteUpload(u.avatar);
  db.users = db.users.filter((x) => x.id !== id);
  db.deposits = db.deposits.filter((d) => d.userId !== id);
  db.withdrawals = db.withdrawals.filter((w) => w.userId !== id);
  db.users.forEach((x) => { if (x.referredBy === id) x.referredBy = null; });
  return u;
}
