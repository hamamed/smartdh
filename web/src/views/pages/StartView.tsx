// views/start.ejs — the ad-campaign landing page, rendered without the main layout.
import type { LandingStats } from "@/lib/game";
import type { Plan } from "@/lib/types";
import type { LayoutData } from "@/server/page-props";
import { helpers } from "../helpers";
import { InlineScript, THEME_SCRIPT, jsonForScript } from "../Layout";
import { CalcCard, Chips, Pillars, StatsBand } from "../parts/LandingParts";
import type { ViewProps } from "../registry";

type Data = { stats: LandingStats; ref: string; signup: string; plans: Plan[] };

const GA = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-0BREKVPJ6X', { page_title: 'Ad landing', page_path: location.pathname });
`;

export function StartHead({ L }: { L: LayoutData }) {
  const { t } = helpers(L);
  const s = L.settings;
  return (
    <>
      <title>{`${t("start_h1")} · ${s.siteName}`}</title>
      <meta name="description" content={t("start_sub")} />
      <InlineScript code={THEME_SCRIPT} />
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-0BREKVPJ6X"></script>
      <InlineScript code={GA} />
      <meta name="theme-color" content="#0e9f6e" />
      <link rel="icon" href={`/icons/icon-192.png?v=${L.assetV}`} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- same fonts as the Express page */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      {L.dir === "rtl"
        ? <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css" rel="stylesheet" />
        : <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />}
      <link href={`/css/style.css?v=${L.assetV}`} rel="stylesheet" />
    </>
  );
}

const START_CHIPS: [string, string][] = [["badge-check", "start_free"], ["shield-check", "start_secure"], ["arrow-down-to-line", "start_fast"]];

export function StartBody({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const s = L.settings;
  const steps = [
    { icon: "user-plus", text: t("howto_invest_1") },
    { icon: "layers", text: t("howto_invest_2", { min: money(s.minAddFunds) }) },
    { icon: "shield", text: t("howto_invest_3") },
    { icon: "trending-up", text: t("howto_invest_4") },
  ];
  return (
    <>
      <header className="container d-flex align-items-center justify-content-between py-3">
        <a href="/" className="navbar-brand fw-bold text-primary d-inline-flex align-items-center gap-2 mb-0" style={{ textDecoration: "none" }}>
          {s.brandMode === "logo" && s.logoUrl
            ? <img src={s.logoUrl} alt={s.siteName} className="brand-logo" />
            : <><i data-lucide="trending-up"></i>{s.siteName}</>}
        </a>
        <a href="/login" className="btn btn-sm btn-outline-secondary">{t("btn_login")}</a>
      </header>

      <main className="flex-grow-1">
        <section className="lp-hero py-4 py-lg-5">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-lg-6">
                <span className="lp-eyebrow mb-3"><i data-lucide="sparkles"></i>{t("start_badge")}</span>
                <h1 className="lp-title fw-bold mb-3">{t("start_h1")}</h1>
                <p className="lp-lead text-muted mb-4">{t("start_sub")}</p>
                <a href={data.signup} className="btn btn-primary btn-lg px-4 d-inline-flex align-items-center gap-2 mb-3">
                  <i data-lucide="rocket"></i>{t("start_cta")}
                </a>
                <Chips h={h} items={START_CHIPS} />
              </div>
              <div className="col-lg-6">
                <CalcCard L={L} h={h} plans={data.plans}>
                  <a href={data.signup} className="btn btn-primary w-100 mt-3 d-inline-flex align-items-center justify-content-center gap-2"><i data-lucide="rocket"></i>{t("start_cta")}</a>
                </CalcCard>
              </div>
            </div>
          </div>
        </section>

        <StatsBand h={h} stats={data.stats} />

        <section className="py-5">
          <div className="container">
            <div className="text-center mx-auto mb-5" style={{ maxWidth: 640 }}>
              <span className="sec-eyebrow">{t("start_badge")}</span>
              <h2 className="sec-title fw-bold mb-0">{t("lp_what_t", { site: s.siteName })}</h2>
            </div>
            <Pillars h={h} />
          </div>
        </section>

        <section className="py-5">
          <div className="container">
            <div className="text-center mb-5">
              <span className="sec-eyebrow">{t("lp_steps_d")}</span>
              <h2 className="sec-title fw-bold mb-0">{t("lp_steps_t")}</h2>
            </div>
            <div className="row g-4 lp-steps">
              {steps.map((st, i) => (
                <div className="col-md-6 col-lg-3" key={st.icon}>
                  <div className="lp-step h-100">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="step-num">{i + 1}</span>
                      <span className="tile-icon ti-navy" style={{ width: 44, height: 44, fontSize: "1.15rem" }}><i data-lucide={st.icon}></i></span>
                    </div>
                    <p className="text-muted small mb-0 lh-lg">{st.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-5">
          <div className="container">
            <div className="cta-band text-center px-3 px-md-5 py-5">
              <h2 className="fw-bold mb-2">{t("lp_ready_t")}</h2>
              <p className="cta-note mb-4 mx-auto" style={{ maxWidth: "46ch" }}>{t("lp_ready_d")}</p>
              <a href={data.signup} className="btn btn-light btn-lg px-4 d-inline-flex align-items-center gap-2"><i data-lucide="rocket"></i>{t("start_cta")}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="container py-4 text-center small text-muted">
        {t("footer_strong")} {t("footer_rest")}
      </footer>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/lucide@0.454.0/dist/umd/lucide.min.js"></script>
      <InlineScript code={`window.renderIcons = function(){ if (window.lucide) lucide.createIcons(); }; window.MSG = ${jsonForScript({ cur: L.curLabel, earn30: t("earn_30d") })};`} />
      <script src={`/js/app.js?v=${L.assetV}`}></script>
      <InlineScript code="window.renderIcons();" />
    </>
  );
}
