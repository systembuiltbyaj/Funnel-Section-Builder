"use client";

import Link from "next/link";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";

/**
 * What the user has collected while browsing, docked to the bottom of the hub.
 *
 * It stays in view deliberately: the library is a long scroll, and a tray that
 * leaves the viewport turns "collect as you browse" into "scroll back and check
 * what you picked".
 */
export function FunnelTray() {
  const { sel, hydrated, setSection } = useFunnelSelection();

  // Render nothing until hydration finishes, so the bar cannot flash empty on
  // first paint before localStorage has been read.
  if (!hydrated) return null;

  const picked = PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled).map((g) => {
    const v = g.variations.find((x) => x.number === sel[g.id].variation) ?? g.variations[0];
    return { id: g.id, label: g.label, name: variationShortName(v.title) };
  });
  if (picked.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#2A2250] bg-[#100C24]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <span className="shrink-0 text-[12.5px] font-bold text-[#E8E4F5]">
          {picked.length} section{picked.length === 1 ? "" : "s"}
        </span>

        {/* Chips are dropped below sm: on a phone the bar must not eat the
            viewport, and the count plus the action carry the meaning. */}
        <div className="hidden min-w-0 flex-1 flex-wrap gap-1.5 sm:flex">
          {picked.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSection(p.id, { enabled: false })}
              aria-label={`Remove ${p.label}`}
              title={`Remove ${p.label}`}
              className="rounded-md border border-[#2A2250] px-2 py-1 text-[11px] text-[#A09AB8] transition hover:border-[#F87171] hover:text-[#F87171]"
            >
              {p.label} · {p.name} ✕
            </button>
          ))}
        </div>

        <Link
          href="/build"
          className="ml-auto shrink-0 rounded-md bg-[#7C5CFC] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
        >
          Open builder →
        </Link>
      </div>
    </div>
  );
}
