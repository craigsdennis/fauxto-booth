import type { ReactNode } from "react";

type ShareAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
};

type SharePanelProps = {
  title: string;
  description?: string;
  actions: ShareAction[];
  qr?: {
    src: string | null;
    alt: string;
    fallbackLabel: string;
    error?: string | null;
    hint?: ReactNode;
  };
};

export function SharePanel({ title, description, actions, qr }: SharePanelProps) {
  return (
    <div className="rounded-3xl border border-white/15 bg-slate-950/80 p-4 text-left shadow-2xl shadow-black/50">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
        {title}
      </p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      <div className="mt-4 flex items-start gap-3">
        {qr && (
          <div className="rounded-2xl border border-white/10 bg-white/90 p-2 shadow-inner">
            {qr.src ? (
              <img
                src={qr.src}
                alt={qr.alt}
                className="h-36 w-36 rounded-lg bg-white"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-white/70 text-xs font-medium text-slate-500">
                {qr.error ? "QR unavailable" : qr.fallbackLabel}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 space-y-2">
          {qr?.hint}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const className =
                "rounded-2xl border border-white/20 px-3 py-2 text-[11px] font-semibold text-white transition hover:border-white/40";
              if (action.href) {
                return (
                  <a
                    key={action.label}
                    href={action.href}
                    target={action.target}
                    rel={action.rel}
                    className={className}
                  >
                    {action.label}
                  </a>
                );
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={className}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
          {qr?.error && (
            <p className="text-xs text-rose-200">
              We couldn't draw that QR. Copy the link instead.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
