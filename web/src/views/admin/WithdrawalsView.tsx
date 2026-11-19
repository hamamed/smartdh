// views/admin/withdrawals.ejs
import type { Withdrawal } from "@/lib/types";
import { InlineScript } from "../Layout";
import type { ViewProps } from "../registry";
import { AdminHead, Filters, Pager, PerPage } from "./AdminParts";

// The three modal scripts, verbatim from withdrawals.ejs.
const REJECT_SCRIPT = "\n(function () {\n  const modal = document.getElementById('rejectModal');\n  if (!modal) return;\n  const form = document.getElementById('rejectForm');\n  const who = document.getElementById('rjWho');\n  const note = document.getElementById('rjNote');\n  const reason = document.getElementById('rjReason');\n  modal.addEventListener('show.bs.modal', function (ev) {\n    const b = ev.relatedTarget; if (!b) return;\n    form.action = '/admin/withdraw/' + b.dataset.id + '/reject';\n    who.textContent = (b.dataset.name || '') + ' · ' + (b.dataset.amount || '');\n    reason.selectedIndex = 0; note.value = '';\n  });\n  // The free-text note is required only when \"Other\" is picked.\n  function syncNote() { note.required = (reason.value === 'other'); }\n  reason.addEventListener('change', syncNote); syncNote();\n})();\n";
const NOTIFY_SCRIPT = "\n(function () {\n  const modal = document.getElementById('notifyModal');\n  if (!modal) return;\n  const form = document.getElementById('notifyForm');\n  const who = document.getElementById('nfWho');\n  modal.addEventListener('show.bs.modal', function (ev) {\n    const b = ev.relatedTarget; if (!b) return;\n    form.action = '/admin/users/' + b.dataset.id + '/notify';\n    who.textContent = b.dataset.name || '';\n  });\n})();\n";
const SCHED_SCRIPT = "\n(function () {\n  const modal = document.getElementById('schedModal');\n  if (!modal) return;\n  const form = document.getElementById('schedForm');\n  const who = document.getElementById('scWho');\n  const action = document.getElementById('scAction');\n  const rejectBox = document.getElementById('scReject');\n  function syncAction() { rejectBox.hidden = (action.value !== 'reject'); }\n  modal.addEventListener('show.bs.modal', function (ev) {\n    const b = ev.relatedTarget; if (!b) return;\n    form.action = '/admin/withdraw/' + b.dataset.id + '/schedule';\n    who.textContent = (b.dataset.name || '') + ' · ' + (b.dataset.amount || '');\n    action.value = 'approve'; syncAction();\n  });\n  action.addEventListener('change', syncAction);\n})();\n";

type Data = {
  withdrawals: Withdrawal[]; page: number; pages: number; per: number; perOptions: number[]; total: number; status: string; q: string;
  statusCounts: Record<string, number>; wdReasons: string[]; ok: string; kycByUser: Record<string, string>;
};

const kycClass = (k: string) => (k === "approved" ? "success" : k === "rejected" ? "danger" : k === "submitted" ? "info" : k === "requested" ? "warning" : "secondary");

export default function WithdrawalsView({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const sc0 = data.statusCounts;
  const hidden: [string, string][] = [];
  if (data.per !== 10) hidden.push(["per", String(data.per)]);
  if (data.status) hidden.push(["status", data.status]);
  const kept = (data.status ? "&status=" + data.status : "") + (data.q ? "&q=" + encodeURIComponent(data.q) : "");
  const reasonOptions = data.wdReasons.map((r) => <option value={r} key={r}>{t("wdr_" + r)}</option>);
  const closeBtn = <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label={t("btn_cancel")}></button>;
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container">
          <AdminHead heading={t("tab_withdrawals")} />
          {data.ok && (
            <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>
              {data.ok === "notified" ? t("notify_ok") : data.ok === "kyc_req" ? t("kyc_req_ok") : t("profile_saved")}
            </div>
          )}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <form method="get" action="/admin/withdrawals" className="d-flex gap-2" style={{ maxWidth: 320 }}>
                  {hidden.map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}
                  <div className="input-group input-group-sm">
                    <span className="input-group-text"><i data-lucide="search"></i></span>
                    <input name="q" className="form-control" placeholder={t("search_player")} defaultValue={data.q} />
                  </div>
                  <button className="btn btn-sm btn-primary">{t("btn_search")}</button>
                </form>
                <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
                  <Filters keep={data.per !== 10 ? "&per=" + data.per : ""} base="/admin/withdrawals" current={data.status} q={data.q} options={[
                    { value: "", label: t("filter_all"), count: (sc0.pending || 0) + (sc0.paid || 0) + (sc0.rejected || 0) },
                    { value: "pending", label: t("st_pending"), count: sc0.pending || 0, danger: true },
                    { value: "paid", label: t("st_paid"), count: sc0.paid || 0 },
                    { value: "rejected", label: t("st_rejected"), count: sc0.rejected || 0 },
                  ]} />
                  <a href="/admin/export/withdrawals.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_withdrawals")}</a>
                </div>
              </div>
              {data.withdrawals.length === 0 ? (
                <p className="text-muted mb-0">{t("no_results")}</p>
              ) : (
                <>
                  <div className="list-group list-group-flush">
                    {data.withdrawals.map((w) => {
                      const wc = w.status === "paid" ? "success" : w.status === "rejected" ? "danger" : "warning";
                      const reason = w.status === "rejected" ? h.rejectReason(w) : "";
                      const kst = data.kycByUser[w.userId] || "none";
                      const kcc = kycClass(kst);
                      return (
                        <div className="list-group-item px-0 d-flex align-items-start gap-2 bg-transparent" key={w.id}>
                          <a href={`/admin/invoice/withdraw/${w.id}`} target="_blank" rel="noopener" className="tile-icon ti-coral flex-shrink-0" style={{ width: 38, height: 38, fontSize: ".95rem" }} title={t("inv_title")}><i data-lucide="arrow-up-circle"></i></a>
                          <div className="flex-grow-1 min-w-0">
                            <a href={`/admin/users/${w.userId}`} className="fw-semibold small text-truncate d-block text-reset text-decoration-none">{w.userName}</a>
                            <div className="fw-bold small text-danger">{money(w.amount)}</div>
                            <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: ".72rem" }}>
                              <span className={`badge bg-${wc}-subtle text-${wc} text-capitalize`}>{w.status}</span>
                              <span className="text-muted text-truncate">{w.fromLabel || w.from} · <span data-ago={w.createdAt} title={new Date(w.createdAt).toLocaleString()}>{h.timeAgo(w.createdAt)}</span></span>
                            </div>
                            {reason && <div className="mt-1 p-2 rounded-3 bg-danger-subtle text-danger" style={{ fontSize: ".72rem" }}><i data-lucide="info" style={{ width: ".9em", height: ".9em" }}></i> {reason}</div>}
                            {w.status === "pending" && w.scheduled && (
                              <div className="mt-1 p-2 rounded-3 bg-info-subtle text-info d-flex align-items-center gap-2" style={{ fontSize: ".72rem" }}>
                                <i data-lucide="clock" style={{ width: ".9em", height: ".9em" }}></i>
                                <span>{t("sched_badge", { action: t(w.scheduled.action === "approve" ? "sched_act_approve" : "sched_act_reject"), when: new Date(w.scheduled.at).toLocaleString() })}</span>
                                <form action={`/admin/withdraw/${w.id}/unschedule`} method="post" className="ms-auto"><input type="hidden" name="_csrf" value={L.csrfToken} />
                                  <button className="btn btn-sm btn-link p-0 text-danger" title={t("sched_cancel")}><i data-lucide="x" style={{ width: ".9em", height: ".9em" }}></i></button></form>
                              </div>
                            )}
                            {(w.payoutName || w.payoutAccount) && (
                              <div className="d-flex align-items-center gap-1 mt-1 p-2 rounded-3 bg-body-secondary" style={{ fontSize: ".72rem" }}>
                                <i data-lucide={w.method === "bank" ? "landmark" : "wallet"} style={{ width: ".9em", height: ".9em" }}></i>
                                <span className="fw-semibold">{w.payoutName || ""}</span>
                                <span className="text-muted" dir="ltr" style={{ wordBreak: "break-all" }}>{w.payoutAccount || ""}</span>
                              </div>
                            )}
                          </div>
                          {w.status === "pending" && (
                            <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                              <span className={`badge bg-${kcc}-subtle text-${kcc}`} title={t("kyc_title")}><i data-lucide="shield-check" style={{ width: ".85em", height: ".85em" }}></i> {t("kyc_st_" + kst)}</span>
                              <div className="d-flex gap-1">
                                <button type="button" className="btn btn-sm btn-outline-secondary btn-icon" style={{ width: 32, height: 32 }} title={t("notify_title")}
                                  data-bs-toggle="modal" data-bs-target="#notifyModal" data-id={w.userId} data-name={w.userName}><i data-lucide="mail"></i></button>
                                {kst !== "approved" && (
                                  <form action={`/admin/users/${w.userId}/request-verify`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} /><input type="hidden" name="back" value="/admin/withdrawals" />
                                    <button className="btn btn-sm btn-outline-primary btn-icon" style={{ width: 32, height: 32 }} title={t("kyc_request")}><i data-lucide="shield-check"></i></button></form>
                                )}
                                <form action={`/admin/withdraw/${w.id}/approve`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                                  <button className="btn btn-sm btn-success btn-icon" style={{ width: 32, height: 32 }} title={t("btn_markpaid")}><i data-lucide="check"></i></button></form>
                                <button type="button" className="btn btn-sm btn-outline-danger btn-icon" style={{ width: 32, height: 32 }} title={t("st_rejected")}
                                  data-bs-toggle="modal" data-bs-target="#rejectModal" data-id={w.id} data-name={w.userName} data-amount={money(w.amount)}><i data-lucide="x"></i></button>
                                <button type="button" className="btn btn-sm btn-outline-info btn-icon" style={{ width: 32, height: 32 }} title={t("sched_title")}
                                  data-bs-toggle="modal" data-bs-target="#schedModal" data-id={w.id} data-name={w.userName} data-amount={money(w.amount)}><i data-lucide="clock"></i></button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
                    <span className="small text-muted">{t("showing_n", { shown: data.withdrawals.length, total: data.total })}</span>
                    <PerPage h={h} base="/admin/withdrawals" per={data.per} options={data.perOptions} qs={kept} />
                    <Pager base="/admin/withdrawals" page={data.page} pages={data.pages} qs={kept + "&per=" + data.per} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="modal fade" id="rejectModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <form method="post" id="rejectForm" action="">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="modal-header border-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><i data-lucide="x-circle" className="text-danger"></i>{t("reject_modal_t")}</h5>
                {closeBtn}
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3 d-flex align-items-center gap-2"><i data-lucide="user"></i><span id="rjWho"></span></p>
                <label className="form-label small fw-semibold mb-1">{t("wd_reason_label")}</label>
                <select name="reason" id="rjReason" className="form-select mb-2">{reasonOptions}</select>
                <textarea name="reasonNote" id="rjNote" className="form-control" rows={2} maxLength={300} placeholder={t("reject_note_ph")}></textarea>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">{t("btn_cancel")}</button>
                <button className="btn btn-danger d-inline-flex align-items-center gap-1"><i data-lucide="x"></i>{t("btn_reject_refund")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <InlineScript code={REJECT_SCRIPT} />

      <div className="modal fade" id="notifyModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <form method="post" id="notifyForm" action="">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <input type="hidden" name="back" value="/admin/withdrawals" />
              <div className="modal-header border-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><i data-lucide="mail" className="text-primary"></i>{t("notify_title")}</h5>
                {closeBtn}
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-2 d-flex align-items-center gap-2"><i data-lucide="user"></i><span id="nfWho"></span></p>
                <textarea name="message" id="nfMsg" className="form-control" rows={4} maxLength={1000} required defaultValue={t("notify_preset")}></textarea>
                <div className="form-text">{t("notify_hint")}</div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">{t("btn_cancel")}</button>
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="send"></i>{t("notify_btn")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <InlineScript code={NOTIFY_SCRIPT} />

      <div className="modal fade" id="schedModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <form method="post" id="schedForm" action="">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="modal-header border-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><i data-lucide="clock" className="text-info"></i>{t("sched_title")}</h5>
                {closeBtn}
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3 d-flex align-items-center gap-2"><i data-lucide="user"></i><span id="scWho"></span></p>
                <label className="form-label small fw-semibold mb-1">{t("sched_action")}</label>
                <select name="action" id="scAction" className="form-select mb-3">
                  <option value="approve">{t("sched_approve")}</option>
                  <option value="reject">{t("sched_reject")}</option>
                </select>
                <label className="form-label small fw-semibold mb-1">{t("sched_at")}</label>
                <input name="at" id="scAt" type="datetime-local" className="form-control mb-3" required />
                <div id="scReject" hidden>
                  <label className="form-label small fw-semibold mb-1">{t("wd_reason_label")}</label>
                  <select name="reason" id="scReason" className="form-select mb-2">{reasonOptions}</select>
                  <textarea name="reasonNote" className="form-control" rows={2} maxLength={300} placeholder={t("reject_note_ph")}></textarea>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">{t("btn_cancel")}</button>
                <button className="btn btn-info text-white d-inline-flex align-items-center gap-1"><i data-lucide="clock"></i>{t("sched_btn")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <InlineScript code={SCHED_SCRIPT} />
    </>
  );
}
