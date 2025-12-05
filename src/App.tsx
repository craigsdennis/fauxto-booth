import { useState } from "react";
import { useAgent } from "agents/react";
import type { MyAgent, PublicAgentState } from "../worker/agents/my-agent";

function App() {
  const [someReactValueState, setSomeReactValueState] = useState<string>("Initial value");
  const agent = useAgent<MyAgent, PublicAgentState>({
    agent: "my-agent",
    onStateUpdate(state) {
      setSomeReactValueState(state.someValue);
    },
  });

  async function update(formData: FormData) {
    const someInputValue = (formData.get("some-input-value") as string) ?? "";
    await agent.stub.updateSomeValue({ someValue: someInputValue });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16 lg:px-8">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-cyan-300/80">
            agents demo
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Example Agent
          </h1>
          <p className="mt-4 text-base text-slate-300">
            Update your worker-backed agent and watch the value sync through Tailwind-styled
            UI elements.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_-30px_rgba(15,23,42,0.9)] backdrop-blur-lg sm:p-10">
          <div className="flex flex-col gap-8">
            <div className="rounded-2xl bg-slate-900/70 p-5 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">Current agent value</p>
              <p className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                {someReactValueState}
              </p>
            </div>

            <form action={update} className="space-y-5">
              <div>
                <label
                  className="text-sm font-medium text-slate-200"
                  htmlFor="some-input-value"
                >
                  Set a new value
                </label>
                <input
                  id="some-input-value"
                  name="some-input-value"
                  placeholder="Something expressive..."
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Update on the server
              </button>
            </form>

            <p className="text-xs text-slate-400">
              Tailwind utilities provide the default look and feel—tweak the classes to change the
              mood instantly.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
