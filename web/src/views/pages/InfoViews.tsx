// views/contact.ejs and views/download.ejs
import type { ViewProps } from "../registry";

type ContactData = { contactEmail: string; form: { name?: string; email?: string; subject?: string }; sent: boolean; error: string | null; now: number };

export function ContactView({ L, h, data }: ViewProps<ContactData>) {
  const { t } = h;
  const { form } = data;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <a href={L.user ? "/dashboard" : "/"} className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h2 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="mail" className="text-primary"></i>{t("contact_title")}</h2>
        </div>
        <p className="text-muted mb-4">{t("contact_sub")}</p>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            {data.sent ? (
              <>
                <div className="alert alert-success d-flex align-items-start gap-2">
                  <i data-lucide="check-circle" className="flex-shrink-0 mt-1"></i>
                  <div><div className="fw-semibold">{t("contact_sent_h")}</div><div className="small">{t("contact_sent_b")}</div></div>
                </div>
                <a href="/" className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"><i data-lucide="arrow-left"></i>{t("back_home")}</a>
              </>
            ) : (
              <>
                {data.error && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{data.error}</div>}
                <form method="post" action="/contact"><input type="hidden" name="_csrf" value={L.csrfToken} />
                  <input type="hidden" name="_t" value={String(data.now)} />
                  <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, overflow: "hidden" }}>
                    <label>Website</label><input type="text" name="website" tabIndex={-1} autoComplete="off" />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">{t("lbl_name")}</label>
                      <input name="name" className="form-control" defaultValue={form.name || ""} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">{t("lbl_email")}</label>
                      <input name="email" type="email" className="form-control" defaultValue={form.email || ""} required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">{t("contact_subject")} <span className="text-muted small">{t("opt")}</span></label>
                      <input name="subject" className="form-control" defaultValue={form.subject || ""} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">{t("contact_msg")}</label>
                      <textarea name="message" className="form-control" rows={5} required></textarea>
                    </div>
                    <div className="col-12">
                      <button className="btn btn-primary w-100 py-2 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="send"></i>{t("contact_send")}</button>
                    </div>
                  </div>
                </form>
                <p className="text-center text-muted small mt-4 mb-0">
                  {t("contact_or_email")}{" "}
                  <a href={`mailto:${data.contactEmail}`} className="fw-semibold">{data.contactEmail}</a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const DL_FEATURES: [string, string][] = [["zap", "dl_f1"], ["smartphone", "dl_f2"], ["wifi-off", "dl_f3"]];

export function DownloadView({ L, h, data }: ViewProps<{ apkUrl: string }>) {
  const { t } = h;
  return (
    <section className="lp-hero py-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="text-center">
          <img src={`/icons/icon-192.png?v=${L.assetV}`} alt={L.settings.siteName} width={88} height={88}
            style={{ borderRadius: 22, boxShadow: "var(--shadow-md)" }} />
          <h1 className="fw-bold mt-3 mb-2">{t("dl_title")}</h1>
          <p className="text-muted mb-4 mx-auto" style={{ maxWidth: "44ch" }}>{t("dl_sub")}</p>
          <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center mb-2">
            {/* Shown only when the browser reports the app is installable */}
            <button type="button" data-pwa-install="" hidden className="btn btn-primary btn-lg px-4 d-inline-flex align-items-center justify-content-center gap-2">
              <i data-lucide="download"></i>{t("dl_install")}
            </button>
            {data.apkUrl && (
              <a href={data.apkUrl} className="btn btn-success btn-lg px-4 d-inline-flex align-items-center justify-content-center gap-2">
                <i data-lucide="smartphone"></i>{t("dl_apk")}
              </a>
            )}
            <a href="/dashboard" className="btn btn-outline-secondary btn-lg px-4 d-inline-flex align-items-center justify-content-center gap-2">
              <i data-lucide="external-link"></i>{t("dl_open")}
            </a>
          </div>
        </div>
        <div className="row g-3 mt-3">
          {DL_FEATURES.map(([icon, key]) => (
            <div className="col-sm-4" key={key}>
              <div className="lp-card text-center p-4 h-100">
                <span className="tile-icon ti-mint mx-auto mb-2" style={{ width: 52, height: 52, fontSize: "1.35rem" }}><i data-lucide={icon}></i></span>
                <div className="fw-semibold small">{t(key)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card border-0 shadow-sm rounded-4 mt-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="help-circle" className="text-primary"></i>{t("dl_how")}</h6>
            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="tile-icon ti-sky flex-shrink-0" style={{ width: 44, height: 44, fontSize: "1.1rem" }}><i data-lucide="smartphone"></i></span>
              <div>
                <div className="fw-semibold">{t("dl_android")}</div>
                <div className="text-muted small">{t("dl_android_d")}</div>
              </div>
            </div>
            <div className="d-flex align-items-start gap-3">
              <span className="tile-icon ti-lilac flex-shrink-0" style={{ width: 44, height: 44, fontSize: "1.1rem" }}><i data-lucide="apple"></i></span>
              <div>
                <div className="fw-semibold">{t("dl_ios")}</div>
                <div className="text-muted small">{t("dl_ios_d")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
