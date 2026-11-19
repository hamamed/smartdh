// views/terms.ejs and views/privacy.ejs
import { PRIVACY_HTML, TERMS_HTML } from "../legal-texts";
import type { ViewProps } from "../registry";

export default function LegalView({ L, h, data }: ViewProps<{ kind: "terms" | "privacy" }>) {
  const texts = data.kind === "terms" ? TERMS_HTML : PRIVACY_HTML;
  const html = texts[L.lang] || texts.en;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 760 }}>
        <h2 className="fw-bold mb-4">{h.t(data.kind === "terms" ? "footer_terms" : "footer_privacy")}</h2>
        <div className="text-muted lh-lg" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </section>
  );
}
