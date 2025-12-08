import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useAgent } from "agents/react";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";

function createAbsoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return normalized;
  }
  return `${window.location.origin}${normalized}`;
}

type BoothPageProps = {
  slug: string;
  navigate: Navigate;
};

export function BoothPage({ slug, navigate }: BoothPageProps) {
  const [boothState, setBoothState] = useState<BoothState | null>(null);

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setBoothState(state);
    },
  });

  const backgroundReady = Boolean(boothState?.backgroundImageUrl);
  const displayName = boothState?.displayName || slug;
  const description = boothState?.description;
  const boothPath = `/booths/${encodeURIComponent(slug)}`;
  const phonePath = `${boothPath}/phone`;
  const phoneUrl = createAbsoluteUrl(phonePath);

  const qrSrc = useMemo(() => {
    const encoded = encodeURIComponent(phoneUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
  }, [phoneUrl]);

  const backgroundStyle: CSSProperties = backgroundReady
    ? {
        backgroundImage: `url(${boothState?.backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage:
          "radial-gradient(circle at 15% 20%, rgba(34,211,238,0.35), transparent 55%), radial-gradient(circle at 80% 0%, rgba(233,131,255,0.25), transparent 60%), linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))",
        backgroundSize: "cover",
      };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-[140px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to lobby
          </button>

          <header className="mt-6 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-200">
              Host view
            </div>
            <div>
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">{displayName}</h1>
              <p className="mt-2 text-sm text-slate-400">/booths/{slug}</p>
            </div>
            {description ? (
              <p className="text-base text-slate-300">{description}</p>
            ) : (
              <p className="text-base text-slate-400">
                Describe your vibe when editing the booth to help the AI lock in lighting and styling cues.
              </p>
            )}
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/50">
              <div className="relative aspect-[5/3] w-full" style={backgroundStyle}>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-slate-950/70" />
                <div className="absolute inset-0 flex flex-col justify-end p-8">
                  <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-300">
                    {backgroundReady ? "Backdrop locked in" : "Generating AI backdrop"}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    {backgroundReady ? "Guests will match this look" : "We're crafting your set"}
                  </h2>
                  <p className="mt-3 text-sm text-slate-300">
                    {backgroundReady
                      ? "Every upload will inherit this lighting, palette, and styling so composites feel like a single photoshoot."
                      : "We're fine-tuning lighting, lenses, and palette based on your description. The preview appears here once ready."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <h2 className="text-base font-semibold text-white">Guest link</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Share the phone-friendly capture page below or have guests scan the QR. Submissions stream back here.
                </p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs text-slate-400">Link</p>
                  <a
                    href={phoneUrl}
                    className="mt-1 block font-mono text-sm text-cyan-300"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(phonePath);
                    }}
                  >
                    {phoneUrl}
                  </a>
                </div>
              </section>

              <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Scan to join</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Place this QR at the venue. It opens the camera-ready booth page on any phone or tablet.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                  <img src={qrSrc} alt="QR code linking guests to the mobile booth" className="h-40 w-40 rounded-xl bg-white p-2" />
                  <a
                    href={phoneUrl}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(phonePath);
                    }}
                    className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    Open phone view →
                  </a>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
