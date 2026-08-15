import { test } from "node:test";
import assert from "node:assert/strict";
import { singleSectionPrompt } from "./single-section-prompt.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";
import { EXTRA_GROUPS } from "./gallery-extras.ts";
import type { FunnelBrandKit } from "./prompt-assembly.ts";

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

test("a 10P group produces non-empty text containing the variation's heading", () => {
  const text = singleSectionPrompt([...PROMPT_GROUPS, ...EXTRA_GROUPS], "hero", "01a", EMPTY_KIT);
  assert.ok(text.length > 0);
  assert.match(text, /SECTION 01 · HERO/);
});

// This is the test that would have caught the Extras defect: gallery.tsx used
// to call buildOutputs with PROMPT_GROUPS only, so an Extras groupId (which
// lives in EXTRA_GROUPS, not PROMPT_GROUPS) never matched anything and the
// copy button silently wrote "" to the clipboard. Run this against the old
// PROMPT_GROUPS-only call and it fails (empty string, not > 0).
test("an extras group (carousel) also produces non-empty text", () => {
  const text = singleSectionPrompt([...PROMPT_GROUPS, ...EXTRA_GROUPS], "carousel", "CAR-01", EMPTY_KIT);
  assert.ok(text.length > 0);
});

test("an unknown group id produces an empty string", () => {
  const text = singleSectionPrompt([...PROMPT_GROUPS, ...EXTRA_GROUPS], "does-not-exist", "01a", EMPTY_KIT);
  assert.equal(text, "");
});

test("passing only PROMPT_GROUPS (the old defect) leaves an extras groupId unresolved", () => {
  const text = singleSectionPrompt(PROMPT_GROUPS, "carousel", "CAR-01", EMPTY_KIT);
  assert.equal(text, "");
});
