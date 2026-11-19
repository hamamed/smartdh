// views/achievements.ejs, activity.ejs, rewards.ejs, leaderboard.ejs
import type { Tx, User } from "@/lib/types";
import type { ViewProps } from "../registry";

export function AchievementsView({ h, data }: ViewProps<{ achievements: string[] }>) {
  const { t, ACH } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="trophy" className="text-primary"></i>{t("ach_title")}
            <span className="text-muted fs-6">({data.achievements.length}/{Object.keys(ACH).length})</span>
          </h3>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="row g-2">
              {Object.keys(ACH).map((id) => {
                const got = data.achievements.includes(id);
                return (
                  <div className="col-6 col-md-3" key={id}>
                    <div className={`text-center p-3 rounded-3 h-100 ${got ? "bg-warning-subtle" : "bg-body-secondary opacity-50"}`} title={h.achDesc(id)}>
                      <div className={`fs-3 ${got ? "text-warning" : "text-muted"}`}><i data-lucide={ACH[id].icon}></i></div>
                      <div className="small fw-semibold mt-1">{h.achName(id)}</div>
                      <div className="small text-muted" style={{ fontSize: ".72rem" }}>{got ? h.achDesc(id) : t("locked")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActivityView({ h, data }: ViewProps<{ txns: Tx[] }>) {
  const { t, TX } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="history" className="text-primary"></i>{t("activity_title")}</h3>
        </div>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            {data.txns.length === 0 ? (
              <p className="text-muted small mb-0">{t("no_activity")}</p>
            ) : (
              <div className="list-group list-group-flush">
                {data.txns.map((tx, i) => {
                  const m = TX[tx.type] || TX.admin_adjust;
                  const note = h.txNote(tx);
                  return (
                    <div className="list-group-item px-0 d-flex align-items-center gap-2 bg-transparent" key={i}>
                      <div className={`rounded-circle d-flex align-items-center justify-content-center bg-${m.cls}-subtle text-${m.cls}`}
                        style={{ width: 40, height: 40, flex: "0 0 40px", fontSize: "1.05rem" }}><i data-lucide={m.icon}></i></div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small text-truncate">{h.txLabel(tx.type)}</div>
                        {!!tx.amount && <div className={`fw-bold small text-${m.sign === "-" ? "danger" : "success"}`}>{m.sign}{h.money(tx.amount)}</div>}
                        <div className="text-muted text-truncate" style={{ fontSize: ".78rem" }}>{note && <><bdi>{note}</bdi> · </>}<span data-ago={tx.at} title={new Date(tx.at).toLocaleString()}>{h.timeAgo(tx.at)}</span></div>
                      </div>
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

export function RewardsView({ L, h, data }: ViewProps<{ user: User; bonusUnlocked: boolean; canClaim: boolean }>) {
  const { t, money } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="gift" className="text-primary"></i>{t("db_title")}</h3>
        </div>
        <div id="flash"></div>
        <div className="card border-0 shadow-sm rounded-4 text-center">
          <div className="card-body p-4">
            <div className="tile-icon ti-yellow mx-auto mb-3" style={{ width: 76, height: 76, fontSize: "2rem" }}><i data-lucide={data.bonusUnlocked ? "flame" : "lock"}></i></div>
            <h5 className="fw-bold mb-1">{t("streak_line", { n: data.user.streak.count })}</h5>
            <p className="text-muted small mb-4">{t("bonus_grows", { max: money(L.settings.dailyBonusBase * 7) })}</p>
            {!data.bonusUnlocked ? (
              <>
                <div className="alert alert-warning py-2 small d-flex align-items-center justify-content-center gap-1 mb-3">
                  <i data-lucide="lock"></i><span>{t("bonus_need_deposit")}</span>
                </div>
                <a href="/invest" className="btn btn-primary btn-lg px-4 d-inline-flex align-items-center gap-2"><i data-lucide="plus"></i>{t("bonus_go_deposit")}</a>
              </>
            ) : (
              <form action="/daily-bonus" method="post"><input type="hidden" name="_csrf" value={L.csrfToken} />
                <button className="btn btn-warning btn-lg px-4 d-inline-flex align-items-center gap-2" disabled={!data.canClaim}>
                  <i data-lucide="gift"></i>{data.canClaim ? t("btn_claim") : t("btn_claimed")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const MEDALS = ["#e8b923", "#a8b3c4", "#c98442"];

export function LeaderboardView({ h, data }: ViewProps<{ rows: { id: number; name: string; total: number; isSelf: boolean }[] }>) {
  const { t } = h;
  return (
    <section className="py-4 py-lg-5">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <a href="/dashboard" className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
          <h3 className="fw-bold mb-0 d-flex align-items-center gap-2"><i data-lucide="trophy" className="text-warning"></i>{t("lb_title")}</h3>
        </div>
        <p className="text-muted mb-4">{t("lb_sub")}</p>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="list-group list-group-flush">
              {data.rows.map((r, i) => {
                const medal = MEDALS[i];
                return (
                  <div className={`list-group-item d-flex align-items-center gap-3 py-3 ${r.isSelf ? "bg-primary-subtle" : "bg-transparent"}`} key={r.id}>
                    <div className="fw-bold text-muted text-center d-flex align-items-center justify-content-center" style={{ width: 38, fontSize: "1.15rem" }}>
                      {medal ? <i data-lucide="medal" style={{ color: medal }}></i> : <span className="fs-6">#{i + 1}</span>}
                    </div>
                    <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold"
                      style={{ width: 42, height: 42, flex: "0 0 42px" }}>{r.name.charAt(0)}</div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{r.name}{r.isSelf && <> <span className="badge bg-primary ms-1">{t("lb_you")}</span></>}</div>
                      <div className="fw-bold small text-success">{h.money(r.total)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
