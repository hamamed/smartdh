// views/withdraw.ejs and views/profile.ejs
import type { User, Withdrawal } from "@/lib/types";
import { PayoutFields } from "../parts/PlayerParts";
import type { ViewProps } from "../registry";

type Funds = Record<string, { held: number; locked: number; available: number; unlockAt: number }>;
type WithdrawData = { user: User; payoutOk: boolean; payoutAccount: string; depositOk: boolean; lockDays: number; funds: Funds; myWithdrawals: Withdrawal[] };

export function WithdrawView({ L, h, data }: ViewProps<WithdrawData>) {
  const { t, money } = h;
  const s = L.settings;
  const u = data.user;
  const kyc = u.kyc || { status: "none", reviewNote: "" };
  const plans = s.plans;
  const lockedApps = plans.filter((p) => (data.funds[p.id] || { locked: 0 }).locked > 0);
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="arrow-down-to-line" className="text-primary"></i>{t("withdraw_title")}</h3>
        </div>
        <div id="flash"></div>

        {kyc.status === "requested" || kyc.status === "rejected" ? (
          <div className="alert alert-warning d-flex align-items-start gap-2">
            <i data-lucide="shield-alert" className="flex-shrink-0 mt-1"></i>
            <div className="flex-grow-1">
              <div className="fw-semibold">{t("kyc_prompt_h")}</div>
              <div className="small">{t("kyc_prompt_b")}</div>
              {kyc.status === "rejected" && kyc.reviewNote && <div className="small mt-1">{t("wd_reason_label")}: {kyc.reviewNote}</div>}
              <a href="/verify-identity" className="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1"><i data-lucide="shield-check"></i>{t("kyc_prompt_cta")}</a>
            </div>
          </div>
        ) : kyc.status === "submitted" ? (
          <div className="alert alert-info d-flex align-items-center gap-2"><i data-lucide="clock"></i><span>{t("kyc_pending_b")}</span></div>
        ) : null}

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body">
            {!data.depositOk ? (
              <>
                <div className="alert alert-warning small d-flex align-items-center gap-2 mb-3">
                  <i data-lucide="alert-triangle"></i><span>{t("e_needdeposit")}</span>
                </div>
                <a href="/invest" className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="plus"></i>{t("bonus_go_deposit")}</a>
              </>
            ) : (
              <form method="post" action="/withdraw"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <select name="from" className="form-select mb-2">
                  <option value="earnings">{`${t("opt_earnings")} (${money(u.earnings)})`}</option>
                  {plans.map((p) => {
                    const f = data.funds[p.id] || { held: 0, locked: 0, available: 0 };
                    return <option value={p.id} key={p.id}>{`${h.planName(p)} (${money(f.available)}${f.locked > 0 ? " · " + t("wd_locked_opt", { amt: money(f.locked) }) : ""})`}</option>;
                  })}
                </select>
                {data.lockDays > 0 && lockedApps.length > 0 && (
                  <div className="alert alert-warning py-2 small mb-2">
                    <div className="d-flex align-items-center gap-1 fw-semibold mb-1"><i data-lucide="lock"></i>{t("wd_lock_title", { days: data.lockDays })}</div>
                    {lockedApps.map((p) => {
                      const f = data.funds[p.id];
                      return (
                        <div className="pt-1" key={p.id}>
                          <div className="d-flex justify-content-between gap-2">
                            <span className="fw-semibold text-truncate">{h.planName(p)}</span>
                            <span className="fw-semibold text-nowrap flex-shrink-0">{money(f.locked)}</span>
                          </div>
                          {!!f.unlockAt && <div className="text-muted" style={{ fontSize: ".78rem" }}>{t("wd_unlocks", { date: new Date(f.unlockAt).toLocaleDateString() })}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="input-group mb-2">
                  <span className="input-group-text"><i data-lucide="banknote"></i></span>
                  <input name="amount" type="number" min={s.minWithdraw} step="1" className="form-control" placeholder={t("amount_ph")} required />
                  <span className="input-group-text">{L.curLabel}</span>
                </div>
                <hr className="my-3" />
                {data.payoutOk ? (
                  <>
                    <div className="d-flex align-items-center gap-3 p-3 rounded-3 bg-body-secondary mb-3">
                      <span className="tile-icon ti-mint" style={{ width: 42, height: 42, fontSize: "1.1rem" }}>
                        <i data-lucide={u.payout.method === "bank" ? "landmark" : "wallet"}></i>
                      </span>
                      <div className="flex-grow-1 small">
                        <div className="text-muted">{t("payout_sending_to")}</div>
                        <div className="fw-semibold">{u.payout.name}{" "}
                          <span className="badge bg-primary-subtle text-primary ms-1">{u.payout.method === "bank" ? t("payout_bank") : t("payout_paypal")}</span>
                        </div>
                        <div className="text-muted" dir="ltr" style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}>{data.payoutAccount}</div>
                      </div>
                      <a href="/profile" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
                        <i data-lucide="pencil"></i>{t("payout_change")}
                      </a>
                    </div>
                    <button className="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-1"><i data-lucide="arrow-down"></i>{t("btn_request")}</button>
                  </>
                ) : (
                  <>
                    <div className="alert alert-warning small d-flex align-items-center gap-2 mb-3">
                      <i data-lucide="alert-triangle"></i><span>{t("payout_missing_d")}</span>
                    </div>
                    <a href="/profile" className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-1">
                      <i data-lucide="settings"></i>{t("payout_setup")}
                    </a>
                  </>
                )}
                <p className="small text-muted mt-2 mb-0">{t("withdraw_note", { min: money(s.minWithdraw), days: s.withdrawEveryDays })}</p>
              </form>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="history" className="text-primary"></i>{t("activity_title")}</h6>
            {data.myWithdrawals.length === 0 ? (
              <p className="text-muted small mb-0">{t("no_activity")}</p>
            ) : (
              <div className="list-group list-group-flush">
                {data.myWithdrawals.map((w) => {
                  const wc = w.status === "paid" ? "success" : w.status === "rejected" ? "danger" : "warning";
                  const reason = w.status === "rejected" ? h.rejectReason(w) : "";
                  return (
                    <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={w.id}>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small text-truncate">{w.fromLabel || w.from}</div>
                        <div className="fw-bold small text-danger">{money(w.amount)}</div>
                        <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: ".72rem" }}>
                          <span className={`badge bg-${wc}-subtle text-${wc} text-capitalize`}>{w.status}</span>
                          <span className="text-muted"><span data-ago={w.createdAt} title={new Date(w.createdAt).toLocaleString()}>{h.timeAgo(w.createdAt)}</span></span>
                        </div>
                        {reason && (
                          <div className="alert alert-danger py-1 px-2 mb-0 mt-2 d-flex align-items-start gap-1" style={{ fontSize: ".75rem" }}>
                            <i data-lucide="info" style={{ width: ".95em", height: ".95em" }} className="flex-shrink-0 mt-1"></i>
                            <span><span className="fw-semibold">{t("wd_reason_label")}:</span> {reason}</span>
                          </div>
                        )}
                      </div>
                      <a href={`/invoice/withdraw/${w.id}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-secondary btn-icon flex-shrink-0" style={{ width: 30, height: 30 }} title={t("inv_title")}><i data-lucide="file-text"></i></a>
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

type ProfileData = { user: User; error: string | null; ok: string | null; err: string | null };

export function ProfileView({ L, h, data }: ViewProps<ProfileData>) {
  const { t } = h;
  const u = data.user;
  const okMap: Record<string, string> = { saved: t("profile_saved"), payout: t("profile_saved"), password: t("pw_changed"), email: t("prof_email_changed"), prefs: t("prof_prefs_saved") };
  const errMap: Record<string, string> = { wrongpass: t("pw_wrong_current"), short: t("pw_too_short"), mismatch: t("pw_mismatch"), bademail: t("prof_bademail"), dupemail: t("prof_dupemail") };
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="user" className="text-primary"></i>{t("profile_title")}</h3>
        </div>
        {data.error && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{data.error}</div>}
        {data.err && errMap[data.err] && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{errMap[data.err]}</div>}
        {data.ok && okMap[data.ok] && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{okMap[data.ok]}</div>}

        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="user" className="text-primary"></i>{t("profile_identity")}</h6>
            <div className="d-flex align-items-center gap-3 mb-3">
              {u.avatar
                ? <img src={u.avatar} alt="" className="rounded-circle" style={{ width: 64, height: 64, objectFit: "cover" }} />
                : <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 64, height: 64, fontSize: "1.5rem" }}>{u.name.charAt(0).toUpperCase()}</div>}
              <div className="small text-muted">{u.email}<br /><span className="text-uppercase">{u.referralCode}</span></div>
            </div>
            <form method="post" action={`/profile?_csrf=${L.csrfToken}`} encType="multipart/form-data"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label">{t("lbl_name")}</label>
                <input name="name" className="form-control" defaultValue={u.name} required />
              </div>
              <div className="mb-3">
                <label className="form-label">{t("profile_photo")} <span className="text-muted small">{t("opt")}</span></label>
                <input type="file" name="photo" id="photoInput" className="form-control" accept="image/*" />
                <input type="hidden" name="hasPhoto" id="hasPhoto" value="0" />
                <div className="form-text">{t("photo_hint")}</div>
                <img id="photoPreview" className="rounded-3 mt-2 d-none" style={{ width: 96, height: 96, objectFit: "cover" }} alt="" />
              </div>
              {u.avatar && (
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" name="removePhoto" id="removePhoto" value="1" />
                  <label className="form-check-label small" htmlFor="removePhoto">{t("photo_remove")}</label>
                </div>
              )}
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="banknote" className="text-primary"></i>{t("payout_details")}</h6>
            <p className="text-muted small mb-3">{t("payout_intro")}</p>
            <form method="post" action="/profile/payout"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <PayoutFields h={h} payout={u.payout} />
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="settings-2" className="text-primary"></i>{t("prof_prefs_t")}</h6>
            <form method="post" action="/profile/prefs"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label">{t("prof_lang")}</label>
                <select name="lang" className="form-select" defaultValue={u.lang || L.lang}>
                  {L.langs.map((l) => <option value={l.code} key={l.code}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" role="switch" name="emails" id="emails" value="1" defaultChecked={!u.emailOptOut} />
                <label className="form-check-label" htmlFor="emails">{t("prof_notif")}<span className="d-block small text-muted">{t("prof_notif_d")}</span></label>
              </div>
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="shield-check" className="text-primary"></i>{t("prof_security_t")}</h6>
            <div className="alert alert-secondary py-2 small d-flex align-items-start gap-2 mb-3"><i data-lucide="lock" className="flex-shrink-0 mt-1"></i><span>{t("prof_security_note")}</span></div>
            <div className="fw-semibold small mb-2">{t("prof_email_t")}</div>
            <form method="post" action="/profile/email" autoComplete="off" className="mb-4"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-2">
                <input name="email" type="email" className="form-control" defaultValue={u.email} required />
              </div>
              <div className="input-group">
                <span className="input-group-text"><i data-lucide="lock"></i></span>
                <input name="current" type="password" className="form-control" placeholder={t("pw_current")} autoComplete="current-password" required />
                <button className="btn btn-outline-primary">{t("btn_save")}</button>
              </div>
            </form>
            <div className="fw-semibold small mb-2">{t("profile_password")}</div>
            <form method="post" action="/profile/password" autoComplete="off"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-2"><input name="current" type="password" className="form-control" placeholder={t("pw_current")} autoComplete="current-password" required /></div>
              <div className="mb-2"><input name="next" type="password" minLength={6} className="form-control" placeholder={t("pw_new")} autoComplete="new-password" required /></div>
              <div className="input-group">
                <input name="confirm" type="password" minLength={6} className="form-control" placeholder={t("pw_confirm")} autoComplete="new-password" required />
                <button className="btn btn-outline-primary">{t("pw_change")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
