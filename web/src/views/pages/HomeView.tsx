// views/home.ejs — the player dashboard
import type { CampaignStatus } from "@/lib/game";
import type { HistoryPoint, Tx, User } from "@/lib/types";
import { InlineScript } from "../Layout";
import { CampaignCard } from "../parts/PlayerParts";
import type { ViewProps } from "../registry";

type Check = { key: string; done: boolean; icon: string; tint: string; href: string };
type Data = {
  user: User; perSecond: number; totalInvested: number; totalBalance: number; bonusUnlocked: boolean; canClaim: boolean;
  showTour: boolean; history: HistoryPoint[]; recentActivity: Tx[]; activityCount: number;
  checklist: Check[]; checklistDone: number; checklistHidden: boolean; campaign: CampaignStatus;
  level: number; xp: number; xpCur: number; xpNext: number;
};

// EJS's escape for <%= %>: values dropped into the tour script exactly as EJS wrote them.
const ejsEscape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");

// Welcome tour (verbatim from home.ejs, with its three interpolations filled in).
const TOUR_SCRIPT = "\nfunction initTour() {\n  var el = document.getElementById('tourModal');\n  if (!el || !window.bootstrap) return;\n  var steps = el.querySelectorAll('.tour-step');\n  var dotsWrap = document.getElementById('tourDots');\n  var back = document.getElementById('tourBack');\n  var next = document.getElementById('tourNext');\n  var skip = document.getElementById('tourSkip');\n  var NEXT = \"__NEXT__\", DONE = \"__DONE__\";\n  var i = 0, done = false;\n  for (var k = 0; k < steps.length; k++) { var d = document.createElement('span'); d.className = 'tour-dot'; dotsWrap.appendChild(d); }\n  var dots = dotsWrap.children;\n  var modal = new bootstrap.Modal(el);\n  function show(k) {\n    i = k;\n    for (var j = 0; j < steps.length; j++) steps[j].classList.toggle('d-none', j !== k);\n    for (var j2 = 0; j2 < dots.length; j2++) dots[j2].classList.toggle('active', j2 === k);\n    back.classList.toggle('d-none', k === 0);\n    next.textContent = (k === steps.length - 1) ? DONE : NEXT;\n  }\n  function finish() {\n    if (!done) {\n      done = true;\n      fetch('/onboarded', { method: 'POST', headers: { 'X-CSRF-Token': \"__CSRF__\" } }).catch(function () {});\n    }\n    modal.hide();\n  }\n  next.addEventListener('click', function () { if (i < steps.length - 1) show(i + 1); else finish(); });\n  back.addEventListener('click', function () { if (i > 0) show(i - 1); });\n  skip.addEventListener('click', finish);\n  var openBtn = document.getElementById('tourOpen');\n  if (openBtn) openBtn.addEventListener('click', function () { done = true; show(0); modal.show(); });\n  show(0);\n__SHOW__}\nif (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTour);\nelse initTour();\n";
function tourScript(next: string, done: string, csrf: string, show: boolean): string {
  return TOUR_SCRIPT.replace("__NEXT__", ejsEscape(next)).replace("__DONE__", ejsEscape(done)).replace("__CSRF__", ejsEscape(csrf))
    .replace("__SHOW__", show ? "   modal.show(); \n" : "");
}

const TOUR_STEPS = [
  { icon: "sparkles", color: "ti-coral", t: "tour_1_t", d: "tour_1_d" },
  { icon: "layers", color: "ti-mint", t: "tour_2_t", d: "tour_2_d" },
  { icon: "layout-grid", color: "ti-sky", t: "tour_3_t", d: "tour_3_d" },
  { icon: "star", color: "ti-yellow", t: "tour_4_t", d: "tour_4_d" },
  { icon: "rocket", color: "ti-lilac", t: "tour_5_t", d: "tour_5_d" },
];

export default function HomeView({ L, h, data }: ViewProps<Data>) {
  const { t, money, TX } = h;
  const s = L.settings;
  const u = data.user;
  const { level, xp, xpCur, xpNext } = data;
  const points = data.history.map((p) => ({ t: p.t, total: p.total, invested: p.invested == null ? null : p.invested, earnings: p.earnings == null ? null : p.earnings, referral: p.referral == null ? null : p.referral }));
  return (
    <>
      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="d-flex justify-content-between align-items-start mb-4 gap-2">
            <div>
              <h3 className="fw-bold mb-0">{t("hi_name", { name: u.name })}</h3>
              <p className="text-muted mb-0">{t("dash_sub")}</p>
            </div>
            <button id="tourOpen" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 flex-shrink-0">
              <i data-lucide="circle-help"></i><span className="d-none d-sm-inline">{t("tour_help")}</span>
            </button>
          </div>
          <div id="flash"></div>

          {(u.notices || []).filter((n) => !n.read).reverse().map((n) => (
            <div className="alert alert-info d-flex align-items-start gap-2 shadow-sm rounded-4 mb-3" key={n.id}>
              <i data-lucide="megaphone" className="flex-shrink-0 mt-1"></i>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold mb-1">{t("notice_from", { site: s.siteName })}</div>
                <div className="small" style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                <a href="/invest" className="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("notice_cta")}</a>
              </div>
              <form action={`/notices/${n.id}/read`} method="post" className="flex-shrink-0"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <button className="btn btn-sm btn-icon btn-outline-secondary" style={{ width: 30, height: 30 }} title={t("notice_dismiss")} aria-label={t("notice_dismiss")}><i data-lucide="x"></i></button>
              </form>
            </div>
          ))}

          {!data.checklistHidden && data.checklistDone < data.checklist.length && (
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                  <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="rocket" className="text-primary"></i>{t("gs_title")}</h6>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary-subtle text-primary">{t("gs_progress", { done: data.checklistDone, total: data.checklist.length })}</span>
                    <form action="/dismiss-getting-started" method="post" data-raw-onsubmit={`return confirm('${t("gs_hide_c")}')`}>
                      <input type="hidden" name="_csrf" value={L.csrfToken} />
                      <button className="btn btn-sm btn-icon btn-outline-secondary" style={{ width: 30, height: 30 }} title={t("gs_hide")} aria-label={t("gs_hide")}><i data-lucide="x"></i></button>
                    </form>
                  </div>
                </div>
                <p className="text-muted small mb-3">{t("gs_sub")}</p>
                <div className="progress mb-3" style={{ height: 8 }}><div className="progress-bar" style={{ width: `${Math.round(data.checklistDone / data.checklist.length * 100)}%` }}></div></div>
                <div className="gs-grid">
                  {data.checklist.map((c) => c.done ? (
                    <div className="gs-box done" key={c.key}>
                      <span className="gs-check"><i data-lucide="check"></i></span>
                      <span className="tile-icon ti-mint"><i data-lucide={c.icon}></i></span>
                      <span className="gs-label">{t("gs_" + c.key + "_s")}</span>
                      <span className="gs-desc text-success">{t("gs_done")}</span>
                    </div>
                  ) : (
                    <a href={c.href} className="gs-box text-reset" key={c.key}>
                      <span className={`tile-icon ${c.tint}`}><i data-lucide={c.icon}></i></span>
                      <span className="gs-label">{t("gs_" + c.key + "_s")}</span>
                      <span className="gs-desc">{t("gs_" + c.key + "_d")}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {s.dailyBonusEnabled && (
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body d-flex flex-wrap align-items-center gap-3">
                <div className="tile-icon ti-yellow" style={{ width: 52, height: 52, flex: "0 0 52px", fontSize: "1.4rem" }}><i data-lucide={data.bonusUnlocked ? "flame" : "lock"}></i></div>
                <div className="flex-grow-1">
                  <h6 className="fw-bold mb-1">{t("db_title")}</h6>
                  {data.bonusUnlocked
                    ? <p className="text-muted small mb-0">{t("streak_line", { n: u.streak.count })} · {t("bonus_grows", { max: money(s.dailyBonusBase * 7) })}</p>
                    : <p className="text-muted small mb-0">{t("bonus_need_deposit")}</p>}
                </div>
                {data.bonusUnlocked ? (
                  <form action="/daily-bonus" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                    <input type="hidden" name="redirect" value="home" />
                    <button className="btn btn-warning d-inline-flex align-items-center gap-1" disabled={!data.canClaim}>
                      <i data-lucide="gift"></i>{data.canClaim ? t("btn_claim") : t("btn_claimed")}
                    </button>
                  </form>
                ) : (
                  <a href="/invest" className="btn btn-outline-primary d-inline-flex align-items-center gap-1"><i data-lucide="plus"></i>{t("bonus_go_deposit")}</a>
                )}
              </div>
            </div>
          )}

          <CampaignCard L={L} h={h} campaign={data.campaign} redirectTo="home" />

          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-coral rounded-4 h-100">
                <div className="card-body">
                  <div className="small d-flex align-items-center gap-1"><i data-lucide="piggy-bank"></i>{t("c_invested")}</div>
                  <div className="h4 fw-bold mb-0 mt-1">{money(data.totalInvested)}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-mint rounded-4 h-100">
                <div className="card-body">
                  <div className="small d-flex align-items-center gap-1"><i data-lucide="coins"></i>{t("c_earnings")}</div>
                  <div className="h4 fw-bold mb-0 mt-1 live-counter" data-value={u.earnings} data-persec={data.perSecond} data-currency={L.curLabel}>{money(u.earnings)}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-lilac rounded-4 h-100">
                <div className="card-body">
                  <div className="small d-flex align-items-center gap-1"><i data-lucide="user-plus"></i>{t("c_referral")}</div>
                  <div className="h4 fw-bold mb-0 mt-1">{money(u.referralEarnings || 0)}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card wallet wallet-yellow rounded-4 h-100">
                <div className="card-body">
                  <div className="small d-flex align-items-center gap-1"><i data-lucide="wallet"></i>{t("c_total")}</div>
                  <div className="h4 fw-bold mb-0 mt-1 live-counter" data-value={data.totalBalance} data-persec={data.perSecond} data-currency={L.curLabel}>{money(data.totalBalance)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 48, height: 48, flex: "0 0 48px", fontSize: "1.1rem" }}>{level}</div>
                <div className="flex-grow-1">
                  <div className="fw-bold d-flex align-items-center gap-1"><i data-lucide="star" style={{ color: "#ffb020" }}></i>{t("level_label")} {level}</div>
                  <div className="small text-muted">{t("xp_progress", { have: xp - xpCur, need: xpNext - xpCur })}</div>
                </div>
              </div>
              <div className="progress" role="progressbar">
                <div className="progress-bar" style={{ width: `${Math.min(100, Math.round((xp - xpCur) / (xpNext - xpCur) * 100))}%` }}></div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="bar-chart-3" className="text-primary"></i>{t("chart_title")}</h6>
                {data.history.length >= 2 && (
                  <div className="btn-group btn-group-sm trend-ranges" role="group">
                    <button type="button" className="btn btn-outline-primary" data-range="hourly">{t("trend_hourly")}</button>
                    <button type="button" className="btn btn-outline-primary active" data-range="daily">{t("trend_daily")}</button>
                    <button type="button" className="btn btn-outline-primary" data-range="weekly">{t("trend_weekly")}</button>
                    <button type="button" className="btn btn-outline-primary" data-range="monthly">{t("trend_monthly")}</button>
                  </div>
                )}
              </div>
              {data.history.length < 2 ? (
                <p className="text-muted small mb-0">{t("chart_empty")}</p>
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-2 mb-3" id="balFilters">
                    <button type="button" className="trend-chip active" data-series="total"><span className="chip-dot" style={{ background: "#f4a62a" }}></span>{t("c_total")}</button>
                    <button type="button" className="trend-chip active" data-series="invested"><span className="chip-dot" style={{ background: "#e5533e" }}></span>{t("c_invested")}</button>
                    <button type="button" className="trend-chip active" data-series="earnings"><span className="chip-dot" style={{ background: "#0e9f6e" }}></span>{t("c_earnings")}</button>
                    <button type="button" className="trend-chip active" data-series="referral"><span className="chip-dot" style={{ background: "#7c6be0" }}></span>{t("c_referral")}</button>
                  </div>
                  <div className="chart-box">
                    <canvas id="balanceChart" data-points={JSON.stringify(points)} data-currency={L.curLabel}
                      data-ltotal={t("c_total")} data-linvested={t("c_invested")} data-learnings={t("c_earnings")} data-lreferral={t("c_referral")}></canvas>
                  </div>
                </>
              )}

              <div className="d-flex align-items-center justify-content-between mt-4 mb-2">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="list" className="text-primary"></i>{t("activity_title")}</h6>
                {!!data.activityCount && <span className="small text-muted">{data.activityCount}</span>}
              </div>
              {!data.recentActivity.length ? (
                <p className="text-muted small mb-0">{t("no_activity")}</p>
              ) : (
                <>
                  <div className="list-group list-group-flush">
                    {data.recentActivity.map((tx, i) => {
                      const m = TX[tx.type] || TX.admin_adjust;
                      const note = h.txNote(tx);
                      return (
                        <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={i}>
                          <div className={`rounded-circle d-flex align-items-center justify-content-center bg-${m.cls}-subtle text-${m.cls} flex-shrink-0`}
                            style={{ width: 38, height: 38, fontSize: "1rem" }}><i data-lucide={m.icon}></i></div>
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold small text-truncate">{h.txLabel(tx.type)}</div>
                            {!!tx.amount && <div className={`fw-bold small text-${m.sign === "-" ? "danger" : "success"}`}>{m.sign}{money(tx.amount)}</div>}
                            <div className="text-muted text-truncate" style={{ fontSize: ".72rem" }}>{note && <><bdi>{note}</bdi> · </>}<span data-ago={tx.at} title={new Date(tx.at).toLocaleString()}>{h.timeAgo(tx.at)}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-center mt-3">
                    <a href="/activity" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"><i data-lucide="list"></i>{t("act_show_all")}</a>
                  </div>
                </>
              )}
            </div>
          </div>

          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><i data-lucide="layout-grid" className="text-primary"></i>{t("menu_title")}</h6>
          <div className="menu-grid">
            <a className="menu-tile" href="/invest"><span className="tile-icon ti-coral"><i data-lucide="layers"></i></span><span className="tile-label">{t("plans_title")}</span></a>
            <a className="menu-tile" href="/withdraw"><span className="tile-icon ti-mint"><i data-lucide="arrow-down-to-line"></i></span><span className="tile-label">{t("withdraw_title")}</span></a>
            <a className="menu-tile" href="/send"><span className="tile-icon ti-sky"><i data-lucide="send"></i></span><span className="tile-label">{t("send_title")}</span></a>
            {s.dailyBonusEnabled && <a className="menu-tile" href="/rewards"><span className="tile-icon ti-yellow"><i data-lucide="gift"></i></span><span className="tile-label">{t("db_title")}</span></a>}
            <a className="menu-tile" href="/achievements"><span className="tile-icon ti-lilac"><i data-lucide="trophy"></i></span><span className="tile-label">{t("ach_title")}</span></a>
            <a className="menu-tile" href="/activity"><span className="tile-icon ti-navy"><i data-lucide="history"></i></span><span className="tile-label">{t("activity_title")}</span></a>
            {s.leaderboardEnabled && <a className="menu-tile" href="/leaderboard"><span className="tile-icon ti-coral"><i data-lucide="medal"></i></span><span className="tile-label">{t("lb_title")}</span></a>}
            <a className="menu-tile" href="/referral"><span className="tile-icon ti-mint"><i data-lucide="user-plus"></i></span><span className="tile-label">{t("invite_title")}</span></a>
            <a className="menu-tile" href="/guide"><span className="tile-icon ti-navy"><i data-lucide="book-open"></i></span><span className="tile-label">{t("nav_guide")}</span></a>
            <a className="menu-tile" href="/profile"><span className="tile-icon ti-sky"><i data-lucide="user"></i></span><span className="tile-label">{t("profile_title")}</span></a>
            <a className="menu-tile" href="/support"><span className="tile-icon ti-coral"><i data-lucide="life-buoy"></i></span><span className="tile-label">{t("sup_title")}</span></a>
          </div>
        </div>
      </section>

      <div className="modal fade" id="tourModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4">
            <div className="modal-body p-4 text-center">
              {TOUR_STEPS.map((st, i) => (
                <div className={`tour-step ${i === 0 ? "" : "d-none"}`} key={st.t}>
                  <div className={`tile-icon ${st.color} mx-auto mb-3`} style={{ width: 76, height: 76, fontSize: "2rem" }}><i data-lucide={st.icon}></i></div>
                  <h5 className="fw-bold mb-2">{t(st.t)}</h5>
                  <p className="text-muted mb-0">{t(st.d, { site: s.siteName })}</p>
                </div>
              ))}
              <div className="d-flex justify-content-center gap-1 my-4" id="tourDots"></div>
              <div className="d-flex justify-content-between gap-2">
                <button className="btn btn-outline-secondary btn-sm" id="tourSkip">{t("tour_skip")}</button>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm d-none" id="tourBack">{t("tour_back")}</button>
                  <button className="btn btn-primary btn-sm px-3" id="tourNext">{t("tour_next")}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <InlineScript code={tourScript(t("tour_next"), t("tour_done"), L.csrfToken, data.showTour)} />
    </>
  );
}
