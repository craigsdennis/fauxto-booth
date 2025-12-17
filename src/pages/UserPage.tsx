import { useCallback, useEffect, useState } from "react";
import { useAgent } from "agents/react";
import type { UserAgent, UserState } from "../../worker/agents/user";
import type { Navigate } from "../navigation";
import { FooterBadge } from "../partials/FooterBadge";
import { ensureUserIdCookie } from "../utils/user-id";

type UserPageProps = {
  navigate: Navigate;
};

const EDUCATION_SENTENCES = [
  "Your fauxto (that's dad joke for: a fake photo) is being processed.",
  "This application is using ByteDance's SeeDream 4.5 on Replicate.",
  "It is using the image editing capabilities to add you and others to the photo that was created for the background.",
  "This is built using the Cloudflare Agents SDK. Each Booth is an agent.",
  "When a new upload is received the booth checks to see if the right number of people are there.",
  "If it is it snaps a new fauxto. If not, you gotta go find more folks to join your fauxto.",
  "Those creations can take some time, but don't worry...",
  "This is backed using Cloudflare Workflows, our durable execution tool.",
  "It will get generated, eventually.",
  "If it hits an error it will automatically retry.",
  "If you're interested in learning more, the code is in the footer.",
  "There is a tutorial in the repo how it all works.",
];

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
  const [userId, setUserId] = useState<string | null>(() => ensureUserIdCookie());
  const [fauxtos, setFauxtos] = useState<UserState["fauxtos"]>([]);
  const [booths, setBooths] = useState<UserState["booths"]>([]);
  const [educationLines, setEducationLines] = useState<string[]>([]);
  const [activeEducationLine, setActiveEducationLine] = useState("");

  useEffect(() => {
    if (!userId) {
      setUserId(ensureUserIdCookie());
    }
  }, [userId]);

  useAgent<UserAgent, UserState>({
    agent: "user-agent",
    name: userId ?? "",
    enabled: Boolean(userId),
    onStateUpdate(state) {
      setFauxtos(state.fauxtos ?? []);
       setBooths(state.booths ?? []);
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Fauxto Booth · Your Fauxtos";
  }, []);

  const hasFauxtos = fauxtos.length > 0;
  const showEducation = !hasFauxtos;
  const hasBooths = booths.length > 0;
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

  useEffect(() => {
    if (!showEducation) {
      setEducationLines([]);
      setActiveEducationLine("");
      return;
    }
    let isMounted = true;
    let sentenceIndex = 0;
    let charIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const typeNext = () => {
      if (!isMounted) return;
      const sentence = EDUCATION_SENTENCES[sentenceIndex];
      if (!sentence) {
        setActiveEducationLine("");
        return;
      }
      if (charIndex <= sentence.length) {
        setActiveEducationLine(sentence.slice(0, charIndex));
        charIndex += 1;
        timeoutId = setTimeout(typeNext, 45);
      } else {
        setEducationLines((prev) => {
          if (prev.includes(sentence)) {
            return prev;
          }
          return [...prev, sentence];
        });
        sentenceIndex += 1;
        charIndex = 0;
        timeoutId = setTimeout(typeNext, 600);
      }
    };

    typeNext();
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showEducation]);

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
            </div>

            {hasBooths && (
              <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
                  Uploaded to
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {booths.map((booth) => (
                    <button
                      type="button"
                      key={booth.boothName}
                      onClick={() => openBooth(booth.boothName)}
                      className="rounded-2xl border border-white/15 px-3 py-1 text-white transition hover:border-white/40"
                    >
                      {booth.boothDisplayName}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              <>
                <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 text-left text-sm text-slate-200 shadow-2xl shadow-black/30">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-200/80">
                    Live update
                  </p>
                  <div className="mt-3 space-y-2 font-mono text-[13px]" aria-live="polite">
                    {educationLines.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-slate-200">
                        {line}
                      </p>
                    ))}
                    {activeEducationLine && (
                      <p className="text-cyan-200">
                        {activeEducationLine}
                        <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-sm bg-cyan-200 align-middle" />
                      </p>
                    )}
                  </div>
                </div>
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
              </>
            )}
          </div>
        </div>

        <FooterBadge className="mx-auto mt-12 w-full max-w-5xl" />
      </div>
    </div>
  );
}
