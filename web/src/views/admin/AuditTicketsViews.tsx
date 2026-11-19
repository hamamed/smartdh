// views/admin/audit.ejs and views/admin/tickets.ejs
import type { AuditEntry, Ticket } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead, Ago, Pager } from "./AdminParts";

export function AuditView({ h, data }: ViewProps<{ audit: AuditEntry[] }>) {
  const { t } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_audit")} />
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex justify-content-end gap-2 mb-3">
              <a href="/admin/export/users.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_users")}</a>
              <a href="/admin/export/deposits.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_deposits")}</a>
              <a href="/admin/export/withdrawals.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_withdrawals")}</a>
            </div>
            {data.audit.length === 0 ? (
              <p className="text-muted mb-0">{t("audit_none")}</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="text-muted small"><tr><th>{t("th_when")}</th><th>{t("audit_who")}</th><th>{t("audit_action")}</th><th>{t("th_details")}</th></tr></thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td className="small text-muted text-nowrap"><Ago h={h} at={a.at} /></td>
                        <td className="small fw-semibold">{a.adminName}</td>
                        <td><span className="badge bg-primary-subtle text-primary">{a.action}</span></td>
                        <td className="small">{a.details}</td>
                      </tr>
                    ))}
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

type TicketsData = { tickets: Ticket[]; page: number; pages: number; total: number; status: string; statusCounts: Record<string, number> };

export function TicketsView({ h, data }: ViewProps<TicketsData>) {
  const { t } = h;
  const filters: [string, string][] = [["", t("filter_all")], ["open", t("sup_status_open")], ["answered", t("sup_status_answered")], ["closed", t("sup_status_closed")]];
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_tickets")} />
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {filters.map(([val, label]) => {
                const on = data.status === val;
                const n = val ? data.statusCounts[val] || 0 : data.total;
                return (
                  <a key={val} href={`/admin/tickets${val ? "?status=" + val : ""}`} className={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}>
                    {label} <span className={`badge ${on ? "bg-white text-primary" : "bg-body-secondary text-muted"} ms-1`}>{n}</span>
                  </a>
                );
              })}
            </div>
            {!data.tickets.length ? (
              <p className="text-muted small mb-0">{t("sup_no_tickets")}</p>
            ) : (
              <>
                <div className="list-group list-group-flush">
                  {data.tickets.map((tk) => {
                    const sc = tk.status === "closed" ? "secondary" : tk.status === "answered" ? "success" : "warning";
                    return (
                      <a key={tk.id} href={`/admin/tickets/${tk.id}`} className="list-group-item list-group-item-action px-0 d-flex align-items-center gap-2 bg-transparent text-reset">
                        <span className={`tile-icon ${tk.status === "open" ? "ti-yellow" : "ti-navy"} flex-shrink-0`} style={{ width: 38, height: 38, fontSize: ".95rem" }}><i data-lucide={tk.status === "open" ? "mail" : "mail-open"}></i></span>
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-semibold small text-truncate">#{tk.id} · {tk.subject}</div>
                          <div className="text-muted text-truncate" style={{ fontSize: ".75rem" }}>{tk.userName} · {t("sup_t_" + tk.topic)} · <Ago h={h} at={tk.updatedAt} /></div>
                        </div>
                        <span className={`badge bg-${sc}-subtle text-${sc} flex-shrink-0`}>{t("sup_status_" + tk.status)}</span>
                      </a>
                    );
                  })}
                </div>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="small text-muted">{data.total}</span>
                  <Pager base="/admin/tickets" qs={data.status ? "&status=" + data.status : ""} page={data.page} pages={data.pages} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
