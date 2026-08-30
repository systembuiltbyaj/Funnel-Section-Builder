"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { GalleryRail } from "./gallery/rail";
import { Gallery } from "./gallery/gallery";
import { PrivateContent } from "./private-content";

type View = { kind: "builder" } | { kind: "browse"; group: string | null };

/**
 * The single page: the builder and the library behind one pill rail.
 *
 * `?tab=builder` is read once, on first render, so the /build redirect and any
 * existing link into the builder still land in the right place. After that the
 * view is plain client state — switching is instant, with no route transition,
 * which is what the tool felt like before it was split in two.
 */
export function Shell() {
  const params = useSearchParams();
  const [view, setView] = useState<View>(() =>
    params.get("tab") === "builder" ? { kind: "builder" } : { kind: "browse", group: null }
  );

  const { sel } = useFunnelSelection();
  const pickedIds = PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled).map((g) => g.id);

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#0D0B1F] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[600px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10">
        <header className="px-4 pb-6 pt-10 text-center">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B6390]">
            10P Sales Page Framework
          </div>
          <h1
            className="text-[30px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Funnel Section <span className="text-[#F5C842]">Builder</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-[560px] text-[13px] leading-[1.6] text-[#A09AB8]">
            Compose a full funnel section-by-section, or browse every variation&rsquo;s
            wireframe and take away a copy-ready prompt.
          </p>
        </header>

        <GalleryRail
          activeGroup={view.kind === "browse" ? view.group : null}
          builderActive={view.kind === "builder"}
          onSelect={(group) => setView({ kind: "browse", group })}
          onSelectBuilder={() => setView({ kind: "builder" })}
          pickedIds={pickedIds}
        />

        {view.kind === "builder" ? (
          <PrivateContent />
        ) : (
          <Gallery
            activeGroup={view.group}
            onSelectGroup={(group) => setView({ kind: "browse", group })}
            onBuild={() => setView({ kind: "builder" })}
          />
        )}
      </div>
    </main>
  );
}
