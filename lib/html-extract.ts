/**
 * Turning a model's reply into a section fragment we can stitch.
 *
 * The model is told to return one `<section>` plus a scoped `<style>`, and no
 * document wrapper. Models mostly comply, so this handles the ways they do not
 * without wasting a paid call: code fences get stripped, and a whole document
 * gets salvaged down to its body rather than rejected.
 */

export type ExtractResult = {
  html: string;
  /** The reply looks cut off — unbalanced tags or a dangling `<`. */
  truncated: boolean;
  /** The model returned a whole document and we recovered the body from it. */
  salvagedFromDocument: boolean;
};

const FENCE = /^\s*```(?:html?|HTML)?\s*\n([\s\S]*?)\n?\s*```\s*$/;

/** Tags that never carry a closing partner, so they must not skew the balance. */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function countTag(html: string, tag: string): [open: number, close: number] {
  const open = html.match(new RegExp(`<${tag}\\b`, "gi"))?.length ?? 0;
  const close = html.match(new RegExp(`</${tag}\\s*>`, "gi"))?.length ?? 0;
  return [open, close];
}

export function extractSectionFragment(raw: string): ExtractResult {
  let html = (raw ?? "").trim();
  let salvagedFromDocument = false;

  const fenced = html.match(FENCE);
  if (fenced) html = fenced[1].trim();

  // A whole document is recoverable: keep the head styles (the stitcher hoists
  // them) and take the body. Failing here would bin a call we already paid for.
  if (/<!DOCTYPE|<html[\s>]/i.test(html)) {
    salvagedFromDocument = true;
    const headStyles = html.match(/<style[\s\S]*?<\/style>/gi)?.join("\n") ?? "";
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const inner = body ? body[1].trim() : "";
    html = [headStyles, inner].filter(Boolean).join("\n").trim();
  }

  const unbalanced = ["section", "style", "div"].some((tag) => {
    if (VOID_TAGS.has(tag)) return false;
    const [open, close] = countTag(html, tag);
    return open !== close;
  });

  const truncated =
    html.length === 0 ||
    unbalanced ||
    // A trailing `<` or an unterminated attribute means the reply stopped
    // mid-tag, which is what a hit token limit looks like.
    /<[^>]*$/.test(html);

  return { html, truncated, salvagedFromDocument };
}
