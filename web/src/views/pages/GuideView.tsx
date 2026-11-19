// views/guide.ejs
import type { Plan } from "@/lib/types";
import type { ViewProps } from "../registry";

const TOC: [string, string][] = [
  ["start", "g_start_t"], ["home", "g_home_t"], ["menu", "g_menu_t"], ["invest", "g_invest_t"],
  ["withdraw", "g_wd_t"], ["earn", "howto_earn_t"], ["xp", "g_xp_t"], ["ref", "g_ref_t"],
  ["ach", "g_ach_t"], ["activity", "g_act_t"], ["status", "g_status_t"], ["icons", "g_icons_t"],
];
const START: [string, string, string][] = [["user-plus", "g_start_1_t", "g_start_1_d"], ["hourglass", "g_start_2_t", "g_start_2_d"], ["log-in", "g_start_3_t", "g_start_3_d"]];
const HOME: [string, string, string][] = [["gift", "ti-yellow", "g_home_bonus"], ["piggy-bank", "ti-coral", "g_home_w1"], ["coins", "ti-mint", "g_home_w2"],
  ["wallet", "ti-yellow", "g_home_w3"], ["star", "ti-lilac", "g_home_level"], ["chart-line", "ti-sky", "g_home_chart"], ["layout-grid", "ti-navy", "g_home_menu"]];
const MENU: [string, string, string, string][] = [["layers", "ti-coral", "plans_title", "g_m_invest"], ["arrow-down-to-line", "ti-mint", "withdraw_title", "g_m_withdraw"],
  ["send", "ti-sky", "send_title", "g_m_send"], ["gift", "ti-yellow", "db_title", "g_m_rewards"],
  ["trophy", "ti-lilac", "ach_title", "g_m_ach"], ["history", "ti-navy", "activity_title", "g_m_activity"],
  ["medal", "ti-coral", "lb_title", "g_m_board"], ["user-plus", "ti-mint", "invite_title", "g_m_invite"],
  ["user", "ti-sky", "profile_title", "g_m_profile"]];
const XP: [string, string][] = [["g_xp_deposit", "+10 … +200 XP"], ["g_xp_bonus", "+10 XP"], ["g_xp_send", "+5 XP"], ["g_xp_ach", "+25 XP"]];
const STATUSES: [string, string, string][] = [["warning", "st_pending", "g_st_pending"], ["success", "st_active", "g_st_active"], ["success", "st_approved", "g_st_approved"],
  ["success", "st_paid", "g_st_paid"], ["danger", "st_rejected", "g_st_rejected"]];
const ICONS: [string, string][] = [["arrow-left", "g_i_back"], ["plus", "g_i_plus"], ["copy", "g_i_copy"], ["moon", "g_i_theme"],
  ["globe", "g_i_lang"], ["circle-help", "g_i_help"], ["lock", "g_i_lock"], ["gift", "g_i_gift"]];

const tintOf = (color: string) =>
  color === "primary" ? "navy" : color === "success" ? "mint" : color === "danger" ? "coral" : color === "warning" ? "yellow" : color === "info" ? "sky" : "lilac";

export default function GuideView({ L, h, data }: ViewProps<{ plans: Plan[] }>) {
  const { t, money } = h;
  const s = L.settings;
  const tiers = s.referralTiers;
  const earn: [string, string, string, string][] = [
    ["coins", "ti-mint", "howto_earn_1_t", t("howto_earn_1_d")],
    ["gift", "ti-yellow", "howto_earn_2_t", t("howto_earn_2_d", { max: money(s.dailyBonusBase * 7) })],
    ["user-plus", "ti-coral", "howto_earn_3_t", t("howto_earn_3_d", { t1: tiers[0] * 100, t2: tiers[1] * 100, t3: tiers[2] * 100 })],
    ["trophy", "ti-lilac", "howto_earn_4_t", t("howto_earn_4_d")],
  ];
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <a href={L.user ? "/dashboard" : "/"} className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h2 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="book-open" className="text-primary"></i>{t("guide_title")}</h2>
        </div>
        <p className="text-muted mb-4">{t("guide_sub")}</p>

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="list" className="text-primary"></i>{t("guide_toc")}</h6>
            <div className="d-flex flex-wrap gap-2">
              {TOC.map(([id, key]) => <a key={id} href={`#${id}`} className="badge bg-body-secondary text-body text-decoration-none p-2">{t(key)}</a>)}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="start">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">1</span>{t("g_start_t")}</h5>
            <p className="text-muted small mb-3">{t("g_start_d")}</p>
            {START.map(([icon, tk, dk]) => (
              <div className="d-flex align-items-start gap-3 border-bottom py-2" key={tk}>
                <span className="tile-icon ti-navy" style={{ width: 36, height: 36, fontSize: "1rem" }}><i data-lucide={icon}></i></span>
                <div><div className="fw-semibold small">{t(tk)}</div><div className="text-muted small">{t(dk)}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="home">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">2</span>{t("g_home_t")}</h5>
            <p className="text-muted small mb-3">{t("g_home_d")}</p>
            {HOME.map(([icon, tint, key]) => (
              <div className="d-flex align-items-center gap-3 border-bottom py-2" key={key}>
                <span className={`tile-icon ${tint}`} style={{ width: 34, height: 34, fontSize: ".95rem" }}><i data-lucide={icon}></i></span>
                <div className="text-muted small">{t(key)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="menu">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">3</span>{t("g_menu_t")}</h5>
            <p className="text-muted small mb-3">{t("g_menu_d")}</p>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <tbody>
                  {MENU.map(([icon, tint, nameKey, descKey]) => (
                    <tr key={descKey}>
                      <td style={{ width: 44 }}><span className={`tile-icon ${tint}`} style={{ width: 34, height: 34, fontSize: ".95rem" }}><i data-lucide={icon}></i></span></td>
                      <td className="fw-semibold small text-nowrap">{t(nameKey)}</td>
                      <td className="text-muted small">{t(descKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="invest">
          <div className="card-body">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><span className="step-num">4</span>{t("g_invest_t")}</h5>
            <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("g_invest_apps")}</h6>
            <div className="table-responsive mb-4">
              <table className="table table-sm align-middle mb-0">
                <thead className="text-muted small"><tr><th>{t("th_app")}</th><th>{t("th_rate")}</th><th>{t("th_level")}</th></tr></thead>
                <tbody>
                  {data.plans.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`tile-icon ti-${tintOf(p.color)}`} style={{ width: 32, height: 32, fontSize: ".9rem" }}><i data-lucide={p.icon}></i></span>
                          <div><div className="fw-semibold small">{h.planName(p)}</div><div className="text-muted" style={{ fontSize: ".75rem" }}>{h.planDesc(p)}</div></div>
                        </div>
                      </td>
                      <td><span className={`badge bg-${p.color}-subtle text-${p.color}`}>{`${(p.ratePer15Days * 100).toFixed(1)}% ${t("per15_suffix")}`}</span></td>
                      <td className="small">{(p.minLevel || 1) > 1 ? t("locked_at", { n: p.minLevel }) : t("level_label") + " 1"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("g_invest_flow")}</h6>
            <ol className="text-muted small ps-3 mb-0">
              <li className="mb-1">{t("g_invest_f1", { min: money(s.minAddFunds) })}</li>
              <li className="mb-1">{t("g_invest_f2")}</li>
              <li className="mb-1">{t("g_invest_f3")}</li>
              <li>{t("g_invest_f4")}</li>
            </ol>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="withdraw">
          <div className="card-body">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><span className="step-num">5</span>{t("g_wd_t")}</h5>
            <ol className="text-muted small ps-3 mb-0">
              <li className="mb-1">{t("g_wd_1")}</li>
              <li className="mb-1">{t("g_wd_2", { min: money(s.minWithdraw), days: s.withdrawEveryDays })}</li>
              <li className="mb-1">{t("g_wd_3")}</li>
              <li>{t("g_wd_4")}</li>
            </ol>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="earn">
          <div className="card-body">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><span className="step-num">6</span>{t("howto_earn_t")}</h5>
            {earn.map(([icon, tint, tk, d]) => (
              <div className="d-flex align-items-start gap-3 border-bottom py-2" key={tk}>
                <span className={`tile-icon ${tint}`} style={{ width: 34, height: 34, fontSize: ".95rem" }}><i data-lucide={icon}></i></span>
                <div><div className="fw-semibold small">{t(tk)}</div><div className="text-muted small">{d}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="xp">
          <div className="card-body">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><span className="step-num">7</span>{t("g_xp_t")}</h5>
            <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("g_xp_sources")}</h6>
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <tbody>
                  {XP.map(([k, v]) => <tr key={k}><td className="small text-muted">{t(k)}</td><td className="text-end"><span className="badge bg-success-subtle text-success">{v}</span></td></tr>)}
                </tbody>
              </table>
            </div>
            <p className="text-muted small mb-0"><i data-lucide="info" className="me-1"></i>{t("g_xp_formula")}</p>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="ref">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">8</span>{t("g_ref_t")}</h5>
            <p className="text-muted small mb-3">{t("g_ref_d")}</p>
            <div className="row g-2">
              {["coral", "yellow", "sky"].map((tint, i) => (
                <div className="col-md-4" key={tint}>
                  <div className="p-3 rounded-3 bg-body-secondary h-100">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className={`tile-icon ti-${tint}`} style={{ width: 30, height: 30, fontSize: ".85rem" }}><i data-lucide="users"></i></span>
                      <span className="fw-semibold small">{t("ref_tier", { n: i + 1 })}</span>
                      <span className="badge bg-success-subtle text-success ms-auto">{`${tiers[i] * 100}%`}</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: ".75rem" }}>{t("ref_tier_" + (i + 1) + "_d")}</div>
                  </div>
                </div>
              ))}
            </div>
            {s.campaign && s.campaign.enabled && (
              <div className="alert alert-warning small mt-3 mb-0 d-flex align-items-center gap-2">
                <i data-lucide="party-popper"></i>
                <span><strong>{s.campaign.title || t("camp_title")}</strong> — {t("camp_desc", { goal: s.campaign.inviteGoal, min: money(s.campaign.minDeposit), coins: money(s.campaign.rewardCoins), xp: s.campaign.rewardXp })}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="ach">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">9</span>{t("g_ach_t")}</h5>
            <p className="text-muted small mb-3">{t("g_ach_d")}</p>
            <div className="row g-2">
              {Object.keys(h.ACH).map((id) => (
                <div className="col-6 col-md-3" key={id}>
                  <div className="text-center p-2 rounded-3 bg-warning-subtle h-100">
                    <div className="fs-4 text-warning"><i data-lucide={h.ACH[id].icon}></i></div>
                    <div className="small fw-semibold">{h.achName(id)}</div>
                    <div className="text-muted" style={{ fontSize: ".7rem" }}>{h.achDesc(id)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="activity">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">10</span>{t("g_act_t")}</h5>
            <p className="text-muted small mb-3">{t("g_act_d")}</p>
            <div className="row g-2">
              {Object.keys(h.TX).map((type) => {
                const m = h.TX[type];
                return (
                  <div className="col-md-6" key={type}>
                    <div className="d-flex align-items-center gap-2 border-bottom py-2">
                      <span className={`rounded-circle d-flex align-items-center justify-content-center bg-${m.cls}-subtle text-${m.cls}`}
                        style={{ width: 30, height: 30, flex: "0 0 30px", fontSize: ".85rem" }}><i data-lucide={m.icon}></i></span>
                      <span className="small">{h.txLabel(type)}</span>
                      {m.sign && <span className={`badge bg-${m.cls}-subtle text-${m.cls} ms-auto`}>{m.sign}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="status">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">11</span>{t("g_status_t")}</h5>
            <p className="text-muted small mb-3">{t("g_status_d")}</p>
            {STATUSES.map(([cls, badge, desc]) => (
              <div className="d-flex align-items-center gap-3 border-bottom py-2" key={desc}>
                <span className={`badge bg-${cls}-subtle text-${cls}`} style={{ minWidth: 90 }}>{t(badge)}</span>
                <span className="text-muted small">{t(desc)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3" id="icons">
          <div className="card-body">
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><span className="step-num">12</span>{t("g_icons_t")}</h5>
            <p className="text-muted small mb-3">{t("g_icons_d")}</p>
            <div className="row g-2">
              {ICONS.map(([icon, key]) => (
                <div className="col-md-6" key={key}>
                  <div className="d-flex align-items-center gap-3 border-bottom py-2">
                    <span className="btn btn-sm btn-outline-secondary btn-icon rounded-circle pe-none"><i data-lucide={icon}></i></span>
                    <span className="text-muted small">{t(key)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!L.user && (
          <div className="text-center mt-4">
            <a href="/signup" className="btn btn-primary px-4 d-inline-flex align-items-center gap-2"><i data-lucide="rocket"></i>{t("btn_getstarted")}</a>
          </div>
        )}
      </div>
    </section>
  );
}
