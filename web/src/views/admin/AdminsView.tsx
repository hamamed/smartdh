// views/admin/admins.ejs
import { roleOf } from "@/lib/rbac";
import type { User } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

type Data = { admins: User[]; roles: string[]; ROLES: Record<string, { perms: string[] }>; PERMS: string[]; adminEmail: string; meId: number; ok: string | null; err: string | null };

export default function AdminsView({ L, h, data }: ViewProps<Data>) {
  const { t } = h;
  const okMap: Record<string, string> = { added: t("adm_ok_added"), role: t("adm_ok_role"), removed: t("adm_ok_removed") };
  const errMap: Record<string, string> = { bademail: t("adm_err_bademail"), needdetails: t("adm_err_needdetails"), notself: t("adm_err_notself"),
    locked: t("adm_err_locked"), lastowner: t("adm_err_lastowner"), cantchange: t("adm_err_cantchange") };
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 820 }}>
        <AdminHead heading={t("tab_admins")} back="/admin" />
        {data.ok && okMap[data.ok] && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{okMap[data.ok]}</div>}
        {data.err && errMap[data.err] && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i data-lucide="alert-triangle"></i>{errMap[data.err]}</div>}
        <p className="text-muted mb-4">{t("adm_intro")}</p>

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="user-plus" className="text-primary"></i>{t("adm_add_t")}</h6>
            <form method="post" action="/admin/admins/add" className="row g-2">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="col-md-5"><label className="form-label small">{t("lbl_email")}</label><input name="email" type="email" className="form-control" required /></div>
              <div className="col-md-4"><label className="form-label small">{t("adm_role")}</label>
                <select name="role" className="form-select">
                  {data.roles.filter((r) => r !== "owner").map((r) => <option value={r} key={r}>{t("role_" + r)}</option>)}
                  <option value="owner">{t("role_owner")}</option>
                </select></div>
              <div className="col-md-3 d-flex align-items-end"><button className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="plus"></i>{t("adm_add_btn")}</button></div>
              <div className="col-12"><div className="form-text">{t("adm_add_hint")}</div></div>
              <div className="col-md-6"><input name="name" className="form-control form-control-sm" placeholder={t("adm_newname_ph")} /></div>
              <div className="col-md-6"><input name="password" type="text" className="form-control form-control-sm" placeholder={t("adm_newpass_ph")} /></div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="shield" className="text-primary"></i>{t("adm_roles_t")}</h6>
            {data.roles.map((r) => {
              const perms = data.ROLES[r].perms;
              return (
                <div className="d-flex flex-wrap align-items-center gap-2 py-2 border-top" key={r}>
                  <span className="badge bg-primary-subtle text-primary" style={{ minWidth: 88 }}>{t("role_" + r)}</span>
                  {perms.includes("*")
                    ? <span className="small fw-semibold text-success">{t("adm_all_access")}</span>
                    : data.PERMS.map((p) => {
                      const on = perms.includes(p);
                      return <span key={p} className={`badge ${on ? "bg-success-subtle text-success" : "bg-body-secondary text-muted"}`}><i data-lucide={on ? "check" : "x"} style={{ width: ".8em", height: ".8em" }}></i> {t("perm_" + p)}</span>;
                    })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="users" className="text-primary"></i>{t("adm_list_t")}</h6>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="text-muted small"><tr><th>{t("th_user")}</th><th>{t("adm_role")}</th><th className="text-end">{t("th_action")}</th></tr></thead>
                <tbody>
                  {data.admins.map((a) => {
                    const isSelf = a.id === data.meId;
                    const isLocked = !!data.adminEmail && a.email.toLowerCase() === data.adminEmail;
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="fw-semibold">{a.name}
                            {isSelf && <span className="badge bg-primary-subtle text-primary ms-1">{t("adm_you")}</span>}
                            {isLocked && <span className="badge bg-body-secondary text-muted ms-1"><i data-lucide="lock" style={{ width: ".8em", height: ".8em" }}></i></span>}
                          </div>
                          <div className="small text-muted">{a.email}</div>
                        </td>
                        <td>
                          {isSelf || isLocked ? (
                            <span className="badge bg-primary-subtle text-primary">{t("role_" + roleOf(a))}</span>
                          ) : (
                            <form method="post" action={`/admin/admins/${a.id}/role`} className="d-flex gap-1">
                              <input type="hidden" name="_csrf" value={L.csrfToken} />
                              <select name="role" className="form-select form-select-sm" style={{ maxWidth: 150 }} data-raw-onchange="this.form.submit()" defaultValue={roleOf(a) || undefined}>
                                {data.roles.map((r) => <option value={r} key={r}>{t("role_" + r)}</option>)}
                              </select>
                            </form>
                          )}
                        </td>
                        <td className="text-end">
                          {!isSelf && !isLocked ? (
                            <form method="post" action={`/admin/admins/${a.id}/remove`} className="d-inline" data-raw-onsubmit={`return confirm('${t("adm_remove_c")}')`}>
                              <input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"><i data-lucide="user-minus"></i>{t("adm_remove")}</button>
                            </form>
                          ) : <span className="small text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
