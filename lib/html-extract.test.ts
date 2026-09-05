import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSectionFragment } from "./html-extract.ts";

const GOOD = '<style>.h{color:var(--text)}</style>\n<section class="h"><h1>Hi</h1></section>';

test("a clean fragment passes through untouched", () => {
  const r = extractSectionFragment(GOOD);
  assert.equal(r.html, GOOD);
  assert.equal(r.truncated, false);
  assert.equal(r.salvagedFromDocument, false);
});

test("markdown code fences are stripped", () => {
  const r = extractSectionFragment("```html\n" + GOOD + "\n```");
  assert.equal(r.html, GOOD);
  assert.equal(r.truncated, false);
});

test("a bare fence with no language is stripped too", () => {
  assert.equal(extractSectionFragment("```\n" + GOOD + "\n```").html, GOOD);
});

test("a full document is salvaged to its body rather than thrown away", () => {
  const doc =
    "<!DOCTYPE html><html><head><style>.a{color:red}</style></head>" +
    "<body><section>Real</section></body></html>";
  const r = extractSectionFragment(doc);
  assert.equal(r.salvagedFromDocument, true);
  assert.ok(r.html.includes("<section>Real</section>"), "body content survives");
  assert.ok(r.html.includes(".a{color:red}"), "head styles survive for the stitcher to hoist");
  assert.ok(!/<html[\s>]/i.test(r.html), "the document wrapper is gone");
  assert.equal(r.truncated, false);
});

// --- truncation: the tripwire for a reply that hit the token ceiling ------

test("an unclosed section reads as truncated", () => {
  assert.equal(extractSectionFragment("<section><h1>Hi</h1>").truncated, true);
});

test("an unclosed style reads as truncated", () => {
  assert.equal(extractSectionFragment("<style>.a{color:red}<section></section>").truncated, true);
});

test("an unbalanced div reads as truncated", () => {
  assert.equal(extractSectionFragment("<section><div><p>x</p></section>").truncated, true);
});

test("a reply cut off mid-tag reads as truncated", () => {
  assert.equal(
    extractSectionFragment('<section><h1>Hi</h1></section><div class="').truncated,
    true
  );
});

test("empty output reads as truncated, not as success", () => {
  assert.equal(extractSectionFragment("").truncated, true);
  assert.equal(extractSectionFragment("   ").truncated, true);
});

test("void tags do not skew the balance check", () => {
  const r = extractSectionFragment('<section><img src="x.png" /><br><input></section>');
  assert.equal(r.truncated, false);
});

test("loose CSS comments outside a style block are stripped, not rendered as text", () => {
  // Observed from gpt-oss-120b: it prefixes the fragment with a numbered list of
  // /* … */ notes. Outside <style> those are text nodes, so they render at the
  // top of the section as visible gibberish.
  const raw = [
    "/* 1. Edit navigation links or logo text. */",
    "/* 2. Replace [HEADLINE …] with actual copy. */",
    "",
    "<style>.hero{color:red} /* keep me: I am inside style */</style>",
    "<section class='hero'><h1>Hi</h1></section>",
  ].join("\n");

  const { html, truncated } = extractSectionFragment(raw);
  assert.equal(truncated, false);
  assert.equal(html.includes("Edit navigation links"), false, "leading notes must go");
  assert.equal(html.includes("Replace [HEADLINE"), false);
  assert.ok(html.includes("keep me: I am inside style"), "comments inside <style> are CSS, not text");
  assert.ok(html.includes("<section"), "the section itself survives");
});

test("a comment between markup blocks does not survive either", () => {
  const raw = "<style>.a{}</style>\n/* stray note */\n<section><p>x</p></section>";
  const { html } = extractSectionFragment(raw);
  assert.equal(html.includes("stray note"), false);
});
