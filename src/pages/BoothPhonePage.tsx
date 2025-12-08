import { useState } from "react";
import type { CSSProperties } from "react";
import { useAgent } from "agents/react";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";

const phoneSteps = [
  {
    title: "Upload a selfie",
    body: "Use a recent photo with plenty of light. We'll crop everything except your face and shoulders.",
  },
  {
    title: "Align your face",
    body: "Pinch and drag until your face lines up with the guide. Consistent framing makes better composites.",
  },
  {
    title: "Submit & chill",
    body: "Tap send and we'll blend you into the backdrop automatically. You'll get a ping when it's ready.",
  },
];

type BoothPhonePageProps = {
  slug: string;
  navigate: Navigate;
};

export function BoothPhonePage({ slug, navigate }: BoothPhonePageProps) {
  const [boothState, setBoothState] = useState<BoothState | null>(null);

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setBoothState(state);
    },
  });

  const displayName = boothState?.displayName || slug;
  const description = boothState?.description || "Snap or upload a selfie. We'll make it look like you're on set.";
  const backgroundStyle: CSSProperties = boothState?.backgroundImageUrl
    ? {
        backgroundImage: `url(${boothState.backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage:
          "linear-gradient(135deg, rgba(14,165,233,0.35), rgba(147,51,234,0.25)), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent 60%), #020617",
        backgroundSize: "cover",
      };
  const hostPath = `/booths/${encodeURIComponent(slug)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Phone booth</p>
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          <p className="text-sm text-slate-400">{description}</p>
        </header>

        <div className="mt-8 space-y-8">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60">
            <div className="relative aspect-[4/5]" style={backgroundStyle}>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
              <div className="absolute bottom-0 w-full p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Backdrop preview</p>
                <p className="mt-2 text-lg font-semibold text-white">We'll match your lighting to this scene.</p>
              </div>
            </div>
          </div>

          <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-base font-semibold">Ready when you are</h2>
            <p className="mt-2 text-sm text-slate-400">
              Follow the steps below. The upload flow is on the way—this page already reflects your booth style.
            </p>
            <ol className="mt-6 space-y-4 text-sm text-slate-300">
              {phoneSteps.map((step) => (
                <li key={step.title} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate(hostPath)}
            className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/40 px-4 py-3 text-sm font-semibold text-cyan-300"
          >
            Return to host view
          </button>
          <p className="text-center text-xs text-slate-500">
            Share this page or let guests scan the QR from the host dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
