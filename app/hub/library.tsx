"use client";

import { useEffect, useRef, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";
import { sampleForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";

/**
 * The section catalogue, presented in 10P funnel order.
 *
 * Ordering is the teaching device: scrolling the page walks a reader through
 * the framework in the same sequence the builder asks for sections, so the
 * structure is learned without being explained.
 */
export function SectionLibrary() {
  const { sel, kit, toggleSection } = useFunnelSelection();
  const [activeId, setActiveId] = useState(PROMPT_GROUPS[0]?.id ?? "");
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  // Active stage is driven by what is actually on screen. Scroll arithmetic
  // breaks as soon as rows have different heights, which they do.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id.replace("group-", ""));
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    rowRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mx-auto flex max-w-[1200px] gap-6 px-4 py-6">
      <nav
        aria-label="Funnel stages"
        className="sticky top-6 hidden h-fit w-[158px] shrink-0 flex-col gap-0.5 md:flex"
      >
        <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A5478]">
          10P Framework
        </div>
        {PROMPT_GROUPS.map((g, i) => {
          const count = Object.values(sel).length && sel[g.id]?.enabled ? 1 : 0;
          return (
            <a
              key={g.id}
              href={`#group-${g.id}`}
              aria-current={activeId === g.id ? "true" : undefined}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11.5px] transition ${
                activeId === g.id
                  ? "bg-[#1A1540] font-semibold text-[#E8E4F5]"
                  : "text-[#5A5478] hover:text-[#A09AB8]"
              }`}
            >
              <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate">{g.label}</span>
              {count > 0 && <span className="ml-auto text-[#7C5CFC]">●</span>}
            </a>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {PROMPT_GROUPS.map((g, i) => (
          <div
            key={g.id}
            id={`group-${g.id}`}
            ref={(el) => {
              if (el) rowRefs.current.set(g.id, el);
              else rowRefs.current.delete(g.id);
            }}
            className="mb-9 scroll-mt-6"
          >
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A09AB8]">
                {String(i + 1).padStart(2, "0")} · {g.label}
              </span>
              <span className="text-[11px] text-[#5A5478]">
                {g.variations.length} variation{g.variations.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {g.variations.map((v) => {
                const active = sel[g.id]?.enabled && sel[g.id]?.variation === v.number;
                const sample = sampleForPreview(v.previewSrc);
                return (
                  <div
                    key={v.number}
                    className={`w-[228px] shrink-0 overflow-hidden rounded-lg border bg-[#0B091A] transition ${
                      active ? "border-[#7C5CFC]" : "border-[#2A2250] hover:border-[#4A3A8A]"
                    }`}
                  >
                    {v.previewSrc && (
                      /* Plain img, not next/image: 110+ thumbnails already pass
                         unoptimized, so the wrapper buys nothing here. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={v.previewSrc}
                        alt={`${v.title} thumbnail`}
                        loading="lazy"
                        decoding="async"
                        className="block aspect-[2/1] w-full object-cover"
                      />
                    )}
                    <div className="p-2.5">
                      <div className="mb-2 truncate text-[12px] font-semibold text-[#E8E4F5]" title={v.title}>
                        {variationShortName(v.title)}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSection(g.id, v.number)}
                          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                            active
                              ? "bg-[#7C5CFC] text-white"
                              : "border border-[#2A2250] text-[#A09AB8] hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                          }`}
                        >
                          {active ? "✓ Added" : "+ Add"}
                        </button>
                        {sample && (
                          <button
                            type="button"
                            onClick={() =>
                              setLive({
                                heading: v.title,
                                items: [{ id: `${g.id}-${v.number}`, title: v.title, sampleSrc: sample }],
                              })
                            }
                            aria-label={`Live preview ${v.title}`}
                            title="Live preview"
                            className="rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[11px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </section>
  );
}
