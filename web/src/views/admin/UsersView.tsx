// views/admin/users.ejs
import type { User } from "@/lib/types";
import type { ViewProps } from "../registry";
import { Filters, Pager, PerPage } from "./AdminParts";

type Row = User & { level: number; invTotal: number; balTotal: number };
type Data = {
  users: Row[]; page: number; pages: number; per: number; perOptions: number[]; totalUsers: number; q: string; status: string;
  totalUsersAll: number; statusCounts: Record<string, number>; done: string | null; doneN: number; created: string | null;
};

export default function UsersView({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const meId = L.user ? L.user.id : -1;
  const sc0 = data.statusCounts;
  const kept = (data.status ? "&status=" + data.status : "") + (data.q ? "&q=" + encodeURIComponent(data.q) : "");
  const { created, done } = data;
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <a href="/admin" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
              <h3 className="fw-bold mb-0">{t("tab_users")}</h3>
            </div>
            <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" type="button"
              data-bs-toggle="collapse" data-bs-target="#createBox"><i data-lucide="user-plus"></i>{t("create_user")}</button>
          </div>
          {created && (
            <div className={`alert alert-${created === "ok" ? "success" : "danger"} py-2 d-flex align-items-center gap-2`}>
              <i data-lucide={created === "ok" ? "check" : "alert-triangle"}></i>
              {created === "dup" ? t("create_dup") : created === "err" ? t("create_err") : t("create_ok")}
            </div>
          )}
          <div className="collapse mb-4" id="createBox">
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="user-plus" className="text-primary"></i>{t("create_user_t")}</h6>
                <form method="post" action="/admin/users/create" className="row g-2">
                  <input type="hidden" name="_csrf" value={L.csrfToken} />
                  <div className="col-md-4"><label className="form-label small">{t("lbl_name")}</label><input name="name" className="form-control" required /></div>
                  <div className="col-md-4"><label className="form-label small">{t("lbl_email")}</label><input name="email" type="email" className="form-control" required /></div>
                  <div className="col-md-2"><label className="form-label small">{t("lbl_password")}</label><input name="password" type="text" minLength={4} className="form-control" required /></div>
                  <div className="col-md-2"><label className="form-label small">{t("th_status")}</label>
                    <select name="status" className="form-select">
                      <option value="active">{t("st_active")}</option>
                      <option value="pending">{t("st_pending")}</option>
                    </select></div>
                  <div className="col-12 d-flex flex-wrap align-items-center gap-3">
                    <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="user-plus"></i>{t("create_user")}</button>
                    <div className="form-check mb-0">
                      <input className="form-check-input" type="checkbox" name="isTest" id="isTest" value="1" />
                      <label className="form-check-label small" htmlFor="isTest">{t("create_as_test")}</label>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                <form method="get" action="/admin/users" className="d-flex gap-2" style={{ maxWidth: 420 }}>
                  {data.per !== 10 && <input type="hidden" name="per" value={data.per} />}
                  <div className="input-group input-group-sm">
                    <span className="input-group-text"><i data-lucide="search"></i></span>
                    <input name="q" className="form-control" placeholder={t("search_users")} defaultValue={data.q} />
                  </div>
                  <button className="btn btn-sm btn-primary">{t("btn_search")}</button>
                </form>
                <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
                  <Filters keep={data.per !== 10 ? "&per=" + data.per : ""} base="/admin/users" current={data.status} q={data.q} options={[
                    { value: "", label: t("filter_all"), count: data.totalUsersAll },
                    { value: "pending", label: t("st_pending"), count: sc0.pending || 0, danger: true },
                    { value: "active", label: t("st_active"), count: sc0.active || 0 },
                    { value: "rejected", label: t("st_rejected"), count: sc0.rejected || 0 },
                  ]} />
                  <a href="/admin/export/users.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_users")}</a>
                </div>
              </div>
              {done && (
                <div className={`alert alert-${done === "none" ? "warning" : "success"} py-2 d-flex align-items-center gap-2`}>
                  <i data-lucide={done === "none" ? "alert-triangle" : "check"}></i>
                  {done === "none" ? t("bulk_none") : t("bulk_done_" + done, { n: data.doneN })}
                </div>
              )}
              {data.users.length === 0 ? (
                <p className="text-muted mb-0">{t("no_results")}</p>
              ) : (
                <>
                  {/* lives outside the list: rows contain their own forms; checkboxes join via form="bulkForm" */}
                  <form id="bulkForm" method="post" action="/admin/users/bulk" data-raw-onsubmit="return dvConfirmBulk(this)">
                    <input type="hidden" name="_csrf" value={L.csrfToken} />
                  </form>
                  <div id="bulkBar" className="d-none align-items-center gap-2 p-2 mb-2 rounded-3 bg-body-secondary">
                    <span className="small fw-semibold ms-2"><span id="bulkCount">0</span> {t("bulk_selected")}</span>
                    <div className="ms-auto d-flex gap-1 flex-wrap">
                      <button type="button" id="batchDepBtn" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                        data-bs-toggle="modal" data-bs-target="#batchDepModal"><i data-lucide="receipt"></i>{t("batch_dep")}</button>
                      <button form="bulkForm" name="action" value="approve" className="btn btn-sm btn-success d-inline-flex align-items-center gap-1">
                        <i data-lucide="check"></i>{t("btn_approve")}</button>
                      <button form="bulkForm" name="action" value="reject" className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1">
                        <i data-lucide="x"></i>{t("bulk_reject")}</button>
                      <button form="bulkForm" name="action" value="delete" className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1">
                        <i data-lucide="trash-2"></i>{t("bulk_delete")}</button>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2 mb-2 px-1">
                    <input type="checkbox" className="form-check-input" id="checkAll" title={t("bulk_selectall")} />
                    <span className="small text-muted">{t("bulk_selectall")}</span>
                  </div>
                  <div className="list-group list-group-flush" id="usersTable">
                    {data.users.map((u) => {
                      const sc = u.status === "active" ? "success" : u.status === "rejected" ? "danger" : "warning";
                      const uOnline = !!u.lastSeen && Date.now() - u.lastSeen < 300000;
                      const isMe = u.id === meId;
                      return (
                        <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={u.id}>
                          <input type="checkbox" className="form-check-input row-check flex-shrink-0" form="bulkForm" name="ids" value={u.id}
                            disabled={isMe} {...(isMe ? { title: t("bulk_notyou") } : {})} />
                          {u.avatar
                            ? <img src={u.avatar} className="rounded-circle flex-shrink-0" style={{ width: 38, height: 38, objectFit: "cover" }} alt="" />
                            : <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                style={{ width: 38, height: 38 }}>{u.name.charAt(0).toUpperCase()}</div>}
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold small text-truncate">{u.name}
                              {u.isAdmin && <span className="badge bg-primary-subtle text-primary ms-1">{t("badge_admin")}</span>}
                            </div>
                            <div className="small text-muted text-truncate">{u.email}</div>
                            <div className="d-flex align-items-center gap-2 flex-wrap mt-1" style={{ fontSize: ".72rem" }}>
                              {uOnline ? (
                                <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold"><span className="online-dot"></span>{t("online_now")}</span>
                              ) : u.lastSeen ? (
                                <span className="text-muted d-inline-flex align-items-center gap-1"><i data-lucide="clock" style={{ width: ".85em", height: ".85em" }}></i><span data-ago={u.lastSeen} title={new Date(u.lastSeen).toLocaleString()}>{h.timeAgo(u.lastSeen)}</span></span>
                              ) : null}
                              <span className={`badge bg-${sc}-subtle text-${sc}`}>{h.statusLabel(u.status)}</span>
                              <span className="badge bg-body-secondary text-muted">L{u.level}</span>
                              <span className="text-muted">{t("th_invested")}: <span className="fw-semibold text-body">{money(u.invTotal)}</span></span>
                              <span className="text-muted">{t("th_earnings")}: <span className="fw-semibold text-success">{money(u.earnings)}</span></span>
                              {!!u.createdAt && <span className="text-muted"><span data-ago={u.createdAt} title={new Date(u.createdAt).toLocaleString()}>{h.timeAgo(u.createdAt)}</span></span>}
                            </div>
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            {u.status === "pending" && (
                              <>
                                <form action={`/admin/approve/${u.id}`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                                  <button className="btn btn-sm btn-success btn-icon" style={{ width: 32, height: 32 }} title={t("btn_approve")}><i data-lucide="check"></i></button></form>
                                <form action={`/admin/reject/${u.id}`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                                  <button className="btn btn-sm btn-outline-danger btn-icon" style={{ width: 32, height: 32 }}><i data-lucide="x"></i></button></form>
                              </>
                            )}
                            <a href={`/admin/users/${u.id}`} className="btn btn-sm btn-outline-primary btn-icon" style={{ width: 32, height: 32 }} title={t("btn_manage")}><i data-lucide="eye"></i></a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
                    <span className="small text-muted">{t("showing_n", { shown: data.users.length, total: data.totalUsers })}</span>
                    <PerPage h={h} base="/admin/users" per={data.per} options={data.perOptions} qs={kept} />
                    <Pager base="/admin/users" page={data.page} pages={data.pages} qs={kept + "&per=" + data.per} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="modal fade" id="batchDepModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <form method="post" action="/admin/users/batch-deposit" id="batchDepForm">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="modal-body p-4">
                <h5 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="receipt" className="text-primary"></i>{t("batch_dep_t")}</h5>
                <p className="text-muted small mb-3"><span id="batchCount">0</span> {t("bulk_selected")}</p>
                <div id="batchIds"></div>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label small">{t("th_amount")}</label>
                    <div className="input-group input-group-sm"><input name="amount" type="number" min="1" className="form-control" required /><span className="input-group-text">{L.curLabel}</span></div>
                  </div>
                  <div className="col-6">
                    <label className="form-label small">{t("plans_title")}</label>
                    <select name="plan" className="form-select form-select-sm">{L.settings.plans.map((p) => <option value={p.id} key={p.id}>{h.planName(p)}</option>)}</select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">{t("th_status")}</label>
                    <select name="status" className="form-select form-select-sm">
                      <option value="approved">{t("st_approved")}</option>
                      <option value="pending">{t("st_pending")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">{t("tour_skip")}</button>
                <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("batch_dep_go")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
