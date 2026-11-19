// Payout details (shared by the profile and withdraw forms).
import type { Payout } from "./types";

export function readPayout(body: { method?: string; payoutName?: string; paypal?: string; rib?: string }): Payout {
  return {
    method: body.method === "bank" ? "bank" : "paypal",
    name: (body.payoutName || "").trim(),
    paypal: (body.paypal || "").trim(),
    rib: (body.rib || "").trim(),
  };
}

export function payoutMissing(p: Payout): boolean {
  if (!p.name) return true;
  return p.method === "bank" ? !p.rib : !p.paypal;
}

export function payoutAccount(p: Payout): string {
  return p.method === "bank" ? p.rib : p.paypal;
}
