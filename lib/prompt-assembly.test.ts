import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOutputs,
  variationShortName,
  stripBrandBlocks,
  CONTENT_SLOT_RULE,
} from "./prompt-assembly.ts";
import type { PromptGroup, FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";

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
    sel: { hero: { enabled: false, variation: "01a" } },
    kit: EMPTY_KIT,
    includeRef: true,
  });
  assert.deepEqual(out.blocks, []);
  assert.equal(out.full, null);
});

test("buildOutputs emits a block and a full prompt for an enabled section", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.equal(out.blocks.length, 1);
  assert.equal(out.blocks[0].id, "hero");
  assert.ok(out.blocks[0].heading.includes("HERO"));
});

test("no copy reaches the prompt, and the model is told to leave slots", () => {
  const out = buildOutputs({
    groups: GROUPS,
    // Cast: the type no longer has `copy`, but a record persisted before it was
    // dropped still does at runtime. This pins that such a field cannot leak.
    sel: { hero: { enabled: true, variation: "01a", copy: "My headline" } as BuilderSelection },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.ok(
    !out.blocks[0].text.includes("My headline"),
    "a copy field left over on the selection must not leak into the prompt"
  );
  assert.ok(!out.full?.includes("My headline"));
  assert.ok(out.blocks[0].text.includes(CONTENT_SLOT_RULE));
  assert.ok(out.full?.includes(CONTENT_SLOT_RULE));
});

test("a brand kit never reaches the output — the tool emits a wireframe", () => {
  // The kit is still collected and still drives the gallery's Design preview.
  // It just must not colour a generated prompt: the deliverable is a skeleton,
  // and the client applies their palette afterwards.
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: { ...EMPTY_KIT, primary: "#7C5CFC", fontHead: "Syne", images: "Logo: /brand.svg" },
    includeRef: false,
  });
  for (const text of [out.blocks[0].text, out.full ?? ""]) {
    assert.equal(text.includes("#7C5CFC"), false, "the brand colour must not leak");
    assert.equal(text.includes("Syne"), false, "nor the brand font");
    assert.equal(text.includes("/brand.svg"), false, "nor the image notes");
    assert.match(text, /Do NOT choose a brand colour/);
    assert.match(text, /RENDER AS A DESIGNED WIREFRAME/);
  }
});

test("buildOutputs falls back to the first variation when the number is unknown", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "does-not-exist" } },
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

test("an empty brand kit never asks the model to choose a palette", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  for (const text of [out.blocks[0].text, out.full ?? ""]) {
    assert.ok(
      !/choose one clean, conversion-friendly palette/i.test(text),
      "colour is the client's to own — the model must not pick a brand colour"
    );
    assert.match(text, /Do NOT choose a brand colour/);
    assert.match(text, /--brand/, "a swappable CSS variable is offered instead");
  }
});

test("the slot rule survives into both outputs when a brand kit IS set", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: { ...EMPTY_KIT, primary: "#7C5CFC", fontHead: "Syne" },
    includeRef: false,
  });
  assert.ok(out.blocks[0].text.includes(CONTENT_SLOT_RULE), "per-section block keeps it");
  assert.ok(out.full?.includes(CONTENT_SLOT_RULE), "master prompt keeps it");
});

test("the slot rule names the bracket convention it depends on", () => {
  assert.match(CONTENT_SLOT_RULE, /\[HEADLINE/);
  assert.match(CONTENT_SLOT_RULE, /\[IMAGE 16:9/);
  assert.match(CONTENT_SLOT_RULE, /Never a stock URL/);
  assert.match(CONTENT_SLOT_RULE, /nav labels/, "structural furniture stays real words");
});
