/**
 * The wireframe contract — what a generated section looks like.
 *
 * This tool outputs a skeleton, not a finished page: structure is the product,
 * and copy, images and brand colour belong to the client. Shared by the gallery
 * asset script (`scripts/build-wireframes.mjs`) and by the app's own output, so
 * a preview and the thing you actually generate cannot drift apart.
 */

import type { FunnelBrandKit } from "./prompt-assembly.ts";

/**
 * A deliberately colourless brand kit.
 *
 * `resolveTokens` derives every shade from these two, so a neutral accent on a
 * white ground yields a fully greyscale token block with no special-casing in
 * the design-token module.
 */
export const WIREFRAME_KIT: FunnelBrandKit = {
  primary: "#3F3F46",
  background: "#FFFFFF",
  fontHead: "Inter",
  fontSub: "Inter",
  fontBody: "Inter",
  images: "",
};

export const WIREFRAME_RULE = `
=== RENDER AS A DESIGNED WIREFRAME (overrides the CONTENT rule above) ===
This file is a WIREFRAME shown as a gallery thumbnail. Someone is choosing a
LAYOUT from it at a glance. Readability beats fill-in-ability here.

TEXT — plain English placeholders, NOT bracket labels:
- Do NOT output "[HEADLINE — 6-9 words, core promise]" style brackets anywhere.
- Headline: "Main Headline Goes Here" (or "Section Headline Goes Here").
- Eyebrow / kicker: "EYEBROW / TAGLINE" in small uppercase, in a soft grey pill.
- Subhead / body: a real sentence describing its own job, e.g. "A short and
  clear value proposition that explains your offer and the main benefit."
- Buttons: "Primary CTA →" and "Secondary CTA".
- Repeating items: "Feature 1" / "Short benefit here", "Step 1", "Testimonial 1",
  "Question 1 goes here" — numbered so the repetition is obvious.
- Small print: "Optional small text (e.g. no credit card required)".
- Social proof: "Trusted by 1,000+ business owners" with "Short testimonial or
  social proof." beneath it.

GRAPHICS — draw them, do not leave empty boxes:
- Hero/product media: draw a simple laptop or browser frame in flat grey CSS,
  and inside it centre a small inline-SVG photo glyph (a rounded rect with a
  circle and a mountain triangle) above the words "PRODUCT / DASHBOARD PREVIEW
  OR HERO IMAGE" in small uppercase grey.
- Other images: a light grey rounded box with the same photo glyph and a short
  uppercase caption of what belongs there.
- Feature/step icons: a grey circle with a simple inline-SVG glyph inside
  (bolt, shield, bar-chart, people). Never an emoji, never a letter.
- Avatars: a row of overlapping plain grey circles.
- Logos: plain grey rounded rectangles, no text inside.
- Add one or two very soft light-grey blob shapes (large border-radius circles
  at low opacity) behind the media as background decoration.

ANNOTATIONS — 1 to 2 per section, no more:
- Add short handwritten-style notes in the margin pointing at the most important
  element, e.g. "Show your product, dashboard, or a relevant hero image here."
- Style them with font-family: 'Segoe Script','Bradley Hand',cursive, in mid
  grey, ~13px, and draw a curved arrow to their target with an inline SVG path.
- Position them absolutely inside a position:relative wrapper so they never
  overlap real content. If the section is narrow or dense, omit them.

STYLE:
- Greyscale only, using the given tokens. No brand colour, no photographs, no
  stock URLs, no gradients beyond a flat tint.
- Keep the layout, column structure, order and hierarchy of the spec exactly —
  the wireframe must be recognisably the same arrangement as the real section.
- Generous whitespace, 1px light-grey rules, consistent small radius, and a
  clear type hierarchy: headline large and near-black, body mid-grey, labels
  small uppercase.
- Give the section a light background (#fff or #fafafa), never a dark one.
- Output markup only. Do NOT prefix the fragment with /* … */ notes.

FIT — the wireframe is screenshotted at exactly 1280x800 for a gallery card:
- It MUST NOT scroll horizontally at 1280px. Measured on the first run: 10 of
  100 overflowed, and the card crops whatever sticks out. Give the section
  \`box-sizing: border-box\` and \`overflow-x: hidden\`, cap any inner container at
  \`max-width: 1200px; margin: 0 auto\`, and let grids wrap rather than forcing a
  row wider than the viewport. Absolutely-positioned annotations must sit INSIDE
  that container, never past its right edge.
- The section must END where its content ends. No \`min-height: 100vh\`, no tall
  trailing padding, no empty spacer rows — one wireframe shipped 240px of blank
  white below its last card, which reads as a broken screenshot.
- The most important content — headline, CTA, the structure that distinguishes
  this variation — belongs in the TOP 800px, because that is all the thumbnail
  shows.`;
