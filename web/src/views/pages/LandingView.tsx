// views/landing.ejs
import type { LandingStats } from "@/lib/game";
import type { Plan } from "@/lib/types";
import type { ViewProps } from "../registry";
import { CalcCard, Chips, Pillars, StatsBand } from "../parts/LandingParts";

type Data = { stats: LandingStats; plans: Plan[] };

const CHIPS: [string, string][] = [["layers", "lp_chip_1"], ["trophy", "lp_chip_2"], ["arrow-down-to-line", "lp_chip_3"]];

export default function LandingView({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const s = L.settings;
  return (
    <div className="lp-page">
      <section className="lp-hero py-5">
        <div className="container py-lg-5">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="lp-eyebrow mb-3"><i data-lucide="trophy"></i>{t("hero_badge")}</span>
              <h1 className="lp-title fw-bold mb-3">{t("hero_title")}</h1>
              <p className="lp-lead text-muted mb-4">{t("hero_desc")}</p>
              <div className="d-flex gap-2 flex-wrap mb-4">
                <a href="/signup" className="btn btn-primary btn-lg px-4 d-inline-flex align-items-center gap-2">
                  <i data-lucide="rocket"></i>{t("btn_getstarted")}
                </a>
                <a href="/login" className="btn btn-outline-secondary btn-lg px-4">{t("btn_login")}</a>
              </div>
              <Chips h={h} items={CHIPS} />
            </div>

            <div className="col-lg-6">
              <CalcCard L={L} h={h} plans={data.plans} />
            </div>
          </div>
        </div>
      </section>

      <StatsBand h={h} stats={data.stats} />

      <section className="py-5 mt-2">
        <div className="container">
          <div className="text-center mx-auto mb-5" style={{ maxWidth: 720 }}>
            <span className="sec-eyebrow">{t("hero_badge")}</span>
            <h2 className="sec-title fw-bold mb-3">{t("lp_what_t", { site: s.siteName })}</h2>
            <p className="text-muted mb-0 lh-lg">{t("lp_what_d")}</p>
          </div>
          <Pillars h={h} />
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <div className="text-center mb-5">
            <span className="sec-eyebrow">{t("guide_title")}</span>
            <h2 className="sec-title fw-bold mb-2">{t("lp_more_t")}</h2>
            <a href="/guide" className="d-inline-flex align-items-center gap-1"><i data-lucide="book-open"></i>{t("guide_title")}</a>
          </div>
          <div className="row g-3 justify-content-center">
            <div className="col-md-6">
              <div className="lp-card p-4 d-flex align-items-start gap-3">
                <span className="tile-icon ti-yellow" style={{ width: 48, height: 48, fontSize: "1.25rem" }}><i data-lucide="star"></i></span>
                <div>
                  <h6 className="fw-bold mb-2">{t("howto_level_t")}</h6>
                  <p className="text-muted small mb-0 lh-lg">{t("howto_level_d")}</p>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="lp-card p-4 d-flex align-items-start gap-3">
                <span className="tile-icon ti-sky" style={{ width: 48, height: 48, fontSize: "1.25rem" }}><i data-lucide="arrow-down-to-line"></i></span>
                <div>
                  <h6 className="fw-bold mb-2">{t("howto_withdraw_t")}</h6>
                  <p className="text-muted small mb-0 lh-lg">{t("howto_withdraw_d", { min: money(s.minWithdraw), days: s.withdrawEveryDays })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="text-center mb-5">
            <span className="sec-eyebrow">{t("faq_t")}</span>
            <h2 className="sec-title fw-bold mb-0">{t("faq_t")}</h2>
          </div>
          <div className="accordion accordion-flush faq" id="faq">
            {[1, 2, 3, 4].map((n, i) => (
              <div className="accordion-item border-0 shadow-sm rounded-4 mb-2 overflow-hidden" key={n}>
                <h2 className="accordion-header">
                  <button className={`accordion-button ${i === 0 ? "" : "collapsed"} fw-semibold`} type="button"
                    data-bs-toggle="collapse" data-bs-target={`#faq${n}`}>
                    {t("faq_" + n + "_q")}
                  </button>
                </h2>
                <div id={`faq${n}`} className={`accordion-collapse collapse ${i === 0 ? "show" : ""}`} data-bs-parent="#faq">
                  <div className="accordion-body text-muted small lh-lg">{t("faq_" + n + "_a", { site: s.siteName })}</div>
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
            <div className="d-flex gap-2 flex-wrap justify-content-center">
              <a href="/signup" className="btn btn-light btn-lg px-4 d-inline-flex align-items-center gap-2">
                <i data-lucide="rocket"></i>{t("btn_getstarted")}
              </a>
              <a href="/login" className="btn btn-outline-light btn-lg px-4">{t("btn_login")}</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
