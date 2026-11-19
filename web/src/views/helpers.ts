// The template helpers the EJS views got from res.locals, rebuilt from layout props.
import { ACHIEVEMENTS, TX } from "@/lib/constants";
import { planColor } from "@/lib/plan-color";
import { t as translate, type Vars } from "@/lib/locales";
import { formatMoney, rejectReasonText, timeAgo, translateNote } from "@/lib/text";
import type { Plan, Tx, Withdrawal } from "@/lib/types";
import type { LayoutData } from "@/server/page-props";

export function helpers(L: LayoutData) {
  const t = (key: string, vars?: Vars) => translate(L.lang, key, vars);
  const own = (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v; };
  return {
    t,
    money: (n: number | null | undefined) => formatMoney(n, L.curLabel),
    timeAgo: (ts: number | null | undefined) => timeAgo(ts, L.lang),
    planName: (p: Pick<Plan, "id" | "name">) => own("plan_" + p.id, p.name),
    planDesc: (p: Pick<Plan, "id" | "desc">) => own("plan_" + p.id + "_d", p.desc),
    achName: (id: string) => own("ach_" + id, ACHIEVEMENTS[id] ? ACHIEVEMENTS[id].name : id),
    achDesc: (id: string) => own("ach_" + id + "_d", ACHIEVEMENTS[id] ? ACHIEVEMENTS[id].desc : ""),
    txLabel: (type: string) => t("tx_" + type),
    txNote: (tx: Tx) => translateNote(t, tx),
    planColor: (p: Plan | null | undefined) => planColor(p),
    statusLabel: (s: string) => t("st_" + s),
    rejectReason: (w: Withdrawal) => rejectReasonText(t, w),
    can: (perm: string) => L.perms.includes(perm),
    ACH: ACHIEVEMENTS,
    TX,
  };
}
export type Helpers = ReturnType<typeof helpers>;

/** Joins class names, skipping empty ones (EJS templates used string concatenation). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
