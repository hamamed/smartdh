// views/layout.ejs as React: the <head> tags (rendered by _document) and the page
// chrome around every view (nav, announcement, impersonation bar, bottom nav, footer,
// the window.MSG strings and the CDN + app scripts).
import { Fragment, type ReactNode } from "react";
import type { LayoutData } from "@/server/page-props";
import { cx, helpers } from "./helpers";

const GA_ID = "G-0BREKVPJ6X";

/** Inline script whose text must stay exactly as written. */
export function InlineScript({ code }: { code: string }) {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

// JSON inside a <script>: escape "<" so text can never close the tag.
export const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export function gaScript(L: LayoutData): string {
  const pageTitle = L.title ? L.title : L.settings.siteName;
  let s = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}', {
      page_title: ${jsonForScript(pageTitle)},
      page_path: location.pathname
    });
`;
  if (L.gaEvent) s += `    gtag('event', ${jsonForScript(L.gaEvent.name)}, ${jsonForScript(L.gaEvent.params || {})});\n`;
  return s;
}

export const THEME_SCRIPT = "try{var th=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-bs-theme',th);}catch(e){}";

export function DefaultHead({ L }: { L: LayoutData }) {
  const s = L.settings;
  return (
    <>
      <title>{(L.title ? L.title + " · " : "") + s.siteName}</title>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}></script>
      <InlineScript code={gaScript(L)} />
      <InlineScript code={THEME_SCRIPT} />
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#0e9f6e" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={s.siteName} />
      <link rel="apple-touch-icon" href={`/icons/icon-192.png?v=${L.assetV}`} />
      <link rel="icon" href={`/icons/icon-192.png?v=${L.assetV}`} />
      <link rel="shortcut icon" href={`/icons/icon-192.png?v=${L.assetV}`} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- same fonts as the Express layout */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      {L.dir === "rtl"
        ? <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css" rel="stylesheet" />
        : <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />}
      <link href={`/css/style.css?v=${L.assetV}`} rel="stylesheet" />
    </>
  );
}

function msgScript(L: LayoutData): string {
  const { t } = helpers(L);
  const keys = ["f_funds", "f_withdraw", "f_bonus", "f_sent", "f_deprequested", "f_moved", "e_move", "f_campaign", "e_campaign", "e_payout",
    "e_amount", "e_plan", "e_wamount", "e_tamount", "e_recipient", "e_insufficient", "e_cadence", "e_claimed", "e_locked", "e_wlocked", "e_needdeposit",
    "bulk_confirm_delete", "bulk_confirm_reject", "copied"];
  const msg: Record<string, string> = {};
  for (const k of keys) msg[k] = t(k);
  msg.copy = t("btn_copy");
  msg.cur = L.curLabel;
  msg.earn30 = t("earn_30d");
  msg.move_avail = t("move_avail", { amt: "__A__" });
  return `window.MSG = ${jsonForScript(msg)};`;
}

export const ICONS_SCRIPT = "window.renderIcons = () => window.lucide && lucide.createIcons({ attrs: { width: '1em', height: '1em' } }); renderIcons();";

export function Layout({ L, children }: { L: LayoutData; children: ReactNode }) {
  const { t } = helpers(L);
  const s = L.settings;
  const u = L.user;
  const showBottomNav = u && u.status === "active" && !u.isAdmin;
  const nav = [
    { href: "/dashboard", icon: "home", label: t("nav_home"), match: ["/dashboard"] },
    { href: "/invest", icon: "layers", label: t("plans_title"), match: ["/invest"] },
    { href: "/withdraw", icon: "arrow-down-to-line", label: t("withdraw_title"), match: ["/withdraw"] },
    { href: "/support", icon: "life-buoy", label: t("sup_title"), match: ["/support"] },
    { href: "/profile", icon: "user", label: t("profile_title"), match: ["/profile"] },
  ];
  const isActive = (m: string[]) => m.some((p) => L.reqPath === p || L.reqPath.indexOf(p + "/") === 0);
  const currentLang = L.langs.find((l) => l.code === L.lang);

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-body border-bottom sticky-top">
        <div className="container">
          <a className="navbar-brand fw-bold text-primary d-flex align-items-center gap-1" href="/">
            {s.brandMode === "logo" && s.logoUrl
              ? <img src={s.logoUrl} alt={s.siteName} className="brand-logo" />
              : <><i data-lucide="trending-up"></i>{s.siteName}</>}
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="nav">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              {u && u.isAdmin && (
                <li className="nav-item">
                  <a href={L.adminUrl} className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="shield"></i>{t("nav_admin")}</a>
                </li>
              )}
              <li className="nav-item dropdown lang-switch">
                <button className="btn btn-sm btn-outline-secondary dropdown-toggle d-inline-flex align-items-center gap-1" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i data-lucide="globe"></i><span>{currentLang ? currentLang.name : ""}</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li><h6 className="dropdown-header d-flex align-items-center gap-1"><i data-lucide="languages"></i>{t("nav_language")}</h6></li>
                  {L.langs.map((l) => (
                    <li key={l.code}>
                      <a className={cx("dropdown-item d-flex align-items-center gap-2", l.code === L.lang && "active")} href={`/lang/${l.code}`}>
                        <i data-lucide={l.code === L.lang ? "check" : "circle"} className={l.code === L.lang ? "" : "opacity-25"}></i>
                        <span className="flex-grow-1">{l.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="nav-item">
                <button id="themeToggle" className="btn btn-sm btn-outline-secondary btn-icon ms-lg-2" title="Theme"><i data-lucide="moon"></i></button>
              </li>
              {u ? (
                <li className="nav-item ms-lg-1">
                  <form action="/logout" method="post" className="d-inline"><input type="hidden" name="_csrf" value={L.csrfToken} />
                    <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"><i data-lucide="log-out"></i>{t("nav_logout")}</button>
                  </form>
                </li>
              ) : (
                <>
                  <li className="nav-item"><a className="nav-link" href="/login">{t("nav_login")}</a></li>
                  <li className="nav-item ms-lg-2"><a className="btn btn-sm btn-primary px-3" href="/signup">{t("nav_getstarted")}</a></li>
                </>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {s.announcement && s.announcement.enabled && s.announcement.text && (
        <div className="announcement-bar">
          <div className="container d-flex align-items-center gap-2 py-2 small">
            <i data-lucide="megaphone" className="flex-shrink-0"></i>
            <span className="flex-grow-1">{s.announcement.text}</span>
          </div>
        </div>
      )}

      {L.impersonating && u && (
        <div className="impersonate-bar">
          <div className="container d-flex align-items-center gap-2 py-2 small">
            <i data-lucide="eye" className="flex-shrink-0"></i>
            <span className="flex-grow-1">{t("imp_viewing", { name: u.name })}</span>
            <form action="/admin/stop-impersonate" method="post" className="mb-0"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <button className="btn btn-sm btn-light d-inline-flex align-items-center gap-1"><i data-lucide="log-out"></i>{t("imp_exit")}</button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-grow-1">{children}</main>

      {showBottomNav && (
        <nav className="bottom-nav d-lg-none" aria-label="app navigation">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className={cx("bn-item", isActive(n.match) && "active")}>
              <span className="bn-ic"><i data-lucide={n.icon}></i></span>
              <span className="bn-lb">{n.label}</span>
            </a>
          ))}
        </nav>
      )}

      <footer className="bg-body border-top py-4">
        <div className="container small text-muted">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div className="d-flex align-items-center gap-1"><strong>{t("footer_strong")}</strong> {t("footer_rest")}</div>
            <div className="d-flex flex-wrap align-items-center gap-3">
              {u && u.status === "active" && (
                <a href="/dashboard?tour=1" className="text-muted d-inline-flex align-items-center gap-1"><i data-lucide="circle-help"></i>{t("tour_help")}</a>
              )}
              <a href="/guide" className="text-muted d-inline-flex align-items-center gap-1"><i data-lucide="book-open"></i>{t("nav_guide")}</a>
              <a href="/contact" className="text-muted d-inline-flex align-items-center gap-1"><i data-lucide="mail"></i>{t("footer_contact")}</a>
              <a href="/download" className="text-muted d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("dl_title")}</a>
              <a href="/terms" className="text-muted">{t("footer_terms")}</a>
              <a href="/privacy" className="text-muted">{t("footer_privacy")}</a>
              <span className="d-inline-flex align-items-center gap-2">
                <i data-lucide="globe"></i>
                {L.langs.map((l, i) => (
                  <Fragment key={l.code}>
                    <a href={`/lang/${l.code}`} className={l.code === L.lang ? "fw-bold text-primary" : "text-muted"}>{l.name}</a>
                    {i < L.langs.length - 1 && <span className="opacity-50">·</span>}
                  </Fragment>
                ))}
              </span>
            </div>
          </div>
        </div>
      </footer>

      <InlineScript code={msgScript(L)} />
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/lucide@0.454.0/dist/umd/lucide.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
      <InlineScript code={ICONS_SCRIPT} />
      <script src={`/js/app.js?v=${L.assetV}`}></script>
    </>
  );
}
