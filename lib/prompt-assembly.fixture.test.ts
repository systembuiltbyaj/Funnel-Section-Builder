import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildOutputs } from "./prompt-assembly.ts";
import type { FunnelBrandKit } from "./prompt-assembly.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";

const SNAPSHOT = new URL("./__snapshots__/prompt-output.txt", import.meta.url);

const KIT: FunnelBrandKit = {
  primary: "#7C5CFC", background: "#101020",
  fontHead: "Syne", fontSub: "Inter", fontBody: "Inter",
  images: "Logo: /brand/logo.svg",
};

const CASES = [
  { name: "hero only, no kit, no ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" } }, kit: null, includeRef: false },
  { name: "hero only, kit, ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" } }, kit: KIT, includeRef: true },
  { name: "four sections, kit, ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" }, empathy: { enabled: true, variation: "02a", copy: "B" }, offer: { enabled: true, variation: "06a", copy: "C" }, faq: { enabled: true, variation: "11a", copy: "D" } }, kit: KIT, includeRef: true },
  { name: "nothing enabled", sel: {}, kit: KIT, includeRef: true },
];

const EMPTY: FunnelBrandKit = { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" };

function render(): string {
  return CASES.map((c) => {
    const out = buildOutputs({
      groups: PROMPT_GROUPS,
      sel: c.sel as never,
      kit: c.kit ?? EMPTY,
      includeRef: c.includeRef,
    });
    return `### ${c.name}\n--- blocks ---\n${out.blocks.map((b) => b.heading + "\n" + b.text).join("\n\n")}\n--- full ---\n${out.full ?? "(null)"}`;
  }).join("\n\n========\n\n");
}

/**
 * `.gitattributes` pins the snapshot to LF, but a working tree that predates it
 * (or a clone with a different autocrlf setting) can still carry CRLF. Compare
 * on normalized text so the assertion tests the prompts, not the checkout.
 */
const lf = (s: string) => s.replace(/\r\n/g, "\n");

test("generated prompt output is unchanged", () => {
  const current = render();
  if (!existsSync(SNAPSHOT) || process.env.UPDATE_SNAPSHOT === "1") {
    writeFileSync(SNAPSHOT, current, "utf8");
    console.log("snapshot written — re-run without UPDATE_SNAPSHOT to assert");
    return;
  }
  assert.equal(lf(current), lf(readFileSync(SNAPSHOT, "utf8")), "prompt output changed");
});
