import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePersisted, STORAGE_KEY } from "./funnel-selection.ts";

const CATALOGUE = { hero: ["01a", "01b"], faq: ["11a"] };
const KIT = { primary: "#7C5CFC", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" };

test("storage key is versioned so a shape change cannot resurrect old state", () => {
  assert.match(STORAGE_KEY, /\.v\d+$/);
  assert.equal(STORAGE_KEY, "fsb.selection.v3");
});

test("an older analysis block is read for its reasons and stripped of dead fields", () => {
  // The 2026-08 shape nested niche/vibe under `meta` and kept the whole pasted
  // page in `sourceCopy`. Reasons still map cleanly; `sourceCopy` must not come
  // back with them — the tool no longer stores anyone's copy.
  const out = validatePersisted(
    {
      sel: { hero: { enabled: true, variation: "01b", copy: "hi" } },
      kit: KIT,
      analysis: { reasons: { hero: "why" }, meta: { niche: "n", vibe: "v" }, sourceCopy: "c" },
    },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b" });
  assert.equal(out?.analysis?.reasons.hero, "why");
  assert.equal(out?.analysis?.niche, "", "the old nested meta shape is not read");
  assert.equal("sourceCopy" in (out?.analysis ?? {}), false, "pasted copy must not persist");
});

test("validatePersisted keeps entries that match the catalogue", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: true, variation: "01b", copy: "hi" } }, kit: KIT },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b" });
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
  assert.equal("copy" in (out?.sel.hero ?? {}), false, "copy is not carried forward");
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
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b" });
  assert.equal(Object.prototype.hasOwnProperty.call(out?.sel ?? {}, "__proto__"), false);
});

test("validatePersisted coerces malformed entry fields", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: "yes", variation: "01a", copy: 42 } }, kit: {} },
    CATALOGUE
  );
  assert.equal(out?.sel.hero.enabled, true);
  assert.equal("copy" in (out?.sel.hero ?? {}), false);
  assert.equal(out?.kit.primary, "");
});

test("a v3 record written before copy was dropped still loads its sections", () => {
  const stored = {
    sel: { hero: { enabled: true, variation: "01a", copy: "an old client's headline" } },
    kit: { primary: "#7c5cfc", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
  };
  const out = validatePersisted(stored, { hero: ["01a", "01b"] });
  assert.ok(out);
  assert.equal(out.sel.hero.enabled, true);
  assert.equal(out.sel.hero.variation, "01a");
  assert.equal(
    "copy" in out.sel.hero,
    false,
    "copy must be dropped on read, not carried forward"
  );
});

test("analysis round-trips through persisted state", () => {
  const stored = {
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
    analysis: { reasons: { hero: "matches personal brand" }, niche: "coaching", vibe: "premium" },
  };
  const out = validatePersisted(stored, { hero: ["01a"] });
  assert.ok(out);
  assert.equal(out.analysis?.niche, "coaching");
  assert.equal(out.analysis?.reasons.hero, "matches personal brand");
});

test("a record with no analysis loads with analysis null", () => {
  const stored = {
    sel: { hero: { enabled: true, variation: "01a" } },
    kit: { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
  };
  const out = validatePersisted(stored, { hero: ["01a"] });
  assert.ok(out);
  assert.equal(out.analysis, null);
});

test("a reason for a section that no longer exists is dropped", () => {
  const stored = {
    sel: {},
    kit: { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
    analysis: { reasons: { gone: "stale", hero: "kept" }, niche: "", vibe: "" },
  };
  const out = validatePersisted(stored, { hero: ["01a"] });
  assert.ok(out);
  assert.deepEqual(Object.keys(out.analysis?.reasons ?? {}), ["hero"]);
});

test("a funnel saved under a merged group id keeps its section", () => {
  // `compare` folded into `usp` and `urgency` into `risk` when the 12 groups
  // became 10. Without a migration validatePersisted drops the unknown id and
  // the section vanishes from the saved funnel with no error.
  const stored = {
    sel: {
      compare: { enabled: true, variation: "04c" },
      urgency: { enabled: true, variation: "10b" },
    },
    kit: { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
  };
  const out = validatePersisted(stored, { usp: ["04c", "05a"], risk: ["08a", "10b"] });
  assert.ok(out);
  assert.equal(out.sel.usp?.enabled, true, "compare survived as usp");
  assert.equal(out.sel.usp?.variation, "04c", "and kept its variation");
  assert.equal(out.sel.risk?.enabled, true, "urgency survived as risk");
  assert.equal(out.sel.risk?.variation, "10b");
  assert.equal("compare" in out.sel, false, "the dead id does not linger");
});

test("a migrated id never overwrites a section already chosen under the new id", () => {
  const stored = {
    sel: {
      usp: { enabled: true, variation: "05a" },
      compare: { enabled: true, variation: "04c" },
    },
    kit: { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" },
  };
  const out = validatePersisted(stored, { usp: ["04c", "05a"] });
  assert.equal(out?.sel.usp?.variation, "05a", "the explicit pick wins over the migrated one");
});
