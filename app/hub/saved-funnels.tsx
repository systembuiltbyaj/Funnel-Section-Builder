"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = { id: string; name: string; updated_at: string };

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; projects: Project[] };

/**
 * The user's saved funnels.
 *
 * The four states are kept distinct on purpose. Collapsing them — as the
 * builder's original fetch did, by swallowing every error — renders "no funnels
 * yet" to someone whose session merely expired, which is a lie about their data.
 */
export function SavedFunnels() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (cancelled) return;
        if (res.status === 401) {
          setState({
            kind: "error",
            message: "Your session expired — sign in again to see your funnels.",
          });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: "Could not load your funnels. Try again in a moment." });
          return;
        }
        const data = await res.json();
        if (!cancelled) setState({ kind: "ready", projects: data.projects ?? [] });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Could not reach the server." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // Supabase unconfigured: the feature does not exist rather than being broken.
  if (!configured) return null;

  return (
    <section className="mx-auto max-w-[1200px] border-t border-[#2A2250] px-4 py-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A09AB8]">
        Your funnels
      </h2>

      {state.kind === "loading" && (
        <p className="text-[12.5px] text-[#5A5478]">Loading your funnels…</p>
      )}

      {state.kind === "error" && (
        <p className="rounded-lg border border-[#4A2250] bg-[#1A0F24] px-4 py-3 text-[12.5px] text-[#F87171]">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && state.projects.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#2A2250] px-4 py-6 text-center text-[12.5px] text-[#5A5478]">
          No funnels yet — add sections above and they&apos;ll collect here.
        </p>
      )}

      {state.kind === "ready" && state.projects.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.projects.map((p) => (
            <li key={p.id}>
              <Link
                href="/build"
                className="block rounded-lg border border-[#2A2250] bg-[#0B091A] p-3.5 transition hover:border-[#7C5CFC]"
              >
                <div className="truncate text-[13px] font-semibold text-[#E8E4F5]">{p.name}</div>
                <div className="mt-1 text-[11px] text-[#5A5478]">
                  Updated {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
