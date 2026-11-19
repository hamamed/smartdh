// views/admin/settings.ejs, settings-announcement.ejs, settings-payments.ejs, settings-telegram.ejs
import type { Settings } from "@/lib/types";
import type { ViewProps } from "../registry";
import { AdminHead } from "./AdminParts";

const TILES: [string, string, string, string][] = [
  ["/admin/settings/general", "ti-sky", "sliders-horizontal", "set_general_t"],
  ["/admin/settings/economy", "ti-mint", "coins", "set_economy_t"],
  ["/admin/settings/payments", "ti-yellow", "landmark", "set_payments_t"],
  ["/admin/settings/announcement", "ti-coral", "megaphone", "set_announcement_t"],
  ["/admin/settings/campaign", "ti-lilac", "party-popper", "set_campaign_t"],
  ["/admin/settings/telegram", "ti-sky", "send", "set_telegram_t"],
  ["/admin/account", "ti-navy", "user-cog", "tab_account"],
];

export function SettingsHubView({ h }: ViewProps) {
  const { t } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container">
        <AdminHead heading={t("tab_settings")} />
        <p className="text-muted mb-4">{t("settings_intro")}</p>
        <div className="menu-grid">
          {TILES.map(([href, tint, icon, key]) => (
            <a className="menu-tile" href={href} key={href}>
              <span className={`tile-icon ${tint}`}><i data-lucide={icon}></i></span>
              <span className="tile-label">{t(key)}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

const Saved = ({ h, ok }: { h: ViewProps["h"]; ok: unknown }) =>
  ok ? <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{h.t("profile_saved")}</div> : null;

export function SettingsAnnouncementView({ L, h, data }: ViewProps<{ ok: string | null }>) {
  const { t } = h;
  const ann = L.settings.announcement;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <AdminHead heading={t("set_announcement_t")} back="/admin" />
        <Saved h={h} ok={data.ok} />
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <p className="text-muted small mb-3">{t("set_announcement_d")}</p>
            {ann.enabled && ann.text && (
              <>
                <div className="small text-muted mb-1">{t("ann_preview")}</div>
                <div className="announcement-bar rounded-3 mb-3">
                  <div className="d-flex align-items-center gap-2 p-2 small">
                    <i data-lucide="megaphone"></i><span>{ann.text}</span>
                  </div>
                </div>
              </>
            )}
            <form action="/admin/settings/announcement" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="mb-3">
                <label className="form-label">{t("ann_text")}</label>
                <input name="ann_text" className="form-control" placeholder={t("ann_ph")} defaultValue={ann.text} />
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" name="ann_enabled" id="ann_enabled" value="1" defaultChecked={ann.enabled} />
                <label className="form-check-label" htmlFor="ann_enabled">{t("ann_show")}</label>
              </div>
              <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SettingsPaymentsView({ L, h, data }: ViewProps<{ ok: string | null }>) {
  const { t } = h;
  const info = L.settings.depositInfo;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 620 }}>
        <AdminHead heading={t("set_payments_t")} back="/admin/settings" />
        <Saved h={h} ok={data.ok} />
        <div className="alert alert-warning small d-flex align-items-center gap-2">
          <i data-lucide="alert-triangle"></i><span>{t("set_depwarn")}</span>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <p className="text-muted small mb-3">{t("set_payments_d")}</p>
            <form action="/admin/settings/payments" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t("set_bankname")}</label>
                  <input name="dep_bankName" className="form-control" defaultValue={info.bankName} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t("set_accountname")}</label>
                  <input name="dep_accountName" className="form-control" defaultValue={info.accountName} />
                </div>
                <div className="col-12">
                  <label className="form-label">{t("set_rib")}</label>
                  <input name="dep_rib" className="form-control" dir="ltr" defaultValue={info.rib} />
                  <div className="form-text">{t("set_rib_hint")}</div>
                </div>
                <div className="col-12">
                  <label className="form-label">{t("set_depnote")}</label>
                  <input name="dep_note" className="form-control" defaultValue={info.note} />
                </div>
              </div>
              <button className="btn btn-primary mt-3 d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

type TelegramData = { telegram: Settings["telegram"]; ok: string | null; test: string | null; envToken: boolean; envChat: boolean };

export function SettingsTelegramView({ L, h, data }: ViewProps<TelegramData>) {
  const { t } = h;
  const tg = data.telegram || { enabled: false, botToken: "", chatId: "" };
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 640 }}>
        <AdminHead heading={t("set_telegram_t")} back="/admin" />
        <Saved h={h} ok={data.ok} />
        {data.test === "ok" && <div className="alert alert-success py-2 d-flex align-items-center gap-1"><i data-lucide="check"></i>{t("tg_test_ok")}</div>}
        {data.test === "fail" && <div className="alert alert-danger py-2 d-flex align-items-center gap-1"><i data-lucide="alert-triangle"></i>{t("tg_test_fail")}</div>}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2"><i data-lucide="send" className="text-primary"></i>{t("set_telegram_t")}</h6>
            <p className="text-muted small mb-3">{t("set_telegram_d")}</p>
            <ol className="small text-muted mb-3 ps-3">
              <li>{t("tg_help_1")}</li>
              <li>{t("tg_help_2")}</li>
              <li>{t("tg_help_3")}</li>
            </ol>
            <form action="/admin/settings/telegram" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" name="enabled" id="tgEnabled" value="1" defaultChecked={!!tg.enabled} />
                <label className="form-check-label fw-semibold" htmlFor="tgEnabled">{t("tg_enable")}</label>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">{t("tg_token")}</label>
                <input name="botToken" className="form-control" dir="ltr" placeholder="123456789:AA..." defaultValue={tg.botToken || ""} />
                {data.envToken && <div className="form-text">{t("tg_env_set")}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">{t("tg_chat")}</label>
                <input name="chatId" className="form-control" dir="ltr" placeholder="-1001234567890" defaultValue={tg.chatId || ""} />
                {data.envChat && <div className="form-text">{t("tg_env_set")}</div>}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary d-inline-flex align-items-center gap-1"><i data-lucide="save"></i>{t("btn_save")}</button>
                <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-1" formAction="/admin/settings/telegram/test" formMethod="post"><i data-lucide="send"></i>{t("tg_test_btn")}</button>
              </div>
            </form>
          </div>
        </div>
        <div className="alert alert-secondary small mt-3 d-flex align-items-start gap-2">
          <i data-lucide="info"></i><span>{t("tg_events_note")}</span>
        </div>
      </div>
    </section>
  );
}
