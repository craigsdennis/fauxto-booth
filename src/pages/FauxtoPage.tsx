import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import type { FauxtoAgent, FauxtoState } from "../../worker/agents/fauxto";
import type { Navigate } from "../navigation";

function createAbsoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return normalized;
  }
  return `${window.location.origin}${normalized}`;
}

type FauxtoPageProps = {
  fauxtoId: string;
  navigate: Navigate;
};

export function FauxtoPage({ fauxtoId, navigate }: FauxtoPageProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [parentBoothName, setParentBoothName] = useState<string | null>(null);

  useAgent<FauxtoAgent, FauxtoState>({
    agent: "fauxto-agent",
    name: fauxtoId,
    onStateUpdate(state) {
      setFilePath(state.filePath || null);
      setMembers(state.members || []);
      setParentBoothName(state.parentBoothName || null);
    },
  });

  const boothPath = parentBoothName ? `/booths/${encodeURIComponent(parentBoothName)}` : "/";
  const imageUrl = filePath ? `/api/images/${filePath}` : null;
  const shareUrl = createAbsoluteUrl(`/fauxtos/${encodeURIComponent(fauxtoId)}`);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = parentBoothName
      ? `Fauxto Booth · ${parentBoothName}`
      : "Fauxto Booth";
  }, [parentBoothName]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden px-6 py-10">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-[140px]" />
        </div>

        <div className="relative mx-auto flex max-w-4xl flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Fauxto</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Capture #{fauxtoId.slice(0, 8)}</h1>
              {parentBoothName && (
                <button
                  type="button"
                  onClick={() => navigate(boothPath)}
                  className="mt-2 text-sm text-cyan-300 hover:text-cyan-200"
                >
                  ← Back to {parentBoothName}
                </button>
              )}
            </div>
            <div className="text-right text-sm text-slate-400">
              <p>Share link</p>
              {typeof navigator !== "undefined" && navigator.clipboard ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                    } catch (error) {
                      console.warn("Could not copy", error);
                    }
                  }}
                  className="mt-1 inline-flex rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white"
                >
                  Copy URL
                </button>
              ) : (
                <p className="mt-1 text-xs text-slate-500">{shareUrl}</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/40">
            {imageUrl ? (
              <img src={imageUrl} alt="Generated Fauxto" className="w-full object-cover" />
            ) : (
              <div className="flex h-80 items-center justify-center text-slate-500">
                Waiting for this Fauxto to render…
              </div>
            )}
          </div>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-base font-semibold text-white">Guests included</h2>
            {members.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {members.map((member) => (
                  <li key={member} className="rounded-2xl border border-white/10 px-4 py-2">
                    {member}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">We'll show the roster once this Fauxto completes.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
