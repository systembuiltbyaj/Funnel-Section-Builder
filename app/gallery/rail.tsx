"use client";

import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { EXTRA_GROUPS } from "@/lib/gallery-extras";

const PILL_BASE = "shrink-0 rounded-full px-3 py-1.5 text-[12px] transition whitespace-nowrap";

/**
 * The 10P as a horizontal pill bar, with the builder as its first pill.
 *
 * Horizontal rather than a sidebar because the builder and the library are one
 * page again: the bar is the page's primary navigation, not a filter bolted to
 * the side of a grid. It filters rather than scroll-jumps — with 174 variations
 * a single stacked page is a very long scroll.
 */
export function GalleryRail({
  activeGroup,
  builderActive,
  onSelect,
  onSelectBuilder,
  pickedIds,
}: {
  activeGroup: string | null;
  builderActive: boolean;
  onSelect: (groupId: string | null) => void;
  onSelectBuilder: () => void;
  pickedIds: string[];
}) {
  const total =
    PROMPT_GROUPS.reduce((n, g) => n + g.variations.length, 0) +
    EXTRA_GROUPS.reduce((n, g) => n + g.variations.length, 0);

  return (
    <nav
      aria-label="Funnel builder and the 10P framework"
      className="mx-auto mb-6 flex max-w-[1240px] gap-1.5 overflow-x-auto px-4 pb-1"
    >
      <button
        type="button"
        onClick={onSelectBuilder}
        aria-current={builderActive ? "true" : undefined}
        className={`${PILL_BASE} font-bold ${
          builderActive
            ? "bg-[#7C5CFC] text-white"
            : "border border-[#2A2250] text-[#A09AB8] hover:text-[#E8E4F5]"
        }`}
      >
        🧩 Funnel Builder
      </button>

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={!builderActive && activeGroup === null ? "true" : undefined}
        className={`${PILL_BASE} ${
          !builderActive && activeGroup === null
            ? "bg-[#F5C842] font-bold text-[#0D0B1F]"
            : "border border-[#2A2250] text-[#A09AB8] hover:text-[#E8E4F5]"
        }`}
      >
        All sections <span className="opacity-65">{total}</span>
      </button>

      {[...PROMPT_GROUPS, ...EXTRA_GROUPS].map((g) => {
        const active = !builderActive && activeGroup === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            aria-current={active ? "true" : undefined}
            className={`${PILL_BASE} ${
              active
                ? "bg-[#F5C842] font-bold text-[#0D0B1F]"
                : "border border-[#2A2250] text-[#A09AB8] hover:text-[#E8E4F5]"
            }`}
          >
            {g.label}
            {pickedIds.includes(g.id) && (
              <span className={active ? "text-[#0D0B1F]" : "text-[#7C5CFC]"}> ●</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
