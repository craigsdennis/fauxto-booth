import { useCallback, useEffect, useState } from "react";
import { useAgent } from "agents/react";
import type { FauxtoAgent, FauxtoState } from "../../worker/agents/fauxto";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";
import { FooterBadge } from "../partials/FooterBadge";

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

  useAgent<FauxtoAgent, FauxtoState>({
    agent: "fauxto-agent",
    name: fauxtoId,
    onStateUpdate(state) {
      setFilePath(state.filePath || null);
      setParentBoothName(state.parentBoothName || null);
    },
  });

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: parentBoothName ?? "",
    enabled: Boolean(parentBoothName),
    onStateUpdate(state) {
      setBoothDisplayName(state.displayName || parentBoothName);
      setBoothFauxtoCount(state.fauxtoCount ?? 0);
    },
  });

  const boothPath = parentBoothName ? `/booths/${encodeURIComponent(parentBoothName)}` : "/";
  const imagePath = filePath ? `/api/images/${filePath}` : null;
  const imageUrl = imagePath ? createAbsoluteUrl(imagePath) : null;
  const sharePath = `/share/fauxtos/${encodeURIComponent(fauxtoId)}`;
  const shareUrl = createAbsoluteUrl(sharePath);
  const shareMessage = `Come take a fake photo with me at ${shareUrl}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  const handleWebShare = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      try {
        await navigator.clipboard?.writeText(shareMessage);
      } catch (error) {
        console.warn("Could not copy share message", error);
      }
      return;
    }
    try {
      await navigator.share({
        title: boothDisplayName ?? parentBoothName ?? "Fauxto Booth",
        text: shareMessage,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.warn("Share failed", error);
      }
    }
  }, [boothDisplayName, parentBoothName, shareMessage, shareUrl]);

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
                  onClick={handleWebShare}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white"
                >
                  Share
                </button>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold text-white"
                >
                  Post to X
                </a>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{shareUrl}</p>
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

        </div>

        <FooterBadge className="mx-auto mt-10 w-full max-w-4xl" />
      </div>
    </div>
  );
}
