import { useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import type { Navigate } from "../navigation";
import type { HubAgent, HubState, BoothDetail } from "../../worker/agents/hub";

type FormStatus =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; boothName: string; boothSlug: string }
  | { status: "error"; message: string };

const creationSteps = [
  {
    title: "Give it a name",
    body: "Set a title guests will recognize. We'll turn it into a short, shareable link automatically.",
  },
  {
    title: "Describe the vibe",
    body: "Mention the event, outfits, or mood. The AI artist uses this to style every generated photo.",
  },
  {
    title: "Share & collect",
    body: "Send the booth link to guests. They drop selfies, you get cohesive composites that look like everyone posed together.",
  },
];

type HomePageProps = {
  navigate: Navigate;
};

export function HomePage({ navigate }: HomePageProps) {
  const [latestBooths, setLatestBooths] = useState<BoothDetail[]>([]);
  const [formStatus, setFormStatus] = useState<FormStatus>({ status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  const agent = useAgent<HubAgent, HubState>({
    agent: "hub-agent",
    onStateUpdate(state) {
      setLatestBooths(state.latestBooths);
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Fauxto Booth";
  }, []);

  async function createBooth(formData: FormData) {
    const displayName = ((formData.get("display-name") as string) ?? "").trim();
    const description = ((formData.get("description") as string) ?? "").trim();
    const rawIdealMemberSize = Number(formData.get("ideal-member-size"));
    const idealMemberSize = Number.isFinite(rawIdealMemberSize)
      ? Math.max(1, Math.min(Math.round(rawIdealMemberSize), 10))
      : 2;
    const hostName = typeof window !== "undefined" ? window.location.hostname : "";

    if (!displayName) {
      setFormStatus({
        status: "error",
        message: "Give your booth a memorable name so we can create the link.",
      });
      return;
    }

    if (!agent?.stub) {
      setFormStatus({
        status: "error",
        message:
          "Connecting to the Fauxto Booth engine. Try again in a moment.",
      });
      return;
    }

    try {
      setFormStatus({ status: "pending" });
      const boothSlug = await agent.stub.createBooth({
        displayName,
        description,
        hostName,
        idealMemberSize,
      });
      setFormStatus({ status: "success", boothName: displayName, boothSlug });
      formRef.current?.reset();
      navigate(`/booths/${boothSlug}`);
    } catch (error) {
      setFormStatus({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving your booth.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/30 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-pink-500/20 blur-[120px]" />
          <div className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-violet-600/20 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">
              fauxto booth
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Launch a virtual booth where every guest looks like they posed
              together.
            </h1>
            <p className="mt-5 text-base text-slate-300 sm:text-lg">
              Spin up custom AI-powered photo booths for weddings, launches, or
              fandom meetups. Guests drop selfies, and Fauxto Booth blends them
              into consistent, on-theme portraits in seconds.
            </p>
          </header>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Create a booth
                  </h2>
                  <p className="text-sm text-slate-400">
                    Set the vibe and we will take care of the compositing magic.
                  </p>
                </div>
              </div>

              <form
                ref={formRef}
                action={createBooth}
                className="mt-8 space-y-6"
              >
                <div>
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="display-name"
                  >
                    Booth name
                  </label>
                  <input
                    id="display-name"
                    name="display-name"
                    placeholder="e.g. Sam & Riley's Neon Nights"
                    required
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="description"
                  >
                    Describe the look (optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    placeholder="Smoky NYC rooftop, champagne, glitter eyeliner, cinematic flash"
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    The more specific the vibe, the more consistent your
                    generated group shots will be.
                  </p>
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="ideal-member-size"
                  >
                    People per Fauxto
                  </label>
                  <input
                    id="ideal-member-size"
                    name="ideal-member-size"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={2}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    We'll wait for this many guests before snapping each composite.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={formStatus.status === "pending"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 disabled:opacity-60"
                >
                  {formStatus.status === "pending"
                    ? "Creating booth…"
                    : "Launch booth"}
                </button>

                {formStatus.status === "success" && (
                  <div className="rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    Booth "{formStatus.boothName}" is live. Share the link:
                    fauxto.ai/booth/{formStatus.boothSlug}
                  </div>
                )}

                {formStatus.status === "error" && (
                  <div className="rounded-2xl border border-rose-400/50 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    {formStatus.message}
                  </div>
                )}
              </form>
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Latest booths
                </h2>
                {latestBooths.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-400">
                    Your first booth will show up here. We keep the 10 most
                    recent creations pinned for quick access.
                  </p>
                ) : (
                  <ul className="mt-6 space-y-3">
                    {latestBooths.map((booth) => (
                      <li
                        key={booth.name}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {booth.displayName}
                          </p>
                          <p className="text-xs text-slate-400">
                            /{booth.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/booths/${booth.name}`)}
                          className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  How it works
                </h2>
                <dl className="mt-6 space-y-4">
                  {creationSteps.map((step) => (
                    <div
                      key={step.title}
                      className="rounded-2xl bg-slate-950/60 p-4"
                    >
                      <dt className="text-base font-semibold text-white">
                        {step.title}
                      </dt>
                      <dd className="mt-2 text-sm text-slate-400">
                        {step.body}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
