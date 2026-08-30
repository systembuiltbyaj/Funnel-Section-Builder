import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAnalyzeRequest,
  buildAnalyzerCatalogue,
  normalizeAnalysis,
  ANALYZE_COPY_MAX,
  ANALYZE_COPY_MIN,
} from "./analyze-contract.ts";

const CATALOGUE = { hero: ["01a", "01b"], faq: ["11a"] };

const SOURCE = [
  {
    id: "hero",
    label: "Hero",
    variations: [
      { number: "01a", description: "Split photo hero", funnelTypes: ["coaching"] },
      { number: "01b", description: "Full-bleed video hero", funnelTypes: [] },
    ],
  },
];

test("a well-formed request passes", () => {
  const r = validateAnalyzeRequest({ copy: "x".repeat(ANALYZE_COPY_MIN) });
  assert.equal(r.ok, true);
});

test("copy under the minimum is refused", () => {
  const r = validateAnalyzeRequest({ copy: "too short" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "invalid_input");
});

test("oversized copy is refused with the size code", () => {
  const r = validateAnalyzeRequest({ copy: "x".repeat(ANALYZE_COPY_MAX + 1) });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "input_too_large");
});

test("a catalog supplied by the caller is ignored entirely", () => {
  const r = validateAnalyzeRequest({
    copy: "x".repeat(ANALYZE_COPY_MIN),
    catalog: [{ id: "evil", label: "Evil", variations: [] }],
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(
      Object.keys(r.value),
      ["copy"],
      "only copy may cross the boundary — the catalogue is built server-side"
    );
  }
});

test("the analyzer catalogue is flattened small and keeps funnel-type tags", () => {
  const out = buildAnalyzerCatalogue(SOURCE);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "hero");
  assert.equal(out[0].variations[0].number, "01a");
  assert.equal(out[0].variations[0].funnelTypes, "coaching");
  assert.equal(out[0].variations[1].funnelTypes, "");
});

test("an unknown sectionId is dropped", () => {
  const out = normalizeAnalysis(
    { niche: "coaching", vibe: "premium", sections: [{ sectionId: "nope", recommendedVariation: "01a", reason: "r" }] },
    CATALOGUE
  );
  assert.deepEqual(out.sections, []);
});

test("a variation that does not belong to the section is repaired to the first", () => {
  const out = normalizeAnalysis(
    { sections: [{ sectionId: "faq", recommendedVariation: "01a", reason: "r" }] },
    CATALOGUE
  );
  assert.equal(out.sections[0].recommendedVariation, "11a");
});

test("a __proto__ sectionId cannot pass the catalogue check", () => {
  const raw = JSON.parse('{"sections":[{"sectionId":"__proto__","recommendedVariation":"01a","reason":"r"}]}');
  const out = normalizeAnalysis(raw, CATALOGUE);
  assert.deepEqual(out.sections, [], "Object.prototype must not look like a known section");
});

test("junk input yields an empty analysis rather than throwing", () => {
  assert.deepEqual(normalizeAnalysis(null, CATALOGUE), { niche: "", vibe: "", sections: [] });
  assert.deepEqual(normalizeAnalysis({ sections: "nope" }, CATALOGUE), { niche: "", vibe: "", sections: [] });
});

test("a section cannot be recommended twice", () => {
  const out = normalizeAnalysis(
    {
      sections: [
        { sectionId: "hero", recommendedVariation: "01a", reason: "first" },
        { sectionId: "hero", recommendedVariation: "01b", reason: "second" },
      ],
    },
    CATALOGUE
  );
  assert.equal(out.sections.length, 1);
  assert.equal(out.sections[0].reason, "first");
});
