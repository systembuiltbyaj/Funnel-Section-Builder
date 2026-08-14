"use client";

import { PROMPT_GROUPS } from "@/lib/prompt-groups";

/**
 * The 10P as a filter rail.
 *
 * It filters rather than scroll-jumps: with 110 variations a single stacked page
 * is a very long scroll, and a rail that only jumps does not earn its width.
 */
export function GalleryRail({
  activeGroup,
  onSelect,
  pickedIds,
}: {
  activeGroup: string | null;
  onSelect: (groupId: string | null) => void;
  pickedIds: string[];
}) {
  const total = PROMPT_GROUPS.reduce((n, g) => n + g.variations.length, 0);

  return (
    <nav
      aria-label="10P framework"
      className="sticky top-4 hidden h-fit w-[164px] shrink-0 flex-col gap-0.5 md:flex"
    >
      <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A5478]">
        10P Framework
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={activeGroup === null ? "true" : undefined}
        className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
          activeGroup === null
            ? "bg-[#F5C842] font-bold text-[#0D0B1F]"
            : "text-[#A09AB8] hover:text-[#E8E4F5]"
        }`}
      >
        <span>All sections</span>
        <span className={activeGroup === null ? "opacity-65" : "text-[#5A5478]"}>{total}</span>
      </button>

      {PROMPT_GROUPS.map((g) => {
        const active = activeGroup === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            aria-current={active ? "true" : undefined}
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
              active ? "bg-[#F5C842] font-bold text-[#0D0B1F]" : "text-[#A09AB8] hover:text-[#E8E4F5]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{g.label}</span>
              {pickedIds.includes(g.id) && (
                <span className={active ? "text-[#0D0B1F]" : "text-[#7C5CFC]"}>●</span>
              )}
            </span>
            <span className={active ? "opacity-65" : "text-[#5A5478]"}>{g.variations.length}</span>
          </button>
        );
      })}
    </nav>
  );
}
