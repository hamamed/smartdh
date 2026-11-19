// views/error.ejs
import type { ViewProps } from "../registry";

type Data = { code: number; heading: string; mBody: string; detail?: string | null };

export default function ErrorView({ L, h, data }: ViewProps<Data>) {
  const { code, heading, mBody, detail } = data;
  const icon = code === 404 ? "map-pin-off" : code === 403 ? "shield-alert" : "triangle-alert";
  return (
    <section className="py-5">
      <div className="container text-center" style={{ maxWidth: 560 }}>
        <div className="tile-icon ti-coral mx-auto mb-3" style={{ width: 76, height: 76, fontSize: "2rem" }}>
          <i data-lucide={icon}></i>
        </div>
        <div className="display-5 fw-bold text-primary mb-1">{code}</div>
        <h4 className="fw-bold mb-2">{heading}</h4>
        <p className="text-muted mb-4">{mBody}</p>
        {detail && (
          <pre className="text-start small bg-body-secondary rounded-3 p-3 mb-4" style={{ whiteSpace: "pre-wrap" }}>{detail}</pre>
        )}
        <a href={L.user ? "/dashboard" : "/"} className="btn btn-primary d-inline-flex align-items-center gap-1">
          <i data-lucide="house"></i>{h.t("btn_back_home")}
        </a>
      </div>
    </section>
  );
}
