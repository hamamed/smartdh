// views/admin/hub.ejs — the admin home
import type { AdminCounts } from "@/lib/admin-lists";
import { InlineScript } from "../Layout";
import type { ViewProps } from "../registry";

// Admin presence polling (verbatim from hub.ejs).
const ONLINE_SCRIPT = "\n// Admin presence: poll who's online and refresh the \"Online now\" card.\n(function () {\n  const card = document.getElementById('onlineCard');\n  if (!card) return;\n  const countEl = document.getElementById('onlineCount');\n  const listEl = document.getElementById('onlineList');\n  const noneTxt = card.dataset.i18nNone || 'No one online';\n  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\n  function initials(n) { return (n || '?').trim().charAt(0).toUpperCase(); }\n  async function tick() {\n    try {\n      const r = await fetch('/admin/online.json', { headers: { 'Accept': 'application/json' } });\n      if (!r.ok) return;\n      const d = await r.json();\n      countEl.textContent = d.count;\n      if (!d.count) { listEl.innerHTML = '<span class=\"text-muted small\">' + esc(noneTxt) + '</span>'; }\n      else {\n        listEl.innerHTML = d.users.slice(0, 40).map(u =>\n          '<a href=\"/admin/users/' + u.id + '\" class=\"d-inline-flex align-items-center gap-1 badge bg-body-secondary text-reset text-decoration-none py-2 px-2\">' +\n          '<span class=\"online-dot\"></span>' +\n          (u.avatar ? '<img src=\"' + esc(u.avatar) + '\" style=\"width:18px;height:18px;border-radius:50%;object-fit:cover\">'\n                    : '<span class=\"online-ini\">' + esc(initials(u.name)) + '</span>') +\n          '<span class=\"small fw-semibold\">' + esc(u.name) + '</span></a>'\n        ).join('');\n      }\n    } catch (e) { /* keep the last view on a transient error */ }\n  }\n  tick();\n  setInterval(tick, 45000);\n})();\n";

type Data = { counts: AdminCounts; stats: { players: number; invested: number; earnings: number; total: number; deposits: number; paid: number }; onlineCount: number };

export default function HubView({ L, h, data }: ViewProps<Data>) {
  const { t, money, can } = h;
  const { counts, stats } = data;
  const todo = counts.pendingUsers + counts.pendingDeposits + counts.pendingWithdrawals + (counts.openTickets || 0) + (counts.pendingKyc || 0);
  const badge = (n: number, cls = "bg-danger") => (n ? <span className={`badge ${cls} position-absolute top-0 end-0 m-2`}>{n}</span> : null);
  const i18n = {
    deposit: t("trend_deposits"), withdraw: t("trend_withdrawals"), joined: t("act_joined"),
    empty: t("act_empty"), more: t("act_more"), invoice: t("inv_title"), invited_by: t("invited_by"),
    approved: t("st_approved"), pending: t("st_pending"), rejected: t("st_rejected"), paid: t("st_paid"), active: t("st_active"),
  };
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="d-flex align-items-center gap-2 mb-4">
            <a href={`${L.appUrl}/dashboard`} className="btn btn-outline-secondary btn-icon rounded-circle" title={t("nav_dashboard")}><i data-lucide="arrow-left"></i></a>
            <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="shield" className="text-primary"></i>{t("admin_title")}</h3>
          </div>

          <div className={`card border-0 shadow-sm rounded-4 mb-4 ${todo ? "border-start border-4 border-warning" : ""}`}>
            <div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="bell" className={todo ? "text-warning" : "text-primary"}></i>{t("needs_attention")}
                {!!todo && <span className="badge bg-warning text-dark ms-1">{todo}</span>}</h6>
              {todo === 0 ? (
                <p className="text-muted small mb-0 d-flex align-items-center gap-1"><i data-lucide="check" className="text-success"></i>{t("all_clear")}</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {!!counts.pendingUsers && (
                    <a href="/admin/users?status=pending" className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1">
                      <i data-lucide="user-plus"></i>{t("tab_pending")} <span className="badge bg-dark ms-1">{counts.pendingUsers}</span></a>
                  )}
                  {!!counts.pendingDeposits && (
                    <a href="/admin/deposits" className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1">
                      <i data-lucide="receipt"></i>{t("tab_deposits")} <span className="badge bg-dark ms-1">{counts.pendingDeposits}</span></a>
                  )}
                  {!!counts.pendingWithdrawals && (
                    <a href="/admin/withdrawals" className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1">
                      <i data-lucide="banknote"></i>{t("tab_withdrawals")} <span className="badge bg-dark ms-1">{counts.pendingWithdrawals}</span></a>
                  )}
                  {!!counts.pendingKyc && (
                    <a href="/admin/users" className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1">
                      <i data-lucide="shield-check"></i>{t("kyc_title")} <span className="badge bg-dark ms-1">{counts.pendingKyc}</span></a>
                  )}
                  {!!counts.openTickets && can("tickets") && (
                    <a href="/admin/tickets?status=open" className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1">
                      <i data-lucide="life-buoy"></i>{t("tab_tickets")} <span className="badge bg-dark ms-1">{counts.openTickets}</span></a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4" id="onlineCard" data-i18n-none={t("online_none")} data-i18n-ago={t("online_ago")}>
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <span className="online-dot"></span>{t("online_title")}
                  <span className="badge bg-success-subtle text-success ms-1" id="onlineCount">{data.onlineCount}</span>
                </h6>
                <span className="small text-muted" id="onlineUpdated"></span>
              </div>
              <div id="onlineList" className="d-flex flex-wrap gap-2">
                {!data.onlineCount && <span className="text-muted small">{t("online_none")}</span>}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-coral rounded-4 h-100"><div className="card-body">
                <div className="small d-flex align-items-center gap-1"><i data-lucide="users"></i>{t("stat_players")}</div>
                <div className="h4 fw-bold mb-0 mt-1">{stats.players}</div>
              </div></div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-mint rounded-4 h-100"><div className="card-body">
                <div className="small d-flex align-items-center gap-1"><i data-lucide="piggy-bank"></i>{t("stat_invested")}</div>
                <div className="h5 fw-bold mb-0 mt-1">{money(stats.invested)}</div>
              </div></div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-yellow rounded-4 h-100"><div className="card-body">
                <div className="small d-flex align-items-center gap-1"><i data-lucide="coins"></i>{t("stat_earnings")}</div>
                <div className="h5 fw-bold mb-0 mt-1">{money(stats.earnings)}</div>
              </div></div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
                <div className="small text-muted d-flex align-items-center gap-1"><i data-lucide="wallet"></i>{t("stat_total")}</div>
                <div className="h5 fw-bold mb-0 mt-1">{money(stats.total)}</div>
              </div></div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="bar-chart-3" className="text-primary"></i>{t("trend_title")}</h6>
                <div className="btn-group btn-group-sm trend-ranges" role="group">
                  <button type="button" className="btn btn-outline-primary" data-range="hourly">{t("trend_hourly")}</button>
                  <button type="button" className="btn btn-outline-primary active" data-range="daily">{t("trend_daily")}</button>
                  <button type="button" className="btn btn-outline-primary" data-range="weekly">{t("trend_weekly")}</button>
                  <button type="button" className="btn btn-outline-primary" data-range="monthly">{t("trend_monthly")}</button>
                </div>
              </div>
              <p className="text-muted small mb-3">{t("trend_desc")}</p>
              <div className="d-flex flex-wrap gap-2 mb-3" id="trendFilters">
                <button type="button" className="trend-chip active" data-series="deposit"><span className="chip-dot" style={{ background: "#0e9f6e" }}></span>{t("trend_deposits")}</button>
                <button type="button" className="trend-chip active" data-series="withdraw"><span className="chip-dot" style={{ background: "#e5484d" }}></span>{t("trend_withdrawals")}</button>
                <button type="button" className="trend-chip active" data-series="signup"><span className="chip-dot" style={{ background: "#f4a62a" }}></span>{t("trend_players")}</button>
                <button type="button" className="trend-chip active" data-series="referral"><span className="chip-dot" style={{ background: "#7c6be0" }}></span>{t("trend_referrals")}</button>
              </div>
              <div className="chart-box">
                <canvas id="trendChart" data-currency={L.curLabel} data-ldep={t("trend_deposits")} data-lwd={t("trend_withdrawals")} data-lplayers={t("trend_players")} data-lref={t("trend_referrals")}></canvas>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-4 mb-2">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="list" className="text-primary"></i>{t("act_title")}</h6>
                <span className="small text-muted" id="actCount"></span>
              </div>
              <div id="trendActivity" data-currency={L.curLabel} data-i18n={JSON.stringify(i18n)}></div>
            </div>
          </div>

          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="layout-grid" className="text-primary"></i>{t("menu_title")}</h6>
          <div className="menu-grid">
            {can("users") && (
              <a className="menu-tile position-relative" href="/admin/users">
                <span className="tile-icon ti-coral"><i data-lucide="users"></i></span>
                <span className="tile-label">{t("tab_users")}</span>
                {badge(counts.pendingUsers)}
              </a>
            )}
            {can("deposits") && (
              <a className="menu-tile position-relative" href="/admin/deposits">
                <span className="tile-icon ti-mint"><i data-lucide="receipt"></i></span>
                <span className="tile-label">{t("tab_deposits")}</span>
                {badge(counts.pendingDeposits)}
              </a>
            )}
            {can("withdrawals") && (
              <a className="menu-tile position-relative" href="/admin/withdrawals">
                <span className="tile-icon ti-yellow"><i data-lucide="banknote"></i></span>
                <span className="tile-label">{t("tab_withdrawals")}</span>
                {badge(counts.pendingWithdrawals)}
              </a>
            )}
            {can("email") && <a className="menu-tile" href="/admin/email"><span className="tile-icon ti-coral"><i data-lucide="mail"></i></span><span className="tile-label">{t("tab_email")}</span></a>}
            {can("apps") && <a className="menu-tile" href="/admin/apps"><span className="tile-icon ti-sky"><i data-lucide="layers"></i></span><span className="tile-label">{t("tab_apps")}</span></a>}
            {can("settings") && <a className="menu-tile" href="/admin/settings"><span className="tile-icon ti-lilac"><i data-lucide="settings"></i></span><span className="tile-label">{t("tab_settings")}</span></a>}
            {can("admins") && <a className="menu-tile" href="/admin/admins"><span className="tile-icon ti-navy"><i data-lucide="shield-check"></i></span><span className="tile-label">{t("tab_admins")}</span></a>}
            {can("data") && <a className="menu-tile" href="/admin/data"><span className="tile-icon ti-mint"><i data-lucide="database"></i></span><span className="tile-label">{t("tab_data")}</span></a>}
            {can("tickets") && (
              <a className="menu-tile position-relative" href="/admin/tickets">
                <span className="tile-icon ti-coral"><i data-lucide="life-buoy"></i></span>
                <span className="tile-label">{t("tab_tickets")}</span>
                {badge(counts.openTickets)}
              </a>
            )}
            <a className="menu-tile" href="/admin/invoices"><span className="tile-icon ti-mint"><i data-lucide="file-text"></i></span><span className="tile-label">{t("tab_invoices")}</span></a>
            {can("audit") && <a className="menu-tile" href="/admin/audit"><span className="tile-icon ti-navy"><i data-lucide="history"></i></span><span className="tile-label">{t("tab_audit")}</span></a>}
            {can("test") && (
              <a className="menu-tile position-relative" href="/admin/test">
                <span className="tile-icon ti-yellow"><i data-lucide="flask-conical"></i></span>
                <span className="tile-label">{t("tab_test")}</span>
                {badge(counts.testUsers, "bg-warning text-dark")}
              </a>
            )}
            <a className="menu-tile" href="/admin/account"><span className="tile-icon ti-sky"><i data-lucide="user-cog"></i></span><span className="tile-label">{t("tab_account")}</span></a>
          </div>
        </div>
      </section>
      <InlineScript code={ONLINE_SCRIPT} />
    </>
  );
}
