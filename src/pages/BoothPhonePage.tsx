import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import type { BoothAgent, BoothState } from "../../worker/agents/booth";
import type { Navigate } from "../navigation";
import { ensureUserIdCookie } from "../utils/user-id";

type BoothPhonePageProps = {
  slug: string;
  navigate: Navigate;
};

type UploadStatus =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string; sharePath?: string };

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

const defaultDescription = "Snap a selfie and we'll make it look like you're on set.";

function createAbsoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return normalized;
  }
  return `${window.location.origin}${normalized}`;
}

export function BoothPhonePage({ slug, navigate }: BoothPhonePageProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supportsCamera, setSupportsCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [lastCapturePreview, setLastCapturePreview] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(slug);
  const [description, setDescription] = useState(defaultDescription);

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setDisplayName(state.displayName || slug);
      setDescription(state.description ?? defaultDescription);
    },
  });

  const uploadEndpoint = `/agents/booth-agent/${encodeURIComponent(slug)}`;
  const phonePageUrl =
    typeof window !== "undefined"
      ? window.location.href
      : createAbsoluteUrl(`/booths/${encodeURIComponent(slug)}/phone`);
  const inviteMessage = `Come take a fake photo with me at ${phonePageUrl} and we'll be added to ${displayName}`;
  const smsInviteLink = `sms:?&body=${encodeURIComponent(inviteMessage)}`;
  const boothSharePath = `/share/booths/${encodeURIComponent(slug)}`;
  const boothShareUrl = createAbsoluteUrl(boothSharePath);

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
    async () => {
      const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

      if (!canUseCamera) {
        setCameraError("This device can't provide a camera feed in the browser. Try another device.");
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
            : "We couldn't access your camera. Please allow permissions and try again.",
        );
      }
    },
    [cameraActive],
  );

  useEffect(() => {
    if (!supportsCamera || cameraActive || autoStartAttemptedRef.current) {
      return;
    }
    autoStartAttemptedRef.current = true;
    void startCamera();
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
        let message = "Upload failed. Please try again.";
        let sharePath: string | undefined;
        try {
          const data = await response.json();
          if (data?.message) {
            message = data.message;
          }
          if (typeof data?.sharePath === "string") {
            sharePath = data.sharePath;
          }
        } catch {
          // ignore parsing errors
        }
        throw Object.assign(new Error(message), { sharePath });
      }

      setUploadStatus({ status: "success" });
      window.setTimeout(() => {
        navigate("/me");
      }, 3000);
    } catch (error) {
      const sharePath = (error as { sharePath?: string }).sharePath;
      setUploadStatus({
        status: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong while uploading your selfie.",
        sharePath,
      });
    }
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
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Selfie Station</p>
          <h1 className="text-3xl font-semibold text-white">{displayName}</h1>
          <p className="text-sm text-slate-400">{description}</p>
          <a
            href={smsInviteLink}
            className="inline-flex items-center justify-center text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Invite people to your fauxto shoot →
          </a>
        </header>

        <section className="mt-6 flex flex-col gap-5 rounded-[32px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/40">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px] bg-slate-950/80">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`h-full w-full -scale-x-100 object-cover transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-30"}`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-400">
                <p>{supportsCamera ? "Allow camera access so we can frame you instantly." : "Camera unavailable on this device—try another phone."}</p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white"
                >
                  {supportsCamera ? "Enable camera" : "Switch device"}
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
          </div>

          {cameraError && <p className="text-sm text-rose-300">{cameraError}</p>}

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Status</p>
            {uploadStatus.status === "idle" && <p className="mt-1">Ready for your close-up.</p>}
            {uploadStatus.status === "pending" && <p className="mt-1">Uploading… this can take a few seconds.</p>}
            {uploadStatus.status === "success" && (
              <p className="mt-1 text-emerald-300">
                Selfie uploaded successfully—wow you look great! Sending you to your Fauxtos page; you&rsquo;ll see every masterpiece you&rsquo;re part of there.
              </p>
            )}
            {uploadStatus.status === "error" && (
              <>
                <p className="mt-1 text-rose-300">{uploadStatus.message}</p>
                {uploadStatus.sharePath && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={createAbsoluteUrl(uploadStatus.sharePath)}
                      className="rounded-2xl border border-white/20 px-3 py-2 text-[11px] font-semibold text-white transition hover:border-white/40"
                    >
                      Share this booth instead
                    </a>
                    <a
                      href={`sms:?&body=${encodeURIComponent(`Join me at ${boothShareUrl}`)}`}
                      className="rounded-2xl border border-white/20 px-3 py-2 text-[11px] font-semibold text-white transition hover:border-white/40"
                    >
                      Text the booth link
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-center text-xs text-slate-500">
            All photos are captured right here—no file uploads needed.
          </p>
        </section>

      </div>
    </div>
  );
}
