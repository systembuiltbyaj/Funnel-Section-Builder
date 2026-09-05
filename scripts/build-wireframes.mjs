/**
 * Regenerate the greyscale wireframe sample for one or more variations.
 *
 * The catalogue's `-sample.html` files are finished, photo-rich designs. They
 * sell the layout but they are the wrong tool for choosing one: a client reads
 * the stock photo and the demo copy instead of the structure. This script
 * builds the companion `-wireframe.html` for each variation — same layout, no
 * design, every content point a labelled slot.
 *
 * It reuses the app's own generation path rather than a second prompt, so a
 * wireframe cannot drift from what the builder would actually produce.
 *
 *   node --experimental-strip-types scripts/build-wireframes.mjs           # all
 *   node --experimental-strip-types scripts/build-wireframes.mjs hero-v1   # some
 *
 * Existing files are skipped unless --force is passed, so an interrupted run
 * resumes instead of paying for the whole catalogue again.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { PROMPT_GROUPS } from "../lib/prompt-groups.ts";
import { buildTokenBlock } from "../lib/design-tokens.ts";
import { buildSectionGenerationPrompt, SYSTEM_PROMPT } from "../lib/section-generation-prompt.ts";
import { extractSectionFragment } from "../lib/html-extract.ts";
import { stitchFunnel } from "../lib/stitch-funnel.ts";
import {
  pickProvider,
  buildProviderRequest,
  parseProviderReply,
  parseRetryAfterSeconds,
  isTokenRateLimit,
} from "../lib/generation-provider.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "private");

/**
 * A deliberately colourless brand kit.
 *
 * `resolveTokens` derives every supporting shade from these two, so a neutral
 * accent on a white ground produces a fully greyscale token block with no
 * special-casing anywhere in the design-token module.
 */
const WIREFRAME_KIT = {
  primary: "#3F3F46",
  background: "#FFFFFF",
  fontHead: "Inter",
  fontSub: "Inter",
  fontBody: "Inter",
  images: "",
};

/**
 * Appended to the section prompt, and it deliberately OVERRIDES the bracket
 * convention that `CONTENT_SLOT_RULE` sets up.
 *
 * The bracket slots (`[HEADLINE — 6-9 words, core promise]`) exist so a
 * generated deliverable can be filled in with find-and-replace. These files are
 * not deliverables — they are the pictures on the gallery cards. Their job is to
 * be read at a glance at thumbnail size, and `[HEADLINE — 6-9 words, core
 * promise]` is unreadable shrunk to 460px wide while "Main Headline Goes Here"
 * is instantly legible. So previews get plain-English placeholders; the
 * deliverable keeps its brackets.
 */
const WIREFRAME_RULE = `
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
- Output markup only. Do NOT prefix the fragment with /* … */ notes.`;

function slugsFromArgs() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A wireframe is mostly boxes and labels, so it needs far less room than a
 * finished section. That matters on Groq, which counts `max_tokens` against the
 * per-minute budget up front: at generation's 6,000 the request alone is ~7,500
 * tokens against an 8,000/min limit, so every second call would be refused.
 */
const WIREFRAME_MAX_TOKENS = 6_000;

async function generateOne(variation, provider) {
  const tokenBlock = buildTokenBlock(WIREFRAME_KIT);
  const prompt = buildSectionGenerationPrompt({ variation, tokenBlock }) + WIREFRAME_RULE;

  const request = buildProviderRequest(
    provider,
    { system: SYSTEM_PROMPT, prompt },
    { maxOutputTokens: WIREFRAME_MAX_TOKENS }
  );

  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });
    if (res.ok) break;

    const body = await res.text();
    if (!isTokenRateLimit(res.status, body)) {
      throw new Error(`${res.status} ${body.slice(0, 160)}`);
    }
    // Rate limited: the bucket refills on a clock, so wait it out rather than
    // failing an asset we would only have to regenerate later.
    const wait = parseRetryAfterSeconds((n) => res.headers.get(n));
    process.stdout.write(` (rate limited, waiting ${wait}s)`);
    await sleep((wait + 1) * 1000);
    res = null;
  }
  if (!res || !res.ok) throw new Error("still rate limited after 6 attempts");

  const reply = parseProviderReply(provider.provider, await res.json());
  const { html, truncated } = extractSectionFragment(reply);
  if (truncated) throw new Error("came back truncated");

  return stitchFunnel({
    tokenBlock,
    fragments: [{ groupId: variation.id, variation: variation.number, html }],
    title: `${variation.label} — ${variation.title} (wireframe)`,
    fontFamilies: [WIREFRAME_KIT.fontHead],
  });
}

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const forced = process.argv.includes("--anthropic")
  ? { GENERATION_PROVIDER: "anthropic" }
  : process.argv.includes("--groq")
    ? { GENERATION_PROVIDER: "groq" }
    : {};
const provider = pickProvider({ ...process.env, ...env, ...forced }, "generation");
if (!provider) {
  console.error("No provider configured — set GROQ_API_KEY or ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const force = process.argv.includes("--force");
const only = new Set(slugsFromArgs());
const targets = [];
for (const group of PROMPT_GROUPS) {
  for (const v of group.variations) {
    const slug = (v.previewSrc ?? "").replace("/private/", "").replace("-thumb.webp", "");
    if (!slug) continue;
    if (only.size && !only.has(slug)) continue;
    if (!existsSync(join(OUT_DIR, `${slug}-sample.html`))) continue; // no sample => no layout to mirror
    targets.push({ slug, variation: v });
  }
}

console.log(`provider: ${provider.provider}/${provider.model}`);
console.log(`targets : ${targets.length}\n`);

let done = 0;
let skipped = 0;
let failed = 0;
for (const [i, t] of targets.entries()) {
  const out = join(OUT_DIR, `${t.slug}-wireframe.html`);
  if (!force && existsSync(out)) {
    skipped++;
    continue;
  }
  try {
    const doc = await generateOne(t.variation, provider);
    writeFileSync(out, doc, "utf8");
    done++;
    console.log(`  [${i + 1}/${targets.length}] ${t.slug} — ${doc.length} bytes`);
  } catch (err) {
    failed++;
    console.log(`  [${i + 1}/${targets.length}] ${t.slug} — FAILED: ${err.message}`);
  }
}

console.log(`\nwritten ${done}, skipped ${skipped}, failed ${failed}`);
