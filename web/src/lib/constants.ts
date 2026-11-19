// Fixed game tables, copied from the Express app's server.js.

export const ACHIEVEMENTS: Record<string, { icon: string; name: string; desc: string }> = {
  first_deposit: { icon: "sprout", name: "First Deposit", desc: "Made your first investment" },
  first_withdraw: { icon: "banknote", name: "Cashed Out", desc: "Made your first withdrawal" },
  generous: { icon: "gift", name: "Generous", desc: "Sent coins to a friend" },
  recruiter: { icon: "user-plus", name: "Recruiter", desc: "Referred a new player" },
  saver_10k: { icon: "coins", name: "Saver", desc: "Reached 10,000 total" },
  saver_100k: { icon: "landmark", name: "Big Money", desc: "Reached 100,000 total" },
  millionaire: { icon: "crown", name: "Millionaire", desc: "Reached 1,000,000 total" },
  streak_7: { icon: "flame", name: "On Fire", desc: "7-day login streak" },
};

// Transaction display metadata
export const TX: Record<string, { icon: string; label: string; cls: string; sign: string }> = {
  deposit_request: { icon: "hourglass", label: "Deposit requested", cls: "secondary", sign: "" },
  deposit: { icon: "arrow-up", label: "Invested", cls: "primary", sign: "" },
  withdraw_request: { icon: "hourglass", label: "Withdrawal requested", cls: "warning", sign: "-" },
  withdraw_paid: { icon: "banknote", label: "Withdrawal paid", cls: "success", sign: "-" },
  withdraw_rejected: { icon: "rotate-ccw", label: "Withdrawal refunded", cls: "secondary", sign: "+" },
  transfer_out: { icon: "send", label: "Sent coins", cls: "danger", sign: "-" },
  transfer_in: { icon: "inbox", label: "Received coins", cls: "success", sign: "+" },
  daily_bonus: { icon: "gift", label: "Daily bonus", cls: "success", sign: "+" },
  referral_bonus: { icon: "user-plus", label: "Referral bonus", cls: "success", sign: "+" },
  achievement: { icon: "trophy", label: "Achievement unlocked", cls: "warning", sign: "" },
  campaign_reward: { icon: "party-popper", label: "Challenge reward", cls: "success", sign: "+" },
  campaign_invite: { icon: "user-check", label: "Invite bonus", cls: "success", sign: "+" },
  admin_adjust: { icon: "shield", label: "Admin adjustment", cls: "secondary", sign: "" },
  earnings_credit: { icon: "gift", label: "Earnings added", cls: "success", sign: "+" },
  move_funds: { icon: "arrow-left-right", label: "Moved investment", cls: "info", sign: "" },
  deposit_cancelled: { icon: "x-circle", label: "Deposit cancelled", cls: "secondary", sign: "" },
};

// A self-service deposit request auto-cancels if the money isn't received in time.
export const DEPOSIT_EXPIRY_MS = 24 * 60 * 60 * 1000;
// A player counts as "online" if seen within this window (admin presence view).
export const ONLINE_MS = 5 * 60 * 1000;

// Preset reasons an admin can pick when rejecting a withdrawal.
export const WITHDRAW_REJECT_REASONS = ["clearing", "first3_limit", "payout_details", "name_mismatch", "min_amount", "cadence", "review", "other"];

// Admin roles (RBAC). 'owner' has '*'. Order here = order shown in the UI.
export const ROLES: Record<string, { perms: string[] }> = {
  owner: { perms: ["*"] },
  manager: { perms: ["users", "deposits", "withdrawals", "email", "apps", "settings", "audit", "test", "tickets"] },
  moderator: { perms: ["users", "deposits", "withdrawals", "audit", "tickets"] },
  support: { perms: ["tickets", "users"] },
};
export const PERMS = ["users", "deposits", "withdrawals", "email", "apps", "settings", "data", "audit", "test", "tickets", "admins"];
