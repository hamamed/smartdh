// views/referral.ejs and views/verify-identity.ejs
import type { CampaignStatus } from "@/lib/game";
import type { Kyc, User } from "@/lib/types";
import { InlineScript } from "../Layout";
import { CampaignCard } from "../parts/PlayerParts";
import type { ViewProps } from "../registry";

type Tier = { percent: number; members: { name: string; avatar: string; active: boolean }[] };
const TINTS = ["coral", "yellow", "sky"];

export function ReferralView({ L, h, data }: ViewProps<{ user: User; tiers: Tier[]; campaign: CampaignStatus }>) {
  const { t, money } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="user-plus" className="text-primary"></i>{t("invite_title")}</h3>
        </div>
        <CampaignCard L={L} h={h} campaign={data.campaign} redirectTo="referral" />
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body text-center p-4">
            <div className="tile-icon ti-mint mx-auto mb-3" style={{ width: 72, height: 72, fontSize: "1.9rem" }}><i data-lucide="user-plus"></i></div>
            <p className="text-muted small mb-4">{t("invite_desc")}</p>
            <div className="input-group mb-3">
              <span className="input-group-text">{t("your_code")}</span>
              <input className="form-control fw-bold text-center" id="refLink" readOnly defaultValue={data.user.referralCode} />
              <button className="btn btn-outline-primary d-inline-flex align-items-center gap-1" type="button" id="copyRef"><i data-lucide="copy"></i>{t("btn_copy")}</button>
            </div>
            <div className="p-3 rounded-3 wallet wallet-mint">
              <div className="small d-flex align-items-center justify-content-center gap-1"><i data-lucide="coins"></i>{t("ref_total")}</div>
              <div className="h4 fw-bold mb-0 mt-1">{money(data.user.referralEarnings)}</div>
            </div>
          </div>
        </div>
        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="network" className="text-primary"></i>{t("ref_team")}</h6>
        {data.tiers.map((tier, i) => (
          <div className="card border-0 shadow-sm rounded-4 mb-2" key={i}>
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <span className={`tile-icon ti-${TINTS[i]}`} style={{ width: 44, height: 44, fontSize: "1.1rem" }}><i data-lucide="users"></i></span>
                <div className="flex-grow-1">
                  <div className="fw-bold d-flex align-items-center gap-2">
                    {t("ref_tier", { n: i + 1 })}
                    <span className="badge bg-success-subtle text-success">{`${tier.percent}%`}</span>
                  </div>
                  <div className="small text-muted">{t("ref_tier_" + (i + 1) + "_d")}</div>
                </div>
                <div className="text-end">
                  <div className="h5 fw-bold mb-0">{tier.members.length}</div>
                  <div className="small text-muted">{t("ref_members")}</div>
                </div>
              </div>
              {tier.members.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">
                  {tier.members.map((m, j) => (
                    <span className="badge bg-body-secondary text-body d-inline-flex align-items-center gap-1 p-2" key={j}>
                      {m.avatar
                        ? <img src={m.avatar} className="rounded-circle" style={{ width: 20, height: 20, objectFit: "cover" }} alt="" />
                        : <span className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-bold"
                            style={{ width: 20, height: 20, fontSize: ".65rem" }}>{m.name.charAt(0).toUpperCase()}</span>}
                      {m.name}
                      {!m.active && <i data-lucide="hourglass" className="text-muted"></i>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="alert alert-secondary small mt-3 d-flex align-items-center gap-2">
          <i data-lucide="info"></i><span>{t("ref_note")}</span>
        </div>
      </div>
    </section>
  );
}

const PREVIEW_SCRIPT = `
// Instant preview for the two CIN file inputs.
document.querySelectorAll('input[type=file][data-preview]').forEach(function (inp) {
  inp.addEventListener('change', function () {
    const img = document.querySelector('[data-preview-for="' + inp.name + '"]');
    if (!img) return;
    const f = inp.files && inp.files[0];
    if (f) { img.src = URL.createObjectURL(f); img.classList.remove('d-none'); }
    else { img.classList.add('d-none'); }
  });
});
`;

export function VerifyIdentityView({ L, h, data }: ViewProps<{ kyc: Kyc; userName: string; ok: string; err: string }>) {
  const { t } = h;
  const { kyc, ok, err } = data;
  const sides: [string, string, string][] = [["cinFront", "kyc_cin_front", kyc.cinFront], ["cinBack", "kyc_cin_back", kyc.cinBack]];
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="d-flex align-items-center gap-2 mb-4">
            <a href="/withdraw" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
            <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="shield-check" className="text-primary"></i>{t("kyc_title")}</h3>
          </div>
          {(ok === "submitted" || ok === "already") && (
            <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i data-lucide="check"></i>{t("kyc_ok_submitted")}</div>
          )}
          {err && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i data-lucide="alert-triangle"></i>
              {err === "big" ? t("kyc_err_big") : err === "file" ? t("kyc_err_file") : t("kyc_err_fill")}
            </div>
          )}
          {kyc.status === "approved" ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body text-center py-5">
                <span className="tile-icon ti-mint mx-auto mb-3" style={{ width: 64, height: 64, fontSize: "1.8rem" }}><i data-lucide="badge-check"></i></span>
                <h5 className="fw-bold mb-1">{t("kyc_approved_h")}</h5>
                <p className="text-muted mb-0">{t("kyc_approved_b")}</p>
              </div>
            </div>
          ) : (
            <>
              {kyc.status === "submitted" ? (
                <div className="alert alert-info d-flex align-items-center gap-2"><i data-lucide="clock"></i>{t("kyc_pending_b")}</div>
              ) : kyc.status === "rejected" ? (
                <div className="alert alert-danger d-flex align-items-start gap-2">
                  <i data-lucide="x-circle" className="flex-shrink-0 mt-1"></i>
                  <div><div className="fw-semibold">{t("kyc_rejected_h")}</div>
                    {kyc.reviewNote && <div className="small mt-1">{t("wd_reason_label")}: {kyc.reviewNote}</div>}
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning d-flex align-items-center gap-2"><i data-lucide="info"></i>{t("kyc_intro")}</div>
              )}
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body">
                  <form action={`/verify-identity?_csrf=${L.csrfToken}`} method="post" encType="multipart/form-data">
                    <input type="hidden" name="_csrf" value={L.csrfToken} />
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">{t("kyc_fullname")}</label>
                      <input name="fullName" className="form-control" required maxLength={120} defaultValue={kyc.fullName || data.userName || ""} />
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6 mb-3">
                        <label className="form-label small fw-semibold">{t("kyc_dob")}</label>
                        <input name="dob" type="date" className="form-control" required defaultValue={kyc.dob || ""} />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label small fw-semibold">{t("kyc_address")}</label>
                        <input name="address" className="form-control" required maxLength={300} defaultValue={kyc.address || ""} />
                      </div>
                    </div>
                    <label className="form-label small fw-semibold">{t("kyc_cin")}</label>
                    <p className="text-muted small mb-2">{t("kyc_cin_hint")}</p>
                    <div className="row g-3 mb-3">
                      {sides.map(([name, label, existing]) => (
                        <div className="col-6" key={name}>
                          <div className="border rounded-3 p-2 h-100">
                            <div className="small text-muted mb-1 d-flex align-items-center gap-1"><i data-lucide="credit-card" style={{ width: ".9em", height: ".9em" }}></i>{t(label)}</div>
                            {existing && <img src={existing} alt="" className="img-fluid rounded mb-2 d-block" style={{ maxHeight: 120 }} />}
                            <input name={name} type="file" accept="image/*" className="form-control form-control-sm" data-preview="" required={!existing} />
                            <img data-preview-for={name} className="img-fluid rounded mt-2 d-none" style={{ maxHeight: 120 }} alt="" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2">
                      <i data-lucide="send"></i>{kyc.status === "rejected" ? t("kyc_resubmit") : t("kyc_submit")}
                    </button>
                  </form>
                </div>
              </div>
              <p className="text-muted small mt-3 d-flex align-items-start gap-2"><i data-lucide="lock" style={{ width: "1em", height: "1em" }} className="flex-shrink-0 mt-1"></i>{t("kyc_privacy")}</p>
            </>
          )}
        </div>
      </section>
      <InlineScript code={PREVIEW_SCRIPT} />
    </>
  );
}
