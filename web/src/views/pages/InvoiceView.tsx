// views/admin/invoice.ejs — printable receipt (players and admins), no main layout.
import type { LayoutData } from "@/server/page-props";
import { helpers } from "../helpers";
import type { ViewProps } from "../registry";

type Rec = { id: number; amount: number; createdAt: number; status: string; userName?: string };
type Detail = { source?: string; incoming?: boolean; note?: string; receipt?: string; method?: string; account?: string; payoutName?: string };
type Data = { type: "deposit" | "withdraw" | "transfer"; rec: Rec; u: { name: string; email: string } | null; detail: Detail; backUrl?: string; backLabel?: string; generatedAt: number };

const INVOICE_CSS = "\n    * { box-sizing: border-box; }\n    :root {\n      --brand: #0e9f6e; --ink: #14261c; --muted: #5f6b62; --line: #e5eae2;\n      --in: #0b7d57; --out: #d3373c;\n    }\n    body { font-family: \"Plus Jakarta Sans\", \"Segoe UI\", system-ui, Tahoma, sans-serif; color: var(--ink); margin: 0; padding: 34px; background: #f4f6f3; }\n    .sheet { max-width: 620px; margin: 0 auto; background: #fff; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; box-shadow: 0 18px 42px -20px rgba(20,38,28,.22); }\n    .top { padding: 26px 30px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--line); }\n    .brand { font-size: 1.3rem; font-weight: 800; color: var(--brand); letter-spacing: -.02em; }\n    .muted { color: var(--muted); font-size: .82rem; }\n    .badge { display: inline-block; font-size: .74rem; font-weight: 700; padding: 4px 11px; border-radius: 999px; }\n    .b-in  { background: #e3f5ec; color: var(--in); }\n    .b-out { background: #fdecec; color: var(--out); }\n    .b-pending  { background: #fcefd6; color: #97600a; }\n    .b-rejected { background: #fdecec; color: var(--out); }\n    .b-ok       { background: #e3f5ec; color: var(--in); }\n    .amount { padding: 26px 30px; text-align: center; border-bottom: 1px solid var(--line); }\n    .amount .big { font-family: \"JetBrains Mono\", ui-monospace, monospace; font-size: 2.5rem; font-weight: 700; letter-spacing: -.03em; }\n    .amount .big.in { color: var(--in); } .amount .big.out { color: var(--out); }\n    .amount .lbl { color: var(--muted); font-size: .85rem; margin-top: 2px; }\n    .rows { padding: 12px 30px 6px; }\n    .row { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: .92rem; }\n    .row:last-child { border-bottom: 0; }\n    .row .k { color: var(--muted); }\n    .row .v { font-weight: 600; text-align: end; overflow-wrap: anywhere; word-break: break-word; min-width: 0; }\n    .mono { font-family: \"JetBrains Mono\", ui-monospace, monospace; }\n    .receipt { padding: 6px 30px 24px; }\n    .receipt img { max-width: 100%; border: 1px solid var(--line); border-radius: 12px; }\n    .foot { padding: 18px 30px 26px; font-size: .74rem; color: var(--muted); text-align: center; border-top: 1px solid var(--line); }\n    .bar { max-width: 620px; margin: 0 auto 16px; display: flex; gap: 10px; }\n    .btn { padding: 9px 18px; border: 0; border-radius: 10px; font-weight: 700; font-family: inherit; cursor: pointer; font-size: .9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }\n    .btn-p { background: var(--brand); color: #fff; }\n    .btn-o { background: #fff; color: var(--muted); border: 1px solid var(--line); }\n    @media print { body { background: #fff; padding: 0; } .sheet { border: 0; box-shadow: none; } .bar { display: none; } }\n  ";
const idPrefixOf = (type: string) => (type === "deposit" ? "D" : type === "withdraw" ? "W" : "T");

export function InvoiceHead({ L, data }: { L: LayoutData; data: Record<string, unknown> }) {
  const { t } = helpers(L);
  const d = data as unknown as Data;
  return (
    <>
      <title>{`${t("inv_title")} #${idPrefixOf(d.type) + d.rec.id}`}</title>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- same fonts as the Express invoice */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: INVOICE_CSS }} />
    </>
  );
}

export function InvoiceBody({ L, h, data }: ViewProps<Data>) {
  const { t, money } = h;
  const s = L.settings;
  const { type, rec, u, detail } = data;
  const isTransfer = type === "transfer";
  const inflow = type === "deposit" || (isTransfer && !!detail.incoming);
  const sc = rec.status === "approved" || rec.status === "paid" ? "b-ok" : rec.status === "rejected" ? "b-rejected" : "b-pending";
  const done = rec.status === "approved" || rec.status === "paid";
  return (
    <>
      <div className="bar">
        <button className="btn btn-p" data-raw-onclick="window.print()">🖨 {t("stmt_print")}</button>
        {data.backUrl && <a className="btn btn-o" href={data.backUrl}>← {data.backLabel}</a>}
      </div>
      <div className="sheet">
        <div className="top">
          <div>
            {s.brandMode === "logo" && s.logoUrl
              ? <img src={s.logoUrl} alt={s.siteName} style={{ height: 36, maxWidth: 200, objectFit: "contain" }} />
              : <div className="brand">{s.siteName}</div>}
            <div className="muted">{isTransfer ? t("rcv_receipt") : inflow ? t("inv_deposit") : t("inv_withdraw")}</div>
          </div>
          <div style={{ textAlign: "end" }}>
            <div className="mono" style={{ fontWeight: 700 }}>{idPrefixOf(type)}{rec.id}</div>
            <div className="muted">{new Date(rec.createdAt).toLocaleString()}</div>
            <div style={{ marginTop: 6 }}><span className={`badge ${sc}`}>{h.statusLabel(rec.status) || rec.status}</span></div>
          </div>
        </div>
        <div className="amount">
          {done && (
            <>
              <div style={{ width: 72, height: 72, margin: "0 auto 12px", borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px -8px rgba(14,159,110,.55)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "1.35rem", color: "var(--brand)", letterSpacing: "-.01em" }}>
                {isTransfer ? (inflow ? t("rcv_received_ok") : t("rcv_sent_ok")) : (inflow ? t("inv_deposited_ok") : t("inv_withdrawn_ok"))}
              </div>
            </>
          )}
          <div className="big" style={{ color: "var(--brand)" }}>{money(rec.amount)}</div>
        </div>
        <div className="rows">
          <div className="row"><span className="k">{t("lbl_name")}</span><span className="v">{u ? u.name : rec.userName}</span></div>
          {u && <div className="row"><span className="k">{t("lbl_email")}</span><span className="v">{u.email}</span></div>}
          <div className="row"><span className="k">{isTransfer ? (inflow ? t("inv_from") : t("rcv_to")) : (inflow ? t("inv_into") : t("inv_from"))}</span><span className="v">{detail.source}</span></div>
          {inflow && detail.note && <div className="row"><span className="k">{t("manual_bankref")}</span><span className="v">{detail.note}</span></div>}
          {!inflow && detail.method && (
            <>
              <div className="row"><span className="k">{t("payout_method")}</span><span className="v text-capitalize">{detail.method}</span></div>
              {detail.payoutName && <div className="row"><span className="k">{t("payout_name")}</span><span className="v">{detail.payoutName}</span></div>}
              {detail.account && <div className="row"><span className="k">{t("inv_account")}</span><span className="v mono" dir="ltr">{detail.account}</span></div>}
            </>
          )}
          <div className="row"><span className="k">{t("th_amount")}</span><span className="v mono">{money(rec.amount)}</span></div>
        </div>
        {inflow && detail.receipt && (
          <div className="receipt">
            <div className="muted" style={{ marginBottom: 6 }}>{t("manual_receipt")}</div>
            <img src={detail.receipt} alt="receipt" />
          </div>
        )}
        <div style={{ padding: "14px 30px", borderTop: "1px solid var(--line)", fontSize: ".82rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          {t("inv_support")}{" "}
          <a href="/contact" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "none" }}>{t("footer_contact")}</a>
        </div>
        <div className="foot">{t("footer_strong")} {t("footer_rest")}</div>
      </div>
    </>
  );
}
