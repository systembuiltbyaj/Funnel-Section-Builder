"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";
import { sampleForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";

/**
 * What the analyzer proposed, section by section, with its reasoning.
 *
 * Every choice stays editable here — swap a variation, drop a section, or walk
 * away and pick the whole funnel by hand. The recommendation is a starting
 * point, not a verdict.
 */
export function ReviewPicks() {
  const router = useRouter();
  const { sel, kit, analysis, setSection } = useFunnelSelection();
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);

  const chosen = PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled);

  // Nothing to review — someone deep-linked here or cleared their selections.
  if (chosen.length === 0) {
    return (
      <div className="mx-auto max-w-[880px] px-4 pb-24">
        <div className="rounded-[14px] border border-dashed border-[#2A2250] px-6 py-10 text-center">
          <p className="mb-4 text-[13px] text-[#A09AB8]">
            There&apos;s nothing to review yet. Paste your funnel copy and run the analyzer, or
            pick sections yourself.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/"
              className="rounded-lg bg-[#7C5CFC] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
            >
              Start from copy
            </Link>
            <Link
              href="/sections"
              className="rounded-lg border border-[#2A2250] px-4 py-2.5 text-[12.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
            >
              Pick sections myself
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const previewAll = () => {
    const items: PreviewItem[] = [];
    for (const g of chosen) {
      const v = g.variations.find((x) => x.number === sel[g.id].variation) ?? g.variations[0];
      const src = sampleForPreview(v.previewSrc);
      if (src) items.push({ id: `${g.id}-${v.number}`, title: v.title, sampleSrc: src });
    }
    if (items.length) setLive({ heading: "Full funnel preview", items });
  };

  return (
    <div className="mx-auto max-w-[880px] px-4 pb-28">
      {analysis.meta && (analysis.meta.niche || analysis.meta.vibe) && (
        <div className="mb-4 flex flex-wrap gap-2 text-[11.5px]">
          {analysis.meta.niche && (
            <span className="rounded-full border border-[#2A2250] bg-[#12102A] px-3 py-1.5 text-[#A09AB8]">
              Niche · <span className="text-[#E8E4F5]">{analysis.meta.niche}</span>
            </span>
          )}
          {analysis.meta.vibe && (
            <span className="rounded-full border border-[#2A2250] bg-[#12102A] px-3 py-1.5 text-[#A09AB8]">
              Tone · <span className="text-[#E8E4F5]">{analysis.meta.vibe}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {chosen.map((g) => {
          const s = sel[g.id];
          const v = g.variations.find((x) => x.number === s.variation) ?? g.variations[0];
          const sample = sampleForPreview(v.previewSrc);
          const why = analysis.reasons[g.id];

          return (
            <div key={g.id} className="rounded-[14px] border border-[#2A2250] bg-[#12102A] p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold text-[#E8E4F5]">{g.label}</span>
                <select
                  value={s.variation}
                  onChange={(e) => setSection(g.id, { variation: e.target.value })}
                  className="ml-auto max-w-[62%] rounded-md border border-[#2A2250] bg-[#0B091A] px-2.5 py-1.5 text-[12px] text-[#E8E4F5] outline-none focus:border-[#7C5CFC]"
                >
                  {g.variations.map((opt) => (
                    <option key={opt.number} value={opt.number}>
                      {variationShortName(opt.title)} — {opt.description.slice(0, 54)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSection(g.id, { enabled: false })}
                  aria-label={`Remove ${g.label}`}
                  className="rounded-md border border-[#2A2250] px-2 py-1.5 text-[11px] text-[#5A5478] transition hover:border-[#F87171] hover:text-[#F87171]"
                >
                  Remove
                </button>
              </div>

              {why && (
                <p className="mb-3 flex gap-1.5 text-[11.5px] leading-[1.55]">
                  <span className="shrink-0 font-bold text-[#9B82FF]">Why this one:</span>
                  <span className="text-[#A09AB8]">{why}</span>
                </p>
              )}

              <div className="flex flex-wrap items-start gap-3">
                {v.previewSrc && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={v.previewSrc}
                    alt={`${v.title} preview`}
                    loading="lazy"
                    decoding="async"
                    className="w-[220px] shrink-0 rounded-md border border-[#2A2250] object-cover"
                  />
                )}
                <div className="min-w-[220px] flex-1">
                  <textarea
                    value={s.copy}
                    onChange={(e) => setSection(g.id, { copy: e.target.value })}
                    rows={4}
                    placeholder={`Copy for ${g.label}`}
                    className="w-full resize-y rounded-lg border border-[#2A2250] bg-[#0B091A] px-3 py-2.5 text-[12.5px] leading-[1.55] text-[#E8E4F5] outline-none focus:border-[#7C5CFC]"
                  />
                  {sample && (
                    <button
                      type="button"
                      onClick={() =>
                        setLive({
                          heading: v.title,
                          items: [{ id: `${g.id}-${v.number}`, title: v.title, sampleSrc: sample }],
                        })
                      }
                      className="mt-2 rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[11px] font-semibold text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                    >
                      ▶ Live preview
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#2A2250] bg-[#100C24]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] font-bold text-[#E8E4F5]">
            {chosen.length} section{chosen.length === 1 ? "" : "s"} recommended
          </span>
          <Link
            href="/sections"
            className="rounded-md border border-[#2A2250] px-3 py-2 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Choose sections myself
          </Link>
          <button
            type="button"
            onClick={previewAll}
            className="rounded-md border border-[#2A2250] px-3 py-2 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            ▶ Preview funnel
          </button>
          <button
            type="button"
            onClick={() => router.push("/build")}
            className="ml-auto rounded-md bg-[#F5C842] px-5 py-2.5 text-[12.5px] font-bold text-[#0D0B1F] transition hover:brightness-110"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Looks good — build it →
          </button>
        </div>
      </div>

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </div>
  );
}
