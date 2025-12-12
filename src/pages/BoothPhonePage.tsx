import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAgent } from "agents/react";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";

type BoothPhonePageProps = {
  slug: string;
  navigate: Navigate;
};

type UploadStatus =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string };

async function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  if (canvas.toBlob) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Empty capture"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.92,
      );
    });
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Could not capture frame");
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    view[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: "image/jpeg" });
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (!trimmed) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    if (decodeURIComponent(rawKey) !== name) continue;
    return decodeURIComponent(rest.join("="));
  }
  return null;
}

function ensureUserIdCookie() {
  if (typeof document === "undefined") return null;
  const existing = readCookie("userId");
  if (existing) {
    return existing;
  }
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const expires = new Date(Date.now() + 31536000000).toUTCString();
  document.cookie = `userId=${encodeURIComponent(uuid)}; path=/; expires=${expires}; SameSite=Lax`;
  return uuid;
}

export function BoothPhonePage({ slug, navigate: _navigate }: BoothPhonePageProps) {
  const [boothState, setBoothState] = useState<BoothState | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supportsCamera, setSupportsCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [lastCapturePreview, setLastCapturePreview] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedFauxto, setExpandedFauxto] = useState<string | null>(null);

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      // TODO: Unwrap
      setBoothState(state);
    },
    onMessage(event) {
      console.log(event);
    }
  });

  const displayName = boothState?.displayName || slug;
  const description = boothState?.description || "Snap or upload a selfie. We'll make it look like you're on set.";
  const uploadEndpoint = `/agents/booth-agent/${encodeURIComponent(slug)}`;
  const fauxtos = boothState?.fauxtos ?? [];
  const personalFauxtos = userId
    ? fauxtos.filter((fauxto) => Array.isArray(fauxto.members) && fauxto.members.includes(userId))
    : fauxtos;
  const showingAllFallback = Boolean(userId && personalFauxtos.length === 0);
  const galleryFauxtos = showingAllFallback ? fauxtos : personalFauxtos;
  const hasFauxtos = galleryFauxtos.length > 0;
  const fauxtoHelperText = userId
    ? showingAllFallback
      ? "We haven't spotted you yet—showing recent booth Fauxtos."
      : "Only the Fauxtos you're in appear below."
    : "Everyone's composites appear here for now.";

  useEffect(() => {
    const ensured = ensureUserIdCookie();
    if (ensured) {
      setUserId((current) => (current === ensured ? current : ensured));
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `Fauxto Booth${displayName ? ` · ${displayName}` : ""}`;
  }, [displayName]);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (navigator.mediaDevices?.getUserMedia) {
      setSupportsCamera(true);
    }
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(
    async (options?: { silentFallback?: boolean }) => {
      const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

      if (!canUseCamera) {
        if (!options?.silentFallback) {
          triggerFilePicker();
        }
        return;
      }

      if (cameraActive) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;
        setCameraActive(true);
        setCameraError(null);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (error) {
        setCameraError(
          error instanceof Error
            ? error.message
            : "We couldn't access your camera. Please allow permissions or upload from your files.",
        );
        if (!options?.silentFallback) {
          triggerFilePicker();
        }
      }
    },
    [cameraActive, triggerFilePicker],
  );

  useEffect(() => {
    if (!supportsCamera || cameraActive || autoStartAttemptedRef.current) {
      return;
    }
    autoStartAttemptedRef.current = true;
    void startCamera({ silentFallback: true });
  }, [supportsCamera, cameraActive, startCamera]);

  async function uploadSelfie(file: Blob | File, filename?: string) {
    if (!file) return;
    const formData = new FormData();
    const finalName = (file instanceof File && file.name) || filename || "selfie.jpg";
    formData.append("selfie", file, finalName);
    formData.append("userId", userId as string);
    formData.append("slug", slug);
    formData.append("source", "phone-ui");

    try {
      setUploadStatus({ status: "pending" });
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      setUploadStatus({ status: "success" });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadStatus({
        status: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong while uploading your selfie.",
      });
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadSelfie(file);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    setFlashActive(true);
    setTimeout(() => {
      setFlashActive(false);
    }, 160);

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1440;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setUploadStatus({ status: "error", message: "We couldn't capture the frame. Try again." });
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    const previewUrl = canvas.toDataURL("image/jpeg", 0.92);
    setLastCapturePreview(previewUrl);
    try {
      const blob = await canvasToJpegBlob(canvas);
      void uploadSelfie(blob, `selfie-${Date.now()}.jpg`);
    } catch (error) {
      setUploadStatus({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to save the photo. Try again.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Phone booth</p>
          <h1 className="text-3xl font-semibold text-white">{displayName}</h1>
          <p className="text-sm text-slate-400">{description}</p>
          <p className="text-xs text-cyan-200/70">User ID cookie: {userId ?? "not set"}</p>
        </header>

        <section className="mt-6 flex flex-col gap-5 rounded-[32px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/40">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px] bg-slate-950/80">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`h-full w-full object-cover transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-30"}`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-400">
                <p>{supportsCamera ? "Allow camera access so we can frame you instantly." : "Camera unavailable on this device. Upload instead."}</p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white"
                >
                  {supportsCamera ? "Enable camera" : "Upload a selfie"}
                </button>
              </div>
            )}
            {flashActive && <div className="pointer-events-none absolute inset-0 bg-white/80" />}
            {lastCapturePreview && (
              <div className="absolute bottom-4 right-4 rounded-2xl border border-white/20 bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <span>Last shot</span>
                <img src={lastCapturePreview} alt="Latest capture preview" className="mt-1 h-16 w-12 rounded-lg object-cover" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!cameraActive || uploadStatus.status === "pending"}
              className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 disabled:opacity-50"
            >
              {uploadStatus.status === "pending" ? "Uploading…" : "Capture"}
            </button>
            <button
              type="button"
              onClick={cameraActive ? stopCamera : () => startCamera()}
              className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white"
            >
              {cameraActive ? "Pause camera" : supportsCamera ? "Retry camera" : "Prompt camera"}
            </button>
            <button
              type="button"
              onClick={triggerFilePicker}
              className="grow rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white sm:grow-0"
            >
              Upload from photos
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {cameraError && <p className="text-sm text-rose-300">{cameraError}</p>}

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Status</p>
            {uploadStatus.status === "idle" && <p className="mt-1">Ready for your close-up.</p>}
            {uploadStatus.status === "pending" && <p className="mt-1">Uploading… this can take a few seconds.</p>}
            {uploadStatus.status === "success" && (
              <p className="mt-1 text-emerald-300">Got it! We'll ping the host as soon as your composite is ready.</p>
            )}
            {uploadStatus.status === "error" && (
              <p className="mt-1 text-rose-300">{uploadStatus.message}</p>
            )}
          </div>
          <p className="text-center text-xs text-slate-500">
            Selfies upload securely to {uploadEndpoint}. We only use them to generate the booth shot.
          </p>
        </section>

        <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Your Fauxtos</h2>
              <p className="text-xs text-slate-400">{fauxtoHelperText}</p>
            </div>
            {hasFauxtos && <span className="text-xs font-medium text-slate-300">{galleryFauxtos.length}</span>}
          </div>
          {hasFauxtos ? (
            <div className="mt-4 space-y-4">
              {galleryFauxtos.map((fauxto) => {
                const isExpanded = expandedFauxto === fauxto.filePath;
                return (
                  <button
                    key={fauxto.filePath}
                    type="button"
                    onClick={() =>
                      setExpandedFauxto((current) =>
                        current === fauxto.filePath ? null : fauxto.filePath,
                      )
                    }
                    className={`w-full overflow-hidden rounded-[30px] border border-white/15 bg-slate-950/70 text-left transition ${isExpanded ? "ring-2 ring-cyan-400/70" : ""}`}
                  >
                    <img
                      src={`/api/images/${fauxto.filePath}`}
                      alt={`Generated Fauxto for ${displayName}`}
                      className={`w-full object-cover ${isExpanded ? "h-64" : "h-40"}`}
                    />
                    {Array.isArray(fauxto.members) && fauxto.members.length > 0 && (
                      <p className="px-4 py-3 text-xs text-slate-400">
                        Includes {fauxto.members.length} guest{fauxto.members.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              We'll drop your Fauxtos here the second we spot you in a finished render.
            </p>
          )}
        </section>

      </div>
    </div>
  );
}
