import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgent } from "agents/react";
import type { UserAgent, UserState } from "../../worker/agents/user";
import type { Navigate } from "../navigation";
import { FooterBadge } from "../partials/FooterBadge";
import { ensureUserIdCookie } from "../utils/user-id";

type UserPageProps = {
  navigate: Navigate;
};

function formatTimestamp(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export function UserPage({ navigate }: UserPageProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [fauxtos, setFauxtos] = useState<UserState["fauxtos"]>([]);

  useEffect(() => {
    setUserId(ensureUserIdCookie());
  }, []);

  useAgent<UserAgent, UserState>({
    agent: "user-agent",
    name: userId ?? "",
    onStateUpdate(state) {
      setFauxtos(state.fauxtos ?? []);
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Fauxto Booth · Your Fauxtos";
  }, []);

  const hasFauxtos = fauxtos.length > 0;
  const maskedUserId = useMemo(() => {
    if (!userId) return null;
    return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
  }, [userId]);

  const openBooth = useCallback(
    (boothName: string) => {
      navigate(`/booths/${encodeURIComponent(boothName)}`);
    },
    [navigate],
  );

  const openFauxto = useCallback(
    (fauxtoId: string) => {
      navigate(`/fauxtos/${encodeURIComponent(fauxtoId)}`);
    },
    [navigate],
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="relative isolate flex-1 overflow-hidden pb-32">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-[140px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-10 lg:px-8 lg:py-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to lobby
          </button>

          <div className="mt-10 space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-black/40">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">
                Your Fauxtos
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Keep tabs on every unreal photo you appear in.</h1>
              <p className="mt-4 text-sm text-slate-300">
                Stay on this page while you upload from your phone; we stream new composites back in real time.
              </p>
              {maskedUserId && (
                <p className="mt-4 text-xs text-slate-500">Connected as {maskedUserId}</p>
              )}
            </div>

            {hasFauxtos ? (
              <div className="grid gap-6 md:grid-cols-2">
                {fauxtos.map((fauxto) => (
                  <div
                    key={fauxto.fauxtoId}
                    className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-xl shadow-black/30"
                  >
                    <button
                      type="button"
                      onClick={() => openFauxto(fauxto.fauxtoId)}
                      className="group block w-full"
                    >
                      <img
                        src={`/api/images/${fauxto.filePath}`}
                        alt={`Fauxto from ${fauxto.boothDisplayName}`}
                        className="h-64 w-full object-cover transition duration-500 group-hover:opacity-90"
                      />
                    </button>
                    <div className="flex flex-col gap-2 px-5 py-4 text-sm text-slate-300">
                      <button
                        type="button"
                        onClick={() => openBooth(fauxto.boothName)}
                        className="text-base font-semibold text-white transition hover:text-cyan-200"
                      >
                        {fauxto.boothDisplayName}
                      </button>
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(fauxto.createdAt) ?? "Live"}
                      </p>
                      <button
                        type="button"
                        onClick={() => openFauxto(fauxto.fauxtoId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
                      >
                        Open Fauxto →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                <p>No Fauxtos yet.</p>
                <p className="mt-2">
                  Join a booth from your phone to see your composites listed here instantly.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-4 rounded-2xl border border-white/20 px-5 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  Find a booth
                </button>
              </div>
            )}
          </div>
        </div>

        <FooterBadge className="mx-auto mt-12 w-full max-w-5xl" />
      </div>
    </div>
  );
}
