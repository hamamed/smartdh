// views/admin/settings-campaign.ejs and views/admin/apps.ejs
import type { Plan } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

export function SettingsCampaignView({ L, h, data }: ViewProps<{ ok: string | null }>) {
  const { t, money } = h;
  const c = L.settings.campaign;
  const cur = <span className="input-group-text">{L.curLabel}</span>;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 680 }}>
        <AdminHead heading={t("set_campaign_t")} back="/admin" />
        {data.ok && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide={data.ok === "invited" ? "mail-check" : "check"}></i>{data.ok === "invited" ? t("camp_invited_ok") : t("profile_saved")}</div>}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <p className="text-muted small mb-3">{t("set_campaign_d")}</p>
            <form action="/admin/settings/campaign" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className={`d-flex align-items-center gap-3 p-3 rounded-3 ${c.enabled ? "wallet wallet-mint" : "bg-body-secondary"} mb-4`}>
                <span className={`tile-icon ${c.enabled ? "ti-mint" : "ti-navy"}`} style={{ width: 46, height: 46, fontSize: "1.2rem" }}><i data-lucide="party-popper"></i></span>
                <div className="flex-grow-1">
                  <div className="fw-bold">{t("camp_enable")}</div>
                  <div className="small">{c.enabled ? t("camp_on") : t("camp_off")}</div>
                </div>
                <div className="form-check form-switch fs-4 mb-0">
                  <input className="form-check-input" type="checkbox" name="enabled" id="enabled" value="1" defaultChecked={c.enabled} />
                </div>
              </div>
              <div className="form-check mb-4">
                <input className="form-check-input" type="checkbox" name="notifyAll" id="notifyAll" value="1" defaultChecked />
                <label className="form-check-label" htmlFor="notifyAll">
                  <span className="fw-semibold">{t("camp_notify")}</span>
                  <span className="d-block text-muted small">{t("camp_notify_hint")}</span>
                </label>
              </div>
              <div className="mb-3">
                <label className="form-label">{t("camp_title_label")} <span className="text-muted small">{t("opt")}</span></label>
                <input name="title" className="form-control" placeholder={t("camp_title")} defaultValue={c.title} />
              </div>
              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("camp_rules")}</h6>
              <div className="row g-3 mb-2">
                <div className="col-md-6">
                  <label className="form-label">{t("camp_goal")}</label>
                  <div className="input-group">
                    <span className="input-group-text"><i data-lucide="users"></i></span>
                    <input name="inviteGoal" type="number" min="1" className="form-control" defaultValue={c.inviteGoal} />
                  </div>
                  <div className="form-text">{t("camp_goal_hint")}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t("camp_mindeposit")}</label>
                  <div className="input-group">
                    <input name="minDeposit" type="number" min="0" className="form-control" defaultValue={c.minDeposit} />
                    {cur}
                  </div>
                  <div className="form-text">{t("camp_mindeposit_hint")}</div>
                </div>
              </div>
              <div className="form-check mb-4">
                <input className="form-check-input" type="checkbox" name="requireActive" id="requireActive" value="1" defaultChecked={c.requireActive} />
                <label className="form-check-label small" htmlFor="requireActive">{t("camp_requireactive")}</label>
              </div>
              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("camp_perinvite")}</h6>
              <div className="row g-3 mb-2">
                <div className="col-md-6">
                  <label className="form-label">{t("camp_coinsperinvite")}</label>
                  <div className="input-group">
                    <input name="coinsPerInvite" type="number" min="0" className="form-control" defaultValue={c.coinsPerInvite} />
                    {cur}
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t("camp_xpperinvite")}</label>
                  <div className="input-group">
                    <input name="xpPerInvite" type="number" min="0" className="form-control" defaultValue={c.xpPerInvite} />
                    <span className="input-group-text">XP</span>
                  </div>
                </div>
              </div>
              <div className="form-text mb-4">{t("camp_perinvite_hint")}</div>
              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("camp_reward")}</h6>
              <div className="form-text mb-2">{t("camp_reward_hint")}</div>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="form-label">{t("camp_rewardcoins")}</label>
                  <div className="input-group">
                    <input name="rewardCoins" type="number" min="0" className="form-control" defaultValue={c.rewardCoins} />
                    {cur}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("camp_rewardxp")}</label>
                  <div className="input-group">
                    <input name="rewardXp" type="number" min="0" className="form-control" defaultValue={c.rewardXp} />
                    <span className="input-group-text">XP</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("camp_maxclaims")}</label>
                  <input name="maxClaims" type="number" min="0" className="form-control" defaultValue={c.maxClaims} />
                  <div className="form-text">{t("camp_maxclaims_hint")}</div>
                </div>
              </div>
              <h6 className="fw-bold small text-uppercase text-muted mb-2">{t("camp_counting")}</h6>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" name="resetCount" id="resetCount" value="1" />
                <label className="form-check-label small" htmlFor="resetCount">{t("camp_reset_count")}</label>
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" name="resetProgress" id="resetProgress" value="1" />
                <label className="form-check-label small" htmlFor="resetProgress">{t("camp_reset_progress")}</label>
              </div>
              {!!c.countFrom && (
                <p className="small text-muted"><i data-lucide="info" className="me-1"></i>{t("camp_counting_since", { date: new Date(c.countFrom).toLocaleString() })}</p>
              )}
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <div className="small text-muted mb-2">{t("ann_preview")}</div>
            <div className="p-3 rounded-3 bg-body-secondary">
              <div className="fw-bold mb-1">{c.title || t("camp_title")}</div>
              <div className="small text-muted">{t("camp_desc", { goal: c.inviteGoal, min: money(c.minDeposit), coins: money(c.rewardCoins), xp: c.rewardXp })}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const COLORS = ["primary", "success", "danger", "warning", "info", "secondary"];
const tintOf = (pc: string) => (pc === "success" ? "mint" : pc === "danger" ? "coral" : pc === "warning" ? "yellow" : "lilac");
type AppsData = { appList: Plan[]; show: string; gen: number; appCounts: Record<string, number> };

export function AppsView({ L, h, data }: ViewProps<AppsData>) {
  const { t, money } = h;
  const filters: [string, string][] = [["published", "app_f_published"], ["unpublished", "app_f_unpublished"], ["all", "app_f_all"]];
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_apps")} />
        {!!data.gen && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{t("app_gen_ok", { n: data.gen })}</div>}
        <div className="btn-group btn-group-sm mb-3" role="group">
          {filters.map(([v, k]) => (
            <a key={v} href={`/admin/apps?show=${v}`} className={`btn btn-outline-primary ${data.show === v ? "active" : ""}`}>{t(k)} <span className="badge bg-dark ms-1">{data.appCounts[v]}</span></a>
          ))}
        </div>
        {data.appList.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4 mb-3"><div className="card-body"><p className="text-muted mb-0">{t("apps_none")}</p></div></div>
        ) : (
          <>
            <div className="row g-3 mb-4">
              {data.appList.map((p) => {
                const pc = h.planColor(p);
                const tint = tintOf(pc);
                const pub = p.published !== false;
                const formId = `edit-${p.id}`;
                return (
                  <div className="col-md-6 col-lg-4" key={p.id}>
                    <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                      <div className="product-media">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <div className={`product-media-fallback ti-${tint}`}><i data-lucide={p.icon}></i></div>}
                        <span className={`badge bg-${pub ? "success" : "secondary"} position-absolute top-0 start-0 m-2 d-inline-flex align-items-center gap-1`}>
                          <i data-lucide={pub ? "eye" : "eye-off"} style={{ width: ".85em", height: ".85em" }}></i>{pub ? t("app_published") : t("app_unpublished")}</span>
                        <span className={`badge bg-${pc} position-absolute top-0 end-0 m-2`}>{p.fixedAmount > 0 ? money(p.fixedAmount) : (p.ratePer15Days * 100).toFixed(0) + "%"}</span>
                      </div>
                      <div className="card-body">
                        <form id={formId} action={`/admin/apps/edit/${p.id}?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">
                          <input type="hidden" name="_csrf" value={L.csrfToken} />
                          <div className="mb-2"><label className="form-label small mb-1">{t("app_name")}</label>
                            <input name="name" className="form-control form-control-sm" defaultValue={p.name} /></div>
                          <div className="mb-2"><label className="form-label small mb-1">{t("app_desc")}</label>
                            <input name="desc" className="form-control form-control-sm" defaultValue={p.desc} /></div>
                          <div className="row g-2 mb-2">
                            <div className="col-6"><label className="form-label small mb-1">{t("app_rate")}</label>
                              <div className="input-group input-group-sm"><input name="rate" type="number" step="0.1" className="form-control" defaultValue={(p.ratePer15Days * 100).toFixed(1)} /><span className="input-group-text">%</span></div></div>
                            <div className="col-6"><label className="form-label small mb-1">{t("app_minlevel")}</label>
                              <input name="minLevel" type="number" min="1" className="form-control form-control-sm" defaultValue={p.minLevel || 1} /></div>
                            <div className="col-12"><label className="form-label small mb-1">{t("set_fixed_amount")}</label>
                              <input name="fixedAmount" type="number" min="0" step="1" className="form-control form-control-sm" defaultValue={p.fixedAmount || 0} />
                              <div className="form-text small">{t("set_fixed_hint")}</div></div>
                            <div className="col-6"><label className="form-label small mb-1">{t("app_icon")}</label>
                              <input name="icon" className="form-control form-control-sm" defaultValue={p.icon} /></div>
                            <div className="col-6"><label className="form-label small mb-1">{t("app_color")}</label>
                              <select name="color" className="form-select form-select-sm" defaultValue={p.color}>
                                {COLORS.map((c) => <option value={c} key={c}>{c}</option>)}
                              </select></div>
                          </div>
                          <div className="mb-2"><label className="form-label small mb-1">{t("app_photo")}</label>
                            <input name="image" type="file" accept="image/*" className="form-control form-control-sm" /></div>
                          <div className="mb-2"><label className="form-label small mb-1">{t("app_image_url")}</label>
                            <input name="imageUrl" type="url" className="form-control form-control-sm" placeholder="https://…" defaultValue={/^https?:/.test(p.imageUrl || "") ? p.imageUrl : ""} /></div>
                          <div className="mb-2"><label className="form-label small mb-1">{t("app_link")}</label>
                            <input name="link" type="url" className="form-control form-control-sm" placeholder="https://…" defaultValue={p.link || ""} />
                            <div className="form-text small">{t("app_link_hint")}</div></div>
                          {p.imageUrl && (
                            <div className="form-check mb-2"><input className="form-check-input" type="checkbox" name="removeImage" value="1" id={`rm${p.id}`} />
                              <label className="form-check-label small" htmlFor={`rm${p.id}`}>{t("app_remove_photo")}</label></div>
                          )}
                        </form>
                        {/* The Express template closed the edit form mid-row (invalid HTML the browser repaired);
                            here the row is valid and the save button joins the edit form by its id. */}
                        <div className="d-flex gap-1">
                          <button form={formId} className="btn btn-sm btn-primary flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
                          <form action={`/admin/apps/publish/${p.id}`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                            <input type="hidden" name="current" value={pub ? "1" : "0"} /><input type="hidden" name="back" value={data.show} />
                            <button className={`btn btn-sm btn-${pub ? "outline-secondary" : "success"} d-inline-flex align-items-center gap-1`} title={pub ? t("app_unpublish") : t("app_publish_btn")}><i data-lucide={pub ? "eye-off" : "eye"}></i></button></form>
                          <form action={`/admin/apps/delete/${p.id}`} method="post" data-raw-onsubmit={`return confirm('${t("confirm_delete_app")}')`}><input type="hidden" name="_csrf" value={L.csrfToken} />
                            <button className="btn btn-sm btn-outline-danger"><i data-lucide="trash-2"></i></button></form>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="form-text mb-4">{t("app_delete_hint")}</p>
          </>
        )}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-2 d-flex align-items-center gap-2"><i data-lucide="sparkles" className="text-primary"></i>{t("app_gen_title")}</h6>
            <p className="text-muted small mb-3">{t("app_gen_desc")}</p>
            <form action="/admin/apps/generate" method="post" className="row g-2 align-items-end" style={{ maxWidth: 420 }}><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="col-auto"><label className="form-label small mb-1">{t("app_gen_count")}</label>
                <input name="count" type="number" min="1" max="500" className="form-control" defaultValue="100" style={{ maxWidth: 120 }} /></div>
              <div className="col-auto"><button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="sparkles"></i>{t("app_gen_btn")}</button></div>
            </form>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="plus" className="text-primary"></i>{t("add_app_title")}</h6>
            <form action={`/admin/apps/add?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data" className="row g-2">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="col-md-6"><label className="form-label small">{t("app_name")}</label><input name="name" className="form-control" required /></div>
              <div className="col-md-3"><label className="form-label small">{t("app_icon")}</label><input name="icon" className="form-control" placeholder="rocket" defaultValue="trending-up" /></div>
              <div className="col-md-3"><label className="form-label small">{t("app_rate")}</label><input name="rate" type="number" step="0.1" className="form-control" defaultValue="10" /></div>
              <div className="col-md-6"><label className="form-label small">{t("app_photo")}</label><input name="image" type="file" accept="image/*" className="form-control" /></div>
              <div className="col-md-3"><label className="form-label small">{t("app_minlevel")}</label><input name="minLevel" type="number" min="1" className="form-control" defaultValue="1" /></div>
              <div className="col-md-3"><label className="form-label small">{t("set_fixed_amount")}</label><input name="fixedAmount" type="number" min="0" step="1" className="form-control" defaultValue="0" placeholder="0" /></div>
              <div className="col-md-3"><label className="form-label small">{t("app_color")}</label>
                <select name="color" className="form-select">
                  {COLORS.map((c) => <option value={c} key={c}>{c}</option>)}
                </select></div>
              <div className="col-md-6"><label className="form-label small">{t("app_image_url")}</label><input name="imageUrl" type="url" className="form-control" placeholder="https://…" /><div className="form-text small">{t("app_image_url_hint")}</div></div>
              <div className="col-md-6"><label className="form-label small">{t("app_link")}</label><input name="link" type="url" className="form-control" placeholder="https://…" /><div className="form-text small">{t("app_link_hint")}</div></div>
              <div className="col-12"><label className="form-label small">{t("app_desc")}</label><input name="desc" className="form-control" /></div>
              <div className="col-12"><button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("btn_addapp")}</button></div>
            </form>
            <p className="form-text mb-0 mt-2">{t("app_photo_hint")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
