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
import { WIREFRAME_KIT } from "../lib/wireframe-rule.ts";
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
  // The rule now lives inside buildSectionGenerationPrompt, shared with the app.
  const prompt = buildSectionGenerationPrompt({ variation, tokenBlock });

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
