import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOutputs,
  variationShortName,
  stripBrandBlocks,
  PLACEHOLDER_COPY_RULE,
} from "./prompt-assembly.ts";
import type { PromptGroup, FunnelBrandKit } from "./prompt-assembly.ts";

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

const GROUPS: PromptGroup[] = [
  {
    id: "hero",
    label: "HERO",
    variations: [
      {
        number: "01a",
        title: "Hero Variation 1",
        description: "A centered hero.",
        basePrompt: "Intro line.\n\n=== OUTPUT ===\nSingle file\n\n=== LAYOUT ===\nCentered\n\nBuild the complete file now.",
        varsPrompt: "— BRAND COLORS —\n--bg: #000\n\n— FONTS —\nInter\n\n— COPY —\nHeadline",
      },
    ],
  },
];

test("variationShortName pulls the variation label out of a title", () => {
  assert.equal(variationShortName("Hero Variation 1"), "Variation 1");
  assert.equal(variationShortName("Kampo ni DOK Resort"), "Kampo ni DOK Resort");
});

test("stripBrandBlocks removes only the labelled blocks", () => {
  const vars = "— BRAND COLORS —\n#000\n\n— FONTS —\nInter\n\n— COPY —\nKeep me";
  const out = stripBrandBlocks(vars, ["BRAND COLORS", "FONTS"]);
  assert.ok(out.includes("Keep me"));
  assert.ok(!out.includes("#000"));
  assert.ok(!out.includes("Inter"));
});

test("stripBrandBlocks is a no-op with no labels", () => {
  const vars = "— BRAND COLORS —\n#000";
  assert.equal(stripBrandBlocks(vars, []), vars);
});

test("buildOutputs returns no blocks and no full prompt when nothing is enabled", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: false, variation: "01a", copy: "" } },
    kit: EMPTY_KIT,
    includeRef: true,
  });
  assert.deepEqual(out.blocks, []);
  assert.equal(out.full, null);
});

test("buildOutputs emits a block and a full prompt for an enabled section", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a", copy: "My headline" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.equal(out.blocks.length, 1);
  assert.equal(out.blocks[0].id, "hero");
  assert.ok(out.blocks[0].heading.includes("HERO"));
});

test("no copy reaches the prompt — the model is told to write its own", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a", copy: "My headline" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.ok(
    !out.blocks[0].text.includes("My headline"),
    "a copy field left over on the selection must not leak into the prompt"
  );
  assert.ok(!out.full?.includes("My headline"));
  assert.ok(out.blocks[0].text.includes(PLACEHOLDER_COPY_RULE));
  assert.ok(out.full?.includes(PLACEHOLDER_COPY_RULE));
});

test("buildOutputs puts the authoritative brand kit ahead of the spec when a kit is set", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a", copy: "Copy" } },
    kit: { ...EMPTY_KIT, primary: "#7C5CFC", fontHead: "Syne" },
    includeRef: false,
  });
  const text = out.blocks[0].text;
  assert.ok(text.startsWith("╔══ BRAND KIT"), "brand kit must lead the prompt");
  assert.ok(text.includes("#7C5CFC"));
  assert.ok(text.includes("Syne"));
});

test("buildOutputs falls back to the first variation when the number is unknown", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "does-not-exist", copy: "" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.equal(out.blocks.length, 1);
  assert.ok(out.blocks[0].heading.includes("Variation 1"));
});

test("sectionSpecForCombined drops the single-file output block and trailing build line", async () => {
  const { sectionSpecForCombined } = await import("./prompt-assembly.ts");
  const out = sectionSpecForCombined(GROUPS[0].variations[0].basePrompt);
  assert.ok(!out.includes("=== OUTPUT ==="), "single-file output block survived");
  assert.ok(!out.includes("Build the complete file now"), "trailing build line survived");
  assert.ok(out.includes("=== LAYOUT ==="), "section spec was lost");
});
