import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenGroups, filterGallery } from "./gallery-filter.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";
import { EXTRA_GROUPS, isExtraGroup } from "./gallery-extras.ts";

const GROUPS = [
  {
    id: "hero",
    label: "Hero",
    variations: [
      { id: "hero", number: "01a", label: "Hero", title: "Hero — Variation 1", description: "Centred hero with video block", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/hero-v1-thumb.webp" },
      { id: "hero", number: "01b", label: "Hero", title: "Hero — Variation 2", description: "Split layout, product shot right", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/hero-v2-thumb.webp" },
    ],
  },
  {
    id: "faq",
    label: "FAQ",
    variations: [
      { id: "faq", number: "11a", label: "FAQ", title: "FAQ — Variation 1", description: "Accordion list", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/faq-v1-thumb.webp" },
    ],
  },
] as never;

test("flattenGroups produces one item per variation, carrying its group", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(items.length, 3);
  assert.equal(items[0].groupId, "hero");
  assert.equal(items[0].groupLabel, "Hero");
  assert.equal(items[0].variation.number, "01a");
  assert.equal(items[2].groupId, "faq");
});

test("flattenGroups preserves previewSrc, which PromptVariation does not declare", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(items[0].variation.previewSrc, "/private/hero-v1-thumb.webp");
});

test("a null group means all groups", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "" }).length, 3);
});

test("filtering by group narrows to that group only", () => {
  const items = flattenGroups(GROUPS);
  const out = filterGallery(items, { groupId: "hero", query: "" });
  assert.equal(out.length, 2);
  assert.ok(out.every((i) => i.groupId === "hero"));
});

test("query matches the description", () => {
  const items = flattenGroups(GROUPS);
  const out = filterGallery(items, { groupId: null, query: "accordion" });
  assert.equal(out.length, 1);
  assert.equal(out[0].variation.number, "11a");
});

test("query matches the variation number and the group label", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "01b" }).length, 1);
  assert.equal(filterGallery(items, { groupId: null, query: "faq" }).length, 1);
});

test("query is case- and whitespace-insensitive", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "  SPLIT  " }).length, 1);
});

test("group and query compose", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: "hero", query: "accordion" }).length, 0);
});

test("a query matching nothing returns empty, not everything", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "zzzzz" }).length, 0);
});

test("the real catalogue flattens to 110 items across 10 groups", () => {
  const items = flattenGroups(PROMPT_GROUPS);
  assert.equal(items.length, 110);
  assert.equal(new Set(items.map((i) => i.groupId)).size, 10);
});

test("the extras collections expose 53 image prompts, 6 carousel and 5 layouts", () => {
  const byId = Object.fromEntries(EXTRA_GROUPS.map((g) => [g.id, g.variations.length]));
  assert.deepEqual(byId, { gptimage: 53, carousel: 6, local: 5 });
});

test("extras flatten and filter through the same functions as the 10P groups", () => {
  const items = flattenGroups(EXTRA_GROUPS);
  assert.equal(items.length, 64);
  assert.equal(filterGallery(items, { groupId: "carousel", query: "" }).length, 6);
});

test("isExtraGroup distinguishes extras from 10P groups", () => {
  assert.equal(isExtraGroup("carousel"), true);
  assert.equal(isExtraGroup("gptimage"), true);
  assert.equal(isExtraGroup("hero"), false);
  assert.equal(isExtraGroup(null), false);
});
