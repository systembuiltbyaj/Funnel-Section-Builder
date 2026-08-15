import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokenBlock, resolveTokens, cssFontStack } from "./design-tokens.ts";
import type { FunnelBrandKit } from "./prompt-assembly.ts";

const EMPTY: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};
const KIT: FunnelBrandKit = {
  primary: "#7C5CFC", background: "#0D0B1F",
  fontHead: "Syne", fontSub: "Inter", fontBody: "Inter", images: "",
};

test("a filled kit resolves to its own colours", () => {
  const t = resolveTokens(KIT);
  assert.equal(t.brand, "#7c5cfc");
  assert.equal(t.bg, "#0d0b1f");
});

test("an empty kit still produces a complete, usable palette", () => {
  const t = resolveTokens(EMPTY);
  for (const [key, value] of Object.entries(t)) {
    assert.ok(value && value.length > 0, `${key} must not be empty`);
  }
});

test("no brand colour falls back to monochrome, not to the app's own violet", () => {
  const t = resolveTokens(EMPTY);
  assert.equal(t.brand, t.text, "accent derives from the text colour");
  assert.ok(!t.brand.startsWith("#5e17eb"), "must not impose the app's brand on a client page");
});

test("text is readable against the chosen background either way round", () => {
  assert.equal(resolveTokens({ ...EMPTY, background: "#0d0b1f" }).text, "#f5f5f7");
  assert.equal(resolveTokens({ ...EMPTY, background: "#fffaf0" }).text, "#0f0f14");
});

test("surfaces lift on a dark ground and recede on a light one", () => {
  const dark = resolveTokens({ ...EMPTY, background: "#000000" });
  const light = resolveTokens({ ...EMPTY, background: "#ffffff" });
  assert.notEqual(dark.surface, "#000000");
  assert.notEqual(light.surface, "#ffffff");
});

// --- the security-relevant one ------------------------------------------

test("font names cannot break out of the CSS declaration", () => {
  const attack = "Inter; } body { display: none } @import url(evil.css); .x {";
  const stack = cssFontStack(attack);
  assert.ok(!stack.includes(";"), "no statement terminator survives");
  assert.ok(!stack.includes("{"), "no rule can be opened");
  assert.ok(!stack.includes("}"), "no rule can be closed");
  assert.ok(!stack.includes("@import"), "no at-rule survives");
});

test("a malicious font name cannot escape through the token block either", () => {
  const block = buildTokenBlock({ ...EMPTY, fontHead: '</style><script>alert(1)</script>' });
  assert.ok(!block.includes("<"), "no markup survives into the stylesheet");
  assert.ok(!block.includes(">"));
});

test("an ordinary font name is quoted and given a system fallback", () => {
  const stack = cssFontStack("Space Grotesk");
  assert.ok(stack.startsWith('"Space Grotesk",'));
  assert.ok(stack.includes("system-ui"));
});

test("a blank font name yields the system stack alone, with no empty quotes", () => {
  assert.equal(cssFontStack("   "), cssFontStack(""));
  assert.ok(!cssFontStack("").includes('""'));
});

// --- block shape ---------------------------------------------------------

test("the token block is a single valid :root rule carrying every token", () => {
  const block = buildTokenBlock(KIT);
  assert.ok(block.startsWith(":root {"));
  assert.ok(block.trimEnd().endsWith("}"));
  assert.equal(block.match(/:root/g)?.length, 1);
  for (const token of [
    "--brand:", "--brand-contrast:", "--bg:", "--surface:", "--border:",
    "--text:", "--muted:", "--font-head:", "--font-sub:", "--font-body:",
    "--radius:", "--maxw:",
  ]) {
    assert.ok(block.includes(token), `missing ${token}`);
  }
});

test("the same kit always produces byte-identical output", () => {
  assert.equal(buildTokenBlock(KIT), buildTokenBlock({ ...KIT }));
});
