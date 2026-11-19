// views/login.ejs, signup.ejs, forgot.ejs, reset.ejs, pending.ejs
import { Fragment } from "react";
import type { ViewProps } from "../registry";

type LoginData = { error: string | null; notice?: string | null; unverified?: string | null; form: { email?: string } };

export function LoginView({ L, h, data }: ViewProps<LoginData>) {
  const { t } = h;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <h3 className="fw-bold mb-1">{t("login_title")}</h3>
            <p className="text-muted mb-4">{t("login_sub")}</p>
            {data.notice && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{data.notice}</div>}
            {data.error && <div className="alert alert-danger py-2"><i data-lucide="alert-triangle" className="me-1"></i>{data.error}</div>}
            {data.unverified && (
              <form method="post" action="/resend-verification" className="mb-3">
                <input type="hidden" name="_csrf" value={L.csrfToken} />
                <input type="hidden" name="email" value={data.unverified} />
                <button className="btn btn-outline-primary btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="mail"></i>{t("login_resend")}</button>
              </form>
            )}
            <form method="post" action="/login"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label">{t("lbl_email")}</label>
                <input name="email" type="email" className="form-control" defaultValue={data.form.email || ""} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("lbl_password")}</label>
                <input name="password" type="password" className="form-control" required />
              </div>
              <button className="btn btn-primary w-100 py-2"><i data-lucide="log-in" className="me-1"></i>{t("btn_login")}</button>
            </form>
            <p className="text-center small mt-3 mb-0"><a href="/forgot" className="text-muted">{t("forgot_link")}</a></p>
            <p className="text-center text-muted small mt-3 mb-0">
              {t("new_here")} <a href="/signup">{t("link_signup")}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

type SignupData = { error: string | null; form: { name?: string; email?: string; ref?: string }; now: number };

export function SignupView({ L, h, data }: ViewProps<SignupData>) {
  const { t } = h;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <h3 className="fw-bold mb-1">{t("signup_title")}</h3>
            <p className="text-muted mb-4">{t("signup_sub")}</p>
            {data.error && <div className="alert alert-danger py-2"><i data-lucide="alert-triangle" className="me-1"></i>{data.error}</div>}
            <form method="post" action="/signup"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <input type="hidden" name="_t" value={String(data.now)} />
              {/* honeypot: hidden from humans; only bots fill it */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, overflow: "hidden" }}>
                <label>Website</label>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("lbl_name")}</label>
                <input name="name" className="form-control" defaultValue={data.form.name || ""} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("lbl_email")}</label>
                <input name="email" type="email" className="form-control" defaultValue={data.form.email || ""} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("lbl_password")}</label>
                <input name="password" type="password" className="form-control" minLength={4} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("lbl_ref")} <span className="text-muted small">{t("opt")}</span></label>
                <input name="ref" className="form-control text-uppercase" defaultValue={data.form.ref || ""} placeholder={t("ref_ph")} />
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" name="agree" id="agree" value="1" required />
                {/* agree_html is our own translation string with a link to the terms */}
                <label className="form-check-label small" htmlFor="agree" dangerouslySetInnerHTML={{ __html: t("agree_html") }} />
              </div>
              <button className="btn btn-primary w-100 py-2"><i data-lucide="user-plus" className="me-1"></i>{t("btn_create")}</button>
            </form>
            <p className="text-center text-muted small mt-4 mb-0">
              {t("have_account")} <a href="/login">{t("link_login")}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ForgotView({ L, h, data }: ViewProps<{ sent: boolean }>) {
  const { t } = h;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            {data.sent ? (
              <div className="text-center">
                <div className="tile-icon ti-mint mx-auto mb-3" style={{ width: 72, height: 72, fontSize: "1.9rem" }}><i data-lucide="mail-check"></i></div>
                <h4 className="fw-bold mb-2">{t("forgot_sent_t")}</h4>
                <p className="text-muted mb-4">{t("forgot_sent_d")}</p>
                <a href="/login" className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="log-in"></i>{t("btn_login")}</a>
              </div>
            ) : (
              <>
                <h3 className="fw-bold mb-1">{t("forgot_title")}</h3>
                <p className="text-muted mb-4">{t("forgot_sub")}</p>
                <form method="post" action="/forgot"><input type="hidden" name="_csrf" value={L.csrfToken} />
                  <div className="mb-3">
                    <label className="form-label">{t("lbl_email")}</label>
                    <input name="email" type="email" className="form-control" required />
                  </div>
                  <button className="btn btn-primary w-100 py-2 d-inline-flex align-items-center justify-content-center gap-1">
                    <i data-lucide="mail"></i>{t("forgot_send")}
                  </button>
                </form>
                <p className="text-center text-muted small mt-4 mb-0"><a href="/login">{t("btn_login")}</a></p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ResetView({ L, h, data }: ViewProps<{ token: string; error: string | null }>) {
  const { t } = h;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <h3 className="fw-bold mb-1">{t("reset_title")}</h3>
            <p className="text-muted mb-4">{t("reset_sub")}</p>
            {data.error && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{data.error}</div>}
            <form method="post" action={`/reset/${data.token}`}><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label d-flex align-items-center gap-1"><i data-lucide="shield-check" className="text-primary"></i>{t("reset_code")}</label>
                <input name="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code"
                  className="form-control form-control-lg text-center" style={{ letterSpacing: ".4em", fontWeight: 700 }} placeholder="••••••" required autoFocus />
                <div className="form-text">{t("reset_code_hint")}</div>
              </div>
              <div className="mb-3">
                <label className="form-label">{t("pw_new")}</label>
                <input name="password" type="password" className="form-control" minLength={6} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("pw_confirm")}</label>
                <input name="confirm" type="password" className="form-control" minLength={6} required />
              </div>
              <button className="btn btn-primary w-100 py-2 d-inline-flex align-items-center justify-content-center gap-1">
                <i data-lucide="lock"></i>{t("reset_save")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

const PEND_STEPS: [string, string, string][] = [["user-check", "msg_pend_s1", "mint"], ["shield-check", "msg_pend_s2", "yellow"], ["log-in", "msg_pend_s3", "sky"]];

export function PendingView({ L, h }: ViewProps) {
  const { t } = h;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden text-center">
          <div className="msg-hero">
            <span className="tile-icon ti-yellow"><i data-lucide="hourglass"></i></span>
          </div>
          <div className="card-body p-4 p-md-5 pt-4">
            <h3 className="fw-bold mb-2">{t("pending_title")}</h3>
            <p className="text-muted mb-0">{t("pending_body", { name: L.user ? L.user.name : "" })}</p>
            <div className="msg-steps mt-4">
              {PEND_STEPS.map((s, i) => (
                <Fragment key={s[1]}>
                  <div className="msg-step">
                    <span className={`tile-icon ti-${s[2]}`}><i data-lucide={s[0]}></i></span>
                    <span className="small fw-semibold mt-2">{t(s[1])}</span>
                    {i === 0 && <span className="badge bg-success-subtle text-success mt-1"><i data-lucide="check"></i></span>}
                    {i === 1 && <span className="badge bg-warning-subtle text-warning mt-1">{t("st_pending")}</span>}
                  </div>
                  {i < 2 && <span className="msg-arrow"><i data-lucide="chevron-right"></i></span>}
                </Fragment>
              ))}
            </div>
            <form action="/logout" method="post" className="mt-4"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"><i data-lucide="log-out"></i>{t("nav_logout")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
