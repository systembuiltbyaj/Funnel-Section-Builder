"use client";

import { useMemo, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { flattenGroups, filterGallery } from "@/lib/gallery-filter";
import { EXTRA_GROUPS, isExtraGroup } from "@/lib/gallery-extras";
import { singleSectionPrompt } from "@/lib/single-section-prompt";
import { sampleForPreview, wireframeForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";
import { GalleryCard } from "./card";
import { FunnelTray } from "./tray";

export function Gallery({
  activeGroup,
  onSelectGroup,
  onBuild,
}: {
  activeGroup: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onBuild: () => void;
}) {
  const { sel, kit, toggleSection } = useFunnelSelection();
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);

  const items = useMemo(
    () => [...flattenGroups(PROMPT_GROUPS), ...flattenGroups(EXTRA_GROUPS)],
    []
  );
  const shown = useMemo(
    () => filterGallery(items, { groupId: activeGroup, query }),
    [items, activeGroup, query]
  );

  const activeGroupMeta =
    PROMPT_GROUPS.find((g) => g.id === activeGroup) ??
    EXTRA_GROUPS.find((g) => g.id === activeGroup) ??
    null;

  /**
   * One section's prompt, assembled through the same path the builder uses so a
   * single-section copy and a full-funnel build cannot drift apart.
   *
   * Returns the text rather than writing it to the clipboard: the write is
   * async and can fail (insecure origin, denied permission), and only the
   * card knows how to surface that failure in its own button state.
   *
   * Both group lists are passed because a card's groupId can be an Extras id
   * (gptimage/carousel/local), which does not exist in PROMPT_GROUPS.
   */
  function copyPrompt(groupId: string, variationNumber: string): string {
    return singleSectionPrompt([...PROMPT_GROUPS, ...EXTRA_GROUPS], groupId, variationNumber, kit);
  }

  return (
    <>
      <div className="mx-auto max-w-[1240px] px-4 pb-28">
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
                  Nothing matches “{query}”. Try a shorter search, or pick a group above.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectGroup(null)}
                  className="mt-3 rounded-md border border-[#2A2250] px-3 py-1.5 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                >
                  Show all sections
                </button>
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
                      onToggle={
                        isExtraGroup(item.groupId)
                          ? null
                          : () => toggleSection(item.groupId, v.number)
                      }
                      onPreview={
                        sample
                          ? () =>
                              setLive({
                                heading: v.title,
                                items: [
                                  {
                                    id: `${item.groupId}-${v.number}`,
                                    title: v.title,
                                    sampleSrc: sample,
                                    wireframeSrc: wireframeForPreview(v.previewSrc) ?? undefined,
                                  },
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

      <FunnelTray onBuild={onBuild} />

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </>
  );
}
