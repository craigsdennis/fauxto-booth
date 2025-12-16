import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgent } from "agents/react";
import type { Navigate } from "../navigation";
import type {
  HubAgent,
  HubState,
  HubFauxtoDetail,
} from "../../worker/agents/hub";
import { FooterBadge } from "../partials/FooterBadge";

function formatTimestamp(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Unknown";
  }
}

type AdminPageProps = {
  navigate: Navigate;
};

export function AdminPage({ navigate }: AdminPageProps) {
  const [boothSlugs, setBoothSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [boothFauxtos, setBoothFauxtos] = useState<HubFauxtoDetail[]>([]);
  const [fauxtoLoading, setFauxtoLoading] = useState(true);
  const [fauxtoError, setFauxtoError] = useState<string | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingBoothDeletes, setPendingBoothDeletes] = useState<Record<string, boolean>>({});
  const [boothDeleteError, setBoothDeleteError] = useState<string | null>(null);

  const agent = useAgent<HubAgent, HubState>({
    agent: "hub-agent",
  });

  useEffect(() => {
    if (!agent?.stub?.allBoothSlugs) return;
    let active = true;
    setLoading(true);
    setError(null);
    agent.stub
      .allBoothSlugs()
      .then((slugs) => {
        if (active) {
          setBoothSlugs(slugs);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't fetch booths. Please refresh.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [agent, reloadKey]);

  useEffect(() => {
    if (!agent?.stub?.allFauxtos) return;
    let active = true;
    setFauxtoLoading(true);
    setFauxtoError(null);
    agent.stub
      .allFauxtos()
      .then((records) => {
        if (active) {
          setBoothFauxtos(records);
        }
      })
      .catch((err) => {
        if (active) {
          setFauxtoError(
            err instanceof Error
              ? err.message
              : "We couldn't fetch fauxtos. Please refresh.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setFauxtoLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [agent, reloadKey]);

  const handleDeleteFauxto = useCallback(
    async (fauxtoId: string, boothName: string) => {
      if (!agent?.stub?.deleteFauxto) {
        setDeleteError("Delete action is unavailable right now. Try reloading.");
        return;
      }
      setDeleteError(null);
      setPendingDeletes((prev) => ({ ...prev, [fauxtoId]: true }));
      try {
        await agent.stub.deleteFauxto({ fauxtoId });
        setBoothFauxtos((groups) =>
          groups.map((group) => {
            if (group.boothName !== boothName) {
              return group;
            }
            return {
              ...group,
              fauxtos: group.fauxtos.filter(
                (record) => record.fauxtoId !== fauxtoId,
              ),
            };
          }),
        );
      } catch (err) {
        setDeleteError(
          err instanceof Error
            ? err.message
            : "We couldn't delete that Fauxto. Try again.",
        );
      } finally {
        setPendingDeletes((prev) => {
          const next = { ...prev };
          delete next[fauxtoId];
          return next;
        });
      }
    },
    [agent],
  );

  const handleDeleteBooth = useCallback(
    async (slug: string) => {
      if (!agent?.stub?.deleteBooth) {
        setBoothDeleteError("Delete action is unavailable right now. Try reloading.");
        return;
      }
      setBoothDeleteError(null);
      setPendingBoothDeletes((prev) => ({ ...prev, [slug]: true }));
      try {
        await agent.stub.deleteBooth({ boothSlug: slug });
        setBoothSlugs((slugs) => slugs.filter((existing) => existing !== slug));
        setBoothFauxtos((groups) =>
          groups.filter((group) => group.boothName !== slug),
        );
      } catch (err) {
        setBoothDeleteError(
          err instanceof Error
            ? err.message
            : "We couldn't delete that booth. Try again.",
        );
      } finally {
        setPendingBoothDeletes((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }
    },
    [agent],
  );

  const sortedSlugs = useMemo(() => {
    return [...boothSlugs].sort();
  }, [boothSlugs]);

  const orderedBoothFauxtos = useMemo(() => {
    if (sortedSlugs.length === 0) {
      return [...boothFauxtos];
    }
    const order = new Map(sortedSlugs.map((slug, index) => [slug, index]));
    return [...boothFauxtos].sort((a, b) => {
      const aIndex = order.get(a.boothName) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = order.get(b.boothName) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [boothFauxtos, sortedSlugs]);

  const hasSlugs = sortedSlugs.length > 0;
  const hasBoothFauxtos = orderedBoothFauxtos.length > 0;

  const reloadDisabled =
    loading ||
    fauxtoLoading ||
    !agent?.stub?.allBoothSlugs ||
    !agent?.stub?.allFauxtos;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="relative isolate flex-1 overflow-hidden pb-32">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-[140px]" />
        </div>

        <div className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:px-8 lg:py-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to lobby
          </button>
          <div className="mt-10 rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">All Booths</h1>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
              <p>Quick directory of every booth slug currently registered. Tap one to jump into its control room.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="rounded-2xl border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40 disabled:opacity-50"
                  disabled={reloadDisabled}
                >
                  Reload
                </button>
              </div>
            </div>
            {boothDeleteError && (
              <p className="mt-4 text-sm text-rose-300">{boothDeleteError}</p>
            )}
            {loading && (
              <p className="mt-6 text-sm text-slate-400">Loading booths…</p>
            )}
            {error && (
              <p className="mt-6 text-sm text-rose-300">{error}</p>
            )}
            {!loading && !error && (
              <>
                {hasSlugs ? (
                  <ul className="mt-6 divide-y divide-white/10 rounded-3xl border border-white/10 bg-slate-950/40 text-sm text-white">
                    {sortedSlugs.map((slug) => {
                      const isDeleting = Boolean(pendingBoothDeletes[slug]);
                      return (
                        <li
                          key={slug}
                          className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-white/5"
                        >
                          <span className="font-mono text-sm">{slug}</span>
                          <div className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                            <button
                              type="button"
                              onClick={() => navigate(`/booths/${encodeURIComponent(slug)}`)}
                              className="rounded-2xl border border-white/20 px-3 py-1 text-cyan-200 transition hover:border-white/40 disabled:opacity-50"
                              disabled={isDeleting}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBooth(slug)}
                              className="rounded-2xl border border-rose-400/40 px-3 py-1 text-rose-300 transition hover:border-rose-300 disabled:opacity-50"
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-6 text-sm text-slate-400">No booths found yet. Spin one up from the lobby.</p>
                )}
              </>
            )}
          </div>
          <div className="mt-8 rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">
              Fauxtos
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Every generated Fauxto
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Review renders across all booths. This list aggregates newest to oldest and will power upcoming moderation tools.
            </p>
            {deleteError && (
              <p className="mt-4 text-sm text-rose-300">{deleteError}</p>
            )}
            {fauxtoLoading && (
              <p className="mt-6 text-sm text-slate-400">Loading fauxtos…</p>
            )}
            {fauxtoError && (
              <p className="mt-6 text-sm text-rose-300">{fauxtoError}</p>
            )}
            {!fauxtoLoading && !fauxtoError && (
              <>
                {hasBoothFauxtos ? (
                  <div className="mt-6 space-y-6">
                    {orderedBoothFauxtos.map((group) => {
                      const hasGroupFauxtos = group.fauxtos.length > 0;
                      return (
                        <div
                          key={group.boothName}
                          className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {group.boothDisplayName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {group.boothName}
                              </p>
                            </div>
                            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                              {group.fauxtos.length} Fauxto
                              {group.fauxtos.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          {hasGroupFauxtos ? (
                            <ul className="mt-4 space-y-3">
                              {group.fauxtos.map((fauxto) => {
                                const isDeleting = Boolean(
                                  pendingDeletes[fauxto.fauxtoId],
                                );
                                return (
                                  <li
                                    key={fauxto.fauxtoId}
                                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                                  >
                                    <div className="flex items-center gap-4">
                                      {fauxto.filePath ? (
                                        <img
                                          src={`/api/images/${fauxto.filePath}`}
                                          alt={`Fauxto ${fauxto.fauxtoId}`}
                                          className="h-24 w-24 rounded-2xl object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/20 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                          Pending
                                        </div>
                                      )}
                                      <div className="flex flex-col">
                                        <p className="text-xs text-slate-400">
                                          {fauxto.fauxtoId}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {formatTimestamp(fauxto.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                                      <button
                                        type="button"
                                        className="rounded-2xl border border-white/20 px-3 py-1 text-cyan-200 transition hover:border-white/40 disabled:opacity-50"
                                        disabled={isDeleting}
                                        onClick={() =>
                                          navigate(
                                            `/fauxtos/${encodeURIComponent(fauxto.fauxtoId)}`,
                                          )
                                        }
                                      >
                                        Open
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-2xl border border-rose-400/40 px-3 py-1 text-rose-300 transition hover:border-rose-300 disabled:opacity-50"
                                        disabled={isDeleting}
                                        onClick={() =>
                                          handleDeleteFauxto(
                                            fauxto.fauxtoId,
                                            group.boothName,
                                          )
                                        }
                                      >
                                        {isDeleting ? "Deleting…" : "Delete"}
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="mt-4 text-sm text-slate-500">
                              No fauxtos generated yet for this booth.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-slate-400">
                    No booths available yet.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <FooterBadge className="mx-auto mt-12 w-full max-w-4xl" />
      </div>
    </div>
  );
}
