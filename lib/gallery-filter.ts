/**
 * Filtering for the public gallery.
 *
 * Kept as pure functions in `lib/` rather than inside the component because the
 * test runner is bare `node --test` with type stripping — it cannot load .tsx.
 * Logic that lives here is testable; logic that lives in the component is not.
 *
 * Types against `Section`, not `PromptVariation`: PROMPT_GROUPS is declared with
 * `satisfies`, so its variations keep the full Section type including
 * `previewSrc`. Typing against PromptVariation would silently drop thumbnails.
 */

import type { Section } from "./section-catalogue.ts";

export type GalleryGroup = { id: string; label: string; variations: Section[] };

export type GalleryItem = {
  groupId: string;
  groupLabel: string;
  variation: Section;
};

/** One flat list of every variation, each remembering the group it came from. */
export function flattenGroups(groups: readonly GalleryGroup[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const group of groups) {
    for (const variation of group.variations) {
      items.push({ groupId: group.id, groupLabel: group.label, variation });
    }
  }
  return items;
}

/** Everything a free-text query is matched against, lowercased once. */
function haystack(item: GalleryItem): string {
  const v = item.variation;
  return `${v.title} ${v.description} ${v.number} ${item.groupLabel}`.toLowerCase();
}

export function filterGallery(
  items: readonly GalleryItem[],
  opts: { groupId: string | null; query: string }
): GalleryItem[] {
  const query = opts.query.trim().toLowerCase();
  return items.filter((item) => {
    if (opts.groupId !== null && item.groupId !== opts.groupId) return false;
    if (query === "") return true;
    return haystack(item).includes(query);
  });
}
