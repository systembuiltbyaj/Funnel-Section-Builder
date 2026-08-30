/**
 * The message sent to the model for ONE section.
 *
 * Pure and testable on purpose: route handlers cannot be unit-tested here (the
 * bare `node --test` runner loads neither `.tsx` nor the `@/` alias), so the
 * part worth getting right — what we actually ask for — lives out here.
 *
 * Two things this is careful about:
 *
 * 1. It reuses `sectionSpecForCombined()`, the same transformation the
 *    full-funnel master prompt applies per section. That strips the
 *    "build the complete file now" boilerplate out of `basePrompt`, which
 *    would otherwise fight the fragment-only instruction and produce a whole
 *    document we then have to salvage.
 * 2. No client prose reaches the model at all. The builder is a layout picker,
 *    so the only text in this prompt is the catalogue's own spec plus our
 *    instruction to invent placeholder copy. That removes the prompt-injection
 *    surface a pasted sales page used to carry.
 */

import { sectionSpecForCombined, CONTENT_SLOT_RULE } from "./prompt-assembly.ts";
import type { Section } from "./section-catalogue.ts";

export const SYSTEM_PROMPT = `You are a senior frontend developer building one section of a landing page.

Return exactly one HTML section fragment and nothing else.

OUTPUT RULES — these are absolute:
- Output an optional <style> block followed by exactly one <section> element.
- NEVER output <!DOCTYPE>, <html>, <head> or <body>. The fragment is stitched into a page that already has them.
- No markdown, no code fences, no commentary before or after.

STYLING RULES:
- Use ONLY the CSS custom properties given to you. Do not invent colours, fonts or hex values.
- Respect each token's ROLE, which is written beside it. The two that are always wrong to
  misuse: --text and --muted are TEXT COLOURS and must never be a background; --bg and
  --surface are the only backgrounds that exist. Using --text as a panel fill produces
  white-on-white and an unreadable section.
- Every rule you write must be scoped beneath one unique class on the <section>, so sections cannot collide.
- Responsive down to 360px. Use relative units.
- No external stylesheets, scripts, frameworks or network requests of any kind.
- The page already sets background: var(--bg) on the body. Do NOT give the section a
  different background unless the spec asks for a contrasting band — and if it does,
  use var(--surface). Never a literal colour, and never a light background on a dark
  palette. A section that fights the page background is a broken section.
- If an image is needed, draw a CSS placeholder block whose only content is a labelled
  slot such as [IMAGE 16:9 — coach on stage]. NEVER emit a bare token such as
  url('BG_IMAGE') or src="VIDEO_THUMB", and never link a real or stock image URL —
  both resolve to nothing and render as a broken image.
- This is a layout skeleton, so you write NO real copy. Every headline, subhead, body
  line, CTA label and list item is a labelled slot on one line, e.g.
  [HEADLINE — 6-9 words, the core promise]. Structural furniture (nav labels, form
  field labels, "Read more") stays real words — that is layout, not copy.

LENGTH — this is a hard constraint, not a preference:
- Keep the whole fragment under 160 lines. Favour a few well-chosen rules over exhaustive ones.
- Do not restate a rule that the shared tokens already cover.
- If the section is a list (FAQ, features, testimonials, pricing tiers), include at most 6 items.
  The client can duplicate one; they cannot recover a section that was cut off.
- A section that runs long gets cut off mid-tag and is thrown away, so brevity is correctness here.`;

export function buildSectionGenerationPrompt(args: {
  variation: Section;
  tokenBlock: string;
}): string {
  const { variation, tokenBlock } = args;
  const spec = sectionSpecForCombined(variation.basePrompt);

  return [
    "=== DESIGN TOKENS (the only colours and fonts you may use) ===",
    tokenBlock,
    "",
    `=== SECTION TO BUILD: ${variation.label} — ${variation.title} ===`,
    spec,
    "",
    CONTENT_SLOT_RULE,
    "",
    "Output the section fragment now.",
  ].join("\n");
}
