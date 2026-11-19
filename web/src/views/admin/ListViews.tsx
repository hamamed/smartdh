// views/admin/invoices.ejs, deposits.ejs, ticket.ejs, account.ejs
import type { Deposit, Ticket, User } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead, Ago, Filters, Pager, PerPage } from "./AdminParts";

const SearchBox = ({ h, action, q, hidden }: { h: ViewProps["h"]; action: string; q: string; hidden: [string, string][] }) => (
  <>
    {hidden.map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}
    <div className="input-group input-group-sm">
      <span className="input-group-text"><i data-lucide="search"></i></span>
      <input name="q" className="form-control" placeholder={h.t("search_player")} defaultValue={q} />
    </div>
    <button className="btn btn-sm btn-primary">{h.t("btn_search")}</button>
  </>
);

type InvoiceRow = { kind: string; id: number; amount: number; userName?: string; userId: number; source: string; status: string; at: number };
type InvoicesData = { invoices: InvoiceRow[]; page: number; pages: number; total: number; type: string; q: string; depCount: number; wdCount: number };

export function InvoicesView({ h, data }: ViewProps<InvoicesData>) {
  const { t, money } = h;
  const tabs: [string, string, number][] = [["", t("filter_all"), data.depCount + data.wdCount], ["deposit", t("tab_deposits"), data.depCount], ["withdraw", t("tab_withdrawals"), data.wdCount]];
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_invoices")} />
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <div className="d-flex flex-wrap gap-2">
                {tabs.map(([val, label, n]) => {
                  const on = data.type === val;
                  return (
                    <a key={val} href={`/admin/invoices${val ? "?type=" + val : ""}`} className={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}>
                      {label} <span className={`badge ${on ? "bg-white text-primary" : "bg-body-secondary text-muted"} ms-1`}>{n}</span>
                    </a>
                  );
                })}
              </div>
              <form method="get" action="/admin/invoices" className="d-flex gap-2 ms-auto" style={{ maxWidth: 280 }}>
                <SearchBox h={h} action="/admin/invoices" q={data.q} hidden={data.type ? [["type", data.type]] : []} />
              </form>
            </div>
            {!data.invoices.length ? (
              <p className="text-muted small mb-0">{t("no_results")}</p>
            ) : (
              <>
                <div className="list-group list-group-flush">
                  {data.invoices.map((x) => {
                    const dep = x.kind === "deposit";
                    const sc = x.status === "approved" || x.status === "paid" ? "success" : x.status === "rejected" ? "danger" : "warning";
                    return (
                      <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={x.kind + x.id}>
                        <span className={`tile-icon ${dep ? "ti-mint" : "ti-coral"} flex-shrink-0`} style={{ width: 38, height: 38, fontSize: ".95rem" }}><i data-lucide={dep ? "arrow-down-circle" : "arrow-up-circle"}></i></span>
                        <div className="flex-grow-1 min-w-0">
                          <a href={`/admin/users/${x.userId}`} className="fw-semibold small text-truncate d-block text-reset text-decoration-none">{x.userName}</a>
                          <div className={`fw-bold small text-${dep ? "success" : "danger"}`}>{money(x.amount)}</div>
                          <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: ".72rem" }}>
                            <span className={`badge bg-${sc}-subtle text-${sc}`}>{h.statusLabel(x.status) || x.status}</span>
                            <span className="text-muted text-truncate">{(dep ? "D" : "W") + x.id} · {x.source} · <Ago h={h} at={x.at} /></span>
                          </div>
                        </div>
                        <a href={`/admin/invoice/${x.kind}/${x.id}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-secondary btn-icon flex-shrink-0" style={{ width: 30, height: 30 }} title={t("inv_title")}><i data-lucide="file-text"></i></a>
                      </div>
                    );
                  })}
                </div>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="small text-muted">{data.total}</span>
                  <Pager base="/admin/invoices" qs={(data.type ? "&type=" + data.type : "") + (data.q ? "&q=" + encodeURIComponent(data.q) : "")} page={data.page} pages={data.pages} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type DepositsData = { deposits: Deposit[]; page: number; pages: number; per: number; perOptions: number[]; total: number; status: string; q: string; statusCounts: Record<string, number> };

export function DepositsView({ L, h, data }: ViewProps<DepositsData>) {
  const { t, money } = h;
  const sc = data.statusCounts;
  const hidden: [string, string][] = [];
  if (data.per !== 10) hidden.push(["per", String(data.per)]);
  if (data.status) hidden.push(["status", data.status]);
  const kept = (data.status ? "&status=" + data.status : "") + (data.q ? "&q=" + encodeURIComponent(data.q) : "");
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_deposits")} />
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <form method="get" action="/admin/deposits" className="d-flex gap-2" style={{ maxWidth: 320 }}>
                <SearchBox h={h} action="/admin/deposits" q={data.q} hidden={hidden} />
              </form>
              <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
                <Filters keep={data.per !== 10 ? "&per=" + data.per : ""} base="/admin/deposits" current={data.status} q={data.q} options={[
                  { value: "", label: t("filter_all"), count: (sc.pending || 0) + (sc.approved || 0) + (sc.rejected || 0) },
                  { value: "pending", label: t("st_pending"), count: sc.pending || 0, danger: true },
                  { value: "approved", label: t("st_approved"), count: sc.approved || 0 },
                  { value: "rejected", label: t("st_rejected"), count: sc.rejected || 0 },
                ]} />
                <a href="/admin/export/deposits.csv" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="download"></i>{t("export_deposits")}</a>
              </div>
            </div>
            {data.deposits.length === 0 ? (
              <p className="text-muted mb-0">{t("no_results")}</p>
            ) : (
              <>
                <div className="list-group list-group-flush">
                  {data.deposits.map((d) => {
                    const dc = d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : d.status === "cancelled" ? "secondary" : "warning";
                    return (
                      <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={d.id}>
                        <a href={`/admin/invoice/deposit/${d.id}`} target="_blank" rel="noopener" className="tile-icon ti-mint flex-shrink-0" style={{ width: 38, height: 38, fontSize: ".95rem" }} title={t("inv_title")}><i data-lucide="arrow-down-circle"></i></a>
                        <div className="flex-grow-1 min-w-0">
                          <a href={`/admin/users/${d.userId}`} className="fw-semibold small text-truncate d-block text-reset text-decoration-none">{d.userName}</a>
                          <div className="fw-bold small text-success">{money(d.amount)}</div>
                          <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: ".72rem" }}>
                            <span className={`badge bg-${dc}-subtle text-${dc}`}>{h.statusLabel(d.status)}</span>
                            <span className="text-muted text-truncate">{d.planLabel} · <Ago h={h} at={d.createdAt} /></span>
                          </div>
                        </div>
                        {d.status === "pending" && (
                          <div className="d-flex gap-1 flex-shrink-0">
                            <form action={`/admin/deposit/${d.id}/approve`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-success btn-icon" style={{ width: 32, height: 32 }} title={t("btn_approve")}><i data-lucide="check"></i></button></form>
                            <form action={`/admin/deposit/${d.id}/reject`} method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                              <button className="btn btn-sm btn-outline-danger btn-icon" style={{ width: 32, height: 32 }} title={t("st_rejected")}><i data-lucide="x"></i></button></form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
                  <span className="small text-muted">{t("showing_n", { shown: data.deposits.length, total: data.total })}</span>
                  <PerPage h={h} base="/admin/deposits" per={data.per} options={data.perOptions} qs={kept} />
                  <Pager base="/admin/deposits" page={data.page} pages={data.pages} qs={kept + "&per=" + data.per} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TicketView({ L, h, data }: ViewProps<{ ticket: Ticket; tuser: User | null }>) {
  const { t } = h;
  const tk = data.ticket;
  const sc = tk.status === "closed" ? "secondary" : tk.status === "answered" ? "success" : "warning";
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminHead heading={"#" + tk.id + " · " + tk.subject} back="/admin/tickets" />
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap align-items-center gap-2 small">
            <span className={`badge bg-${sc}-subtle text-${sc}`}>{t("sup_status_" + tk.status)}</span>
            <span className="text-muted">{t("sup_topic")}: <span className="fw-semibold text-body">{t("sup_t_" + tk.topic)}</span></span>
            <span className="text-muted">· {t("sup_created")} <Ago h={h} at={tk.createdAt} /></span>
            <div className="ms-auto d-flex align-items-center gap-2">
              <span className="fw-semibold">{tk.userName}</span>
              <span className="text-muted">{tk.email}</span>
              {data.tuser && <a href={`/admin/users/${data.tuser.id}`} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"><i data-lucide="user"></i>{t("btn_manage")}</a>}
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-column gap-3">
            {tk.messages.map((msg, i) => {
              const isAdmin = msg.from === "admin";
              return (
                <div className={`d-flex ${isAdmin ? "justify-content-end" : "justify-content-start"}`} key={i}>
                  <div className={`p-3 rounded-4 ${isAdmin ? "bg-primary-subtle" : "bg-body-secondary"}`} style={{ maxWidth: "85%" }}>
                    <div className="small fw-semibold mb-1 d-flex align-items-center gap-1">
                      <i data-lucide={isAdmin ? "life-buoy" : "user"} style={{ width: ".85em", height: ".85em" }}></i>
                      {isAdmin ? msg.authorName || t("sup_support") : tk.userName}
                      <span className="text-muted fw-normal" style={{ fontSize: ".72rem" }} title={new Date(msg.at).toLocaleString()}>· <span data-ago={msg.at}>{h.timeAgo(msg.at)}</span></span>
                    </div>
                    {msg.text && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>}
                    {msg.file && ((msg.fileType || "").startsWith("image/") ? (
                      <a href={msg.file} target="_blank" rel="noopener" className="d-inline-block mt-2"><img src={msg.file} alt={msg.fileName} style={{ maxWidth: 240, maxHeight: 240, borderRadius: 10, border: "1px solid var(--line)" }} /></a>
                    ) : (
                      <a href={msg.file} target="_blank" rel="noopener" download="" className="d-inline-flex align-items-center gap-1 mt-2 small fw-semibold text-primary text-decoration-none"><i data-lucide="paperclip"></i>{msg.fileName || t("sup_attachment")}</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <form method="post" action={`/admin/tickets/${tk.id}/reply?_csrf=${L.csrfToken}`} encType="multipart/form-data"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <textarea name="message" className="form-control mb-2" rows={4} maxLength={4000} placeholder={t("sup_reply_ph")}></textarea>
              <div className="mb-2">
                <label className="form-label small d-flex align-items-center gap-1"><i data-lucide="paperclip"></i>{t("sup_attach")}</label>
                <input name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.txt" className="form-control form-control-sm" data-preview="#admReplyPrev" />
                <div id="admReplyPrev"></div>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="send"></i>{t("sup_reply")}</button>
                <button name="close" value="1" className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"><i data-lucide="check-check"></i>{t("sup_reply")} + {t("sup_status_closed")}</button>
              </div>
            </form>
            {tk.status !== "closed" && (
              <form method="post" action={`/admin/tickets/${tk.id}/close`} className="mt-2">
                <input type="hidden" name="_csrf" value={L.csrfToken} />
                <button className="btn btn-sm btn-link text-muted p-0">{t("sup_status_closed")}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AccountView({ L, h, data }: ViewProps<{ me: User; adminEmailLocked: boolean; ok: string | null; err: string | null }>) {
  const { t } = h;
  const okMap: Record<string, string> = { profile: t("acct_ok_profile"), password: t("acct_ok_pw") };
  const errMap: Record<string, string> = { wrongpass: t("acct_err_wrongpass"), noname: t("acct_err_noname"), bademail: t("acct_err_bademail"),
    dupemail: t("acct_err_dupemail"), short: t("acct_err_short"), mismatch: t("acct_err_mismatch") };
  const me = data.me;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <AdminHead heading={t("acct_title")} back="/admin" />
        {data.ok && okMap[data.ok] && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{okMap[data.ok]}</div>}
        {data.err && errMap[data.err] && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i data-lucide="alert-triangle"></i>{errMap[data.err]}</div>}
        <div className="alert alert-secondary d-flex align-items-start gap-2 small rounded-4">
          <i data-lucide="shield" className="flex-shrink-0 mt-1"></i>
          <span>{t("acct_intro")}</span>
        </div>
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="user" className="text-primary"></i>{t("acct_profile_t")}</h6>
            <p className="text-muted small mb-3">{t("acct_signed_in")} <strong>{me.email}</strong></p>
            {data.adminEmailLocked && (
              <div className="alert alert-warning py-2 small d-flex align-items-start gap-2"><i data-lucide="lock" className="flex-shrink-0 mt-1"></i><span>{t("acct_locked_note")}</span></div>
            )}
            <form action="/admin/account/profile" method="post" autoComplete="off">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label small">{t("acct_name")}</label>
                <input name="name" className="form-control" defaultValue={me.name} required />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("acct_new_email")}</label>
                <input name="email" type="email" className="form-control" defaultValue={me.email} required />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("acct_current")}</label>
                <input name="current" type="password" className="form-control" autoComplete="current-password" required />
              </div>
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("acct_save_profile")}</button>
            </form>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="key-round" className="text-primary"></i>{t("acct_pw_t")}</h6>
            <form action="/admin/account/password" method="post" autoComplete="off">
              <input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label small">{t("acct_current")}</label>
                <input name="current" type="password" className="form-control" autoComplete="current-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("acct_new_pw")}</label>
                <input name="password" type="password" minLength={6} className="form-control" autoComplete="new-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("acct_confirm")}</label>
                <input name="confirm" type="password" minLength={6} className="form-control" autoComplete="new-password" required />
              </div>
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("acct_save_pw")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
