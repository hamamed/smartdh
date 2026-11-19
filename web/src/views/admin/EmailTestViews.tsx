// views/admin/email.ejs and views/admin/test.ejs
import type { User } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

type EmailData = { audienceCounts: Record<string, number>; optedOut: number; adminEmail: string; sent: number | null; skipped: number; err: string | null };

export function EmailView({ L, h, data }: ViewProps<EmailData>) {
  const { t } = h;
  const audiences: [string, string][] = [["active", "email_aud_active"], ["pending", "email_aud_pending"], ["nodeposit", "email_aud_nodeposit"], ["all", "email_aud_all"]];
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminHead heading={t("tab_email")} back="/admin" />
        {data.sent !== null && (
          <div className="alert alert-success py-2 d-flex align-items-center gap-2">
            <i data-lucide="mail-check"></i>
            <span>{t("email_sent_n", { n: data.sent })}{!!data.skipped && <> · {t("email_skipped_n", { n: data.skipped })}</>}</span>
          </div>
        )}
        {data.err === "empty" && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{t("email_err_empty")}</div>}
        <p className="text-muted small mb-3">{t("email_intro")}</p>
        <form action="/admin/email/send" method="post" id="emailForm">
          <input type="hidden" name="_csrf" value={L.csrfToken} />
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <label className="form-label fw-semibold">{t("email_audience")}</label>
              <div className="row g-2">
                {audiences.map(([v, k]) => (
                  <div className="col-sm-4" key={v}>
                    <input type="radio" className="btn-check" name="audience" id={`aud-${v}`} value={v} defaultChecked={v === "active"} />
                    <label className="btn btn-outline-primary w-100 d-flex flex-column py-2" htmlFor={`aud-${v}`}>
                      <span className="fw-semibold">{t(k)}</span>
                      <span className="small text-muted">{data.audienceCounts[v]}</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="form-label small">{t("email_specific")}</label>
                <input name="specific" className="form-control" placeholder={t("email_specific_ph")} />
                <div className="form-text">{t("email_specific_d")}</div>
              </div>
              {!!data.optedOut && (
                <div className="small text-muted mt-2 d-flex align-items-center gap-1">
                  <i data-lucide="mail-x"></i>{t("email_optout_note", { n: data.optedOut })}
                </div>
              )}
            </div>
          </div>
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">{t("email_subject")}</label>
                <input name="subject" className="form-control" maxLength={140} required placeholder={t("email_subject_ph")} />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("email_heading")} <span className="text-muted small">{t("opt")}</span></label>
                <input name="heading" className="form-control" maxLength={140} placeholder={t("email_heading_ph")} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">{t("email_message")}</label>
                <textarea name="message" className="form-control" rows={7} required placeholder={t("email_message_ph")}></textarea>
                <div className="form-text">{t("email_message_d")}</div>
              </div>
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small">{t("email_cta_text")}</label>
                  <input name="ctaText" className="form-control" maxLength={60} placeholder={t("email_cta_text_ph")} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small">{t("email_cta_url")}</label>
                  <input name="ctaUrl" type="url" className="form-control" placeholder="https://kanzup.com/dashboard" />
                </div>
              </div>
            </div>
          </div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" name="alsoNotice" id="alsoNotice" value="1" />
            <label className="form-check-label" htmlFor="alsoNotice">
              <span className="fw-semibold">{t("email_also_notice")}</span>
              <span className="d-block text-muted small">{t("email_also_notice_d")}</span>
            </label>
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-primary d-inline-flex align-items-center gap-2" type="submit">
              <i data-lucide="send"></i>{t("email_send_btn")}
            </button>
            <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" type="submit"
              name="testOnly" value="1" formNoValidate data-raw-onclick="return this.form.subject.value && this.form.message.value;">
              <i data-lucide="flask-conical"></i>{t("email_test_btn", { email: data.adminEmail })}
            </button>
          </div>
          <p className="small text-muted mt-3 mb-0 d-flex align-items-start gap-1">
            <i data-lucide="info"></i><span>{t("email_footer_note")}</span>
          </p>
        </form>
      </div>
    </section>
  );
}

type TestUser = User & { level: number; invTotal: number; balTotal: number };
type TestData = { testUsers: TestUser[]; stats: { count: number; invested: number; earnings: number; total: number }; created: string | null; done: string | null; doneN: number };

export function TestLabView({ L, h, data }: ViewProps<TestData>) {
  const { t, money } = h;
  const { stats, created } = data;
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <a href="/admin" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
            <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="flask-conical" className="text-primary"></i>{t("tab_test")}</h3>
          </div>
          <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" type="button"
            data-bs-toggle="collapse" data-bs-target="#createTest"><i data-lucide="user-plus"></i>{t("test_create")}</button>
        </div>
        <div className="alert alert-warning d-flex align-items-start gap-2 rounded-4">
          <i data-lucide="info" className="flex-shrink-0 mt-1"></i>
          <div className="small">{t("test_intro")}</div>
        </div>
        {created && (
          <div className={`alert alert-${created === "ok" ? "success" : "danger"} py-2 d-flex align-items-center gap-2`}>
            <i data-lucide={created === "ok" ? "check" : "alert-triangle"}></i>
            {created === "dup" ? t("create_dup") : created === "err" ? t("create_err") : t("create_ok")}
          </div>
        )}
        {data.done === "deleted" && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{t("test_deleted_n", { n: data.doneN })}</div>}
        <div className="collapse mb-4" id="createTest">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="user-plus" className="text-primary"></i>{t("test_create_t")}</h6>
              <form method="post" action="/admin/users/create" className="row g-2">
                <input type="hidden" name="_csrf" value={L.csrfToken} />
                <input type="hidden" name="isTest" value="1" />
                <div className="col-md-4"><label className="form-label small">{t("lbl_name")}</label><input name="name" className="form-control" defaultValue="Test user" required /></div>
                <div className="col-md-4"><label className="form-label small">{t("lbl_email")}</label><input name="email" type="email" className="form-control" placeholder="test1@demo.local" required /></div>
                <div className="col-md-2"><label className="form-label small">{t("lbl_password")}</label><input name="password" type="text" minLength={4} className="form-control" defaultValue="test1234" required /></div>
                <div className="col-md-2"><label className="form-label small">{t("th_status")}</label>
                  <select name="status" className="form-select">
                    <option value="active">{t("st_active")}</option>
                    <option value="pending">{t("st_pending")}</option>
                  </select></div>
                <div className="col-12"><button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="flask-conical"></i>{t("test_create")}</button></div>
              </form>
            </div>
          </div>
        </div>
        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3">
            <div className="card wallet wallet-yellow rounded-4 h-100"><div className="card-body">
              <div className="small d-flex align-items-center gap-1"><i data-lucide="flask-conical"></i>{t("test_stat_count")}</div>
              <div className="h4 fw-bold mb-0 mt-1">{stats.count}</div>
            </div></div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card wallet wallet-mint rounded-4 h-100"><div className="card-body">
              <div className="small d-flex align-items-center gap-1"><i data-lucide="piggy-bank"></i>{t("stat_invested")}</div>
              <div className="h5 fw-bold mb-0 mt-1">{money(stats.invested)}</div>
            </div></div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card wallet wallet-coral rounded-4 h-100"><div className="card-body">
              <div className="small d-flex align-items-center gap-1"><i data-lucide="coins"></i>{t("stat_earnings")}</div>
              <div className="h5 fw-bold mb-0 mt-1">{money(stats.earnings)}</div>
            </div></div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
              <div className="small text-muted d-flex align-items-center gap-1"><i data-lucide="wallet"></i>{t("stat_total")}</div>
              <div className="h5 fw-bold mb-0 mt-1">{money(stats.total)}</div>
            </div></div>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h6 className="fw-bold mb-0">{t("test_list")}</h6>
              {data.testUsers.length > 0 && (
                <form method="post" action="/admin/test/delete-all" data-raw-onsubmit={`return confirm('${t("test_delall_c")}')`}>
                  <input type="hidden" name="_csrf" value={L.csrfToken} />
                  <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"><i data-lucide="trash-2"></i>{t("test_delall")}</button>
                </form>
              )}
            </div>
            {data.testUsers.length === 0 ? (
              <p className="text-muted mb-0">{t("test_empty")}</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="text-muted small">
                    <tr>
                      <th>{t("th_user")}</th><th>{t("th_status")}</th><th>{t("level_label")}</th>
                      <th>{t("th_invested")}</th><th>{t("th_earnings")}</th><th className="text-end">{t("th_action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.testUsers.map((u) => {
                      const sc = u.status === "active" ? "success" : u.status === "rejected" ? "danger" : "warning";
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="rounded-circle bg-warning-subtle text-warning d-flex align-items-center justify-content-center fw-bold"
                                style={{ width: 36, height: 36, flex: "0 0 36px" }}><i data-lucide="flask-conical"></i></div>
                              <div>
                                <div className="fw-semibold">{u.name} <span className="badge bg-warning-subtle text-warning ms-1">{t("badge_test")}</span></div>
                                <div className="small text-muted">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className={`badge bg-${sc}-subtle text-${sc}`}>{h.statusLabel(u.status)}</span></td>
                          <td><span className="badge bg-body-secondary text-muted">{u.level}</span></td>
                          <td className="fw-semibold">{money(u.invTotal)}</td>
                          <td className="fw-semibold text-success">{money(u.earnings)}</td>
                          <td className="text-end text-nowrap">
                            <form action={`/admin/users/${u.id}/impersonate`} method="post" className="d-inline"><input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-outline-secondary" title={t("view_as")}><i data-lucide="eye"></i></button>
                            </form>{" "}
                            <a href={`/admin/users/${u.id}`} className="btn btn-sm btn-outline-primary"><i data-lucide="settings"></i></a>{" "}
                            <form action={`/admin/users/${u.id}/toggle-test`} method="post" className="d-inline"><input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-outline-success" title={t("test_make_real")}><i data-lucide="user-check"></i></button>
                            </form>{" "}
                            <form action={`/admin/delete/${u.id}`} method="post" className="d-inline" data-raw-onsubmit={`return confirm('${t("confirm_delete")}')`}><input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-outline-danger"><i data-lucide="trash-2"></i></button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
