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
