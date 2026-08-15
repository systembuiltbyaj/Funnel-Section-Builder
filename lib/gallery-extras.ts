/**
 * The three browse-only collections, shaped like 10P groups so the gallery can
 * render them through the same filter and card code.
 *
 * They are not part of the 10P and cannot join a funnel: the tray assembles
 * sales-page sections, and an image prompt or a whole-page layout is not one.
 * `isExtraGroup` is what the gallery uses to withhold the add-to-funnel action.
 */

import { gptImageCards, carouselCards, localWebsiteCards } from "./section-catalogue.ts";
import type { GalleryGroup } from "./gallery-filter.ts";

export const EXTRA_GROUPS: GalleryGroup[] = [
  { id: "gptimage", label: "Image prompts", variations: gptImageCards },
  { id: "carousel", label: "Carousel", variations: carouselCards },
  { id: "local", label: "Full layouts", variations: localWebsiteCards },
];

const EXTRA_IDS = new Set(EXTRA_GROUPS.map((g) => g.id));

export function isExtraGroup(groupId: string | null): boolean {
  return groupId !== null && EXTRA_IDS.has(groupId);
}
