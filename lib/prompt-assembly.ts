// Prompt assembly — data only, no JSX.
//
// This is a verbatim extraction of the prompt-building logic that used to live
// inside the `FunnelBuilder` component in app/private-content.tsx. It was moved
// here, unedited, so it can be unit- and snapshot-tested: `prompt-assembly.fixture.test.ts`
// pins the exact text this module generates for the real section catalogue, so any
// later refactor (e.g. moving where the builder's state lives) can be proven not to
// have changed a single character of a generated prompt.

import { WIREFRAME_RULE } from "./wireframe-rule.ts";

export type BuilderSelection = { enabled: boolean; variation: string };

// Named FunnelBrandKit, NOT BrandKit: lib/samples.ts already exports a `BrandKit`
// (5 optional fields, used for preview re-skinning). Two same-named exported types
// is a footgun. This one has 6 required fields and includes `images`.
// It is structurally assignable to samples.BrandKit, so it can be passed to
// LivePreview directly.
export type FunnelBrandKit = {
  primary: string;
  background: string;
  fontHead: string;
  fontSub: string;
  fontBody: string;
  images: string;
};

export type PromptVariation = {
  number: string;
  title: string;
  description: string;
  basePrompt: string;
  varsPrompt: string;
};

export type PromptGroup = { id: string; label: string; variations: PromptVariation[] };

export type PromptBlock = { id: string; heading: string; sub: string; text: string };

export function variationShortName(title: string) {
  const m = title.match(/Variation\s*\d+/i);
  return m ? m[0] : title;
}

// Remove labeled blocks (e.g. "— BRAND COLORS —", "— FONTS —") from a varsPrompt
// so the variation's original palette can't compete with the client's brand kit.
export function stripBrandBlocks(vars: string, labels: string[]): string {
  if (labels.length === 0) return vars;
  const upper = labels.map((l) => l.toUpperCase());
  const out: string[] = [];
  let skipping = false;
  for (const line of vars.split("\n")) {
    const t = line.trim();
    const isHeader = t.startsWith("—") && t.endsWith("—");
    if (isHeader) {
      const name = t.replace(/—/g, "").trim().toUpperCase();
      skipping = upper.some((l) => name.startsWith(l));
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Adapt a per-file section basePrompt for single-page assembly:
// drop the intro + the "=== OUTPUT ===" (single-file) block + the trailing build line.
export function sectionSpecForCombined(base: string): string {
  let t = base;
  const firstHeader = t.indexOf("=== ");
  if (firstHeader > 0) t = t.slice(firstHeader);
  t = t.replace(/=== OUTPUT ===[\s\S]*?(?=\n=== )/, "");
  t = t.replace(/\n*Build the complete file now\.?\s*$/i, "");
  return t.trim();
}

/**
 * The content contract for every generated section.
 *
 * This tool outputs a layout skeleton, not a finished page: structure and
 * design are the product, while copy, images and brand colours belong to the
 * client. So the model is told to leave labelled slots rather than to invent
 * content.
 *
 * Labelled slots rather than bare `______` on purpose. A blank tells the model
 * nothing about what belongs there, so it either guesses or leaves a gap that
 * collapses the layout; a label carries the brief AND stays unmistakably not
 * real copy. Keeping every slot bracketed and on one line is what makes
 * "find every `[`" a workable fill-in pass.
 */
export const CONTENT_SLOT_RULE =
  "— CONTENT: LEAVE SLOTS, DO NOT WRITE COPY —\n" +
  "This is a layout skeleton. The client supplies all content later.\n" +
  "Write NO real copy and invent NO images.\n\n" +
  "- Every text slot: [LABEL — what belongs there, and how long]\n" +
  "  e.g. [HEADLINE — 6-9 words, the core promise]  [CTA — 2-4 words]\n" +
  "- Every image: a CSS placeholder box whose only content is\n" +
  "  [IMAGE 16:9 — what it should show]. Never a stock URL, never an\n" +
  "  <img src> pointing at a real file.\n" +
  "- Repeating items get numbered slots — [TESTIMONIAL 1 — 1-2 sentences],\n" +
  "  [TESTIMONIAL 2 — …] — so each can be filled independently.\n" +
  '- Keep each slot on one line, so a find-and-replace on "[" catches every one.\n' +
  "- Real words are still required for structural furniture: nav labels,\n" +
  '  "Read more", form field labels. Those are layout, not copy.';

/**
 * Palette instruction for when the user supplied no brand colours.
 *
 * The previous wording asked the model to "choose one clean, conversion-friendly
 * palette", which is the model picking a client's brand for them. Colour is the
 * client's to own, so an empty kit ships monochrome behind CSS variables.
 */
const NEUTRAL_PALETTE_RULE =
  "— BRAND COLORS —\n" +
  "None supplied — the client owns the palette. Do NOT choose a brand colour.\n" +
  "Define every colour once as a CSS custom property on :root and use only\n" +
  "those variables throughout, so swapping the palette is a four-line edit:\n" +
  "  --brand   /* accent: CTAs, links, highlights — a neutral grey for now */\n" +
  "  --bg      /* page base */\n" +
  "  --surface /* cards and raised panels */\n" +
  "  --text    /* body text — TEXT ONLY, never a background */\n" +
  "Ship it monochrome. A borrowed accent colour reads as a mistake.";

export function buildOutputs(args: {
  groups: PromptGroup[];
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  includeRef: boolean;
}): { blocks: PromptBlock[]; full: string | null } {
  const { groups: builderGroups, sel, includeRef } = args;

  const bar = "=".repeat(60);

  // The brand kit no longer shapes the output. This tool emits a WIREFRAME —
  // structure only — so colour, type and imagery are the client's to apply
  // afterwards. The kit is still collected because the gallery's Design preview
  // re-skins the sample with it; it simply never reaches a generated prompt.
  const blocks: { id: string; heading: string; sub: string; text: string }[] = [];
  for (const g of builderGroups) {
    const s = sel[g.id];
    if (!s?.enabled) continue;
    const v = g.variations.find((x) => x.number === s.variation) ?? g.variations[0];
    const secNum = (v.number.match(/^\d+/) || ["?"])[0];
    const vName = variationShortName(v.title);
    const heading = `SECTION ${secNum} · ${g.label} — ${vName}`;

    const clientVars =
      `=== CLIENT VARIABLES — USE THESE (override any example values in the spec above) ===\n\n` +
      `${NEUTRAL_PALETTE_RULE}\n\n` +
      `— FONTS —\nNone supplied. Use one clean system font stack behind a CSS variable; do not pick a display font for the client.\n\n` +
      `— IMAGES —\nEvery image is a labelled placeholder box. Use no photographs.\n\n` +
      CONTENT_SLOT_RULE +
      WIREFRAME_RULE;
    let text = `${bar}\n${heading}\n${v.description}\n${bar}\n\n${v.basePrompt}\n\n${clientVars}`;
    if (includeRef) {
      text +=
        `\n\n──────── REFERENCE · original variation example (format guide only) ────────\n` +
        v.varsPrompt;
    }

    blocks.push({ id: g.id, heading, sub: v.description, text });
  }

  // Combined master prompt → ONE single HTML page (full funnel)
  const ordered = builderGroups.filter((g) => sel[g.id]?.enabled);
  if (ordered.length === 0) {
    return { blocks, full: null as string | null };
  }
  const kitLines =
    NEUTRAL_PALETTE_RULE +
    `\n\n` +
    `— FONTS —\nNone supplied. Use one clean system font stack behind CSS variables; do not pick a display font for the client.\n`;
  let full =
    `You are an expert frontend developer and funnel designer.\n\n` +
    `Build ONE complete, production-ready, single-file HTML landing page — the FULL funnel — by stacking the ${ordered.length} sections below IN THE GIVEN ORDER.\n\n` +
    `=== GLOBAL OUTPUT RULES ===\n` +
    `- Output ONE standalone HTML file. ALL CSS in a single <style>; ALL JS in a single <script>.\n` +
    `- No frameworks. Load every Google Font used once via <link>.\n` +
    `- ONE cohesive design system across every section: shared CSS variables (the brand kit), consistent buttons, spacing scale and section padding.\n` +
    `- Each section is a full-width <section> stacked top → bottom in order; the page must read as one continuous funnel.\n` +
    `- Fully responsive (breakpoint 768px), accessible, smooth-scrolling. Use IntersectionObserver for scroll animations.\n` +
    `- The section specs below were each originally written as standalone blocks — IGNORE any "output one file", "standalone", "File: …" or "Build the complete file now" wording inside them. They are section requirements only.\n\n` +
    `=== BRAND KIT — AUTHORITATIVE · applies to EVERY section ===\n` +
    `Render the ENTIRE page in this kit. Treat any colors/fonts named inside the section specs as illustrative placeholders and replace them with this kit:\n\n` +
    kitLines +
    `\n=== SECTIONS (build in this exact order) ===\n`;
  ordered.forEach((g, i) => {
    const s = sel[g.id];
    const v = g.variations.find((x) => x.number === s.variation) ?? g.variations[0];
    full +=
      `\n${"-".repeat(58)}\n` +
      `SECTION ${i + 1} — ${g.label} · ${variationShortName(v.title)} (${v.description})\n` +
      `${"-".repeat(58)}\n\n` +
      `${sectionSpecForCombined(v.basePrompt)}\n\n` +
      `${CONTENT_SLOT_RULE}\n`;
  });
  full +=
    WIREFRAME_RULE +
    `\n\n=== ASSEMBLY ===\n` +
    `Output the complete single HTML file now: all ${ordered.length} sections in order, sharing one greyscale wireframe system, fully responsive. Nothing else.`;
  return { blocks, full: full as string | null };
}
