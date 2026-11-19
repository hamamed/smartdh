// views/admin/user.ejs — one player, everything about them
import type { Deposit, Schedule, Tx, User, Withdrawal } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

type Data = {
  u: User; level: number; xpCur: number; xpNext: number; invested: number; total: number;
  referrer: User | null; invitees: User[]; deposits: Deposit[]; withdrawals: Withdrawal[]; txns: Tx[];
  payoutAccount: string; schedules: (Schedule & { planLabel?: string })[]; ok: string | null; err: string | null;
};

const statusClass = (s: string) => (s === "active" ? "success" : s === "rejected" ? "danger" : "warning");
const kycClass = (k: string) => (k === "approved" ? "success" : k === "rejected" ? "danger" : k === "submitted" ? "info" : k === "requested" ? "warning" : "secondary");

function okText(t: ViewProps["h"]["t"], ok: string): string {
  const map: Record<string, string> = {
    created: "create_ok", deposit: "manual_dep_ok", withdraw: "manual_wd_ok", earnings: "earn_ok",
    kyc_req: "kyc_req_ok", kyc: "kyc_reviewed_ok", notified: "notify_ok",
  };
  return t(map[ok] || "profile_saved");
}

export default function UserView({ L, h, data }: ViewProps<Data>) {
  const { t, money, ACH, TX } = h;
  const { u, level, xpCur, xpNext } = data;
  const plans = L.settings.plans;
  const csrf = <input type="hidden" name="_csrf" value={L.csrfToken} />;
  const isMe = L.user ? u.id === L.user.id : false;
  const sc = statusClass(u.status);
  const uOnline = !!u.lastSeen && Date.now() - u.lastSeen < 300000;
  const k = u.kyc || { status: "none", fullName: "", dob: "", address: "", cinFront: "", cinBack: "", reviewNote: "" };
  const kc = kycClass(k.status);
  const logins = (u.logins || []).slice().reverse();
  const ago = (ts: number) => <span data-ago={ts} title={new Date(ts).toLocaleString()}>{h.timeAgo(ts)}</span>;
  const planOptions = plans.map((p) => <option value={p.id} key={p.id}>{h.planName(p)}</option>);
  const curSuffix = <span className="input-group-text">{L.curLabel}</span>;

  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 900 }}>
        <AdminHead heading={u.name} back="/admin/users" />
        {data.ok && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{okText(t, data.ok)}</div>}
        {data.err && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i data-lucide="alert-triangle"></i>{data.err === "insufficient" ? t("e_insufficient") : t("manual_err")}</div>}

        <div className="row g-3">
          <div className="col-md-5">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body text-center">
                {u.avatar
                  ? <img src={u.avatar} className="rounded-circle mb-3" style={{ width: 88, height: 88, objectFit: "cover" }} alt="" />
                  : <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold mx-auto mb-3"
                      style={{ width: 88, height: 88, fontSize: "2rem" }}>{u.name.charAt(0).toUpperCase()}</div>}
                <h5 className="fw-bold mb-1">{u.name}
                  {u.isAdmin && <> <span className="badge bg-primary-subtle text-primary">{t("badge_admin")}</span></>}
                  {u.isTest && <> <span className="badge bg-warning-subtle text-warning">{t("badge_test")}</span></>}
                </h5>
                <div className="text-muted small mb-2">{u.email}</div>
                <span className={`badge bg-${sc}-subtle text-${sc} mb-3`}>{h.statusLabel(u.status)}</span>
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("th_joined")}</span><span>{ago(u.createdAt)} · {new Date(u.createdAt).toLocaleDateString()}</span></div>
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("adm_last_login")}</span><span>{u.lastLogin ? ago(u.lastLogin) : t("adm_never")}</span></div>
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("online_label")}</span>
                  <span>{uOnline
                    ? <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold"><span className="online-dot"></span>{t("online_now")}</span>
                    : u.lastSeen ? ago(u.lastSeen) : t("adm_never")}</span></div>
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("your_code")}</span><span className="fw-semibold text-uppercase">{u.referralCode}</span></div>
                {data.referrer && (
                  <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("invited_by")}</span>
                    <a href={`/admin/users/${data.referrer.id}`}>{data.referrer.name}</a></div>
                )}
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("invited_count")}</span><span className="fw-semibold">{data.invitees.length}</span></div>
                <div className="small text-muted d-flex justify-content-between border-top pt-2"><span>{t("db_title")}</span><span className="fw-semibold">{u.streak.count}</span></div>
                <div className="d-flex gap-1 mt-3">
                  {u.status === "pending" && (
                    <form action={`/admin/approve/${u.id}`} method="post" className="flex-grow-1">{csrf}
                      <button className="btn btn-sm btn-success w-100"><i data-lucide="check" className="me-1"></i>{t("btn_approve")}</button></form>
                  )}
                  <form action={`/admin/toggle-admin/${u.id}`} method="post" className="flex-grow-1">{csrf}
                    <button className="btn btn-sm btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-1" disabled={isMe}>
                      <i data-lucide="user-cog"></i>{u.isAdmin ? t("make_player") : t("make_admin")}</button></form>
                  <form action={`/admin/delete/${u.id}`} method="post" data-raw-onsubmit={`return confirm('${t("confirm_delete")}')`}>{csrf}
                    <button className="btn btn-sm btn-outline-danger" disabled={isMe}><i data-lucide="trash-2"></i></button></form>
                </div>
                {!u.isAdmin && (
                  <form action={`/admin/users/${u.id}/toggle-test`} method="post" className="mt-2">{csrf}
                    <button className={`btn btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-1 ${u.isTest ? "btn-outline-success" : "btn-outline-warning"}`}>
                      <i data-lucide="flask-conical"></i>{u.isTest ? t("test_make_real") : t("test_make_test")}</button></form>
                )}
                <div className="d-flex gap-1 mt-2">
                  <form action={`/admin/users/${u.id}/impersonate`} method="post" className="flex-grow-1">{csrf}
                    <button className="btn btn-sm btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-1" disabled={u.isAdmin}><i data-lucide="eye"></i>{t("view_as")}</button></form>
                  <a href={`/admin/users/${u.id}/statement`} target="_blank" className="btn btn-sm btn-outline-secondary flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="file-text"></i>{t("statement")}</a>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-7">
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="wallet" className="text-primary"></i>{t("c_total")}</h6>
                <div className="row g-2 text-center mb-3">
                  <div className="col-4"><div className="p-2 rounded-3 wallet wallet-coral">
                    <div className="small">{t("c_invested")}</div><div className="fw-bold">{money(data.invested)}</div></div></div>
                  <div className="col-4"><div className="p-2 rounded-3 wallet wallet-mint">
                    <div className="small">{t("c_earnings")}</div><div className="fw-bold">{money(u.earnings)}</div></div></div>
                  <div className="col-4"><div className="p-2 rounded-3 wallet wallet-yellow">
                    <div className="small">{t("c_total")}</div><div className="fw-bold">{money(data.total)}</div></div></div>
                </div>
                <div className="small text-muted mb-1">{t("level_label")} {level} · {t("xp_progress", { have: u.xp - xpCur, need: xpNext - xpCur })}</div>
                <div className="progress mb-3"><div className="progress-bar" style={{ width: `${Math.min(100, Math.round((u.xp - xpCur) / (xpNext - xpCur) * 100))}%` }}></div></div>
                <div className="small fw-semibold mb-2">{t("plans_title")}</div>
                {plans.map((p) => (
                  <div className="d-flex justify-content-between border-bottom py-1 small" key={p.id}>
                    <span className="d-flex align-items-center gap-2"><i data-lucide={p.icon} className={`text-${p.color}`}></i>{h.planName(p)}</span>
                    <span className="fw-semibold">{money((u.invested && u.invested[p.id]) || 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="sliders-horizontal" className="text-primary"></i>{t("th_adjust")}</h6>
                <form action={`/admin/adjust/${u.id}`} method="post" className="mb-3">{csrf}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_earnings")}</label>
                      <input name="earnings" type="number" step="1" className="form-control form-control-sm" placeholder={String(Math.round(u.earnings))} />
                    </div>
                    {plans.map((p) => (
                      <div className="col-6" key={p.id}>
                        <label className="form-label small mb-1">{h.planName(p)}</label>
                        <input name={`plan_${p.id}`} type="number" step="1" className="form-control form-control-sm" placeholder={String(Math.round((u.invested && u.invested[p.id]) || 0))} />
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
                  <div className="form-text">{t("adjust_hint")}</div>
                </form>
                <hr />
                <form action={`/admin/users/${u.id}/earnings`} method="post" className="mb-3">{csrf}
                  <label className="form-label small mb-1 d-flex align-items-center gap-1"><i data-lucide="gift" className="text-success"></i>{t("add_earn")}</label>
                  <div className="input-group input-group-sm">
                    <input name="amount" type="number" step="1" className="form-control" placeholder="0" required />
                    <input name="note" type="text" className="form-control" placeholder={t("add_earn_note")} />
                    <button className="btn btn-success"><i data-lucide="plus"></i></button>
                  </div>
                  <div className="form-text">{t("add_earn_hint")}</div>
                </form>
                <hr />
                <form action={`/admin/users/${u.id}/xp`} method="post" className="mb-3">{csrf}
                  <label className="form-label small mb-1">{t("set_xp")}</label>
                  <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
                    <input name="xp" type="number" min="0" className="form-control" defaultValue={u.xp} />
                    <span className="input-group-text">XP</span>
                    <button className="btn btn-outline-primary"><i data-lucide="save"></i></button>
                  </div>
                  <div className="form-text">{t("set_xp_hint")}</div>
                </form>
                <hr />
                <form action={`/admin/users/${u.id}/password`} method="post">{csrf}
                  <label className="form-label small mb-1">{t("set_password")}</label>
                  <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
                    <input name="password" type="text" minLength={4} className="form-control" placeholder={t("pw_new")} required />
                    <button className="btn btn-outline-primary"><i data-lucide="key-round"></i></button>
                  </div>
                  <div className="form-text">{t("set_password_hint")}</div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="mail" className="text-primary"></i>{t("notify_title")}</h6>
            <form action={`/admin/users/${u.id}/notify`} method="post">{csrf}
              <input type="hidden" name="back" value={`/admin/users/${u.id}`} />
              <textarea name="message" className="form-control mb-2" rows={3} maxLength={1000} placeholder={t("notify_ph")} required defaultValue={t("notify_preset")}></textarea>
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div className="form-text mb-0">{t("notify_hint")}</div>
                <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="send"></i>{t("notify_btn")}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="shield-check" className="text-primary"></i>{t("kyc_title")}</h6>
              <span className={`badge bg-${kc}-subtle text-${kc}`}>{t("kyc_st_" + k.status)}</span>
            </div>
            {k.status === "submitted" || k.status === "approved" || k.status === "rejected" ? (
              <>
                <div className="row g-2 mb-3" style={{ fontSize: ".85rem" }}>
                  <div className="col-md-4"><div className="text-muted small">{t("kyc_fullname")}</div><div className="fw-semibold">{k.fullName || "—"}</div></div>
                  <div className="col-md-4"><div className="text-muted small">{t("kyc_dob")}</div><div className="fw-semibold">{k.dob || "—"}</div></div>
                  <div className="col-md-4"><div className="text-muted small">{t("kyc_address")}</div><div className="fw-semibold">{k.address || "—"}</div></div>
                </div>
                <div className="row g-2 mb-3">
                  {([["kyc_cin_front", k.cinFront], ["kyc_cin_back", k.cinBack]] as [string, string][]).map(([label, src]) => (
                    <div className="col-6" key={label}>
                      <div className="text-muted small mb-1">{t(label)}</div>
                      {src
                        ? <a href={src} target="_blank" rel="noopener"><img src={src} alt="" className="img-fluid rounded border" style={{ maxHeight: 160 }} /></a>
                        : <span className="text-muted small">—</span>}
                    </div>
                  ))}
                </div>
                {k.reviewNote && k.status === "rejected" && <div className="alert alert-danger py-1 px-2 small">{t("wd_reason_label")}: {k.reviewNote}</div>}
              </>
            ) : (
              <p className="text-muted small mb-3">{t("kyc_admin_none")}</p>
            )}
            <div className="d-flex flex-wrap gap-2">
              {k.status !== "approved" && (
                <form action={`/admin/users/${u.id}/request-verify`} method="post" className="d-inline">{csrf}
                  <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="send"></i>{k.status === "requested" ? t("kyc_resend") : t("kyc_request")}</button>
                </form>
              )}
              {k.status === "submitted" && (
                <>
                  <form action={`/admin/users/${u.id}/kyc/approve`} method="post" className="d-inline">{csrf}
                    <button className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"><i data-lucide="check"></i>{t("kyc_approve")}</button>
                  </form>
                  <button type="button" className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" data-bs-toggle="modal" data-bs-target="#kycReject"><i data-lucide="x"></i>{t("kyc_reject")}</button>
                </>
              )}
            </div>
          </div>
        </div>

        {k.status === "submitted" && (
          <div className="modal fade" id="kycReject" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered"><div className="modal-content border-0 rounded-4">
              <form action={`/admin/users/${u.id}/kyc/reject`} method="post">{csrf}
                <div className="modal-header border-0"><h5 className="modal-title fw-bold">{t("kyc_reject")}</h5>
                  <button type="button" className="btn-close" data-bs-dismiss="modal"></button></div>
                <div className="modal-body">
                  <label className="form-label small fw-semibold mb-1">{t("wd_reason_label")}</label>
                  <textarea name="note" className="form-control" rows={2} maxLength={300} placeholder={t("reject_note_ph")}></textarea>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">{t("btn_cancel")}</button>
                  <button className="btn btn-danger d-inline-flex align-items-center gap-1"><i data-lucide="x"></i>{t("kyc_reject")}</button>
                </div>
              </form>
            </div></div>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="log-in" className="text-primary"></i>{t("adm_logins")}</h6>
            {!logins.length ? (
              <p className="text-muted small mb-0">{t("adm_never")}</p>
            ) : (
              <>
                <div className="list-group list-group-flush">
                  {logins.slice(0, 15).map((l, i) => (
                    <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={i}>
                      <span className="tile-icon ti-navy flex-shrink-0" style={{ width: 34, height: 34, fontSize: ".9rem" }}><i data-lucide="log-in"></i></span>
                      <div className="flex-grow-1 min-w-0">
                        <div className="small fw-semibold">{new Date(l.at).toLocaleString()}</div>
                        {l.ip && <div className="text-muted" style={{ fontSize: ".72rem" }} dir="ltr">IP · {l.ip}</div>}
                      </div>
                      <span className="text-muted small flex-shrink-0" data-ago={l.at}>{h.timeAgo(l.at)}</span>
                    </div>
                  ))}
                </div>
                {logins.length > 15 && <p className="text-muted small mb-0 mt-2">{logins.length - 15} {t("adm_more")}</p>}
              </>
            )}
          </div>
        </div>

        <div className="row g-3 mt-0">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="receipt" className="text-primary"></i>{t("manual_dep_t")}</h6>
                <form action={`/admin/users/${u.id}/deposit?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">{csrf}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_amount")}</label>
                      <div className="input-group input-group-sm"><input name="amount" type="number" min="1" className="form-control" required />{curSuffix}</div>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("plans_title")}</label>
                      <select name="plan" className="form-select form-select-sm">{planOptions}</select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_status")}</label>
                      <select name="status" className="form-select form-select-sm">
                        <option value="approved">{t("st_approved")}</option>
                        <option value="pending">{t("st_pending")}</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("manual_date")}</label>
                      <input name="date" type="date" className="form-control form-control-sm" />
                    </div>
                    <div className="col-12">
                      <label className="form-label small mb-1">{t("manual_bankref")}</label>
                      <input name="note" className="form-control form-control-sm" placeholder={t("manual_bankref_ph")} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small mb-1">{t("manual_receipt")}</label>
                      <input name="receipt" type="file" accept="image/*" className="form-control form-control-sm" />
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("manual_dep_go")}</button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="banknote" className="text-primary"></i>{t("manual_wd_t")}</h6>
                <form action={`/admin/users/${u.id}/withdraw`} method="post">{csrf}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_amount")}</label>
                      <div className="input-group input-group-sm"><input name="amount" type="number" min="1" className="form-control" required />{curSuffix}</div>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_from")}</label>
                      <select name="from" className="form-select form-select-sm">
                        <option value="earnings">{t("opt_earnings")}</option>
                        {planOptions}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("payout_method")}</label>
                      <select name="method" className="form-select form-select-sm">
                        <option value="paypal">{t("payout_paypal")}</option>
                        <option value="bank">{t("payout_bank")}</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("th_status")}</label>
                      <select name="status" className="form-select form-select-sm">
                        <option value="paid">{t("st_paid")}</option>
                        <option value="pending">{t("st_pending")}</option>
                        <option value="rejected">{t("st_rejected")}</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("payout_name")}</label>
                      <input name="payoutName" className="form-control form-control-sm" defaultValue={u.payout.name} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">{t("manual_account")}</label>
                      <input name="account" className="form-control form-control-sm" dir="ltr" defaultValue={data.payoutAccount} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small mb-1">{t("manual_date")}</label>
                      <input name="date" type="datetime-local" step="1" className="form-control form-control-sm" />
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1"><i data-lucide="minus"></i>{t("manual_wd_go")}</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="repeat" className="text-primary"></i>{t("recur_t")}</h6>
              {data.schedules.length > 0 && (
                <form action="/admin/schedules/run" method="post" className="mb-0">{csrf}
                  <input type="hidden" name="back" value={`/admin/users/${u.id}`} />
                  <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="play"></i>{t("recur_run")}</button>
                </form>
              )}
            </div>
            {data.schedules.length ? (
              <div className="table-responsive mb-3">
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {data.schedules.map((s) => (
                      <tr key={s.id}>
                        <td className="fw-semibold">{money(s.amount)}</td>
                        <td className="small">{s.planLabel}</td>
                        <td><span className="badge bg-primary-subtle text-primary">{t("freq_" + s.frequency)}</span></td>
                        <td className="small text-muted">{t("recur_next")}: {new Date(s.nextRun).toLocaleDateString()}</td>
                        <td className="text-end">
                          <form action={`/admin/schedules/${s.id}/delete`} method="post" className="d-inline">{csrf}
                            <button className="btn btn-sm btn-outline-danger"><i data-lucide="trash-2"></i></button></form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted small">{t("recur_none")}</p>
            )}
            <form action={`/admin/users/${u.id}/schedule`} method="post" className="row g-2">{csrf}
              <div className="col-md-3">
                <label className="form-label small mb-1">{t("th_amount")}</label>
                <div className="input-group input-group-sm"><input name="amount" type="number" min="1" className="form-control" required />{curSuffix}</div>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">{t("plans_title")}</label>
                <select name="plan" className="form-select form-select-sm">{planOptions}</select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">{t("recur_freq")}</label>
                <select name="frequency" className="form-select form-select-sm" defaultValue="weekly">
                  <option value="daily">{t("freq_daily")}</option>
                  <option value="weekly">{t("freq_weekly")}</option>
                  <option value="monthly">{t("freq_monthly")}</option>
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-sm btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="plus"></i>{t("recur_add")}</button>
              </div>
            </form>
            <p className="form-text mb-0">{t("recur_hint")}</p>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="banknote" className="text-primary"></i>{t("payout_details")}</h6>
            {data.payoutAccount ? (
              <div className="row g-2 small">
                <div className="col-md-4"><span className="text-muted">{t("payout_method")}</span><div className="fw-semibold">{u.payout.method === "bank" ? t("payout_bank") : t("payout_paypal")}</div></div>
                <div className="col-md-4"><span className="text-muted">{t("payout_name")}</span><div className="fw-semibold">{u.payout.name || "—"}</div></div>
                <div className="col-md-4"><span className="text-muted">{u.payout.method === "bank" ? t("payout_rib") : t("payout_paypal_email")}</span><div className="fw-semibold" dir="ltr">{data.payoutAccount}</div></div>
              </div>
            ) : (
              <p className="text-muted small mb-0">{t("payout_none")}</p>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="trophy" className="text-warning"></i>{t("ach_title")}{" "}
              <span className="text-muted small">({u.achievements.length}/{Object.keys(ACH).length})</span></h6>
            <div className="d-flex flex-wrap gap-2">
              {Object.keys(ACH).map((id) => {
                const got = u.achievements.includes(id);
                return (
                  <span key={id} className={`badge ${got ? "bg-warning-subtle text-warning" : "bg-body-secondary text-muted opacity-50"} d-inline-flex align-items-center gap-1 p-2`}>
                    <i data-lucide={ACH[id].icon}></i>{h.achName(id)}</span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="row g-3 mt-0">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="receipt" className="text-primary"></i>{t("tab_deposits")}</h6>
              {!data.deposits.length ? <p className="text-muted small mb-0">{t("dv_none")}</p> : (
                <table className="table table-sm align-middle mb-0"><tbody>
                  {data.deposits.slice(0, 6).map((d) => {
                    const dc = d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning";
                    return (
                      <tr key={d.id}><td className="fw-semibold">{money(d.amount)}</td><td className="small">{d.planLabel}</td>
                        <td><span className={`badge bg-${dc}-subtle text-${dc}`}>{h.statusLabel(d.status)}</span></td></tr>
                    );
                  })}
                </tbody></table>
              )}
            </div></div>
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="banknote" className="text-primary"></i>{t("tab_withdrawals")}</h6>
              {!data.withdrawals.length ? <p className="text-muted small mb-0">{t("wd_none")}</p> : (
                <table className="table table-sm align-middle mb-0"><tbody>
                  {data.withdrawals.slice(0, 6).map((w) => {
                    const wc = w.status === "paid" ? "success" : w.status === "rejected" ? "danger" : "warning";
                    return (
                      <tr key={w.id}><td className="fw-semibold">{money(w.amount)}</td><td className="small">{w.fromLabel || w.from}</td>
                        <td><span className={`badge bg-${wc}-subtle text-${wc} text-capitalize`}>{w.status}</span></td></tr>
                    );
                  })}
                </tbody></table>
              )}
            </div></div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="history" className="text-primary"></i>{t("activity_title")}</h6>
            {!data.txns.length ? <p className="text-muted small mb-0">{t("no_activity")}</p> : (
              <div className="list-group list-group-flush">
                {data.txns.map((tx, i) => {
                  const m = TX[tx.type] || TX.admin_adjust;
                  const note = h.txNote(tx);
                  return (
                    <div className="list-group-item px-0 d-flex align-items-center gap-3 bg-transparent" key={i}>
                      <div className={`rounded-circle d-flex align-items-center justify-content-center bg-${m.cls}-subtle text-${m.cls}`}
                        style={{ width: 34, height: 34, flex: "0 0 34px" }}><i data-lucide={m.icon}></i></div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">{h.txLabel(tx.type)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>{note && <><bdi>{note}</bdi> · </>}{ago(tx.at)}</div>
                      </div>
                      {!!tx.amount && <div className={`fw-bold text-${m.cls} text-nowrap small`}>{m.sign}{money(tx.amount)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
