import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgent } from "agents/react";
import type { FauxtoAgent, FauxtoState } from "../../worker/agents/fauxto";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";
import { FooterBadge } from "../partials/FooterBadge";
import { getUserIdFromCookie } from "../utils/user-id";

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
  const [parentBoothName, setParentBoothName] = useState<string | null>(null);
  const [boothDisplayName, setBoothDisplayName] = useState<string | null>(null);
  const [boothFauxtoCount, setBoothFauxtoCount] = useState(0);
  const [hasUserUpload, setHasUserUpload] = useState<boolean | null>(null);
  const [checkingUpload, setCheckingUpload] = useState(false);
  const [userId] = useState(() => getUserIdFromCookie());

  useAgent<FauxtoAgent, FauxtoState>({
    agent: "fauxto-agent",
    name: fauxtoId,
    onStateUpdate(state) {
      setFilePath(state.filePath || null);
      setParentBoothName(state.parentBoothName || null);
    },
  });

  const boothAgent = useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: parentBoothName ?? "",
    enabled: Boolean(parentBoothName),
    onStateUpdate(state) {
      setBoothDisplayName(state.displayName || parentBoothName);
      setBoothFauxtoCount(state.fauxtoCount ?? 0);
    },
  });

  const boothPath = parentBoothName ? `/booths/${encodeURIComponent(parentBoothName)}` : "/";
  const boothPhonePath = `${boothPath}/phone`;
  const imagePath = filePath ? `/api/images/${filePath}` : null;
  const imageUrl = imagePath ? createAbsoluteUrl(imagePath) : null;
  const sharePath = `/share/fauxtos/${encodeURIComponent(fauxtoId)}`;
  const shareUrl = createAbsoluteUrl(sharePath);
  const shareMessage = `Come take a fake photo with me at ${shareUrl}`;
  const smsLink = useMemo(() => {
    if (typeof encodeURIComponent === "undefined") return `sms:?body=${shareMessage}`;
    return `sms:?body=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage]);
  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.warn("Copy failed, falling back to prompt", error);
      window.prompt?.("Copy this link", shareUrl);
    }
  }, [shareUrl]);
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  const handleWebShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: boothDisplayName ?? parentBoothName ?? "Fauxto Booth",
          text: shareMessage,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.warn("Share failed", error);
        }
      }
    }
    await copyShareLink();
  }, [boothDisplayName, parentBoothName, copyShareLink, shareMessage, shareUrl]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = parentBoothName
      ? `Fauxto Booth · ${parentBoothName}`
      : "Fauxto Booth";
  }, [parentBoothName]);

  useEffect(() => {
    if (typeof document === "undefined" || !imageUrl) return;
    const selectors = [
      { selector: 'meta[property="og:image"]', attribute: "property", value: "og:image" },
      { selector: 'meta[name="twitter:image"]', attribute: "name", value: "twitter:image" },
    ];
    const previous: Array<{ el: HTMLMetaElement; content: string | null }> = [];

    for (const { selector, attribute, value } of selectors) {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attribute, value);
        document.head.appendChild(el);
      }
      previous.push({ el, content: el.getAttribute("content") });
      el.setAttribute("content", imageUrl);
    }

    return () => {
      for (const { el, content } of previous) {
        if (content) {
          el.setAttribute("content", content);
        } else {
          el.removeAttribute("content");
        }
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!boothAgent?.stub?.hasUserUpload || !parentBoothName || !userId) {
      return;
    }
    let active = true;
    setCheckingUpload(true);
    boothAgent.stub
      .hasUserUpload({ userId })
      .then((result) => {
        if (active) {
          setHasUserUpload(Boolean(result));
        }
      })
      .catch(() => {
        if (active) {
          setHasUserUpload(false);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingUpload(false);
        }
      });
    return () => {
      active = false;
    };
  }, [boothAgent, parentBoothName, userId]);

  const showJoinCta =
    Boolean(
      parentBoothName &&
        boothDisplayName &&
        userId &&
        hasUserUpload === false &&
        !checkingUpload,
    );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="relative isolate flex-1 overflow-hidden px-6 py-10 pb-28">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-[140px]" />
        </div>

        <div className="relative mx-auto flex max-w-4xl flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Fauxto</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                A photo from{" "}
                {parentBoothName ? (
                  <button
                    type="button"
                    onClick={() => navigate(boothPath)}
                    className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                  >
                    {boothDisplayName ?? parentBoothName}
                  </button>
                ) : (
                  <span>{boothDisplayName ?? "this booth"}</span>
                )}
              </h1>
              {parentBoothName && (
                <button
                  type="button"
                  onClick={() => navigate(boothPath)}
                  className="mt-2 text-sm text-cyan-300 hover:text-cyan-200"
                >
                  ← View this and {Math.max(boothFauxtoCount - 1, 0).toLocaleString()} other photos that never happened
                </button>
              )}
            </div>
            <div className="text-right text-sm text-slate-400">
              <p>Share the magic</p>
              <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  <span>Copy link</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleWebShare}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  Share
                </button>
                <a
                  href={smsLink}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  Text invite
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                >
                  Post to X
                </a>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{shareUrl}</p>
            </div>
          </div>
          {showJoinCta && (
            <div className="rounded-3xl border border-cyan-400/40 bg-slate-900/70 px-5 py-4 text-sm text-slate-200 shadow-lg shadow-cyan-500/10">
              <p className="font-semibold">
                <a
                  href={boothPhonePath}
                  className="text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline"
                >
                  Join in, add your selfie to {boothDisplayName}
                </a>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                or{" "}
                <button
                  type="button"
                  onClick={() => navigate(boothPath)}
                  className="font-semibold text-cyan-300 underline-offset-2 hover:text-cyan-100 hover:underline"
                >
                  visit {boothDisplayName}
                </button>
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/40">
            {imageUrl ? (
              <img src={imageUrl} alt="Generated Fauxto" className="w-full object-cover" />
            ) : (
              <div className="flex h-80 items-center justify-center text-slate-500">
                Waiting for this Fauxto to render…
              </div>
            )}
          </div>

        </div>

        <FooterBadge className="mx-auto mt-10 w-full max-w-4xl" />
      </div>
    </div>
  );
}
