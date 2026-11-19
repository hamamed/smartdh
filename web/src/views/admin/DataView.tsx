// views/admin/data.ejs
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

type Result = { ok: boolean; error?: string; wiped?: boolean; restored?: boolean; created: { email: string; password: string | null }[]; updated: string[]; errors: string[] };

export default function DataView({ L, h, data }: ViewProps<{ result: Result | null }>) {
  const { t } = h;
  const result = data.result;
  const withPass = result && result.ok && !result.wiped && !result.restored ? result.created.filter((c) => c.password) : [];
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 760 }}>
        <AdminHead heading={t("tab_data")} />
        {result && (!result.ok ? (
          <div className="alert alert-danger d-flex align-items-center gap-2"><i data-lucide="alert-triangle"></i><span>{result.error}</span></div>
        ) : result.wiped ? (
          <div className="alert alert-success d-flex align-items-center gap-2"><i data-lucide="check"></i><span>{t("wipe_done")}</span></div>
        ) : result.restored ? (
          <div className="alert alert-success d-flex align-items-center gap-2"><i data-lucide="check"></i><span>{t("f_restored")}</span></div>
        ) : (
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="check" className="text-success"></i>{t("imp_done")}</h6>
              <div className="d-flex gap-2 flex-wrap mb-3">
                <span className="badge bg-success-subtle text-success p-2">{t("imp_created", { n: result.created.length })}</span>
                <span className="badge bg-primary-subtle text-primary p-2">{t("imp_updated", { n: result.updated.length })}</span>
                {result.errors.length > 0 && <span className="badge bg-danger-subtle text-danger p-2">{t("imp_errors", { n: result.errors.length })}</span>}
              </div>
              {withPass.length > 0 && (
                <div className="alert alert-warning small">
                  <div className="fw-semibold mb-2 d-flex align-items-center gap-1"><i data-lucide="key-round"></i>{t("imp_passwords")}</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      {withPass.map((c) => <tr key={c.email}><td>{c.email}</td><td><code>{c.password}</code></td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {result.errors.length > 0 && (
                <ul className="small text-danger mb-0 ps-3">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}

        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="download" className="text-primary"></i>{t("data_export_t")}</h6>
            <p className="text-muted small mb-3">{t("data_export_d")}</p>
            <div className="d-flex flex-wrap gap-2">
              <a className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href="/admin/export/users.csv"><i data-lucide="users"></i>{t("export_users")}</a>
              <a className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href="/admin/export/deposits.csv"><i data-lucide="receipt"></i>{t("export_deposits")}</a>
              <a className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href="/admin/export/withdrawals.csv"><i data-lucide="banknote"></i>{t("export_withdrawals")}</a>
              <a className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" href="/admin/export/backup.json"><i data-lucide="database"></i>{t("export_backup")}</a>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="upload" className="text-primary"></i>{t("data_import_t")}</h6>
            <p className="text-muted small mb-3">{t("data_import_d")}</p>
            <div className="p-3 rounded-3 bg-body-secondary small mb-3">
              <div className="fw-semibold mb-1">{t("imp_columns")}</div>
              <code>name, email, status, xp, earnings, password</code>
              <ul className="mb-0 mt-2 ps-3 text-muted">
                <li>{t("imp_col_email")}</li>
                <li>{t("imp_col_match")}</li>
                <li>{t("imp_col_pass")}</li>
                <li>{t("imp_col_admin")}</li>
              </ul>
              <a className="btn btn-sm btn-outline-secondary mt-2 d-inline-flex align-items-center gap-1" href="/admin/export/users-template.csv">
                <i data-lucide="file-down"></i>{t("imp_template")}
              </a>
            </div>
            <form action={`/admin/import/users?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="input-group">
                <input type="file" name="file" className="form-control" accept=".csv,text/csv" required />
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="upload"></i>{t("imp_go")}</button>
              </div>
              <div className="form-check mt-2">
                <input className="form-check-input" type="checkbox" name="markTest" id="markTest" value="1" />
                <label className="form-check-label small" htmlFor="markTest">{t("imp_as_test")}</label>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 border-danger">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="rotate-ccw" className="text-danger"></i>{t("data_restore_t")}</h6>
            <p className="text-muted small mb-3">{t("data_restore_d")}</p>
            <div className="alert alert-danger small d-flex align-items-center gap-2">
              <i data-lucide="alert-triangle"></i><span>{t("data_restore_warn")}</span>
            </div>
            <form action={`/admin/restore?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data" data-raw-onsubmit={`return confirm('${t("data_restore_confirm")}')`}>
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-2">
                <input type="file" name="file" className="form-control" accept=".json,application/json" required />
              </div>
              <div className="input-group">
                <span className="input-group-text">{t("data_restore_type")}</span>
                <input name="confirm" className="form-control" placeholder="RESTORE" required />
                <button className="btn btn-danger d-inline-flex align-items-center gap-1"><i data-lucide="rotate-ccw"></i>{t("data_restore_go")}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 border-danger mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="trash-2" className="text-danger"></i>{t("data_wipe_t")}</h6>
            <p className="text-muted small mb-3">{t("data_wipe_d")}</p>
            <div className="alert alert-danger small">
              <div className="fw-semibold mb-1 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{t("wipe_removes")}</div>
              <ul className="mb-2 ps-3">
                <li>{t("wipe_r1")}</li>
                <li>{t("wipe_r2")}</li>
                <li>{t("wipe_r3")}</li>
              </ul>
              <div className="d-flex align-items-center gap-1"><i data-lucide="database"></i>{t("wipe_backup_note")}</div>
            </div>
            <form action="/admin/wipe" method="post" data-raw-onsubmit={`return confirm('${t("data_wipe_confirm")}')`}>
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" name="keepAdmin" id="keepAdmin" value="1" defaultChecked />
                <label className="form-check-label small" htmlFor="keepAdmin">{t("wipe_keepadmin")}</label>
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" name="keepSettings" id="keepSettings" value="1" defaultChecked />
                <label className="form-check-label small" htmlFor="keepSettings">{t("wipe_keepsettings")}</label>
              </div>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small">{t("wipe_type")}</label>
                  <input name="confirm" className="form-control" placeholder="WIPE" autoComplete="off" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label small">{t("wipe_password")}</label>
                  <input name="password" type="password" className="form-control" autoComplete="current-password" required />
                </div>
              </div>
              <button className="btn btn-danger mt-3 d-inline-flex align-items-center gap-1"><i data-lucide="trash-2"></i>{t("data_wipe_go")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
