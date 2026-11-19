// Plan display colour (pure, so views can import it without server code).
import type { Plan } from "./types";

// Gold for fixed-amount apps, red for ≤30% / 15 days, green for anything higher.
export function planColor(p: Pick<Plan, "fixedAmount" | "ratePer15Days"> | null | undefined): string {
  if (!p) return "secondary";
  if (p.fixedAmount > 0) return "warning";
  return (p.ratePer15Days || 0) <= 0.30 ? "danger" : "success";
}
