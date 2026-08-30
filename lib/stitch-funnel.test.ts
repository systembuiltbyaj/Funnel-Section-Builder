import { test } from "node:test";
import assert from "node:assert/strict";
import { stitchFunnel, escapeHtml, type Fragment } from "./stitch-funnel.ts";
import { buildTokenBlock } from "./design-tokens.ts";

const TOKENS = buildTokenBlock({
  primary: "#7c5cfc", background: "#0d0b1f",
  fontHead: "Syne", fontSub: "Inter", fontBody: "Inter", images: "",
});

const FRAGMENTS: Fragment[] = [
  { groupId: "hero", variation: "01a", html: "<style>.hero{padding:80px}</style><section class=\"hero\"><h1>One</h1></section>" },
  { groupId: "offer", variation: "06b", html: "<style>.offer{padding:60px}</style><section class=\"offer\"><h2>Two</h2></section>" },
  { groupId: "faq", variation: "11a", html: "<section class=\"faq\"><h2>Three</h2></section>" },
];

test("the output is a complete document", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS });
  assert.ok(doc.startsWith("<!DOCTYPE html>"));
  assert.ok(doc.trimEnd().endsWith("</html>"));
  assert.ok(doc.includes('<meta charset="UTF-8" />'));
  assert.ok(doc.includes("width=device-width"));
});

test("every fragment style is hoisted into exactly one head style tag", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS });
  assert.equal(doc.match(/<style/gi)?.length, 1, "exactly one style tag");

  const body = doc.slice(doc.indexOf("<body>"));
  assert.ok(!/<style/i.test(body), "no style tag survives in the body");

  assert.ok(doc.includes(".hero{padding:80px}"));
  assert.ok(doc.includes(".offer{padding:60px}"));
});

test("the shared token block leads the stylesheet", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS });
  assert.ok(doc.includes(":root {"));
  assert.ok(
    doc.indexOf(":root {") < doc.indexOf(".hero{padding:80px}"),
    "tokens must be declared before the rules that use them"
  );
});

test("section order is preserved in the body", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS });
  const one = doc.indexOf("<h1>One</h1>");
  const two = doc.indexOf("<h2>Two</h2>");
  const three = doc.indexOf("<h2>Three</h2>");
  assert.ok(one > -1 && two > -1 && three > -1);
  assert.ok(one < two && two < three, "fragments keep the order they were given");
});

test("each section is labelled so a human can find the seam", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS });
  assert.ok(doc.includes("<!-- hero · 01a -->"));
  assert.ok(doc.includes("<!-- faq · 11a -->"));
});

test("a fragment carrying no style of its own still contributes its markup", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: [FRAGMENTS[2]] });
  assert.ok(doc.includes('<section class="faq">'));
  assert.equal(doc.match(/<style/gi)?.length, 1);
});

test("no fragments still yields a valid document", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: [] });
  assert.ok(doc.startsWith("<!DOCTYPE html>"));
  assert.ok(doc.trimEnd().endsWith("</html>"));
  assert.equal(doc.match(/<style/gi)?.length, 1);
});

test("the title is escaped, so a client's own words cannot break the head", () => {
  const doc = stitchFunnel({
    tokenBlock: TOKENS,
    fragments: [],
    title: '</title><script>alert(1)</script>',
  });
  assert.ok(!doc.includes("<script>"), "no script tag survives");
  assert.ok(doc.includes("&lt;/title&gt;"));
});

test("a blank title falls back rather than emitting an empty tag", () => {
  const doc = stitchFunnel({ tokenBlock: TOKENS, fragments: [], title: "   " });
  assert.ok(doc.includes("<title>Funnel</title>"));
});

test("escapeHtml covers the four characters that matter in markup", () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("the same input always produces byte-identical output", () => {
  const a = stitchFunnel({ tokenBlock: TOKENS, fragments: FRAGMENTS, title: "Acme" });
  const b = stitchFunnel({ tokenBlock: TOKENS, fragments: [...FRAGMENTS], title: "Acme" });
  assert.equal(a, b);
});

test("a brand font is actually loaded, not just named in CSS", () => {
  const doc = stitchFunnel({
    tokenBlock: ":root { --font-head: \"Sora\", sans-serif; }",
    fragments: [{ groupId: "hero", variation: "01a", html: "<section>x</section>" }],
    fontFamilies: ["Sora", "Inter", "Inter"],
  });
  assert.match(doc, /fonts\.googleapis\.com/, "the font must be fetched, or it silently falls back");
  assert.match(doc, /family=Sora/);
  assert.match(doc, /family=Inter/);
  assert.equal(
    (doc.match(/family=Inter/g) ?? []).length,
    1,
    "a font named twice is requested once"
  );
  assert.match(doc, /display=swap/, "text must render before the font arrives");
});

test("no font link is emitted when no fonts were chosen", () => {
  const doc = stitchFunnel({
    tokenBlock: ":root {}",
    fragments: [{ groupId: "hero", variation: "01a", html: "<section>x</section>" }],
    fontFamilies: ["", "   ", ""],
  });
  assert.equal(/fonts\.googleapis/.test(doc), false);
});

test("a font name cannot break out of the href", () => {
  const doc = stitchFunnel({
    tokenBlock: ":root {}",
    fragments: [{ groupId: "hero", variation: "01a", html: "<section>x</section>" }],
    fontFamilies: ['Sora" onload="alert(1)', "In<script>ter"],
  });
  assert.equal(doc.includes('onload="alert(1)'), false, "attribute cannot be escaped");
  assert.equal(doc.includes("<script>"), false);
});

test("omitting fontFamilies keeps the old output shape", () => {
  const doc = stitchFunnel({
    tokenBlock: ":root {}",
    fragments: [{ groupId: "hero", variation: "01a", html: "<section>x</section>" }],
  });
  assert.equal(/fonts\.googleapis/.test(doc), false);
});
