import { useEffect, useState } from "react";
import * as QRCode from "qrcode";
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
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [qrCodeSrc, setQrCodeSrc] = useState<string | null>(null);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const [isSnappingPhoto, setIsSnappingPhoto] = useState(false);
  const [snapPhotoError, setSnapPhotoError] = useState<string | null>(null);

  const agent = useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setBoothState(state);
    },
  });

  const backgroundImageStatus = boothState?.backgroundImageStatus ?? "ready";
  const backgroundReady = Boolean(boothState?.backgroundFilePath);
  const isGeneratingBackground = backgroundImageStatus === "generating";
  const canRefreshBackground = backgroundImageStatus === "ready";
  const displayName = boothState?.displayName || slug;
  const description = boothState?.description;
  const uploadedCount = boothState?.uploadedCount ?? 0;
  const uploadsLabel = uploadedCount === 1 ? "Upload captured" : "Uploads captured";
  const fauxtos = boothState?.fauxtos ?? [];
  const fauxtosGenerated = fauxtos.length;
  const fauxtosLabel = fauxtosGenerated === 1 ? "Fauxto generated" : "Fauxtos generated";
  const hasFauxtos = fauxtos.length > 0;
  const [activeFauxtoIndex, setActiveFauxtoIndex] = useState(0);
  const activeFauxto = hasFauxtos ? fauxtos[activeFauxtoIndex % fauxtos.length] : null;
  const boothPath = `/booths/${encodeURIComponent(slug)}`;
  const phonePath = `${boothPath}/phone`;
  const phoneUrl = createAbsoluteUrl(phonePath);
  const backgroundUrl = boothState?.backgroundFilePath
    ? `/api/images/${boothState.backgroundFilePath}`
    : null;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `Fauxto Booth${displayName ? ` · ${displayName}` : ""}`;
  }, [displayName]);

  useEffect(() => {
    let active = true;
    setQrCodeSrc(null);
    setQrCodeError(null);

    QRCode.toDataURL(phoneUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: "#020617", // slate-950 copy
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (active) {
          setQrCodeSrc(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrCodeError("We couldn't draw that QR. Copy the link instead.");
        }
      });

    return () => {
      active = false;
    };
  }, [phoneUrl]);

  async function handleRefreshBackground() {
    if (!agent?.stub?.refreshBackground) {
      setGenerateError("Connecting to the booth—try again in a beat.");
      return;
    }

    if (!canRefreshBackground) {
      return;
    }

    try {
      setGenerateError(null);
      await agent.stub.refreshBackground();
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : "We couldn't start that render. Please try again.",
      );
    }
  }

  async function handleSnapPhoto() {
    if (!agent?.stub?.snapPhotos) {
      setSnapPhotoError("Connecting to the booth—try again in a beat.");
      return;
    }

    try {
      setSnapPhotoError(null);
      setIsSnappingPhoto(true);
      await agent.stub.snapPhotos();
    } catch (error) {
      setSnapPhotoError(
        error instanceof Error
          ? error.message
          : "We couldn't take that snap. Please try again.",
      );
    } finally {
      setIsSnappingPhoto(false);
    }
  }

  useEffect(() => {
    setActiveFauxtoIndex(0);
  }, [fauxtos.length]);

  useEffect(() => {
    if (!hasFauxtos || fauxtos.length < 2 || typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveFauxtoIndex((current) => (current + 1) % fauxtos.length);
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [hasFauxtos, fauxtos.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
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

          <div className="mt-10 flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1 space-y-6">
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">{displayName}</h1>
              <div className="flex flex-wrap gap-8 text-sm text-slate-400">
                <div>
                  <p className="text-4xl font-semibold text-white">
                    {uploadedCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.3em]">{uploadsLabel}</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold text-white">
                    {fauxtosGenerated.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.3em]">{fauxtosLabel}</p>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div className="rounded-3xl border border-white/15 bg-slate-950/80 p-4 shadow-2xl shadow-black/50">
                {qrCodeSrc ? (
                  <img
                    src={qrCodeSrc}
                    alt="QR code linking guests to the mobile booth"
                    className="h-40 w-40 rounded-xl bg-white p-2"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-white/70 font-medium text-slate-500">
                    {qrCodeError ? "QR unavailable" : "Rendering QR…"}
                  </div>
                )}
              </div>
              {qrCodeError && (
                <p className="mt-3 text-xs text-rose-200">{qrCodeError}</p>
              )}
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/50">
            <div className="relative aspect-[5/3] w-full overflow-hidden">
              {backgroundUrl ? (
                <img
                  src={backgroundUrl}
                  alt={`AI background for ${displayName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent p-6">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRefreshBackground}
                    disabled={!canRefreshBackground}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 disabled:opacity-60"
                  >
                    {isGeneratingBackground
                      ? "Rendering…"
                      : backgroundReady
                        ? "Regenerate background"
                        : "Generate background"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    disabled={isSnappingPhoto}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 disabled:opacity-60"
                  >
                    {isSnappingPhoto ? "Snapping…" : "Snap Fauxtos"}
                  </button>
                </div>

                {generateError && (
                  <p className="text-sm text-rose-300">{generateError}</p>
                )}
                {snapPhotoError && (
                  <p className="text-sm text-rose-300">{snapPhotoError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-base text-slate-300">
            {description ? (
              <p>{description}</p>
            ) : (
              <p className="text-slate-400">
                Describe your vibe when editing the booth to help the AI lock in lighting and styling cues.
              </p>
            )}
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Live Fauxtos</p>
                <p className="text-sm text-slate-400">Every composite streams back here in real time.</p>
              </div>
              {hasFauxtos && (
                <span className="text-xs font-medium text-slate-300">{fauxtosGenerated} ready</span>
              )}
            </div>
            {activeFauxto && (
              <div className="mt-5 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 shadow-xl shadow-black/40">
                <img
                  key={activeFauxto.filePath}
                  src={`/api/images/${activeFauxto.filePath}`}
                  alt={`Featured Fauxto for ${displayName}`}
                  className="h-80 w-full object-cover transition-all duration-700"
                />
                <div className="flex items-center justify-between px-6 py-4 text-xs text-slate-400">
                  <span>Slideshow · {activeFauxtoIndex + 1} / {fauxtosGenerated}</span>
                  <span>Updates every 5s</span>
                </div>
              </div>
            )}
            {hasFauxtos ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {fauxtos.map((fauxto) => (
                  <div key={fauxto.filePath} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70">
                    <img
                      src={`/api/images/${fauxto.filePath}`}
                      alt={`Fauxto composite for ${displayName}`}
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Snap a photo to see the finished Fauxtos populate this gallery.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
