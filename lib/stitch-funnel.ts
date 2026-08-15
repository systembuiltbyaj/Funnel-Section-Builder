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

export function stitchFunnel(args: {
  tokenBlock: string;
  fragments: readonly Fragment[];
  title?: string;
}): string {
  const { tokenBlock, fragments } = args;
  const title = escapeHtml((args.title ?? "Funnel").trim() || "Funnel");

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
<style>
${css.join("\n\n")}
</style>
</head>
<body>
${body.join("\n\n")}
</body>
</html>
`;
}
