// views/partials/campaign-card.ejs and views/partials/payout-fields.ejs
import type { CampaignStatus } from "@/lib/game";
import type { Payout } from "@/lib/types";
import type { LayoutData } from "@/server/page-props";
import type { Helpers } from "../helpers";

export function CampaignCard({ L, h, campaign, redirectTo }: { L: LayoutData; h: Helpers; campaign: CampaignStatus; redirectTo: string }) {
  const { t, money } = h;
  if (!campaign.enabled) return null;
  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
      <div className="card-body">
        <div className="d-flex align-items-center gap-3 mb-3">
          <span className="tile-icon ti-lilac" style={{ width: 52, height: 52, flex: "0 0 52px", fontSize: "1.4rem" }}><i data-lucide="party-popper"></i></span>
          <div className="flex-grow-1">
            <h6 className="fw-bold mb-1">{campaign.title || t("camp_title")}</h6>
            <p className="text-muted small mb-0">
              {t("camp_desc", { goal: campaign.goal, min: money(campaign.minDeposit), coins: money(campaign.rewardCoins), xp: campaign.rewardXp })}
            </p>
            {(campaign.coinsPerInvite > 0 || campaign.xpPerInvite > 0) && (
              <span className="badge bg-success-subtle text-success mt-2 d-inline-flex align-items-center gap-1">
                <i data-lucide="user-check"></i>{t("camp_perinvite_badge", { coins: money(campaign.coinsPerInvite), xp: campaign.xpPerInvite })}
              </span>
            )}
          </div>
        </div>
        {campaign.maxed ? (
          <div className="alert alert-success py-2 small mb-0 d-flex align-items-center gap-2">
            <i data-lucide="check"></i><span>{t("camp_done", { n: campaign.claims })}</span>
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">{t("camp_progress", { have: campaign.inStage, goal: campaign.goal })}</span>
              {campaign.claims > 0 && <span className="text-muted">{t("camp_times", { n: campaign.claims })}</span>}
            </div>
            <div className="progress mb-3">
              <div className="progress-bar" style={{ width: `${Math.round(campaign.inStage / campaign.goal * 100)}%` }}></div>
            </div>
            {campaign.canClaim ? (
              <form action="/campaign/claim" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <input type="hidden" name="redirect" value={redirectTo} />
                <button className="btn btn-warning w-100 d-inline-flex align-items-center justify-content-center gap-2">
                  <i data-lucide="gift"></i>{t("camp_claim", { coins: money(campaign.rewardCoins), xp: campaign.rewardXp })}
                </button>
              </form>
            ) : (
              <div className="small text-muted d-flex align-items-center gap-1">
                <i data-lucide="lock"></i>{t("camp_locked", { n: campaign.goal - campaign.inStage })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PayoutFields({ h, payout }: { h: Helpers; payout: Payout }) {
  const { t } = h;
  return (
    <>
      <div className="mb-3">
        <label className="form-label">{t("payout_method")}</label>
        <select name="method" className="form-select payout-method" defaultValue={payout.method}>
          <option value="paypal">{t("payout_paypal")}</option>
          <option value="bank">{t("payout_bank")}</option>
        </select>
      </div>
      <div className="mb-3">
        <label className="form-label">{t("payout_name")}</label>
        <input name="payoutName" className="form-control" placeholder={t("payout_name_ph")} defaultValue={payout.name} />
      </div>
      <div className="mb-3 payout-if-paypal">
        <label className="form-label">{t("payout_paypal_email")}</label>
        <input name="paypal" type="email" dir="ltr" className="form-control" placeholder="name@example.com" defaultValue={payout.paypal} />
      </div>
      <div className="mb-3 payout-if-bank">
        <label className="form-label">{t("payout_rib")}</label>
        <input name="rib" dir="ltr" className="form-control" placeholder={t("payout_rib_ph")} defaultValue={payout.rib} />
      </div>
    </>
  );
}
