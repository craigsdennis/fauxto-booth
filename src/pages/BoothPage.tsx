import { useCallback, useEffect, useState } from "react";
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
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [qrCodeSrc, setQrCodeSrc] = useState<string | null>(null);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const [isSnappingPhoto, setIsSnappingPhoto] = useState(false);
  const [snapPhotoError, setSnapPhotoError] = useState<string | null>(null);
  const [backgroundImageStatus, setBackgroundImageStatus] = useState<BoothState["backgroundImageStatus"]>("ready");
  const [backgroundFilePath, setBackgroundFilePath] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState(slug);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [fauxtoCount, setFauxtoCount] = useState(0);
  const [latestFauxtos, setLatestFauxtos] = useState<BoothState["latestFauxtos"]>([]);
  const [displayStatus, setDisplayStatus] = useState<string | undefined>(undefined);
  const [idealMemberSize, setIdealMemberSize] = useState(2);
  const [idealMemberSizeError, setIdealMemberSizeError] = useState<string | null>(null);
  const [idealMemberSizeUpdating, setIdealMemberSizeUpdating] = useState(false);

  const agent = useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setDisplayName(state.displayName || slug);
      setDescription(state.description);
      setBackgroundImageStatus(state.backgroundImageStatus ?? "ready");
      setBackgroundFilePath(state.backgroundFilePath);
      setUploadedCount(state.uploadedCount ?? 0);
      setFauxtoCount(state.fauxtoCount ?? 0);
      setLatestFauxtos(state.latestFauxtos ?? []);
      setDisplayStatus(state.displayStatus);
      setIdealMemberSize(state.idealMemberSize ?? 2);
    },
  });

  const backgroundReady = Boolean(backgroundFilePath);
  const isGeneratingBackground = backgroundImageStatus === "generating";
  const canRefreshBackground = backgroundImageStatus === "ready";
  const uploadsLabel = uploadedCount === 1 ? "Upload captured" : "Uploads captured";
  const fauxtosLabel = fauxtoCount === 1 ? "Fauxto generated" : "Fauxtos generated";
  const latestFauxtoCount = latestFauxtos.length;
  const hasFauxtos = latestFauxtoCount > 0;
  const [activeFauxtoIndex, setActiveFauxtoIndex] = useState(0);
  const activeFauxto = hasFauxtos
    ? latestFauxtos[activeFauxtoIndex % latestFauxtoCount]
    : null;
  const boothPath = `/booths/${encodeURIComponent(slug)}`;
  const phonePath = `${boothPath}/phone`;
  const phoneUrl = createAbsoluteUrl(phonePath);
  const backgroundUrl = backgroundFilePath
    ? `/api/images/${backgroundFilePath}`
    : null;
  const inviteMessage = `Come take a fake photo with me at ${phoneUrl} and we'll be added to ${displayName}`;
  const smsInviteLink = `sms:&body=${encodeURIComponent(inviteMessage)}`;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `Fauxto Booth${displayName ? ` · ${displayName}` : ""}`;
  }, [displayName]);

  const openFauxto = useCallback(
    (id: string) => {
      navigate(`/fauxtos/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const updateIdealMemberSize = useCallback(
    async (nextSize: number) => {
      if (!agent?.stub?.setIdealMemberSize) {
        setIdealMemberSizeError("Connecting to the booth—try again in a beat.");
        return;
      }

      const safeSize = Math.max(1, Math.min(10, nextSize));
      if (safeSize === idealMemberSize) return;

      setIdealMemberSizeError(null);
      setIdealMemberSize(safeSize);
      setIdealMemberSizeUpdating(true);

      try {
        await agent.stub.setIdealMemberSize({ idealMemberSize: safeSize });
      } catch (error) {
        setIdealMemberSizeError(
          error instanceof Error
            ? error.message
            : "We couldn't update that preference. Please try again.",
        );
      } finally {
        setIdealMemberSizeUpdating(false);
      }
    },
    [agent, idealMemberSize],
  );

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
  }, [latestFauxtoCount]);

  useEffect(() => {
    if (!hasFauxtos || latestFauxtoCount < 2 || typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveFauxtoIndex((current) => (current + 1) % latestFauxtoCount);
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [hasFauxtos, latestFauxtoCount]);

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
                    {fauxtoCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.3em]">{fauxtosLabel}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-400">
                <p className="font-semibold text-white">People per Fauxto</p>
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => updateIdealMemberSize(idealMemberSize - 1)}
                    disabled={idealMemberSize <= 1 || idealMemberSizeUpdating}
                    className="rounded-full border border-white/20 px-2 py-1 text-white disabled:opacity-40"
                  >
                    –
                  </button>
                  <span className="text-2xl font-semibold text-white">{idealMemberSize}</span>
                  <button
                    type="button"
                    onClick={() => updateIdealMemberSize(idealMemberSize + 1)}
                    disabled={idealMemberSize >= 10 || idealMemberSizeUpdating}
                    className="rounded-full border border-white/20 px-2 py-1 text-white disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                {idealMemberSizeError && (
                  <p className="text-xs text-rose-300">{idealMemberSizeError}</p>
                )}
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

          {displayStatus && (
            <div className="mt-6 rounded-3xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm text-cyan-100 shadow-lg shadow-cyan-500/20">
              {displayStatus}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/50">
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
                <span className="text-xs font-medium text-slate-300">{fauxtoCount.toLocaleString()} ready</span>
              )}
            </div>
            {activeFauxto && (
              <div className="mt-5 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 shadow-xl shadow-black/40">
                <button
                  type="button"
                  onClick={() => openFauxto(activeFauxto.fauxtoId)}
                  className="group block w-full"
                >
                  <img
                    key={activeFauxto.filePath}
                    src={`/api/images/${activeFauxto.filePath}`}
                    alt={`Featured Fauxto for ${displayName}`}
                    className="h-80 w-full object-cover transition-all duration-700 group-hover:opacity-90"
                  />
                </button>
                <div className="flex items-center justify-between px-6 py-4 text-xs text-slate-400">
                  <span>Slideshow · {activeFauxtoIndex + 1} / {latestFauxtoCount}</span>
                  <button
                    type="button"
                    onClick={() => openFauxto(activeFauxto.fauxtoId)}
                    className="text-cyan-300 hover:text-cyan-200"
                  >
                    Open Fauxto →
                  </button>
                </div>
              </div>
            )}
            {hasFauxtos ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {latestFauxtos.map((fauxto) => (
                  <button
                    key={fauxto.filePath}
                    type="button"
                    onClick={() => openFauxto(fauxto.fauxtoId)}
                    className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 text-left transition hover:border-cyan-400/40"
                  >
                    <img
                      src={`/api/images/${fauxto.filePath}`}
                      alt={`Fauxto composite for ${displayName}`}
                      className="h-64 w-full object-cover"
                    />
                  </button>
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
