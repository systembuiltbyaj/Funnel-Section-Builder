import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBrandKit,
  hasBrandKit,
  isFrameHeightMessage,
  sampleForPreview,
  withHeightReporter,
} from "./samples.ts";

// A stand-in for the library's sample documents: palette in :root, plus the
// same colours repeated as literals the way the real templates do.
const SAMPLE = `<!doctype html><html><head><style>
:root {
  --bg:           #0D0D0D;
  --accent:       #C9922A;
  --accent-hover: #E0A830;
  --text:         #FFFFFF;
  --bg-card:      #1A1A1A;
}
.cta { background: #C9922A; color: #0D0D0D; }
.ring { box-shadow: 0 0 0 2px rgb(201, 146, 42); }
</style></head><body><h1>Hi</h1></body></html>`;

test("sampleForPreview resolves a flat thumbnail to its sample document", () => {
  assert.equal(sampleForPreview("/private/hero-v1-thumb.webp"), "/private/hero-v1-sample.html");
  assert.equal(sampleForPreview("/private/faq-v8-thumb.webp"), "/private/faq-v8-sample.html");
  assert.equal(
    sampleForPreview("/private/before-after-v8-thumb.webp"),
    "/private/before-after-v8-sample.html"
  );
});

test("sampleForPreview resolves sub-folder collections", () => {
  assert.equal(
    sampleForPreview("/private/carousel-ticker-thumb.webp"),
    "/private/carousel/carousel-01-marquee-ticker.html"
  );
  assert.equal(
    sampleForPreview("/private/layout-1-lunara.webp"),
    "/private/local/lunara-beach-resort.html"
  );
});

test("sampleForPreview returns null when no sample exists", () => {
  // Image-prompt library and the two empathy variations with no rendered sample.
  assert.equal(sampleForPreview("/private/gpt-img-01.webp"), null);
  assert.equal(sampleForPreview("/private/empathy-v9-thumb.webp"), null);
  assert.equal(sampleForPreview(undefined), null);
});

test("applyBrandKit remaps the accent colour everywhere it appears", () => {
  // Colours are emitted normalised to lower-case hex, so compare case-insensitively.
  const out = applyBrandKit(SAMPLE, { primary: "#7C5CFC" }).toLowerCase();
  assert.ok(!out.includes("#c9922a"), "old accent survived in the palette or as a literal");
  assert.ok(!out.includes("rgb(201, 146, 42)"), "rgb() form was not remapped");
  assert.ok(out.includes("#7c5cfc"), "brand accent was not applied");
  assert.ok(out.includes("rgb(124, 92, 252)"), "rgb() form was not rewritten to the brand accent");
});

test("applyBrandKit derives a hover shade rather than reusing the accent", () => {
  const out = applyBrandKit(SAMPLE, { primary: "#7C5CFC" });
  assert.ok(!out.includes("#E0A830"), "the template's hover shade survived");
});

test("applyBrandKit remaps the base background and lifts surfaces off it", () => {
  const out = applyBrandKit(SAMPLE, { background: "#101020" });
  assert.ok(out.includes("#101020"), "brand background was not applied");
  assert.ok(!out.includes("#0D0D0D"), "old base colour survived");
  assert.ok(!out.includes("#1A1A1A"), "card surface was not re-derived from the new base");
});

test("applyBrandKit leaves colours alone when only fonts are supplied", () => {
  const out = applyBrandKit(SAMPLE, { fontHead: "Syne", fontBody: "Inter" });
  assert.ok(out.includes("#C9922A"), "accent changed without a primary in the kit");
  assert.ok(out.includes("fonts.googleapis.com"), "web font was not loaded");
  assert.ok(out.includes("brand-kit-overrides"), "font override sheet was not injected");
  assert.ok(out.includes("</head>"), "document head was destroyed");
});

test("applyBrandKit is a no-op for an empty kit", () => {
  assert.equal(applyBrandKit(SAMPLE, {}), SAMPLE);
});

test("applyBrandKit tolerates a document with no :root palette", () => {
  const bare = "<html><body><p>no palette</p></body></html>";
  const out = applyBrandKit(bare, { primary: "#7C5CFC", fontBody: "Inter" });
  assert.ok(out.includes("no palette"), "document content was lost");
});

test("hasBrandKit reports whether anything is worth re-skinning for", () => {
  assert.equal(hasBrandKit({}), false);
  assert.equal(hasBrandKit({ primary: "" }), false);
  assert.equal(hasBrandKit({ primary: "#7C5CFC" }), true);
  assert.equal(hasBrandKit({ fontBody: "Inter" }), true);
});

test("withHeightReporter injects the reporter inside the document body", () => {
  const out = withHeightReporter(SAMPLE, "hero-v1-brand");
  assert.ok(out.includes("fsb-preview"), "reporter was not injected");
  assert.ok(out.includes("hero-v1-brand"), "frame id was not embedded");
  assert.ok(out.indexOf("fsb-preview") < out.indexOf("</body>"), "reporter landed outside the body");
});

test("isFrameHeightMessage only accepts well-formed frame messages", () => {
  assert.equal(isFrameHeightMessage({ source: "fsb-preview", id: "a", height: 100 }), true);
  assert.equal(isFrameHeightMessage({ source: "other", id: "a", height: 100 }), false);
  assert.equal(isFrameHeightMessage({ source: "fsb-preview", id: "a" }), false);
  assert.equal(isFrameHeightMessage(null), false);
  assert.equal(isFrameHeightMessage("fsb-preview"), false);
});
