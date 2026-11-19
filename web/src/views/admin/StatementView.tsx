// views/admin/statement.ejs — printable per-player statement, no main layout.
import type { User } from "@/lib/types";
import type { LayoutData } from "@/server/page-props";
import { helpers } from "../helpers";
import type { ViewProps } from "../registry";

type Row = { t: number; kind: string; label: string; amount: number; status: string; note?: string };
type Data = { u: User; rows: Row[]; invested: number; total: number; generatedAt: number };

const STATEMENT_CSS = "\n    * { box-sizing: border-box; }\n    body { font-family: \"Plus Jakarta Sans\", \"Segoe UI\", system-ui, Tahoma, sans-serif; color: #14261c; margin: 0; padding: 32px; background: #f4f6f3; }\n    .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e5eae2; border-radius: 18px; padding: 30px; box-shadow: 0 18px 42px -20px rgba(20,38,28,.22); }\n    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e9f6e; padding-bottom: 14px; margin-bottom: 20px; }\n    .brand { font-size: 1.4rem; font-weight: 800; color: #0e9f6e; letter-spacing: -.02em; }\n    .muted { color: #5f6b62; font-size: .85rem; }\n    .who { margin: 18px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: .9rem; }\n    .who div span { color: #5f6b62; }\n    table { width: 100%; border-collapse: collapse; font-size: .85rem; margin-top: 8px; }\n    th, td { text-align: start; padding: 8px 6px; border-bottom: 1px solid #e5eae2; }\n    th { color: #5f6b62; font-weight: 700; text-transform: uppercase; font-size: .72rem; letter-spacing: .04em; }\n    .amt { text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; font-family: \"JetBrains Mono\", ui-monospace, monospace; }\n    .in { color: #0b7d57; } .out { color: #d3373c; }\n    .tag { font-size: .7rem; padding: 2px 8px; border-radius: 999px; background: #eef1ec; color: #5f6b62; }\n    .totals { margin-top: 22px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }\n    .totals .box { border: 1px solid #e5eae2; border-radius: 12px; padding: 12px; text-align: center; }\n    .totals .box .v { font-size: 1.15rem; font-weight: 800; font-family: \"JetBrains Mono\", ui-monospace, monospace; }\n    .foot { margin-top: 26px; font-size: .75rem; color: #8a938b; text-align: center; }\n    .noprint { margin-bottom: 18px; }\n    @media print { .noprint { display: none; } body { padding: 0; background: #fff; } .sheet { border: 0; box-shadow: none; padding: 0; } }\n  ";

export function StatementHead({ L, data }: { L: LayoutData; data: Record<string, unknown> }) {
  const { t } = helpers(L);
  const d = data as unknown as Data;
  return (
    <>
      <title>{`${t("statement")} · ${d.u.name}`}</title>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- same fonts as the Express statement */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STATEMENT_CSS }} />
    </>
  );
}

export function StatementBody({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const s = L.settings;
  const u = data.u;
  return (
    <div className="sheet">
      <div className="noprint">
        <button data-raw-onclick="window.print()" style={{ padding: "9px 18px", border: 0, borderRadius: 10, background: "#0e9f6e", color: "#fff", fontWeight: 700, cursor: "pointer" }}>🖨 {t("stmt_print")}</button>
        <a href={`/admin/users/${u.id}`} style={{ marginInlineStart: 8, color: "#777" }}>← {t("nav_back")}</a>
      </div>
      <div className="head">
        <div>
          {s.brandMode === "logo" && s.logoUrl
            ? <img src={s.logoUrl} alt={s.siteName} style={{ height: 40, maxWidth: 220, objectFit: "contain" }} />
            : <div className="brand">{s.siteName}</div>}
          <div className="muted">{t("stmt_title")}</div>
        </div>
        <div className="muted" style={{ textAlign: "end" }}>
          {t("stmt_generated")}<br />{new Date(data.generatedAt).toLocaleString()}
        </div>
      </div>
      <div className="who">
        <div><span>{t("lbl_name")}:</span> <strong>{u.name}</strong></div>
        <div><span>{t("lbl_email")}:</span> {u.email}</div>
        <div><span>{t("your_code")}:</span> {u.referralCode}</div>
        <div><span>{t("th_status")}:</span> {h.statusLabel(u.status)}</div>
      </div>
      <table>
        <thead><tr><th>{t("th_when")}</th><th>{t("audit_action")}</th><th>{t("th_details")}</th><th className="amt">{t("th_amount")}</th><th>{t("th_status")}</th></tr></thead>
        <tbody>
          {!data.rows.length && <tr><td colSpan={5} className="muted">{t("no_activity")}</td></tr>}
          {data.rows.map((r, i) => {
            const inflow = r.kind === "deposit";
            return (
              <tr key={i}>
                <td>{new Date(r.t).toLocaleDateString()}</td>
                <td>{inflow ? t("tx_deposit") : t("tab_withdrawals")}</td>
                <td>{r.label}{r.note && <> <span className="tag">{r.note}</span></>}</td>
                <td className={`amt ${inflow ? "in" : "out"}`}>{inflow ? "+" : "−"}{money(r.amount)}</td>
                <td><span className="tag">{h.statusLabel(r.status) || r.status}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="totals">
        <div className="box"><span className="muted">{t("c_invested")}</span><div className="v">{money(data.invested)}</div></div>
        <div className="box"><span className="muted">{t("c_earnings")}</span><div className="v">{money(u.earnings)}</div></div>
        <div className="box"><span className="muted">{t("c_total")}</span><div className="v">{money(data.total)}</div></div>
      </div>
      <div className="foot">{t("footer_strong")} {t("footer_rest")}</div>
    </div>
  );
}
