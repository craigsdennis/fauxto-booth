import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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

type UploadStatus =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string };

export function BoothPhonePage({ slug, navigate }: BoothPhonePageProps) {
  const [boothState, setBoothState] = useState<BoothState | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supportsCamera, setSupportsCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useAgent<BoothAgent, BoothState>({
    agent: "booth-agent",
    name: slug,
    onStateUpdate(state) {
      setBoothState(state);
    },
  });

  const displayName = boothState?.displayName || slug;
  const description = boothState?.description || "Snap or upload a selfie. We'll make it look like you're on set.";
  const hostPath = `/booths/${encodeURIComponent(slug)}`;
  const uploadEndpoint = `/agents/booth-agent/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (navigator.mediaDevices?.getUserMedia) {
      setSupportsCamera(true);
    }
    return () => {
      stopCamera();
    };
  }, []);

  async function uploadSelfie(file: Blob | File, filename?: string) {
    if (!file) return;
    const formData = new FormData();
    const finalName = (file instanceof File && file.name) || filename || "selfie.jpg";
    formData.append("selfie", file, finalName);
    formData.append("slug", slug);
    formData.append("source", "phone-ui");

    try {
      setUploadStatus({ status: "pending" });
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
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

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  async function startCamera() {
    if (!supportsCamera) {
      triggerFilePicker();
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
        await video.play();
      }
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : "We couldn't access your camera. Please allow permissions or upload from your files.",
      );
      triggerFilePicker();
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
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
    canvas.toBlob((blob) => {
      if (!blob) {
        setUploadStatus({ status: "error", message: "Failed to save the photo. Try again." });
        return;
      }
      void uploadSelfie(blob, `selfie-${Date.now()}.jpg`);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Phone booth</p>
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          <p className="text-sm text-slate-400">{description}</p>
        </header>

        <div className="mt-8 space-y-8">
          <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-base font-semibold">Take your selfie</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use your front camera, fill the guide with your face and shoulders, and submit once you're happy.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500"
                >
                  {cameraActive ? "Camera ready" : supportsCamera ? "Open camera" : "Use camera (prompt)"}
                </button>
                {cameraActive && (
                  <>
                    <video ref={videoRef} playsInline className="h-64 w-full rounded-2xl border border-white/10 object-cover" />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200"
                      >
                        {uploadStatus.status === "pending" ? "Uploading…" : "Capture photo"}
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200"
                      >
                        Close camera
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={triggerFilePicker}
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white"
              >
                Upload from photos
              </button>
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
              <p className="text-xs text-slate-500">
                Your photo uploads securely to {uploadEndpoint}. We only use it to generate the group picture.
              </p>
            </div>
          </section>

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
