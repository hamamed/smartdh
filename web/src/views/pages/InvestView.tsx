// views/invest.ejs
import type { Deposit, Settings, User } from "@/lib/types";
import { InlineScript } from "../Layout";
import type { ViewProps } from "../registry";

type Funds = Record<string, { held: number; locked: number; available: number; unlockAt: number }>;
type Data = { user: User; depositInfo: Settings["depositInfo"]; depositQR: string; funds: Funds; myDeposits: Deposit[]; level: number };

// Move-investment picker: cap the amount at the source plan's available, and stop the
// same plan being both source and destination. (Verbatim from invest.ejs.)
const MOVE_SCRIPT = "\n(function () {\n  const form = document.getElementById('moveForm');\n  if (!form) return;\n  const M = window.MSG || {};\n  const fromSel = document.getElementById('moveFrom');\n  const toSel = document.getElementById('moveTo');\n  const amount = document.getElementById('moveAmount');\n  const availLbl = document.getElementById('moveAvail');\n  function sync() {\n    const opt = fromSel.options[fromSel.selectedIndex];\n    const avail = opt ? Number(opt.dataset.avail) || 0 : 0;\n    amount.max = avail;\n    if (availLbl) availLbl.textContent = (M.move_avail || 'Available: __A__')\n      .replace('__A__', avail.toLocaleString() + ' ' + (M.cur || ''));\n    // A plan can't move into itself.\n    [].forEach.call(toSel.options, o => { o.disabled = (o.value === fromSel.value); });\n    if (toSel.value === fromSel.value) {\n      const alt = [].filter.call(toSel.options, o => !o.disabled)[0];\n      if (alt) toSel.value = alt.value;\n    }\n  }\n  fromSel.addEventListener('change', sync);\n  toSel.addEventListener('change', sync);\n  form.addEventListener('submit', function (e) {\n    const max = Number(amount.max) || 0;\n    if (!(Number(amount.value) > 0) || Number(amount.value) > max) { e.preventDefault(); amount.focus(); }\n  });\n  sync();\n})();\n";

const tintOf = (pc: string) => (pc === "success" ? "mint" : pc === "danger" ? "coral" : pc === "warning" ? "yellow" : "lilac");
const depositClass = (s: string) => (s === "approved" ? "success" : s === "rejected" ? "danger" : s === "cancelled" ? "secondary" : "warning");

export default function InvestView({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const s = L.settings;
  const info = data.depositInfo;
  const plans = s.plans;
  const visiblePlans = plans.filter((p) => p.published !== false);
  const movable = plans.filter((p) => data.funds[p.id] && data.funds[p.id].available > 0);
  const dests = visiblePlans.filter((p) => data.level >= (p.minLevel || 1));
  const copyBtn = (value: string) => (
    <button type="button" className="btn btn-link btn-icon p-0 text-muted" style={{ width: "1.4em", height: "1.4em" }} data-copy={value} title={t("btn_copy")} aria-label={t("btn_copy")}><i data-lucide="copy" style={{ width: ".9em", height: ".9em" }}></i></button>
  );
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="d-flex align-items-center gap-2 mb-4">
            <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
            <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="layers" className="text-primary"></i>{t("plans_title")}</h3>
          </div>
          <div id="flash"></div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-2 d-flex align-items-center gap-2"><i data-lucide="landmark" className="text-primary"></i>{t("deposit_how_title")}</h6>
              <p className="text-muted small mb-3">{t("deposit_how_desc")}</p>
              <div className="row g-3 align-items-center">
                <div className="col-md-8">
                  <div className="d-flex justify-content-between border-bottom py-1"><span className="text-muted small">{t("deposit_bank")}</span><span className="fw-semibold">{info.bankName}</span></div>
                  <div className="d-flex justify-content-between align-items-center border-bottom py-1 gap-2">
                    <span className="text-muted small">{t("deposit_account")}</span>
                    <span className="fw-semibold d-inline-flex align-items-center gap-1">{info.accountName}{" "}{copyBtn(info.accountName)}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center border-bottom py-1 gap-2">
                    <span className="text-muted small">{t("deposit_rib")}</span>
                    <span className="fw-semibold d-inline-flex align-items-center gap-1" dir="ltr">{info.rib}{" "}{copyBtn(info.rib)}</span>
                  </div>
                </div>
                <div className="col-md-4 text-center">
                  {data.depositQR && (
                    <>
                      <img src={data.depositQR} alt="QR" className="img-fluid rounded-3 border" style={{ maxWidth: 180 }} />
                      <div className="small text-muted mt-1 d-flex align-items-center justify-content-center gap-1"><i data-lucide="qr-code"></i>{t("deposit_scan")}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            {visiblePlans.map((p) => {
              const held = (data.user.invested && data.user.invested[p.id]) || 0;
              const locked = data.level < (p.minLevel || 1);
              const pc = h.planColor(p);
              const tint = tintOf(pc);
              const earn30 = held * (p.ratePer15Days || 0) * 2; // 30 days = two 15-day cycles
              const media = (
                <div className="product-media">
                  {p.imageUrl ? <img src={p.imageUrl} alt={h.planName(p)} /> : <div className={`product-media-fallback ti-${tint}`}><i data-lucide={p.icon}></i></div>}
                  <span className={`badge bg-${pc} position-absolute top-0 end-0 m-2`}>{`${(p.ratePer15Days * 100).toFixed(1)}% ${t("per15_suffix")}`}</span>
                  {locked && <span className="badge bg-dark position-absolute top-0 start-0 m-2 d-inline-flex align-items-center gap-1"><i data-lucide="lock"></i>{t("level_label")} {p.minLevel}</span>}
                  {p.link && <span className="badge bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-2 d-inline-flex align-items-center"><i data-lucide="external-link" style={{ width: ".9em", height: ".9em" }}></i></span>}
                </div>
              );
              return (
                <div className="col-md-4" key={p.id}>
                  <div className={`card border-0 shadow-sm rounded-4 h-100 overflow-hidden product-card ${locked ? "opacity-75" : ""}`}>
                    {p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer" className="d-block" title={h.planName(p)}>{media}</a> : media}
                    <div className="card-body">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className={`app-thumb ti-${tint} flex-shrink-0`}>
                          {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <i data-lucide={p.icon}></i>}
                        </span>
                        <h6 className="fw-bold mb-0 text-truncate">{p.link
                          ? <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-reset text-decoration-none d-inline-flex align-items-center gap-1">{h.planName(p)}<i data-lucide="external-link" style={{ width: ".72em", height: ".72em" }}></i></a>
                          : h.planName(p)}</h6>
                      </div>
                      <p className="text-muted small mb-2">{h.planDesc(p)}</p>
                      <div className="d-flex justify-content-between align-items-end gap-2 mb-3 p-2 rounded-3 bg-body-secondary">
                        <div>
                          <div className="small text-muted">{t("plan_youhave")}</div>
                          <div className="fw-bold">{money(held)}</div>
                        </div>
                        <div className="text-end">
                          <div className="small text-muted d-flex align-items-center gap-1 justify-content-end"><i data-lucide="trending-up"></i>{t("earn_30d")}</div>
                          <div className="fw-bold text-success">{held > 0 ? "+" : ""}{money(earn30)}</div>
                        </div>
                      </div>
                      {locked ? (
                        <div className="alert alert-secondary py-2 small mb-0 text-center d-flex align-items-center justify-content-center gap-1">
                          <i data-lucide="lock"></i>{t("locked_at", { n: p.minLevel })}
                        </div>
                      ) : p.fixedAmount > 0 ? (
                        <button type="button" className={`btn btn-${pc} w-100 d-inline-flex align-items-center justify-content-center gap-1`}
                          data-bs-toggle="modal" data-bs-target="#investConfirm"
                          data-plan={p.id} data-name={h.planName(p)} data-amount={money(p.fixedAmount)}>
                          <i data-lucide="plus"></i>{t("invest_fixed", { amt: money(p.fixedAmount) })}</button>
                      ) : (
                        <form action="/add-funds" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                          <input type="hidden" name="plan" value={p.id} />
                          <div className="d-flex gap-1">
                            <input name="amount" type="number" min={s.minAddFunds} step="1"
                              className="form-control form-control-sm" placeholder={t("amount_ph")}
                              data-earn-input="" data-rate={p.ratePer15Days} />
                            <button className={`btn btn-sm btn-${pc}`}><i data-lucide="plus"></i></button>
                          </div>
                          <div className="small text-success mt-1 d-none d-flex align-items-center gap-1" data-earn-out="">
                            <i data-lucide="trending-up"></i><span></span>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {movable.length > 0 && dests.length > 1 && (
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body">
                <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="arrow-left-right" className="text-primary"></i>{t("move_title")}</h6>
                <p className="text-muted small mb-3">{t("move_desc")}</p>
                <form action="/move-funds" method="post" className="row g-2 align-items-end" id="moveForm"><input type="hidden" name="_csrf" value={L.csrfToken} />
                  <div className="col-6 col-md-4">
                    <label className="form-label small mb-1">{t("move_from")}</label>
                    <select name="from" id="moveFrom" className="form-select form-select-sm" required>
                      {movable.map((p) => <option value={p.id} data-avail={Math.floor(data.funds[p.id].available)} key={p.id}>{`${h.planName(p)} — ${money(data.funds[p.id].available)}`}</option>)}
                    </select>
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label small mb-1">{t("move_to")}</label>
                    <select name="to" id="moveTo" className="form-select form-select-sm" required>
                      {dests.map((p) => <option value={p.id} key={p.id}>{h.planName(p)}</option>)}
                    </select>
                  </div>
                  <div className="col-8 col-md-3">
                    <label className="form-label small mb-1 text-muted" id="moveAvail"></label>
                    <input name="amount" id="moveAmount" type="number" min="1" step="1" className="form-control form-control-sm" placeholder={t("amount_ph")} required />
                  </div>
                  <div className="col-4 col-md-1 d-grid">
                    <button className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center gap-1" title={t("move_btn")}><i data-lucide="arrow-left-right"></i></button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {data.myDeposits && data.myDeposits.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="receipt" className="text-primary"></i>{t("deposit_pending_title")}</h6>
                <div className="list-group list-group-flush">
                  {data.myDeposits.map((d) => {
                    const dc = depositClass(d.status);
                    return (
                      <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={d.id}>
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-semibold small text-truncate">{d.planLabel}</div>
                          <div className="fw-bold small text-success">{money(d.amount)}</div>
                          <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: ".72rem" }}>
                            <span className={`badge bg-${dc}-subtle text-${dc}`}>{h.statusLabel(d.status)}</span>
                            <span className="text-muted"><span data-ago={d.createdAt} title={new Date(d.createdAt).toLocaleString()}>{h.timeAgo(d.createdAt)}</span></span>
                          </div>
                        </div>
                        <a href={`/invoice/deposit/${d.id}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-secondary btn-icon flex-shrink-0" style={{ width: 30, height: 30 }} title={t("inv_title")}><i data-lucide="file-text"></i></a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="modal fade" id="investConfirm" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <div className="modal-header border-0">
              <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><i data-lucide="shield-check" className="text-primary"></i>{t("invest_confirm_t")}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label={t("btn_cancel")}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">{t("invest_confirm_d")}</p>
              <div className="d-flex justify-content-between align-items-center p-3 rounded-3 bg-body-secondary">
                <span className="fw-semibold" id="icName"></span>
                <span className="fw-bold text-success" id="icAmount"></span>
              </div>
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">{t("btn_cancel")}</button>
              <form method="post" action="/add-funds" className="m-0"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <input type="hidden" name="plan" id="icPlan" value="" />
                <button className="btn btn-success d-inline-flex align-items-center gap-1"><i data-lucide="check"></i>{t("invest_confirm_yes")}</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <InlineScript code={MOVE_SCRIPT} />
    </>
  );
}
