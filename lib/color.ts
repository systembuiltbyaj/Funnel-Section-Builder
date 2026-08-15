/**
 * Shared colour primitives.
 *
 * Extracted from lib/samples.ts, which had the first four privately, so the
 * generation pipeline could derive a design-token palette without a third copy
 * appearing in the tree. (app/private-content.tsx still carries its own
 * normHex/hexToRgb for the Brand Check linter — that code also does HSL and
 * nearest-colour matching, so folding it in is a separate job.)
 *
 * Every function takes untrusted user input: brand-kit fields come straight
 * from a text box. Malformed input returns null or the input unchanged rather
 * than throwing.
 */

export type Rgb = [number, number, number];

/** Normalise any accepted hex form to lowercase `#rrggbb`, or null. */
export function normHex(hex: string): string | null {
  let h = hex.trim().replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
  return "#" + h;
}

export function hexToRgb(hex: string): Rgb | null {
  const n = normHex(hex);
  if (!n) return null;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour by a 0–1 ratio. */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex(rgb.map((c) => c + (target - c) * t) as Rgb);
}

/** Blend `from` toward `to` by ratio `t` (0 = from, 1 = to). */
export function mix(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from;
  const r = Math.max(0, Math.min(1, t));
  return rgbToHex([
    a[0] + (b[0] - a[0]) * r,
    a[1] + (b[1] - a[1]) * r,
    a[2] + (b[2] - a[2]) * r,
  ]);
}

/** Relative luminance, used to decide whether a colour reads as dark. */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.5;
}

/**
 * Near-black or near-white, whichever reads better on `bg`.
 *
 * Pure white on a dark ground is harsh at long paragraph lengths, and pure
 * black on light is worse, so both are pulled slightly toward the background.
 */
export function readableOn(bg: string): string {
  return isDark(bg) ? "#f5f5f7" : "#0f0f14";
}
