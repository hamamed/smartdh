// Pages compared by compare.mjs. `as`: "anon", "admin", or a fixture user's email prefix
// (e.g. "sara.test"). `host` lets a page be fetched on the admin subdomain.
export const PAGES = [
  // phase 2 — public + auth
  { path: "/", as: "anon" },
  { path: "/start", as: "anon" },
  { path: "/join?ref=ref0002", as: "anon" },
  { path: "/guide", as: "anon" },
  { path: "/guide", as: "sara.test" },
  { path: "/terms", as: "anon" },
  { path: "/privacy", as: "anon" },
  { path: "/download", as: "anon" },
  { path: "/contact", as: "anon" },
  { path: "/contact", as: "sara.test" },
  { path: "/signup", as: "anon" },
  { path: "/signup?ref=REF0002", as: "anon" },
  { path: "/login", as: "anon" },
  { path: "/forgot", as: "anon" },
  { path: "/reset/nope", as: "anon" },
  { path: "/verify/nope", as: "anon" },
  { path: "/unsubscribe/tok5", as: "anon" },
  { path: "/resubscribe/tok5", as: "anon" },
  { path: "/unsubscribe/nope", as: "anon" },
  { path: "/pending", as: "nadia.pending" },
  { path: "/pending", as: "anon" },
  { path: "/no-such-page", as: "anon" },
  { path: "/", as: "sara.test" },
  { path: "/login", as: "sara.test" },
];

// Form posts (rendered results and redirects). `formPage` is where the CSRF token comes from.
const old = () => String(Date.now() - 5000); // passes the "too fast" bot trap
PAGES.push(
  { path: "/login", as: "anon", form: { email: "sara.test@kanzup.test", password: "wrong" }, note: "wrong password" },
  { path: "/login", as: "anon", form: { email: "nobody@kanzup.test", password: "x" }, note: "unknown email" },
  { path: "/signup", as: "anon", form: () => ({ _t: old(), name: "", email: "", password: "" }), note: "empty" },
  { path: "/signup", as: "anon", form: () => ({ _t: old(), name: "N", email: "new@kanzup.test", password: "abcd" }), note: "no agree" },
  { path: "/signup", as: "anon", form: () => ({ _t: old(), name: "N", email: "sara.test@kanzup.test", password: "abcd", agree: "1" }), note: "email taken" },
  { path: "/signup", as: "anon", form: () => ({ _t: old(), name: "N", email: "bot@kanzup.test", password: "abcd", agree: "1", website: "spam" }), note: "honeypot" },
  { path: "/signup", as: "anon", form: () => ({ _t: String(Date.now()), name: "N", email: "fast@kanzup.test", password: "abcd", agree: "1" }), note: "too fast" },
  { path: "/contact", as: "anon", form: () => ({ _t: old(), name: "A", email: "a@kanzup.test", message: "" }), note: "missing message" },
  { path: "/contact", as: "anon", form: () => ({ _t: old(), name: "A", email: "a@kanzup.test", message: "hi", website: "x" }), note: "honeypot" },
  { path: "/forgot", as: "anon", form: { email: "nobody@kanzup.test" }, note: "unknown email" },
  { path: "/resend-verification", as: "anon", formPage: "/login", form: { email: "nobody@kanzup.test" } },
  { path: "/reset/nope", as: "anon", formPage: "/forgot", form: { code: "1", password: "abcdef", confirm: "abcdef" }, note: "bad token" },
  { path: "/logout", as: "sara.test", formPage: "/guide", form: {}, fresh: true },
);

// phase 3 — player pages (GET)
for (const p of ["/dashboard", "/dashboard?tour=1", "/invest", "/withdraw", "/send", "/rewards", "/achievements", "/activity",
  "/support", "/support/new?topic=deposit", "/support/new?topic=nope", "/support/1", "/support/99", "/referral",
  "/profile", "/profile?ok=saved", "/profile?err=wrongpass", "/verify-identity", "/verify-identity?ok=submitted&err=big",
  "/leaderboard", "/invoice/deposit/1", "/invoice/withdraw/1", "/invoice/transfer/1", "/invoice/deposit/99", "/invoice/deposit/3", "/received"]) {
  PAGES.push({ path: p, as: "sara.test" });
}
for (const p of ["/dashboard", "/withdraw", "/verify-identity", "/referral", "/invoice/transfer/1", "/send"]) PAGES.push({ path: p, as: "omar.test" });
for (const p of ["/dashboard", "/invest", "/withdraw"]) PAGES.push({ path: p, as: "lina.test" });
for (const p of ["/dashboard", "/invest", "/withdraw", "/rewards"]) PAGES.push({ path: p, as: "youssef.test" });
for (const p of ["/dashboard", "/invest", "/support"]) PAGES.push({ path: p, as: "nadia.pending" });
for (const p of ["/dashboard", "/invest"]) PAGES.push({ path: p, as: "anon" });

// phase 3 — player form posts, in order (both apps change state the same way), then the pages they affect
const S = "sara.test";
PAGES.push(
  { path: "/add-funds", as: S, formPage: "/invest", form: { plan: "nope", amount: "500" }, note: "bad plan" },
  { path: "/add-funds", as: S, formPage: "/invest", form: { plan: "app2", amount: "500" }, note: "unpublished" },
  { path: "/add-funds", as: S, formPage: "/invest", form: { plan: "safe", amount: "10" }, note: "too small" },
  { path: "/add-funds", as: S, formPage: "/invest", form: { plan: "safe", amount: "500" }, note: "ok" },
  { path: "/add-funds", as: S, formPage: "/invest", form: { plan: "app1", amount: "1" }, note: "fixed amount" },
  { path: "/move-funds", as: S, formPage: "/invest", form: { from: "safe", to: "safe", amount: "100" }, note: "same plan" },
  { path: "/move-funds", as: S, formPage: "/invest", form: { from: "balanced", to: "safe", amount: "99999" }, note: "locked" },
  { path: "/move-funds", as: S, formPage: "/invest", form: { from: "safe", to: "balanced", amount: "100" }, note: "ok" },
  { path: "/withdraw", as: S, formPage: "/withdraw", form: { from: "earnings", amount: "50" }, note: "too small" },
  { path: "/withdraw", as: S, formPage: "/withdraw", form: { from: "balanced", amount: "500" }, note: "locked" },
  { path: "/withdraw", as: S, formPage: "/withdraw", form: { from: "earnings", amount: "150" }, note: "ok" },
  { path: "/withdraw", as: S, formPage: "/withdraw", form: { from: "earnings", amount: "150" }, note: "cadence" },
  { path: "/transfer", as: S, formPage: "/send", form: { to: "omar.test@kanzup.test", amount: "5" }, note: "too small" },
  { path: "/transfer", as: S, formPage: "/send", form: { to: "nobody@kanzup.test", amount: "20" }, note: "no recipient" },
  { path: "/transfer", as: S, formPage: "/send", form: { to: "REF0003", amount: "20" }, note: "ok by code" },
  { path: "/daily-bonus", as: S, formPage: "/rewards", form: { redirect: "home" }, note: "ok" },
  { path: "/daily-bonus", as: S, formPage: "/rewards", form: {}, note: "claimed" },
  { path: "/daily-bonus", as: "youssef.test", formPage: "/rewards", form: {}, note: "youssef" },
  { path: "/campaign/claim", as: S, formPage: "/referral", form: {}, note: "claim" },
  { path: "/campaign/claim", as: "lina.test", formPage: "/dashboard", form: { redirect: "home" }, note: "not yet" },
  { path: "/profile/password", as: S, formPage: "/profile", form: { current: "nope", next: "abcdef", confirm: "abcdef" }, note: "wrong current" },
  { path: "/profile/password", as: S, formPage: "/profile", form: { current: "test1234", next: "abc", confirm: "abc" }, note: "short" },
  { path: "/profile/email", as: S, formPage: "/profile", form: { current: "test1234", email: "omar.test@kanzup.test" }, note: "taken" },
  { path: "/profile/email", as: S, formPage: "/profile", form: { current: "test1234", email: "bad" }, note: "bad email" },
  { path: "/profile/payout", as: S, formPage: "/profile", form: { method: "paypal", payoutName: "Sara T", paypal: "sara@paypal.test", rib: "" }, note: "paypal" },
  { path: "/notices/1/read", as: S, formPage: "/dashboard", form: {} },
  { path: "/support/new", as: S, formPage: "/support/new?topic=bug", form: { topic: "bug", subject: "It broke", message: "Steps..." }, note: "new ticket" },
  { path: "/support/new", as: S, formPage: "/support/new?topic=bug", form: { topic: "bug", subject: "", message: "" }, note: "empty" },
  { path: "/support/1/reply", as: S, formPage: "/support/1", form: { message: "Thanks!" } },
  { path: "/onboarded", as: S, formPage: "/dashboard", form: {} },
  { path: "/dismiss-getting-started", as: "lina.test", formPage: "/dashboard", form: {} },
  { path: "/verify-identity", as: S, formPage: "/verify-identity", form: { fullName: "", dob: "", address: "" }, note: "missing" },
  { path: "/profile/prefs", as: S, formPage: "/profile", form: { lang: "en", emails: "1" }, note: "english" },
);
for (const p of ["/dashboard", "/invest", "/withdraw", "/send", "/activity", "/rewards", "/referral", "/profile", "/support", "/support/2", "/support/1", "/achievements", "/leaderboard"]) PAGES.push({ path: p, as: S, note: "after" });
for (const p of ["/send", "/activity", "/dashboard"]) PAGES.push({ path: p, as: "omar.test", note: "after" });
PAGES.push({ path: "/dashboard", as: "lina.test", note: "after" }, { path: "/rewards", as: "youssef.test", note: "after" });

// phase 4 — admin pages (GET)
for (const p of ["/admin", "/admin/users", "/admin/users?status=pending", "/admin/users?q=test", "/admin/users?per=50&page=2", "/admin/users/2",
  "/admin/users/3", "/admin/users/1", "/admin/users/6", "/admin/users/99", "/admin/test", "/admin/account", "/admin/account?err=wrongpass",
  "/admin/admins", "/admin/admins?ok=added", "/admin/email", "/admin/email?sent=3&skipped=1", "/admin/apps", "/admin/apps?show=all",
  "/admin/apps?show=unpublished", "/admin/deposits", "/admin/deposits?status=pending", "/admin/deposits?q=sara", "/admin/withdrawals",
  "/admin/withdrawals?ok=notified", "/admin/invoices", "/admin/invoices?type=withdraw", "/admin/audit", "/admin/tickets",
  "/admin/tickets?status=answered", "/admin/tickets/1", "/admin/tickets/9", "/admin/settings", "/admin/settings/general",
  "/admin/settings/economy?ok=1", "/admin/settings/payments", "/admin/settings/announcement", "/admin/settings/campaign",
  "/admin/settings/telegram", "/admin/data", "/admin/data?wiped=1", "/admin/users/2/statement", "/admin/invoice/deposit/1",
  "/admin/invoice/withdraw/2", "/admin/invoice/deposit/99", "/admin/online.json", "/admin/stats.json", "/admin/analytics.json",
  "/admin/analytics.json?range=monthly", "/admin/analytics.json?range=hourly", "/admin/export/users.csv", "/admin/export/deposits.csv",
  "/admin/export/withdrawals.csv", "/admin/export/users-template.csv"]) {
  PAGES.push({ path: p, as: "admin" });
}
// admin subdomain: hub at the root, clean URLs; non-admins are sent to the main site
for (const p of ["/", "/users", "/users/2", "/deposits", "/settings/general", "/login", "/admin/users"]) PAGES.push({ path: p, as: "admin", host: "admin.kanzup.test" });
PAGES.push({ path: "/", as: "sara.test", host: "admin.kanzup.test" }, { path: "/invest", as: "sara.test", host: "admin.kanzup.test" }, { path: "/", as: "anon", host: "admin.kanzup.test" });
// access control
PAGES.push({ path: "/admin", as: "sara.test" }, { path: "/admin/users", as: "anon" }, { path: "/admin", as: "mod.support" },
  { path: "/admin/deposits", as: "mod.support" }, { path: "/admin/tickets", as: "mod.support" }, { path: "/admin/users/2", as: "mod.support" });

// phase 4 — admin form posts, in order, then the pages they change
const A = "admin";
const later = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
PAGES.push(
  { path: "/admin/approve/6", as: A, formPage: "/admin/users", form: {} },
  { path: "/admin/deposit/6/approve", as: A, formPage: "/admin/deposits", form: {} },
  { path: "/admin/deposit/8/reject", as: A, formPage: "/admin/deposits", form: {}, note: "sara's request" },
  { path: "/admin/withdraw/2/schedule", as: A, formPage: "/admin/withdrawals", form: { action: "reject", at: later, reason: "review", reasonNote: "later" } },
  { path: "/admin/withdraw/2/unschedule", as: A, formPage: "/admin/withdrawals", form: {} },
  { path: "/admin/withdraw/2/reject", as: A, formPage: "/admin/withdrawals", form: { reason: "payout_details", reasonNote: "fix your paypal" } },
  { path: "/admin/withdraw/2/approve", as: A, formPage: "/admin/withdrawals", form: {}, note: "already rejected" },
  { path: "/admin/users/5/notify", as: A, formPage: "/admin/withdrawals", form: { back: "/admin/withdrawals", message: "Please deposit to unlock." } },
  { path: "/admin/users/5/notify", as: A, formPage: "/admin/withdrawals", form: { back: "/admin/withdrawals", message: "" }, note: "empty" },
  { path: "/admin/users/4/request-verify", as: A, formPage: "/admin/withdrawals", form: { back: "/admin/withdrawals" } },
  { path: "/admin/users/3/kyc/approve", as: A, formPage: "/admin/users/3", form: {} },
  { path: "/admin/adjust/5", as: A, formPage: "/admin/users/5", form: { earnings: "77", plan_balanced: "2500", plan_safe: "" } },
  { path: "/admin/users/5/earnings", as: A, formPage: "/admin/users/5", form: { amount: "-20", note: "correction" } },
  { path: "/admin/users/5/earnings", as: A, formPage: "/admin/users/5", form: { amount: "0" }, note: "zero" },
  { path: "/admin/users/5/xp", as: A, formPage: "/admin/users/5", form: { xp: "450" } },
  { path: "/admin/users/5/password", as: A, formPage: "/admin/users/5", form: { password: "test1234" } },
  { path: "/admin/users/7/toggle-test", as: A, formPage: "/admin/test", form: {} },
  { path: "/admin/users/create", as: A, formPage: "/admin/users", form: { name: "New One", email: "new.one@kanzup.test", password: "test1234", status: "active" } },
  { path: "/admin/users/create", as: A, formPage: "/admin/users", form: { name: "Dup", email: "sara.test@kanzup.test", password: "test1234" }, note: "dup" },
  { path: "/admin/users/4/deposit", as: A, formPage: "/admin/users/4", form: { amount: "1200", plan: "safe", status: "approved", note: "bank ref 42", date: "2026-10-01" } },
  { path: "/admin/users/4/withdraw", as: A, formPage: "/admin/users/4", form: { amount: "99999", from: "earnings", method: "bank", status: "paid" }, note: "too much" },
  { path: "/admin/users/4/withdraw", as: A, formPage: "/admin/users/4", form: { amount: "50", from: "earnings", method: "bank", payoutName: "Lina", account: "RIB 1", status: "paid", date: "2026-10-02T10:30" } },
  { path: "/admin/users/4/schedule", as: A, formPage: "/admin/users/4", form: { amount: "100", plan: "safe", frequency: "monthly" } },
  { path: "/admin/users/batch-deposit", as: A, formPage: "/admin/users", form: { "ids[]": "3", amount: "300", plan: "balanced", status: "pending" } },
  { path: "/admin/users/bulk", as: A, formPage: "/admin/users", form: { action: "reject", ids: "1" }, note: "only self" },
  { path: "/admin/settings/general", as: A, formPage: "/admin/settings/general", form: { siteName: "KanzUp", currency: "MAD" } },
  { path: "/admin/settings/economy", as: A, formPage: "/admin/settings/economy", form: { minAddFunds: "200", minWithdraw: "150", minTransfer: "20", withdrawEveryDays: "10", depositLockDays: "20", tier1: "3", tier2: "1.5", tier3: "0.5", dailyBonusBase: "40", dailyBonusEnabled: "1", leaderboardEnabled: "1", growthEnabled: "1", gUsersBase: "5", gUsersMin: "60", gUsersSpread: "30", gPayoutsMin: "10", gCoinsMin: "100", gCoinsSpread: "50" } },
  { path: "/admin/settings/payments", as: A, formPage: "/admin/settings/payments", form: { dep_bankName: "Test Bank", dep_accountName: "Owner", dep_rib: "RIB 123", dep_note: "note" } },
  { path: "/admin/settings/announcement", as: A, formPage: "/admin/settings/announcement", form: { ann_text: "New announcement", ann_enabled: "1" } },
  { path: "/admin/settings/campaign", as: A, formPage: "/admin/settings/campaign", form: { enabled: "1", inviteGoal: "1", minDeposit: "500", requireActive: "1", coinsPerInvite: "50", rewardCoins: "250", rewardXp: "20", maxClaims: "2" } },
  { path: "/admin/settings/telegram", as: A, formPage: "/admin/settings/telegram", form: { botToken: "", chatId: "" } },
  { path: "/admin/apps/add", as: A, formPage: "/admin/apps", form: { name: "Fresh App", icon: "gem", rate: "12.5", minLevel: "2", fixedAmount: "0", color: "info", desc: "New", link: "" } },
  { path: "/admin/apps/edit/balanced", as: A, formPage: "/admin/apps", form: { name: "BalanceApp", rate: "11", minLevel: "1", fixedAmount: "0", color: "primary", desc: "Edited", link: "", icon: "scale", imageUrl: "" } },
  { path: "/admin/apps/publish/app2", as: A, formPage: "/admin/apps?show=all", form: { current: "0", back: "all" } },
  { path: "/admin/apps/delete/risky", as: A, formPage: "/admin/apps", form: {} },
  { path: "/admin/admins/add", as: A, formPage: "/admin/admins", form: { email: "youssef.test@kanzup.test", role: "moderator" } },
  { path: "/admin/admins/5/role", as: A, formPage: "/admin/admins", form: { role: "manager" } },
  { path: "/admin/admins/1/remove", as: A, formPage: "/admin/admins", form: {}, note: "self" },
  { path: "/admin/admins/5/remove", as: A, formPage: "/admin/admins", form: {} },
  { path: "/admin/account/profile", as: A, formPage: "/admin/account", form: { current: "nope", name: "Owner Admin", email: "owner@kanzup.test" }, note: "wrong pass" },
  { path: "/admin/account/password", as: A, formPage: "/admin/account", form: { current: "test1234", password: "abc", confirm: "abc" }, note: "short" },
  { path: "/admin/email/send", as: A, formPage: "/admin/email", form: { subject: "", message: "" }, note: "empty" },
  { path: "/admin/email/send", as: A, formPage: "/admin/email", form: { subject: "Hello", message: "Line 1\n\nLine 2", audience: "active", testOnly: "1" }, note: "test only" },
  { path: "/admin/email/send", as: A, formPage: "/admin/email", form: { subject: "Hello all", message: "Hi", audience: "nodeposit", alsoNotice: "1" }, note: "no-deposit players" },
  { path: "/admin/tickets/1/reply", as: A, formPage: "/admin/tickets/1", form: { message: "Done, thanks." } },
  { path: "/admin/tickets/2/close", as: A, formPage: "/admin/tickets", form: {} },
  { path: "/admin/schedules/run", as: A, formPage: "/admin/users", form: { back: "/admin/users/4" } },
  { path: "/admin/toggle-admin/7", as: A, formPage: "/admin/users/7", form: {} },
  { path: "/admin/delete/7", as: A, formPage: "/admin/test", form: {} },
  { path: "/admin/users/2/impersonate", as: A, formPage: "/admin/users/2", form: {} },
);
for (const p of ["/dashboard", "/invest", "/admin"]) PAGES.push({ path: p, as: A, note: "impersonating" });
PAGES.push(
  { path: "/add-funds", as: A, formPage: "/invest", form: { plan: "safe", amount: "500" }, note: "read-only while impersonating" },
  { path: "/admin/stop-impersonate", as: A, formPage: "/dashboard", form: {} },
);
for (const p of ["/admin", "/admin/users", "/admin/users/3", "/admin/users/4", "/admin/users/5", "/admin/users/6", "/admin/deposits",
  "/admin/withdrawals", "/admin/audit", "/admin/apps?show=all", "/admin/admins", "/admin/tickets", "/admin/tickets/1", "/admin/test",
  "/admin/settings/economy", "/admin/settings/campaign", "/admin/invoices", "/admin/export/users.csv"]) PAGES.push({ path: p, as: A, note: "after admin" });
for (const p of ["/dashboard", "/invest", "/withdraw", "/activity"]) PAGES.push({ path: p, as: "youssef.test", note: "after admin" });
PAGES.push({ path: "/", as: "anon", note: "after admin" }, { path: "/dashboard", as: "nadia.pending", note: "approved now" });

// Intentional differences (checked by hand; the diffs are still written to the log folder).
const KNOWN = {
  "/admin/apps": "Express emitted invalid nested markup (edit form closed mid-row); Next renders valid HTML, same look and behaviour",
  "/admin/users": "Express bug: the self row's tooltip was built as an escaped string, giving a mangled title; Next renders the intended title",
  "/users": "Express bug: the self row's tooltip was built as an escaped string, giving a mangled title; Next renders the intended title",
};
for (const p of PAGES) {
  const base = p.path.split("?")[0];
  if (KNOWN[base] && !p.form) p.known = KNOWN[base];
}

