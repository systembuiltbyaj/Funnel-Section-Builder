import { test } from "node:test";
import assert from "node:assert/strict";
import { normHex, hexToRgb, rgbToHex, shade, mix, luminance, isDark, readableOn } from "./color.ts";

test("normHex accepts the forms a brand-kit text box actually receives", () => {
  assert.equal(normHex("#7C5CFC"), "#7c5cfc");
  assert.equal(normHex("7C5CFC"), "#7c5cfc");
  assert.equal(normHex("  #7c5cfc  "), "#7c5cfc");
  assert.equal(normHex("#abc"), "#aabbcc");
  assert.equal(normHex("#7c5cfcff"), "#7c5cfc", "8-digit hex drops the alpha pair");
});

test("normHex rejects junk rather than throwing", () => {
  assert.equal(normHex(""), null);
  assert.equal(normHex("not a colour"), null);
  assert.equal(normHex("#12345"), null);
  assert.equal(normHex("#gggggg"), null);
});

test("hexToRgb and rgbToHex round-trip", () => {
  assert.deepEqual(hexToRgb("#7c5cfc"), [124, 92, 252]);
  assert.equal(rgbToHex([124, 92, 252]), "#7c5cfc");
  assert.equal(rgbToHex(hexToRgb("#0d0b1f")!), "#0d0b1f");
});

test("rgbToHex clamps out-of-range channels instead of emitting garbage", () => {
  assert.equal(rgbToHex([-20, 300, 128]), "#00ff80");
});

test("shade lightens on positive and darkens on negative", () => {
  assert.equal(shade("#000000", 1), "#ffffff");
  assert.equal(shade("#ffffff", -1), "#000000");
  assert.equal(shade("#808080", 0), "#808080");
  assert.ok(luminance(shade("#404040", 0.5)) > luminance("#404040"));
});

test("shade returns the input unchanged when it cannot parse it", () => {
  assert.equal(shade("nonsense", 0.5), "nonsense");
});

test("mix blends between two colours and clamps the ratio", () => {
  assert.equal(mix("#000000", "#ffffff", 0), "#000000");
  assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#000000", "#ffffff", 5), "#ffffff", "ratio above 1 clamps");
  assert.equal(mix("#000000", "#ffffff", -3), "#000000", "negative ratio clamps");
});

test("luminance orders colours the way perception does", () => {
  assert.ok(luminance("#ffffff") > luminance("#7c5cfc"));
  assert.ok(luminance("#7c5cfc") > luminance("#000000"));
  assert.equal(luminance("garbage"), 0, "unparseable reads as darkest");
});

test("isDark and readableOn pick sensible text for a ground", () => {
  assert.equal(isDark("#0d0b1f"), true);
  assert.equal(isDark("#f6f1e8"), false);
  assert.equal(readableOn("#0d0b1f"), "#f5f5f7");
  assert.equal(readableOn("#ffffff"), "#0f0f14");
});
