import { sections } from "./section-catalogue.ts";
import type { PromptGroup } from "./prompt-assembly.ts";

/**
 * The catalogue grouped by section id, preserving the order the sections
 * array declares — which is 10P funnel order. Both the builder and the hub
 * library render from this, so they cannot drift apart.
 */
// `satisfies` (not `: PromptGroup[]`) so PROMPT_GROUPS keeps its full inferred
// type — groups of the real Section, with previewSrc/funnelTypes intact — while
// still being verified structurally compatible with the narrower PromptGroup
// shape that lib/prompt-assembly.ts consumes.
export const PROMPT_GROUPS = (() => {
  const order: string[] = [];
  const byId = new Map<string, typeof sections>();
  for (const s of sections) {
    if (s.basePrompt.trim().toLowerCase().startsWith("coming soon")) continue;
    if (!byId.has(s.id)) {
      byId.set(s.id, []);
      order.push(s.id);
    }
    byId.get(s.id)!.push(s);
  }
  // Explicit funnel order rather than "order first seen in the array".
  // Merging groups (before/after into Features, urgency into Final CTA) would
  // otherwise place the merged group wherever its FIRST member happened to sit,
  // which is not where it belongs in the funnel. Ids missing from this list
  // fall to the end in array order, so adding a group cannot silently vanish.
  const FUNNEL_ORDER = [
    "hero",
    "authority",
    "empathy",
    "opportunity",
    "usp",
    "social",
    "offer",
    "faq",
    "risk",
    "footer",
  ];
  const rank = (id: string) => {
    const i = FUNNEL_ORDER.indexOf(id);
    return i === -1 ? FUNNEL_ORDER.length + order.indexOf(id) : i;
  };

  return order
    .slice()
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => ({ id, label: byId.get(id)![0].label, variations: byId.get(id)! }));
})() satisfies PromptGroup[];
