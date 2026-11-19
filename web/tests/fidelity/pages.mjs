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
