"use client";

import { useMemo, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { flattenGroups, filterGallery } from "@/lib/gallery-filter";
import { buildOutputs } from "@/lib/prompt-assembly";
import { sampleForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";
import { GalleryRail } from "./rail";
import { GalleryCard } from "./card";
import { FunnelTray } from "./tray";

export function Gallery() {
  const { sel, kit, toggleSection } = useFunnelSelection();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);

  const items = useMemo(() => flattenGroups(PROMPT_GROUPS), []);
  const shown = useMemo(
    () => filterGallery(items, { groupId: activeGroup, query }),
    [items, activeGroup, query]
  );

  const pickedIds = Object.entries(sel).filter(([, v]) => v?.enabled).map(([id]) => id);
  const activeGroupMeta = PROMPT_GROUPS.find((g) => g.id === activeGroup) ?? null;

  /**
   * One section's prompt, assembled through the same path the builder uses so a
   * single-section copy and a full-funnel build cannot drift apart.
   */
  function copyPrompt(groupId: string, variationNumber: string) {
    const { blocks } = buildOutputs({
      groups: PROMPT_GROUPS,
      sel: { [groupId]: { enabled: true, variation: variationNumber, copy: "" } },
      kit,
      includeRef: true,
    });
    const text = blocks.map((b) => `${b.heading}\n${b.text}`).join("\n\n");
    void navigator.clipboard.writeText(text);
  }

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
            Funnel Section <span className="text-[#F5C842]">Templates</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-[520px] text-[13px] leading-[1.6] text-[#A09AB8]">
            110 ready-made funnel sections across the 12 groups of the 10P framework. Preview any
            section live, recolour it to your brand, and take away a copy-ready prompt.
          </p>
        </header>

        <div className="mx-auto flex max-w-[1240px] gap-6 px-4 pb-28">
          <GalleryRail
            activeGroup={activeGroup}
            onSelect={setActiveGroup}
            pickedIds={pickedIds}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-5">
              <label htmlFor="gallery-search" className="sr-only">
                Search sections
              </label>
              <input
                id="gallery-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sections by name or style…"
                className="w-full rounded-lg border border-[#2A2250] bg-[#151230] px-3.5 py-2.5 text-[13px] text-[#E8E4F5] outline-none placeholder:text-[#5A5478] focus:border-[#7C5CFC]"
              />
            </div>

            <div className="mb-4">
              <h2
                className="text-[19px] font-bold"
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              >
                {activeGroupMeta ? activeGroupMeta.label : "All sections"}
              </h2>
              <p className="mt-1 text-[12px] text-[#8B84A8]">
                {shown.length} {shown.length === 1 ? "variation" : "variations"}
                {query.trim() !== "" && " matching your search"}
              </p>
            </div>

            {shown.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#2A2250] px-6 py-14 text-center">
                <p className="text-[13px] text-[#A09AB8]">
                  Nothing matches “{query}”. Try a shorter search, or pick a group on the left.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {shown.map((item) => {
                  const v = item.variation;
                  const sample = sampleForPreview(v.previewSrc);
                  const inFunnel =
                    Boolean(sel[item.groupId]?.enabled) &&
                    sel[item.groupId]?.variation === v.number;

                  return (
                    <GalleryCard
                      key={`${item.groupId}-${v.number}`}
                      item={item}
                      inFunnel={inFunnel}
                      onCopy={() => copyPrompt(item.groupId, v.number)}
                      onToggle={() => toggleSection(item.groupId, v.number)}
                      onPreview={
                        sample
                          ? () =>
                              setLive({
                                heading: v.title,
                                items: [
                                  { id: `${item.groupId}-${v.number}`, title: v.title, sampleSrc: sample },
                                ],
                              })
                          : null
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <FunnelTray />

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </main>
  );
}
