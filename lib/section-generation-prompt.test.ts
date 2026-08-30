import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSectionGenerationPrompt, SYSTEM_PROMPT } from "./section-generation-prompt.ts";
import { buildTokenBlock } from "./design-tokens.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";
import type { Section } from "./section-catalogue.ts";

const TOKENS = buildTokenBlock({
  primary: "#7c5cfc", background: "#0d0b1f",
  fontHead: "Syne", fontSub: "Inter", fontBody: "Inter", images: "",
});

const hero = PROMPT_GROUPS.find((g) => g.id === "hero")!;
const VARIATION = hero.variations[0] as Section;

test("the system prompt forbids a document wrapper and code fences", () => {
  assert.ok(SYSTEM_PROMPT.includes("<!DOCTYPE"));
  assert.ok(SYSTEM_PROMPT.includes("exactly one <section>"));
  assert.ok(/no markdown, no code fences/i.test(SYSTEM_PROMPT));
});

test("the prompt carries the tokens and the spec", () => {
  const p = buildSectionGenerationPrompt({ variation: VARIATION, tokenBlock: TOKENS });
  assert.ok(p.includes(":root {"), "tokens are present");
  assert.ok(p.includes("--brand:"), "the palette is named");
  assert.ok(p.includes(VARIATION.title), "the section is identified");
});

test("the single-file boilerplate is stripped so it cannot fight the fragment rule", () => {
  const p = buildSectionGenerationPrompt({ variation: VARIATION, tokenBlock: TOKENS });
  assert.ok(
    !/build the complete file now/i.test(p),
    "sectionSpecForCombined must remove the whole-document instruction"
  );
});

test("no client prose can reach the prompt", () => {
  const p = buildSectionGenerationPrompt({ variation: VARIATION, tokenBlock: TOKENS });
  assert.ok(!p.includes("<<<COPY"), "the copy fence is gone with the copy field");
  assert.ok(
    /LEAVE SLOTS, DO NOT WRITE COPY/.test(p),
    "the model is told to leave labelled slots, not write copy"
  );
});

test("the same inputs always produce the same prompt", () => {
  const a = buildSectionGenerationPrompt({ variation: VARIATION, tokenBlock: TOKENS });
  const b = buildSectionGenerationPrompt({ variation: VARIATION, tokenBlock: TOKENS });
  assert.equal(a, b);
});

test("the system prompt forbids inventing copy and images", () => {
  assert.match(SYSTEM_PROMPT, /you write NO real copy/);
  assert.match(SYSTEM_PROMPT, /never link a real or stock image URL/);
  assert.equal(
    /Write real headline copy/.test(SYSTEM_PROMPT),
    false,
    "the old instruction to invent copy must be gone"
  );
});
