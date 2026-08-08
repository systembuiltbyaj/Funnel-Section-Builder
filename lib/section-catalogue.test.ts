import { test } from "node:test";
import assert from "node:assert/strict";
import { sections, gptImageCards, carouselCards, localWebsiteCards, labelClasses } from "./section-catalogue.ts";

test("the catalogue is importable by the test runner", () => {
  assert.ok(sections.length > 0, "sections is empty — the move lost data");
});

test("the catalogue still holds every funnel section group", () => {
  const ids = [...new Set(sections.map((s) => s.id))];
  assert.deepEqual(ids, [
    "hero", "empathy", "opportunity", "compare", "usp", "offer",
    "social", "risk", "authority", "urgency", "faq", "footer",
  ], "group set or 10P ordering changed");
});

test("variation counts per group are unchanged", () => {
  const counts: Record<string, number> = {};
  for (const s of sections) counts[s.id] = (counts[s.id] ?? 0) + 1;
  assert.deepEqual(counts, {
    hero: 9, empathy: 10, opportunity: 11, compare: 7, usp: 10, offer: 12,
    social: 9, risk: 8, authority: 10, urgency: 8, faq: 8, footer: 8,
  }, "a variation was lost or duplicated in the move");
});

test("the browse-only collections survived", () => {
  assert.ok(gptImageCards.length > 0);
  assert.ok(carouselCards.length > 0);
  assert.ok(localWebsiteCards.length > 0);
});

test("every variation carries the fields the builder and prompts rely on", () => {
  for (const s of sections) {
    assert.ok(s.number, `${s.title}: missing number`);
    assert.ok(s.label, `${s.title}: missing label`);
    assert.ok(s.basePrompt, `${s.title}: missing basePrompt`);
    assert.ok(s.varsPrompt, `${s.title}: missing varsPrompt`);
    assert.ok(labelClasses[s.id], `${s.id}: missing label class`);
  }
});

test("variation numbers are unique within a group", () => {
  const seen = new Set<string>();
  for (const s of sections) {
    const key = `${s.id}/${s.number}`;
    assert.ok(!seen.has(key), `duplicate variation number ${key}`);
    seen.add(key);
  }
});
