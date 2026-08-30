/**
 * Assembling independently-generated sections into one deliverable file.
 *
 * Each section arrives from its own model call carrying its own scoped
 * `<style>`. Left alone that produces a document with style tags sprinkled
 * through the body — valid, but hostile to anyone who opens the file to edit
 * it, which is the whole point of the output. So styles are hoisted into a
 * single `<style>` in the head, in section order, behind the shared token
 * block.
 *
 * Pure and deterministic: the same fragments always produce the same file.
 */

export type Fragment = {
  groupId: string;
  variation: string;
  html: string;
};

const RESET = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
img, video { max-width: 100%; display: block; }
h1, h2, h3 { font-family: var(--font-head); }`;

const STYLE_TAG = /<style[^>]*>([\s\S]*?)<\/style>/gi;

/** Escapes text heading into markup. Titles can carry a client's own words. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Splits a fragment into its CSS and its markup. */
function splitStyles(html: string): { css: string; markup: string } {
  const css: string[] = [];
  const markup = html.replace(STYLE_TAG, (_match, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed) css.push(trimmed);
    return "";
  });
  return { css: css.join("\n\n"), markup: markup.trim() };
}

/**
 * The `<link>` that actually fetches the brand kit's fonts.
 *
 * Without this the document is a lie: `buildTokenBlock` writes
 * `--font-head: "Sora", …` into `:root`, the CSS looks correct, and the page
 * silently renders in the fallback stack because nothing ever downloaded Sora.
 * That failure is invisible on a machine where the font happens to be
 * installed, which is exactly how it survived unnoticed.
 *
 * Names are user input heading into a URL and an HTML attribute, so they are
 * filtered to the characters a font family actually uses rather than escaped —
 * a name needing more than letters, digits, spaces and hyphens is not a name.
 * An unknown family simply 404s at Google and the page falls back, which is no
 * worse than emitting nothing.
 */
function googleFontsLink(families: readonly string[]): string {
  const clean = families
    .map((f) => f.replace(/[^a-zA-Z0-9 \-]/g, "").trim().slice(0, 60))
    .filter((f) => f.length > 0);
  const unique = [...new Set(clean)];
  if (unique.length === 0) return "";

  const query = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800`)
    .join("&");

  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com" />\n` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n` +
    // display=swap: show the text in the fallback immediately rather than
    // holding the page blank while the font downloads.
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${query}&display=swap" />`
  );
}

export function stitchFunnel(args: {
  tokenBlock: string;
  fragments: readonly Fragment[];
  title?: string;
  /** The brand kit's three font names, in any order. Duplicates are fine. */
  fontFamilies?: readonly string[];
}): string {
  const { tokenBlock, fragments } = args;
  const title = escapeHtml((args.title ?? "Funnel").trim() || "Funnel");
  const fontLink = googleFontsLink(args.fontFamilies ?? []);

  const css: string[] = [tokenBlock, RESET];
  const body: string[] = [];

  for (const fragment of fragments) {
    const { css: fragmentCss, markup } = splitStyles(fragment.html);
    const label = `${fragment.groupId} · ${fragment.variation}`;
    if (fragmentCss) css.push(`/* ${label} */\n${fragmentCss}`);
    // The comment is the seam a human edits along later.
    body.push(`<!-- ${label} -->\n${markup}`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
${fontLink ? `${fontLink}\n` : ""}<style>
${css.join("\n\n")}
</style>
</head>
<body>
${body.join("\n\n")}
</body>
</html>
`;
}
