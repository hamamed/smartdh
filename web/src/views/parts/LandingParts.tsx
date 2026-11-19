// Pieces shared by the landing page (landing.ejs) and the ad landing page (start.ejs).
import type { ReactNode } from "react";
import type { LandingStats } from "@/lib/game";
import type { Plan } from "@/lib/types";
import type { LayoutData } from "@/server/page-props";
import type { Helpers } from "../helpers";

export function CalcCard({ L, h, plans, children }: { L: LayoutData; h: Helpers; plans: Plan[]; children?: ReactNode }) {
  const { t } = h;
  return (
    <div className="card calc-card border-0 rounded-4">
      <div className="card-body">
        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="calculator" className="text-primary"></i>{t("calc_title")}</h5>
        <label className="form-label small text-muted mb-1">{t("calc_choose_plan")}</label>
        <select id="calcPlan" className="form-select mb-3">
          {plans.map((p) => (
            // `selected` on the option itself (not select defaultValue): several plans can share a rate.
            <option key={p.id} value={p.ratePer15Days} {...(p.id === "balanced" ? { selected: true } : {})}>
              {`${h.planName(p)} — ${(p.ratePer15Days * 100).toFixed(1)}% ${t("per15_suffix")}`}
            </option>
          ))}
        </select>
        <label className="form-label small text-muted mb-1">{t("calc_ifinvest")}</label>
        <div className="input-group input-group-lg mb-4">
          <span className="input-group-text"><i data-lucide="wallet"></i></span>
          <input type="number" id="calcAmount" className="form-control" defaultValue="10000" min="0" step="100" />
          <span className="input-group-text">{L.curLabel}</span>
        </div>
        <div className="row g-2 text-center" data-currency={L.curLabel}>
          <div className="col-4"><div className="calc-out wallet wallet-coral"><div className="small mb-1">{t("lbl_daily")}</div><div className="fw-bold" id="calcDaily">—</div></div></div>
          <div className="col-4"><div className="calc-out wallet wallet-mint"><div className="small mb-1">{t("lbl_15days")}</div><div className="fw-bold" id="calc15">—</div></div></div>
          <div className="col-4"><div className="calc-out wallet wallet-yellow"><div className="small mb-1">{t("lbl_monthly")}</div><div className="fw-bold" id="calcMonthly">—</div></div></div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatsBand({ h, stats }: { h: Helpers; stats: LandingStats }) {
  if (!stats) return null;
  const tiles: [string, string, string | number, string][] = [
    ["users", "ti-coral", stats.players.toLocaleString(), "stat_players"],
    ["coins", "ti-mint", h.money(stats.coins), "stat_total"],
    ["layers", "ti-sky", stats.apps, "plans_title"],
    ["banknote", "ti-yellow", stats.payouts.toLocaleString(), "lp_stat_payouts"],
  ];
  return (
    <section className="pb-2">
      <div className="container">
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body py-4">
            <div className="row g-3 text-center">
              {tiles.map(([icon, tint, value, key]) => (
                <div className="col-6 col-lg-3" key={key}>
                  <span className={`tile-icon ${tint} mx-auto mb-2`} style={{ width: 46, height: 46, fontSize: "1.2rem" }}><i data-lucide={icon}></i></span>
                  <div className="h4 fw-bold mb-0">{value}</div>
                  <div className="small text-muted">{h.t(key)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PILLARS = [
  { icon: "shield-check", tint: "mint", t: "lp_pillar_1_t", d: "lp_pillar_1_d" },
  { icon: "layers", tint: "coral", t: "lp_pillar_2_t", d: "lp_pillar_2_d" },
  { icon: "medal", tint: "yellow", t: "lp_pillar_3_t", d: "lp_pillar_3_d" },
];

export function Pillars({ h }: { h: Helpers }) {
  return (
    <div className="row g-3">
      {PILLARS.map((p) => (
        <div className="col-md-4" key={p.t}>
          <div className="lp-card text-center p-4">
            <span className={`tile-icon ti-${p.tint} mx-auto mb-3`} style={{ width: 60, height: 60, fontSize: "1.5rem" }}><i data-lucide={p.icon}></i></span>
            <h6 className="fw-bold mb-2">{h.t(p.t)}</h6>
            <p className="text-muted small mb-0 lh-lg">{h.t(p.d)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chips({ h, items }: { h: Helpers; items: [string, string][] }) {
  return <div className="lp-trust">{items.map(([icon, key]) => <span className="chip" key={key}><i data-lucide={icon}></i>{h.t(key)}</span>)}</div>;
}
