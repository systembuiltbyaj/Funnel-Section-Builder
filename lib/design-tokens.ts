/**
 * The design contract every generated section must obey.
 *
 * Sections are generated one per request, by separate model calls that never
 * see each other's output. Handing all of them the same `:root` block is what
 * makes the stitched page look like one page instead of N unrelated ones —
 * so this must be deterministic and must never involve the model.
 *
 * Everything here derives from the two brand colours and three font names the
 * user typed. All of it is untrusted input heading into a stylesheet, so font
 * names are sanitised (see `cssFontStack`) and colours fall back rather than
 * emitting whatever was typed.
 */

import type { FunnelBrandKit } from "./prompt-assembly.ts";
import { normHex, shade, mix, readableOn, isDark } from "./color.ts";

/** Used when the user gave no background. Matches the app's own dark ground. */
const DEFAULT_BG = "#0d0b1f";

const SYSTEM_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

/**
 * A font name is user input that ends up inside a CSS declaration, so anything
 * that could terminate the declaration or open a new rule is stripped rather
 * than escaped — families are letters, digits, spaces and hyphens in practice,
 * and a name that needs more than that is not a font name.
 */
export function cssFontStack(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9 \-]/g, "").trim().slice(0, 60);
  return clean ? `"${clean}", ${SYSTEM_STACK}` : SYSTEM_STACK;
}

export type ResolvedTokens = {
  brand: string;
  brandContrast: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  fontHead: string;
  fontSub: string;
  fontBody: string;
};

/** Resolve a brand kit into the concrete values the token block will carry. */
export function resolveTokens(kit: FunnelBrandKit): ResolvedTokens {
  const bg = normHex(kit.background ?? "") ?? DEFAULT_BG;
  const text = readableOn(bg);
  const dark = isDark(bg);

  // No brand colour is a legitimate state — the user may only care about
  // structure. Rather than imposing our violet on a client's page, fall back
  // to monochrome: an accent derived from the text colour reads as a
  // deliberate choice, where a borrowed brand colour reads as a mistake.
  const brand = normHex(kit.primary ?? "") ?? text;

  return {
    brand,
    brandContrast: readableOn(brand),
    bg,
    // Surfaces lift away from the ground on dark, recede into it on light.
    surface: dark ? shade(bg, 0.06) : shade(bg, -0.04),
    border: mix(bg, text, 0.18),
    text,
    muted: mix(text, bg, 0.38),
    fontHead: cssFontStack(kit.fontHead ?? ""),
    fontSub: cssFontStack(kit.fontSub ?? ""),
    fontBody: cssFontStack(kit.fontBody ?? ""),
  };
}

/**
 * The `:root` block shared by every generated section and by the stitched
 * document. Stable key order so the output is diffable and snapshot-safe.
 */
export function buildTokenBlock(kit: FunnelBrandKit): string {
  const t = resolveTokens(kit);
  // Each token is labelled with its ROLE. A model handed bare colour values
  // will happily use --text as a card background, which yields white-on-white
  // and an invisible section — observed, not hypothetical.
  return [
    ":root {",
    `  --brand: ${t.brand};            /* accents, CTAs, emphasis. Never body text. */`,
    `  --brand-contrast: ${t.brandContrast};   /* text ON a --brand fill */`,
    `  --bg: ${t.bg};               /* the page ground. Already set on body. */`,
    `  --surface: ${t.surface};          /* cards and raised panels. The ONLY other background. */`,
    `  --border: ${t.border};           /* hairlines and dividers */`,
    `  --text: ${t.text};             /* body and headings. TEXT ONLY, never a background. */`,
    `  --muted: ${t.muted};            /* secondary text. TEXT ONLY. */`,
    `  --font-head: ${t.fontHead};`,
    `  --font-sub: ${t.fontSub};`,
    `  --font-body: ${t.fontBody};`,
    "  --radius: 14px;",
    "  --maxw: 1120px;",
    "}",
  ].join("\n");
}
