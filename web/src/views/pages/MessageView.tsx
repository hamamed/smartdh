// views/message.ejs
import type { ViewProps } from "../registry";

type Data = {
  heading: string; mBody: string; mIcon?: string; mTint?: string; mPending?: boolean;
  mAction?: { url: string; text: string; icon?: string } | null;
};

const STEPS: [string, string, string][] = [["user-check", "msg_pend_s1", "mint"], ["shield-check", "msg_pend_s2", "yellow"], ["log-in", "msg_pend_s3", "sky"]];

export default function MessageView({ h, data }: ViewProps<Data>) {
  const icon = data.mIcon || "circle-check";
  const tint = data.mTint || "ti-mint";
  const pending = !!data.mPending;
  return (
    <section className="py-5">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden text-center">
          <div className="msg-hero">
            <span className={`tile-icon ${tint}`}><i data-lucide={icon}></i></span>
          </div>
          <div className="card-body p-4 p-md-5 pt-4">
            <h3 className="fw-bold mb-2">{data.heading}</h3>
            <p className="text-muted mb-0">{data.mBody}</p>
            {pending && (
              <div className="msg-steps mt-4">
                {STEPS.map((s, i) => (
                  <span key={s[1]} style={{ display: "contents" }}>
                    <div className="msg-step">
                      <span className={`tile-icon ti-${s[2]}`}><i data-lucide={s[0]}></i></span>
                      <span className="small fw-semibold mt-2">{h.t(s[1])}</span>
                      {i === 0 && <span className="badge bg-success-subtle text-success mt-1"><i data-lucide="check"></i></span>}
                      {i === 1 && <span className="badge bg-warning-subtle text-warning mt-1">{h.t("st_pending")}</span>}
                    </div>
                    {i < 2 && <span className="msg-arrow"><i data-lucide="chevron-right"></i></span>}
                  </span>
                ))}
              </div>
            )}
            <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
              {pending && <a href="/login" className="btn btn-primary d-inline-flex align-items-center gap-2"><i data-lucide="log-in"></i>{h.t("btn_login")}</a>}
              {data.mAction && (
                <a href={data.mAction.url} className="btn btn-primary d-inline-flex align-items-center gap-2"><i data-lucide={data.mAction.icon || "arrow-right"}></i>{data.mAction.text}</a>
              )}
              <a href="/" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"><i data-lucide="house"></i>{h.t("btn_back_home")}</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
