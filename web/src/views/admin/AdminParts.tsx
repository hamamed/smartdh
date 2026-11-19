// views/admin/_head.ejs, _perpage.ejs, _filters.ejs, _pager.ejs
import type { Helpers } from "../helpers";

export function AdminHead({ heading, back = "/admin" }: { heading: string; back?: string }) {
  return (
    <div className="d-flex align-items-center gap-2 mb-4">
      <a href={back} className="btn btn-outline-secondary btn-icon rounded-circle"><i data-lucide="arrow-left"></i></a>
      <h3 className="fw-bold mb-0">{heading}</h3>
    </div>
  );
}

export function PerPage({ h, base, per, options, qs }: { h: Helpers; base: string; per: number; options: number[]; qs: string }) {
  return (
    <div className="d-flex align-items-center gap-1 small text-muted">
      <span>{h.t("per_page")}</span>
      <div className="btn-group btn-group-sm" role="group">
        {options.map((o) => (
          <a key={o} href={`${base}?per=${o}${qs}`} className={`btn ${o === per ? "btn-primary" : "btn-outline-secondary"}`}>{o}</a>
        ))}
      </div>
    </div>
  );
}

export type FilterOption = { value: string; label: string; count?: number; danger?: boolean };

export function Filters({ base, current, q, options, keep = "" }: { base: string; current: string; q: string; options: FilterOption[]; keep?: string }) {
  return (
    <div className="d-flex gap-1 flex-wrap">
      {options.map((o) => {
        const href = base + (o.value ? "?status=" + o.value : "?") + (q ? "&q=" + encodeURIComponent(q) : "") + keep;
        const active = current === o.value;
        return (
          <a key={o.value} href={href} className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"} d-inline-flex align-items-center gap-1`}>
            {o.label}
            {!!o.count && <span className={`badge ${active ? "bg-light text-dark" : o.danger ? "bg-danger" : "bg-secondary"}`}>{o.count}</span>}
          </a>
        );
      })}
    </div>
  );
}

// Short pagination: 1 … 4 5 [6] 7 8 … 20
export function Pager({ base, qs, page, pages }: { base: string; qs: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const win = 2;
  const show: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= win) show.push(p);
    else if (show[show.length - 1] !== "…") show.push("…");
  }
  return (
    <nav>
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
          <a className="page-link" href={`${base}?page=${page - 1}${qs}`}><i data-lucide="chevron-left"></i></a>
        </li>
        {show.map((p, i) => p === "…" ? (
          <li className="page-item disabled" key={"gap" + i}><span className="page-link">…</span></li>
        ) : (
          <li className={`page-item ${p === page ? "active" : ""}`} key={p}>
            <a className="page-link" href={`${base}?page=${p}${qs}`}>{p}</a>
          </li>
        ))}
        <li className={`page-item ${page === pages ? "disabled" : ""}`}>
          <a className="page-link" href={`${base}?page=${page + 1}${qs}`}><i data-lucide="chevron-right"></i></a>
        </li>
      </ul>
    </nav>
  );
}

/** Relative time with an absolute tooltip, as every admin list shows it. */
export function Ago({ h, at }: { h: Helpers; at: number }) {
  return <span data-ago={at} title={new Date(at).toLocaleString()}>{h.timeAgo(at)}</span>;
}
