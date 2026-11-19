// Text helpers used by pages and emails — same output as the Express app.
import { ACHIEVEMENTS } from "./constants";
import type { Translator } from "./locales";
import type { Settings, Tx, Withdrawal } from "./types";

// Facebook-style relative time: "just now", "3 min", "1 h", "2 d", "1 mo", "1 y".
export function timeAgo(ts: number | null | undefined, lang: string): string {
  if (!ts) return "";
  const U: Record<string, Record<string, string>> = {
    en: { now: "just now", m: "min", h: "h", d: "d", w: "w", mo: "mo", y: "y" },
    fr: { now: "à l’instant", m: "min", h: "h", d: "j", w: "sem", mo: "mois", y: "an" },
    ar: { now: "الآن", m: "دقيقة", h: "ساعة", d: "يوم", w: "أسبوع", mo: "شهر", y: "سنة" },
  };
  const L = U[lang] || U.en;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return L.now;
  const m = Math.floor(s / 60); if (m < 60) return m + " " + L.m;
  const h = Math.floor(m / 60); if (h < 24) return h + " " + L.h;
  const d = Math.floor(h / 24); if (d < 7) return d + " " + L.d;
  if (d < 30) return Math.floor(d / 7) + " " + L.w;
  const mo = Math.floor(d / 30); if (mo < 12) return mo + " " + L.mo;
  return Math.floor(d / 365) + " " + L.y;
}

// A rejected withdrawal's reason as human text, in the translator's language.
export function rejectReasonText(tr: Translator, w: Withdrawal | null | undefined): string {
  if (!w) return "";
  const note = (w.rejectNote || "").trim();
  const base = w.rejectReason && w.rejectReason !== "other" ? tr("wdr_" + w.rejectReason) : "";
  return [base, note].filter(Boolean).join(" — ");
}

// Transaction notes are stored in English; translate the known patterns at render time.
export function translateNote(tr: Translator, tx: Tx | null | undefined): string {
  const n = ((tx && tx.note) || "").trim();
  if (!n || !tx) return "";
  if (tx.type === "achievement") {
    const id = Object.keys(ACHIEVEMENTS).find((k) => ACHIEVEMENTS[k].name === n);
    if (id) return tr("ach_" + id);
  }
  const fixed: Record<string, string> = { "Team earnings": "tx_note_team", "Added by admin": "tx_note_added", "Earnings removed by admin": "tx_note_removed" };
  if (fixed[n]) return tr(fixed[n]);
  const who = (w: string) => (w.trim() === "Earnings" ? tr("opt_earnings") : w.trim());
  let m: RegExpMatchArray | null;
  if ((m = n.match(/^From\s+(.+)$/))) return tr("tx_from", { who: who(m[1]) });
  if ((m = n.match(/^To\s+(.+)$/))) return tr("tx_to", { who: who(m[1]) });
  if ((m = n.match(/^Refunded to\s+(.+?)(\s*·\s*(.+))?$/))) return tr("tx_refunded_to", { who: who(m[1]) }) + (m[3] ? " · " + m[3] : "");
  if (n === "Earnings") return tr("opt_earnings");
  return n;
}

export function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Arabic shows درهم for the default DH/MAD; other languages show the setting as-is.
export function currencyLabel(settings: Pick<Settings, "currency">, lang: string): string {
  return lang === "ar" && ["DH", "MAD"].includes(settings.currency) ? "درهم" : settings.currency;
}

export function formatMoney(n: number | null | undefined, curLabel: string): string {
  return `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${curLabel}`;
}

export function dayStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
