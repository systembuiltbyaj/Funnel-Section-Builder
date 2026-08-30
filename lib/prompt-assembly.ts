// Prompt assembly — data only, no JSX.
//
// This is a verbatim extraction of the prompt-building logic that used to live
// inside the `FunnelBuilder` component in app/private-content.tsx. It was moved
// here, unedited, so it can be unit- and snapshot-tested: `prompt-assembly.fixture.test.ts`
// pins the exact text this module generates for the real section catalogue, so any
// later refactor (e.g. moving where the builder's state lives) can be proven not to
// have changed a single character of a generated prompt.

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
 * What replaces the per-section copy block.
 *
 * The builder is a layout picker and collects no copy, so the model has to
 * supply its own. The previous empty block (`— COPY —\n______`) told it
 * nothing and produced blank slots or lorem ipsum; naming the job explicitly
 * produces a section that reads like a real page.
 */
export const PLACEHOLDER_COPY_RULE =
  "— COPY —\n" +
  "No client copy is supplied. Write realistic, conversion-focused placeholder copy " +
  "that fits this section's purpose and the funnel's apparent niche: headline, " +
  "subhead, body, CTA label, and any names, labels or list items the layout needs. " +
  "Keep it specific and on-tone. Never lorem ipsum, never empty slots, never " +
  "literal underscores.";

export function buildOutputs(args: {
  groups: PromptGroup[];
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  includeRef: boolean;
}): { blocks: PromptBlock[]; full: string | null } {
  const { groups: builderGroups, sel, includeRef } = args;
  const { primary, background, fontHead, fontSub, fontBody, images } = args.kit;

  const bar = "=".repeat(60);
  const hasColors = primary.trim().length > 0 || background.trim().length > 0;
  const hasFonts = fontHead.trim().length > 0 || fontSub.trim().length > 0 || fontBody.trim().length > 0;
  const hasBrand = hasColors || hasFonts;

  const colorBlock = hasColors
    ? `— BRAND COLORS (2-color kit — derive every supporting shade from these) —\n` +
      `Primary / accent: ${primary.trim() || "(pick one)"}\n` +
      `Background / base: ${background.trim() || "(pick one)"}\n` +
      `Derive on-brand from the two colors above: text, muted text, cards/surfaces, borders, hovers and gradients ` +
      `(use tints/shades of the brand colors + neutral white/black/grey). Use the primary for CTAs, links and highlights; ` +
      `the background as the page base. Do NOT introduce any unrelated hue.`
    : "";
  const fontBlock = hasFonts
    ? `— FONTS · MANDATORY (load via a Google Fonts <link>; set as CSS variables and apply to EVERY text element) —\n` +
      `Headline font: ${fontHead.trim() || "(strong display font)"}  → ALL H1/H2 and section titles\n` +
      `Subheadline font: ${fontSub.trim() || "(use the body or headline font)"}  → eyebrows, sub-headings, labels\n` +
      `Body font: ${fontBody.trim() || "(clean readable sans)"}  → paragraphs, lists, buttons, nav, all UI text\n` +
      `Use ONLY these fonts. IGNORE every other font named anywhere in the spec (e.g. Inter, Playfair Display, Cormorant Garamond, DM Sans, Manrope, Montserrat, Space Grotesk) — those are placeholders.`
    : "";

  // Authoritative brand kit — leads the prompt so the building AI applies it
  // instead of the variation's illustrative example palette.
  const brandKit = hasBrand
    ? `╔══ BRAND KIT — AUTHORITATIVE · OVERRIDES EVERY COLOR & FONT BELOW ══╗\n` +
      `RULE: The spec below names specific colors and fonts (e.g. Inter, Playfair Display,\n` +
      `Cormorant Garamond, DM Sans, Manrope, Montserrat, Space Grotesk) — treat EVERY one of\n` +
      `them as an illustrative placeholder ONLY. IGNORE those font names entirely and use the\n` +
      `BRAND KIT fonts below for ALL text. Re-skin the ENTIRE section in this brand kit:\n` +
      `backgrounds, text, accents, buttons, borders, gradients, hovers — every color and font.\n` +
      `Keep the spec's LAYOUT, STRUCTURE and ANIMATIONS exactly; change only palette + typography to this:\n\n` +
      `${colorBlock ? colorBlock + "\n\n" : ""}` +
      `${fontBlock ? fontBlock + "\n" : ""}` +
      `${images.trim() ? `\n— IMAGES / LOGO —\n${images.trim()}\n` : ""}` +
      `╚${"═".repeat(66)}╝\n\n`
    : "";

  const blocks: { id: string; heading: string; sub: string; text: string }[] = [];
  for (const g of builderGroups) {
    const s = sel[g.id];
    if (!s?.enabled) continue;
    const v = g.variations.find((x) => x.number === s.variation) ?? g.variations[0];
    const secNum = (v.number.match(/^\d+/) || ["?"])[0];
    const vName = variationShortName(v.title);
    const heading = `SECTION ${secNum} · ${g.label} — ${vName}`;

    let text: string;
    if (hasBrand) {
      text =
        brandKit +
        `${bar}\n${heading}\n${v.description}\n${bar}\n\n${v.basePrompt}\n\n` +
        PLACEHOLDER_COPY_RULE;
      if (includeRef) {
        const stripLabels = [...(hasColors ? ["BRAND COLORS"] : []), ...(hasFonts ? ["FONTS"] : [])];
        text +=
          `\n\n──────── REFERENCE · layout & copy-slot guide (palette removed — use the BRAND KIT above) ────────\n` +
          stripBrandBlocks(v.varsPrompt, stripLabels);
      }
    } else {
      const clientVars =
        `=== CLIENT VARIABLES — USE THESE (override any example values in the spec above) ===\n\n` +
        `— BRAND COLORS —\n______\n\n` +
        `— FONTS —\n______\n\n` +
        `— IMAGES —\nUse placeholder images first, then swap for the real assets.\n${
          images.trim() || "(no image notes — keep the section's built-in placeholder images)"
        }\n\n` +
        PLACEHOLDER_COPY_RULE;
      text = `${bar}\n${heading}\n${v.description}\n${bar}\n\n${v.basePrompt}\n\n${clientVars}`;
      if (includeRef) {
        text +=
          `\n\n──────── REFERENCE · original variation example (format guide only) ────────\n` +
          v.varsPrompt;
      }
    }
    blocks.push({ id: g.id, heading, sub: v.description, text });
  }

  // Combined master prompt → ONE single HTML page (full funnel)
  const ordered = builderGroups.filter((g) => sel[g.id]?.enabled);
  if (ordered.length === 0) {
    return { blocks, full: null as string | null };
  }
  const kitLines =
    (colorBlock || `— BRAND COLORS —\n(choose one clean, conversion-friendly palette and use it throughout)`) +
    `\n\n` +
    (fontBlock || `— FONTS —\n(choose 1–2 Google Fonts and use them throughout)`) +
    `\n${images.trim() ? `\n— IMAGES / LOGO —\n${images.trim()}\n` : ""}`;
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
      `${PLACEHOLDER_COPY_RULE}\n`;
  });
  full +=
    `\n=== ASSEMBLY ===\n` +
    `Output the complete single HTML file now: all ${ordered.length} sections in order, sharing one brand kit and design system, fully responsive and animated. Nothing else.`;
  return { blocks, full: full as string | null };
}
