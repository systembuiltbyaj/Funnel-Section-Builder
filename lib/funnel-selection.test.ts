import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePersisted, STORAGE_KEY } from "./funnel-selection.ts";

const CATALOGUE = { hero: ["01a", "01b"], faq: ["11a"] };
const KIT = { primary: "#7C5CFC", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" };

test("storage key is versioned so a shape change cannot resurrect old state", () => {
  assert.match(STORAGE_KEY, /\.v\d+$/);
  assert.equal(STORAGE_KEY, "fsb.selection.v3");
});

test("v2 state with an analysis block still validates, ignoring the dead field", () => {
  const out = validatePersisted(
    {
      sel: { hero: { enabled: true, variation: "01b", copy: "hi" } },
      kit: KIT,
      analysis: { reasons: { hero: "why" }, meta: { niche: "n", vibe: "v" }, sourceCopy: "c" },
    },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b", copy: "hi" });
  assert.equal("analysis" in (out ?? {}), false);
});

test("validatePersisted keeps entries that match the catalogue", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: true, variation: "01b", copy: "hi" } }, kit: KIT },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b", copy: "hi" });
  assert.equal(out?.kit.primary, "#7C5CFC");
});

test("validatePersisted drops group ids that no longer exist", () => {
  const out = validatePersisted(
    { sel: { ghost: { enabled: true, variation: "99z", copy: "" } }, kit: KIT },
    CATALOGUE
  );
  assert.deepEqual(out?.sel, {});
});

test("validatePersisted repairs a dead variation number to the group's first", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: true, variation: "gone", copy: "keep" } }, kit: KIT },
    CATALOGUE
  );
  assert.equal(out?.sel.hero.variation, "01a", "should fall back to the first valid variation");
  assert.equal(out?.sel.hero.copy, "keep", "copy must survive the repair");
});

test("validatePersisted rejects junk rather than throwing", () => {
  assert.equal(validatePersisted(null, CATALOGUE), null);
  assert.equal(validatePersisted("nope", CATALOGUE), null);
  assert.equal(validatePersisted({ sel: "bad" }, CATALOGUE), null);
  assert.equal(validatePersisted({}, CATALOGUE), null);
});

test("validatePersisted drops a __proto__ key instead of throwing, keeping other valid keys", () => {
  // A literal `{ __proto__: ... }` object-initializer key sets the prototype
  // rather than creating an own property, which would not reproduce the bug —
  // JSON.parse (how this data actually arrives, from localStorage) is
  // different: it creates a genuine own enumerable "__proto__" property. Use
  // an actual JSON string so this test exercises the real code path.
  const raw = JSON.parse(
    '{"sel":{"__proto__":{"enabled":true,"variation":"hax","copy":"evil"},' +
      '"hero":{"enabled":true,"variation":"01b","copy":"hi"}},"kit":' +
      JSON.stringify(KIT) +
      "}"
  );
  const out = validatePersisted(raw, CATALOGUE);
  assert.notEqual(out, null);
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b", copy: "hi" });
  assert.equal(Object.prototype.hasOwnProperty.call(out?.sel ?? {}, "__proto__"), false);
});

test("validatePersisted coerces malformed entry fields", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: "yes", variation: "01a", copy: 42 } }, kit: {} },
    CATALOGUE
  );
  assert.equal(out?.sel.hero.enabled, true);
  assert.equal(out?.sel.hero.copy, "");
  assert.equal(out?.kit.primary, "");
});
