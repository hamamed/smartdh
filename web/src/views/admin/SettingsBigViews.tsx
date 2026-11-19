// views/admin/settings-general.ejs and views/admin/settings-economy.ejs
import type { GrowthDim } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

export function SettingsGeneralView({ L, h, data }: ViewProps<{ ok: string | null }>) {
  const { t } = h;
  const s = L.settings;
  const removeConfirm = `return confirm('${t("set_brand_remove_c")}')`;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <AdminHead heading={t("set_general_t")} back="/admin/settings" />
        {data.ok && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{t("profile_saved")}</div>}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <p className="text-muted small mb-3">{t("set_general_d")}</p>
            <form action="/admin/settings/general" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label">{t("set_gamename")}</label>
                <input name="siteName" className="form-control" defaultValue={s.siteName} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("set_currency")}</label>
                <input name="currency" className="form-control" style={{ maxWidth: 140 }} defaultValue={s.currency} required />
                <div className="form-text">{t("set_currency_hint")}</div>
              </div>
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1">{t("set_brand_t")}</h6>
            <p className="text-muted small mb-3">{t("set_brand_d")}</p>
            <div className="mb-3">
              <div className="small text-muted mb-1">{t("set_brand_preview")}</div>
              <div className="d-inline-flex align-items-center gap-1 fw-bold text-primary border rounded-3 px-3 py-2 bg-body">
                {s.brandMode === "logo" && s.logoUrl
                  ? <img src={s.logoUrl} alt={s.siteName} className="brand-logo" />
                  : <><i data-lucide="trending-up"></i>{s.siteName}</>}
              </div>
            </div>
            <form action={`/admin/settings/logo?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="brandMode" id="bm-text" value="text" defaultChecked={s.brandMode !== "logo"} />
                  <label className="form-check-label" htmlFor="bm-text">{t("set_brand_text")}</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="brandMode" id="bm-logo" value="logo" defaultChecked={s.brandMode === "logo"} />
                  <label className="form-check-label" htmlFor="bm-logo">{t("set_brand_logo")}</label>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("set_brand_upload")}</label>
                <input type="file" name="logo" accept="image/*" className="form-control" />
                <div className="form-text">{t("set_brand_hint")}</div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
                {s.logoUrl && (
                  <button name="remove" value="1" className="btn btn-outline-danger d-inline-flex align-items-center gap-1" data-raw-onclick={removeConfirm}><i data-lucide="trash-2"></i>{t("set_brand_remove")}</button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="mail" className="text-primary"></i>{t("set_emaillogo_t")}</h6>
            <p className="text-muted small mb-3">{t("set_emaillogo_d")}</p>
            <div className="mb-3">
              <div className="small text-muted mb-1">{t("set_brand_preview")}</div>
              <div className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-2" style={{ background: "linear-gradient(135deg,#13b07f,#0b7d57)" }}>
                {s.emailLogoUrl
                  ? <img src={s.emailLogoUrl} alt="email logo" style={{ height: 34, maxHeight: 34, width: "auto", display: "block" }} />
                  : <span className="fw-bold text-white">{s.siteName}</span>}
              </div>
              {!s.emailLogoUrl && <div className="form-text">{t("set_emaillogo_none")}</div>}
            </div>
            <form action={`/admin/settings/email-logo?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label small">{t("set_brand_upload")}</label>
                <input type="file" name="emailLogo" accept="image/*" className="form-control" />
                <div className="form-text">{t("set_emaillogo_hint")}</div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
                {s.emailLogoUrl && (
                  <button name="remove" value="1" className="btn btn-outline-danger d-inline-flex align-items-center gap-1" data-raw-onclick={removeConfirm}><i data-lucide="trash-2"></i>{t("set_brand_remove")}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SettingsEconomyView({ L, h, data }: ViewProps<{ ok: string | null }>) {
  const { t, money } = h;
  const s = L.settings;
  const hs = s.homeStats || ({} as typeof s.homeStats);
  const dims: [string, Partial<GrowthDim>, string][] = [["gUsers", hs.users || {}, t("stat_players")], ["gPayouts", hs.payouts || {}, t("lp_stat_payouts")], ["gCoins", hs.coins || {}, t("stat_total")]];
  const money3 = (name: string, value: number) => (
    <div className="input-group"><input name={name} type="number" min="0" className="form-control" defaultValue={value} />
      <span className="input-group-text">{L.curLabel}</span></div>
  );
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 680 }}>
        <AdminHead heading={t("set_economy_t")} back="/admin/settings" />
        {data.ok && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{t("profile_saved")}</div>}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <p className="text-muted small mb-3">{t("set_economy_d")}</p>
            <form action="/admin/settings/economy" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("set_limits")}</h6>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="form-label">{t("set_minadd")}</label>
                  {money3("minAddFunds", s.minAddFunds)}
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("set_minwd")}</label>
                  {money3("minWithdraw", s.minWithdraw)}
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("set_mintransfer")}</label>
                  {money3("minTransfer", s.minTransfer)}
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("set_wdevery")}</label>
                  <input name="withdrawEveryDays" type="number" min="0" className="form-control" defaultValue={s.withdrawEveryDays} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("set_lockdays")}</label>
                  <div className="input-group">
                    <input name="depositLockDays" type="number" min="0" className="form-control" defaultValue={s.depositLockDays} />
                    <span className="input-group-text">{t("days_unit")}</span>
                  </div>
                  <div className="form-text">{t("set_lockdays_hint")}</div>
                </div>
              </div>

              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("set_tiers")}</h6>
              <div className="row g-3 mb-2">
                {[1, 2, 3].map((n) => (
                  <div className="col-md-4" key={n}>
                    <label className="form-label">{t("ref_tier", { n })}</label>
                    <div className="input-group">
                      <input name={`tier${n}`} type="number" step="0.05" min="0" className="form-control" defaultValue={String(s.referralTiers[n - 1] * 100)} />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-text mb-4">{t("set_tiers_hint")}</div>

              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("set_rewards")}</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">{t("set_dailybase")}</label>
                  {money3("dailyBonusBase", s.dailyBonusBase)}
                  <div className="form-text">{t("set_dailybase_hint", { max: money(s.dailyBonusBase * 7) })}</div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-4 mb-3 pt-2 border-top">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" role="switch" name="dailyBonusEnabled" value="1" id="dbSwitch" defaultChecked={s.dailyBonusEnabled} />
                  <label className="form-check-label d-flex align-items-center gap-1" htmlFor="dbSwitch"><i data-lucide="gift"></i>{t("set_dailybonus")}</label>
                </div>
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" role="switch" name="leaderboardEnabled" value="1" id="lbSwitch" defaultChecked={s.leaderboardEnabled} />
                  <label className="form-check-label d-flex align-items-center gap-1" htmlFor="lbSwitch"><i data-lucide="medal"></i>{t("set_leaderboard")}</label>
                </div>
              </div>

              <div className="pt-3 border-top">
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" role="switch" name="growthEnabled" value="1" id="grSwitch" defaultChecked={hs.enabled !== false} />
                  <label className="form-check-label fw-semibold d-flex align-items-center gap-1" htmlFor="grSwitch"><i data-lucide="trending-up"></i>{t("set_growth")}</label>
                </div>
                <div className="form-text mb-2">{t("set_growth_hint")}</div>
                <div className="row g-3">
                  {dims.map(([k, d, label]) => (
                    <div className="col-md-6" key={k}>
                      <label className="form-label small fw-semibold mb-1">{label}</label>
                      <div className="row g-2">
                        <div className="col-4"><input name={`${k}Base`} type="number" min="0" className="form-control form-control-sm" defaultValue={d.base || 0} placeholder="0" /><div className="form-text mb-0">{t("set_growth_base")}</div></div>
                        <div className="col-4"><input name={`${k}Min`} type="number" min="0" className="form-control form-control-sm" defaultValue={d.min || 0} placeholder="70" /><div className="form-text mb-0">{t("set_growth_min")}</div></div>
                        <div className="col-4"><input name={`${k}Spread`} type="number" min="0" className="form-control form-control-sm" defaultValue={d.spread || 0} placeholder="80" /><div className="form-text mb-0">{t("set_growth_spread")}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary d-inline-flex align-items-center gap-1 mt-3"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>
        <div className="alert alert-secondary small mt-3 d-flex align-items-center gap-2">
          <i data-lucide="info"></i><span>{t("set_rates_note")} <a href="/admin/apps">{t("tab_apps")}</a>.</span>
        </div>
      </div>
    </section>
  );
}
