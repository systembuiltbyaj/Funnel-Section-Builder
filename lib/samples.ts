/**
 * Live-preview support for the section library.
 *
 * Every variation in the builder ships a rendered HTML sample under
 * `public/private/`. This module resolves a variation's thumbnail path to its
 * sample document and re-skins that document in the user's brand kit, so the
 * preview shows the client's colours and fonts rather than the template's
 * illustrative palette.
 */

import { normHex, hexToRgb, shade, luminance } from "./color.ts";

/** Slugs that have a `{slug}-sample.html` sibling in `public/private/`. */
const FLAT_SAMPLES = new Set([
  "authority-v1", "authority-v2", "authority-v3", "authority-v4", "authority-v5",
  "authority-v6", "authority-v7", "authority-v8", "authority-v9",
  "before-after-v1", "before-after-v2", "before-after-v3", "before-after-v4",
  "before-after-v5", "before-after-v6", "before-after-v8",
  "empathy-v1", "empathy-v2", "empathy-v3", "empathy-v4", "empathy-v5",
  "empathy-v6", "empathy-v7", "empathy-v8",
  "faq-v1", "faq-v2", "faq-v3", "faq-v4", "faq-v5", "faq-v6", "faq-v7", "faq-v8",
  "footer-v1", "footer-v2", "footer-v3", "footer-v4", "footer-v5", "footer-v6",
  "footer-v7", "footer-v8",
  "guarantee-v1", "guarantee-v2", "guarantee-v3", "guarantee-v4", "guarantee-v5",
  "guarantee-v6", "guarantee-v7", "guarantee-v8",
  "hero-v1", "hero-v2", "hero-v3", "hero-v4", "hero-v5", "hero-v6", "hero-v7",
  "hero-v8", "hero-v9",
  "offer-v1", "offer-v2", "offer-v3", "offer-v4", "offer-v5", "offer-v6",
  "offer-v7", "offer-v8", "offer-v9",
  "opportunity-v1", "opportunity-v2", "opportunity-v3", "opportunity-v4",
  "opportunity-v5", "opportunity-v6", "opportunity-v7", "opportunity-v8",
  "opportunity-v9",
  "proof-v1", "proof-v2", "proof-v3", "proof-v4", "proof-v5", "proof-v6",
  "proof-v7", "proof-v8",
  "urgency-v1", "urgency-v2", "urgency-v3", "urgency-v4", "urgency-v5",
  "urgency-v6", "urgency-v7", "urgency-v8",
  "usp-v1", "usp-v2", "usp-v3", "usp-v4", "usp-v5", "usp-v6", "usp-v7",
  "usp-v8", "usp-v9",
]);

/** Slugs whose sample lives at a non-standard path (sub-folder collections). */
const NESTED_SAMPLES: Record<string, string> = {
  "aia-hero-ticker": "/private/ai-academy/01-hero/hero-01-ticker.html",
  "aia-hero-space": "/private/ai-academy/01-hero/hero-02-main.html",
  "aia-opportunity-shift": "/private/ai-academy/03-opportunity/opportunity-01-ai-shift.html",
  "aia-opportunity-method": "/private/ai-academy/03-opportunity/opportunity-02-solution.html",
  "aia-usp": "/private/ai-academy/05-usp/usp-01-introducing.html",
  "aia-offer-pricing": "/private/ai-academy/06-offer/offer-01-pricing.html",
  "aia-offer-sneak": "/private/ai-academy/06-offer/offer-02-sneak-peek.html",
  "aia-offer-discover": "/private/ai-academy/06-offer/offer-03-discover-bullets.html",
  "aia-social": "/private/ai-academy/07-social-proof/socialproof-01-proof.html",
  "aia-authority": "/private/ai-academy/08-authority/authority-01-instructor.html",
  "carousel-ticker": "/private/carousel/carousel-01-marquee-ticker.html",
  "carousel-module": "/private/carousel/carousel-02-module-cards.html",
  "carousel-templates": "/private/carousel/carousel-03-templates-scroll.html",
  "carousel-tags": "/private/carousel/carousel-04-tag-pills.html",
  "layout-1-lunara": "/private/local/lunara-beach-resort.html",
  "layout-2-isla-serena": "/private/local/isla-serena.html",
};

/**
 * Resolve a variation's `previewSrc` thumbnail to its live sample document.
 * Returns null when the variation is a static reference (image-prompt library,
 * layout screenshots) with no rendered HTML behind it.
 */
export function sampleForPreview(previewSrc: string | undefined): string | null {
  if (!previewSrc) return null;
  const slug = previewSrc
    .replace(/^\/private\//, "")
    .replace(/-thumb\.webp$/, "")
    .replace(/\.webp$/, "");
  if (FLAT_SAMPLES.has(slug)) return `/private/${slug}-sample.html`;
  return NESTED_SAMPLES[slug] ?? null;
}

// ---------------------------------------------------------------------------
// Brand re-skin
// ---------------------------------------------------------------------------

export type BrandKit = {
  primary?: string;
  background?: string;
  fontHead?: string;
  fontSub?: string;
  fontBody?: string;
};


/** Read the `:root { --name: value }` declarations out of a sample document. */
function readRootVars(html: string): Record<string, string> {
  const block = html.match(/:root\s*\{([^}]*)\}/);
  if (!block) return {};
  const vars: Record<string, string> = {};
  for (const line of block[1].split(";")) {
    const m = line.match(/\s*(--[a-z0-9-]+)\s*:\s*(.+)\s*$/i);
    if (m) vars[m[1].toLowerCase()] = m[2].trim();
  }
  return vars;
}

/**
 * Pick the variable a template uses for its accent colour. Names vary across
 * the library (`--accent`, `--c1`, `--star`, …), so fall back through the
 * common aliases before giving up.
 */
function findAccentVar(vars: Record<string, string>): string | null {
  const exact = ["--accent", "--accent-2", "--c1", "--cta-bg", "--star", "--green", "--success"];
  for (const name of exact) if (vars[name] && normHex(vars[name])) return vars[name];
  for (const [name, value] of Object.entries(vars)) {
    if (name.includes("accent") && normHex(value)) return value;
  }
  return null;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every occurrence of `from` (in 6-digit, 3-digit and rgb() form) with
 * `to`, across the whole document — templates reference their palette both
 * through custom properties and as inline literals.
 */
function replaceColor(html: string, from: string, to: string): string {
  const norm = normHex(from);
  if (!norm) return html;
  let out = html.replace(new RegExp(escapeRe(norm), "gi"), to);

  const short = "#" + norm[1] + norm[3] + norm[5];
  if (normHex(short) === norm) {
    out = out.replace(new RegExp(escapeRe(short) + "\\b", "gi"), to);
  }
  const rgb = hexToRgb(norm);
  if (rgb) {
    const toRgb = hexToRgb(to);
    if (toRgb) {
      const pattern = new RegExp(`rgb\\(\\s*${rgb[0]}\\s*,\\s*${rgb[1]}\\s*,\\s*${rgb[2]}\\s*\\)`, "gi");
      out = out.replace(pattern, `rgb(${toRgb[0]}, ${toRgb[1]}, ${toRgb[2]})`);
    }
  }
  return out;
}

function googleFontsHref(families: string[]): string | null {
  const clean = [...new Set(families.map((f) => f.trim()).filter(Boolean))];
  if (clean.length === 0) return null;
  const query = clean
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/**
 * Re-skin a sample document in the client's brand kit.
 *
 * Colours are remapped by substituting the template's own accent and base
 * values throughout the document, which covers both custom-property and
 * hard-coded usage. Fonts are applied as a trailing override sheet. Templates
 * that hard-code a colour outside their `:root` palette will only partially
 * re-skin — the preview is a close approximation, not the final build.
 */
export function applyBrandKit(html: string, kit: BrandKit): string {
  const primary = kit.primary ? normHex(kit.primary) : null;
  const background = kit.background ? normHex(kit.background) : null;
  const heads = [kit.fontHead, kit.fontSub, kit.fontBody].filter(Boolean) as string[];

  let out = html;
  const vars = readRootVars(html);

  if (primary) {
    const srcAccent = findAccentVar(vars);
    if (srcAccent) out = replaceColor(out, srcAccent, primary);
    for (const alias of ["--accent-hover", "--accent-h", "--accent-2"]) {
      const value = vars[alias];
      if (value && normHex(value) && normHex(value) !== normHex(srcAccent || "")) {
        out = replaceColor(out, value, shade(primary, 0.18));
      }
    }
  }

  if (background) {
    const srcBg = vars["--bg"];
    if (srcBg && normHex(srcBg)) out = replaceColor(out, srcBg, background);
    // Surfaces sit a step off the base; keep that separation in the new palette.
    const lift = luminance(background) < 0.2 ? 0.07 : -0.05;
    for (const alias of ["--bg-card", "--bg-alt", "--card-bg", "--panel-bg", "--box-bg"]) {
      const value = vars[alias];
      if (value && normHex(value)) out = replaceColor(out, value, shade(background, lift));
    }
  }

  const overrides: string[] = [];
  const fontsHref = googleFontsHref(heads);
  if (fontsHref) {
    if (kit.fontBody) overrides.push(`*,*::before,*::after{font-family:'${kit.fontBody}',sans-serif !important}`);
    if (kit.fontHead)
      overrides.push(
        `h1,h2,h3,h1 *,h2 *,h3 *{font-family:'${kit.fontHead}',sans-serif !important}`
      );
    if (kit.fontSub)
      overrides.push(
        `h4,h5,h6,h4 *,h5 *,h6 *{font-family:'${kit.fontSub}',sans-serif !important}`
      );
  }

  const head =
    (fontsHref ? `<link rel="stylesheet" href="${fontsHref}">` : "") +
    (overrides.length ? `<style id="brand-kit-overrides">${overrides.join("")}</style>` : "");

  if (!head) return out;
  return out.includes("</head>")
    ? out.replace("</head>", `${head}</head>`)
    : head + out;
}

/** True when the kit carries at least one value worth re-skinning for. */
export function hasBrandKit(kit: BrandKit): boolean {
  return Boolean(kit.primary || kit.background || kit.fontHead || kit.fontSub || kit.fontBody);
}

/** Message a sandboxed preview frame posts to the builder when it resizes. */
export type FrameHeightMessage = { source: "fsb-preview"; id: string; height: number };

export function isFrameHeightMessage(data: unknown): data is FrameHeightMessage {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.source === "fsb-preview" && typeof d.id === "string" && typeof d.height === "number";
}

/**
 * Append a reporter that posts the document's rendered height to the parent.
 * Preview frames are sandboxed without same-origin access, so the builder
 * cannot measure them directly — the frame has to volunteer its size for
 * stacked sections to flow together without inner scrollbars.
 */
export function withHeightReporter(html: string, id: string): string {
  const script = `<script>(function(){
    var id=${JSON.stringify(id)};
    var last=0;
    function report(){
      var h=Math.max(
        document.body?document.body.scrollHeight:0,
        document.documentElement?document.documentElement.scrollHeight:0
      );
      if(h&&Math.abs(h-last)>2){last=h;parent.postMessage({source:"fsb-preview",id:id,height:h},"*");}
    }
    window.addEventListener("load",report);
    window.addEventListener("resize",report);
    if(window.ResizeObserver&&document.documentElement){new ResizeObserver(report).observe(document.documentElement);}
    setTimeout(report,120);setTimeout(report,600);setTimeout(report,1600);
  })();<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : html + script;
}
