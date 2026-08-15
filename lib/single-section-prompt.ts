// Single-section prompt assembly — pure, testable, no JSX.
//
// Extracted out of app/gallery/gallery.tsx so the bare `node --test` runner
// (which cannot load .tsx) can cover it. This is the exact defect that let the
// Extras cards silently copy an empty string: gallery.tsx used to call
// buildOutputs with PROMPT_GROUPS only, so a groupId from EXTRA_GROUPS
// (gptimage/carousel/local) never matched anything and `blocks` came back `[]`.
// Callers must now pass every group list the groupId might belong to.

import { buildOutputs } from "./prompt-assembly.ts";
import type { FunnelBrandKit } from "./prompt-assembly.ts";
import type { GalleryGroup } from "./gallery-filter.ts";

/**
 * One section's prompt, assembled through the same path the full-funnel
 * builder uses so a single-section copy and a full-funnel build cannot drift
 * apart. `groups` must include whichever group list `groupId` actually lives
 * in — pass both PROMPT_GROUPS and EXTRA_GROUPS so extras resolve too.
 *
 * Returns "" if groupId/variationNumber do not match anything in `groups`.
 */
export function singleSectionPrompt(
  groups: readonly GalleryGroup[],
  groupId: string,
  variationNumber: string,
  kit: FunnelBrandKit
): string {
  const { blocks } = buildOutputs({
    groups: [...groups],
    sel: { [groupId]: { enabled: true, variation: variationNumber, copy: "" } },
    kit,
    includeRef: true,
  });
  return blocks.map((b) => `${b.heading}\n${b.text}`).join("\n\n");
}
