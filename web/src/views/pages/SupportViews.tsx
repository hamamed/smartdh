// views/send.ejs, support.ejs, support-new.ejs, support-ticket.ejs
import type { Ticket, Tx, User } from "@/lib/types";
import type { ViewProps } from "../registry";

type Topic = { key: string; icon: string; tint: string };
const statusClass = (s: string) => (s === "closed" ? "secondary" : s === "answered" ? "success" : "warning");

export function SendView({ L, h, data }: ViewProps<{ user: User; transfers: Tx[] }>) {
  const { t, money } = h;
  const s = L.settings;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="send" className="text-primary"></i>{t("send_title")}</h3>
        </div>
        <div id="flash"></div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="text-muted small mb-3 d-flex align-items-center gap-1"><i data-lucide="coins"></i>{t("opt_earnings")}: <strong>{money(data.user.earnings)}</strong></div>
            <form method="post" action="/transfer"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <input name="to" className="form-control mb-2" placeholder={t("send_ph")} required />
              <div className="input-group mb-2">
                <span className="input-group-text"><i data-lucide="gift"></i></span>
                <input name="amount" type="number" min={s.minTransfer} step="1" className="form-control" placeholder={t("amount_ph")} required />
                <span className="input-group-text">{L.curLabel}</span>
              </div>
              <button className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="send"></i>{t("btn_send")}</button>
              <p className="small text-muted mt-2 mb-0">{t("send_note", { min: money(s.minTransfer) })}</p>
            </form>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4 mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="arrow-left-right" className="text-primary"></i>{t("tr_history")}</h6>
            {!data.transfers || !data.transfers.length ? (
              <p className="text-muted small mb-0 d-flex align-items-center gap-1"><i data-lucide="inbox"></i>{t("tr_empty")}</p>
            ) : (
              <div className="list-group list-group-flush">
                {data.transfers.map((tx, i) => {
                  const incoming = tx.type === "transfer_in";
                  const note = h.txNote(tx);
                  return (
                    <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={i}>
                      <span className={`tile-icon ${incoming ? "ti-mint" : "ti-coral"} flex-shrink-0`} style={{ width: 36, height: 36, fontSize: ".9rem" }}><i data-lucide={incoming ? "inbox" : "send"}></i></span>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small text-truncate">{incoming ? t("tr_in") : t("tr_out")}{note && <> · <bdi>{note}</bdi></>}</div>
                        <div className={`fw-bold small text-${incoming ? "success" : "danger"}`}>{incoming ? "+" : "−"}{money(tx.amount)}</div>
                        <div className="text-muted" style={{ fontSize: ".72rem" }}><span data-ago={tx.at} title={new Date(tx.at).toLocaleString()}>{h.timeAgo(tx.at)}</span></div>
                      </div>
                      {!!tx.ref && (
                        <a href={`/invoice/transfer/${tx.ref}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-secondary btn-icon flex-shrink-0" style={{ width: 30, height: 30 }} title={t("inv_title")}><i data-lucide="file-text"></i></a>
                      )}
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

export function SupportView({ h, data }: ViewProps<{ topics: Topic[]; myTickets: Ticket[] }>) {
  const { t } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="life-buoy" className="text-primary"></i>{t("sup_title")}</h3>
        </div>
        <p className="text-muted mb-4">{t("sup_sub")}</p>
        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="help-circle" className="text-primary"></i>{t("sup_pick")}</h6>
        <div className="row g-2 mb-4">
          {data.topics.map((tp) => (
            <div className="col-md-6" key={tp.key}>
              <a href={`/support/new?topic=${tp.key}`} className="d-flex align-items-center gap-3 p-3 rounded-4 text-reset text-decoration-none border h-100 topic-card">
                <span className={`tile-icon ${tp.tint} flex-shrink-0`} style={{ width: 44, height: 44, fontSize: "1.15rem" }}><i data-lucide={tp.icon}></i></span>
                <span className="fw-semibold small">{t("sup_t_" + tp.key)}</span>
              </a>
            </div>
          ))}
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="inbox" className="text-primary"></i>{t("sup_my_tickets")}</h6>
            {!data.myTickets.length ? (
              <p className="text-muted small mb-0">{t("sup_no_tickets")}</p>
            ) : (
              <div className="list-group list-group-flush">
                {data.myTickets.map((tk) => {
                  const sc = statusClass(tk.status);
                  return (
                    <a href={`/support/${tk.id}`} className="list-group-item list-group-item-action px-0 d-flex align-items-center gap-2 bg-transparent text-reset" key={tk.id}>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small text-truncate">#{tk.id} · {tk.subject}</div>
                        <div className="text-muted text-truncate" style={{ fontSize: ".75rem" }}>{t("sup_t_" + tk.topic)} · <span data-ago={tk.updatedAt} title={new Date(tk.updatedAt).toLocaleString()}>{h.timeAgo(tk.updatedAt)}</span></div>
                      </div>
                      <span className={`badge bg-${sc}-subtle text-${sc} flex-shrink-0`}>{t("sup_status_" + tk.status)}</span>
                      <i data-lucide="chevron-right" className="text-muted flex-shrink-0"></i>
                    </a>
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

export function SupportNewView({ L, h, data }: ViewProps<{ topic: string }>) {
  const { t } = h;
  const topic = data.topic;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/support" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0">{t("sup_t_" + topic)}</h3>
        </div>
        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="tile-icon ti-mint" style={{ width: 40, height: 40, fontSize: "1.05rem" }}><i data-lucide="lightbulb"></i></span>
              <h6 className="fw-bold mb-0">{t("sup_help_title")}</h6>
            </div>
            <p className="text-muted mb-0 lh-lg">{t("sup_h_" + topic)}</p>
          </div>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="message-square-plus" className="text-primary"></i>{t("sup_still_need")}</h6>
            <form method="post" action={`/support/new?_csrf=${L.csrfToken}`} encType="multipart/form-data"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <input type="hidden" name="topic" value={topic} />
              <div className="mb-3">
                <label className="form-label small">{t("sup_subject")}</label>
                <input name="subject" className="form-control" maxLength={140} defaultValue={t("sup_t_" + topic)} />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t("sup_message")}</label>
                <textarea name="message" className="form-control" rows={5} maxLength={4000} required autoFocus></textarea>
              </div>
              <div className="mb-3">
                <label className="form-label small d-flex align-items-center gap-1"><i data-lucide="paperclip"></i>{t("sup_attach")}</label>
                <input name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.txt" className="form-control" data-preview="#supNewPrev" />
                <div className="form-text">{t("sup_attach_hint")}</div>
                <div id="supNewPrev"></div>
              </div>
              <button className="btn btn-primary w-100 py-2 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="send"></i>{t("sup_send")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SupportTicketView({ L, h, data }: ViewProps<{ ticket: Ticket }>) {
  const { t } = h;
  const tk = data.ticket;
  const sc = statusClass(tk.status);
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <a href="/support" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 flex-grow-1 min-w-0 text-truncate">#{tk.id} · {tk.subject}</h3>
          <span className={`badge bg-${sc}-subtle text-${sc} flex-shrink-0`}>{t("sup_status_" + tk.status)}</span>
        </div>
        <p className="text-muted small mb-4">{t("sup_t_" + tk.topic)}</p>
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-column gap-3">
            {tk.messages.map((msg, i) => {
              const mine = msg.from === "user";
              return (
                <div className={`d-flex ${mine ? "justify-content-end" : "justify-content-start"}`} key={i}>
                  <div className={`p-3 rounded-4 ${mine ? "bg-primary-subtle" : "bg-body-secondary"}`} style={{ maxWidth: "85%" }}>
                    <div className="small fw-semibold mb-1 d-flex align-items-center gap-1">
                      <i data-lucide={mine ? "user" : "life-buoy"} style={{ width: ".85em", height: ".85em" }}></i>
                      {mine ? t("sup_you") : t("sup_support")}
                      <span className="text-muted fw-normal" style={{ fontSize: ".72rem" }} title={new Date(msg.at).toLocaleString()}>· <span data-ago={msg.at}>{h.timeAgo(msg.at)}</span></span>
                    </div>
                    {msg.text && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>}
                    {msg.file && ((msg.fileType || "").startsWith("image/") ? (
                      <a href={msg.file} target="_blank" rel="noopener" className="d-inline-block mt-2"><img src={msg.file} alt={msg.fileName} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, border: "1px solid var(--line)" }} /></a>
                    ) : (
                      <a href={msg.file} target="_blank" rel="noopener" download="" className="d-inline-flex align-items-center gap-1 mt-2 small fw-semibold text-primary text-decoration-none"><i data-lucide="paperclip"></i>{msg.fileName || t("sup_attachment")}</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {tk.status === "closed" ? (
          <>
            <p className="text-muted small text-center">{t("sup_closed_note")}</p>
            <div className="text-center"><a href="/support" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("sup_open_ticket")}</a></div>
          </>
        ) : (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <form method="post" action={`/support/${tk.id}/reply?_csrf=${L.csrfToken}`} encType="multipart/form-data"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <textarea name="message" className="form-control mb-2" rows={3} maxLength={4000} placeholder={t("sup_reply_ph")}></textarea>
                <div className="mb-2">
                  <label className="form-label small d-flex align-items-center gap-1"><i data-lucide="paperclip"></i>{t("sup_attach")}</label>
                  <input name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.txt" className="form-control form-control-sm" data-preview="#supReplyPrev" />
                  <div id="supReplyPrev"></div>
                </div>
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="send"></i>{t("sup_reply")}</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
