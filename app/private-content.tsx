"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { LivePreview, type PreviewItem } from "./live-preview";
import { GeneratePanel } from "./build/generate-panel";
import { sampleForPreview } from "@/lib/samples";
import { PROMPT_GROUPS as builderGroups } from "@/lib/prompt-groups";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { buildOutputs as assemblePrompts, variationShortName } from "@/lib/prompt-assembly";

function CopyButton({
  text,
  className = "",
  label = "📋 Copy Prompt",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={`rounded-md px-3.5 py-2.5 text-[12.5px] font-bold transition active:scale-[0.97] ${
        copied ? "bg-[#4ADE80] text-[#0D0B1F]" : "bg-[#F5C842] text-[#0D0B1F] hover:brightness-110"
      } ${className}`}
      style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out animate-[fadeIn_.18s_ease]"
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--tw-fade" as any]: "0",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[1100px] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 shadow-[0_30px_120px_rgba(0,0,0,0.6)] cursor-default bg-[#0B091A] [scrollbar-width:thin]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full h-auto" />
      </div>
    </div>
  );
}

// ---- Brand Check color/font helpers ----
function normHex(hex: string): string | null {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
  return "#" + h;
}
function hexToRgb(hex: string): [number, number, number] | null {
  const n = normHex(hex);
  if (!n) return null;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}
function nearestColor(hex: string, palette: string[]): string {
  let best = palette[0] ?? "";
  let bd = Infinity;
  const a = hexToRgb(hex);
  if (!a) return best;
  for (const p of palette) {
    const b = hexToRgb(p);
    if (!b) continue;
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function uniqHexes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
    const n = normHex(m);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
function kitFonts(s: string): string[] {
  return s
    .replace(/\(google fonts\)/gi, "")
    .split(/[·,+:\n/]/)
    .map((x) => x.trim().replace(/['"]/g, ""))
    .filter((x) => x && !/^(headings?|body|fonts?|google|sans-serif|serif)$/i.test(x));
}
function usedFonts(html: string): string[] {
  const out = new Set<string>();
  for (const decl of html.match(/font-family\s*:\s*([^;}'"]+)/gi) || []) {
    const first = decl.replace(/font-family\s*:/i, "").split(",")[0].replace(/['"]/g, "").trim();
    if (first && !/^(inherit|initial|unset|sans-serif|serif|monospace)$/i.test(first) && !first.startsWith("var("))
      out.add(first);
  }
  for (const l of html.match(/family=([^&":)]+)/gi) || []) {
    const name = l.replace(/family=/i, "").split(":")[0].replace(/\+/g, " ").trim();
    if (name) out.add(name);
  }
  return Array.from(out);
}

function FunnelBuilder() {
  // Selections and the brand kit live in the shared provider so the gallery
  // (app/gallery/gallery.tsx) can add sections that this builder then reads.
  // Local aliases keep the rest of this component unchanged.
  const {
    sel,
    kit,
    setSection: update,
    setKit,
    reset: resetSelection,
  } = useFunnelSelection();
  const { primary, background, fontHead, fontSub, fontBody, images } = kit;
  const setPrimary = (v: string) => setKit({ primary: v });
  const setBackground = (v: string) => setKit({ background: v });
  const setFontHead = (v: string) => setKit({ fontHead: v });
  const setFontSub = (v: string) => setKit({ fontSub: v });
  const setFontBody = (v: string) => setKit({ fontBody: v });
  // No local setter for `images` here: its input lives in
  // app/gallery/brand-kit-panel.tsx (`setKit({ images })`), which this
  // component's shared provider state already reflects.

  const [includeRef, setIncludeRef] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [mode, setMode] = useState<"manual" | "check">("manual");
  const [vPreview, setVPreview] = useState<{ src: string; alt: string } | null>(null);
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);
  const [htmlIn, setHtmlIn] = useState("");
  const [check, setCheck] = useState<{
    offColors: { hex: string; count: number; to: string }[];
    onCount: number;
    brandHexes: string[];
    fonts: string[];
    offFonts: string[];
  } | null>(null);
  const [fixedHtml, setFixedHtml] = useState<string | null>(null);

  const fieldCls =
    "w-full rounded-lg border border-[#2A2250] bg-[#0B091A] px-3 py-2.5 text-[13px] text-[#E8E4F5] placeholder-[#5A5478] focus:border-[#7C5CFC] focus:outline-none resize-y leading-[1.55]";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A09AB8] mb-1.5";

  const enabledCount = builderGroups.filter((g) => sel[g.id]?.enabled).length;

  // Brand kit fed to the live preview, so previews render in the client's
  // palette rather than each template's illustrative one. Memoised because the
  // preview frames refetch and re-skin whenever this identity changes.
  const previewKit = useMemo(
    () => ({
      primary: primary.trim(),
      background: background.trim(),
      fontHead: fontHead.trim(),
      fontSub: fontSub.trim(),
      fontBody: fontBody.trim(),
    }),
    [primary, background, fontHead, fontSub, fontBody]
  );

  /** Selected variations, in funnel order, that have a rendered sample. */
  const funnelPreviewItems = (): PreviewItem[] => {
    const items: PreviewItem[] = [];
    for (const g of builderGroups) {
      const s = sel[g.id];
      if (!s?.enabled) continue;
      const v = g.variations.find((x) => x.number === s.variation) ?? g.variations[0];
      const sampleSrc = sampleForPreview(v.previewSrc);
      if (sampleSrc) items.push({ id: `${g.id}-${v.number}`, title: v.title, sampleSrc });
    }
    return items;
  };

  const buildOutputs = useCallback(
    () =>
      assemblePrompts({
        groups: builderGroups,
        sel,
        kit: { primary, background, fontHead, fontSub, fontBody, images },
        includeRef,
      }),
    [sel, primary, background, fontHead, fontSub, fontBody, images, includeRef]
  );

  const generate = () => setGenerated(true);

  // Derived, not stored: the prompts are always a pure function of the current
  // selections and brand kit, so they stay live as either changes.
  const derived = useMemo(() => (generated ? buildOutputs() : null), [generated, buildOutputs]);
  const results = derived?.blocks ?? null;
  const fullPrompt = derived?.full ?? null;

  const runCheck = () => {
    const brandHexes = uniqHexes(`${primary} ${background}`);
    const brandHues = brandHexes
      .map((h) => hexToHsl(h))
      .filter((x): x is [number, number, number] => !!x && x[1] >= 0.08)
      .map((x) => x[0]);
    const counts: Record<string, number> = {};
    for (const m of htmlIn.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
      const n = normHex(m);
      if (n) counts[n] = (counts[n] || 0) + 1;
    }
    const used = Object.keys(counts);
    const offColors: { hex: string; count: number; to: string }[] = [];
    let onCount = 0;
    if (brandHexes.length) {
      for (const h of used) {
        const hsl = hexToHsl(h);
        let onBrand = brandHexes.includes(h);
        if (!onBrand && hsl) {
          // neutral (white/black/grey) is always allowed; otherwise must share a brand hue (a tint/shade)
          if (hsl[1] < 0.1) onBrand = true;
          else if (brandHues.length && Math.min(...brandHues.map((bh) => hueDist(hsl[0], bh))) <= 30) onBrand = true;
        }
        if (onBrand) onCount++;
        else offColors.push({ hex: h, count: counts[h] || 0, to: nearestColor(h, brandHexes) });
      }
      offColors.sort((a, b) => b.count - a.count);
    }
    const kf = kitFonts([fontHead, fontSub, fontBody].join(" · "));
    const uf = usedFonts(htmlIn);
    const offFonts = uf.filter(
      (f) => !kf.some((b) => f.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(f.toLowerCase()))
    );
    setCheck({ offColors, onCount, brandHexes, fonts: uf, offFonts });
    setFixedHtml(null);
  };

  const setSwap = (hex: string, to: string) =>
    setCheck((c) => (c ? { ...c, offColors: c.offColors.map((o) => (o.hex === hex ? { ...o, to } : o)) } : c));

  const applySwaps = () => {
    if (!check) return;
    const map = new Map(check.offColors.filter((o) => o.to).map((o) => [o.hex, o.to] as const));
    const out = htmlIn.replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => {
      const n = normHex(m);
      return n && map.has(n) ? map.get(n)! : m;
    });
    setFixedHtml(out);
  };

  const reset = () => {
    resetSelection();
    setGenerated(false);
    setHtmlIn("");
    setCheck(null);
    setFixedHtml(null);
  };

  const combined = results ? results.map((r) => r.text).join("\n\n\n") : "";

  return (
    <div className="max-w-[920px] mx-auto px-6 pb-16">
      {/* Mode toggle */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex rounded-lg border border-[#2A2250] bg-[#0B091A] p-1">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`px-4 py-1.5 text-[12.5px] font-semibold rounded-md transition ${
              mode === "manual" ? "bg-[#7C5CFC] text-white" : "text-[#A09AB8] hover:text-white"
            }`}
          >
            ✍️ Manual
          </button>
          <button
            type="button"
            onClick={() => setMode("check")}
            className={`px-4 py-1.5 text-[12.5px] font-semibold rounded-md transition ${
              mode === "check" ? "bg-[#7C5CFC] text-white" : "text-[#A09AB8] hover:text-white"
            }`}
          >
            🎨 Brand Check
          </button>
        </div>
      </div>

      <p className="text-[13px] text-[#A09AB8] leading-[1.6] mb-6 text-center">
        {mode === "check"
          ? "Built the page already? Paste its HTML here and check it against your brand kit — it flags every off-brand color/font and one-click swaps them. Deterministic, no AI, no tokens."
          : "Pick a variation per section, drop in your brand + copy, and generate one ready-to-paste prompt for each section. Pure assembly — nothing leaves your browser."}
      </p>

      {/* 1 · Brand kit */}
      <section className="rounded-[14px] border border-[#2A2250] bg-[#161330] p-6 mb-5">
        <h2
          className="text-[15px] font-bold mb-1"
          style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
        >
          <span className="text-[#7C5CFC]">1 ·</span> Brand Kit
        </h2>
        <p className="text-[12px] text-[#A09AB8] mb-4">
          Two brand colors + three font roles. The AI derives all supporting shades (text, muted,
          cards, borders) on-brand from your colors. Leave blank to keep the variation&apos;s defaults.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Primary / Accent</label>
            <input
              type="text"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="#A8BFA2 Sage Green"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Background / Base</label>
            <input
              type="text"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="#F7F6F0 Ivory White"
              className={fieldCls}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <div>
            <label className={labelCls}>Headline font</label>
            <input
              type="text"
              value={fontHead}
              onChange={(e) => setFontHead(e.target.value)}
              placeholder="Montserrat"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Subheadline font</label>
            <input
              type="text"
              value={fontSub}
              onChange={(e) => setFontSub(e.target.value)}
              placeholder="Inter"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Body font</label>
            <input
              type="text"
              value={fontBody}
              onChange={(e) => setFontBody(e.target.value)}
              placeholder="DM Sans"
              className={fieldCls}
            />
          </div>
        </div>
      </section>

      {mode !== "check" && (
      <>
      {/* 2 · Sections */}
      <section className="rounded-[14px] border border-[#2A2250] bg-[#161330] p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[15px] font-bold"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            <span className="text-[#7C5CFC]">2 ·</span> Pick Sections & Copy
          </h2>
          <span className="text-[11.5px] font-semibold text-[#A09AB8]">
            {enabledCount} selected
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {builderGroups.map((g) => {
            const s = sel[g.id];
            const v = g.variations.find((x) => x.number === s?.variation) ?? g.variations[0];
            return (
              <div
                key={g.id}
                className={`rounded-lg border p-3.5 transition ${
                  s.enabled
                    ? "border-[#7C5CFC] bg-[#1A1540]"
                    : "border-[#2A2250] bg-[#0B091A]"
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => update(g.id, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-[#7C5CFC] cursor-pointer"
                    />
                    <span className="text-[13.5px] font-semibold">{g.label}</span>
                  </label>
                  <span className="text-[11px] text-[#5A5478]">
                    {g.variations.length} variation{g.variations.length > 1 ? "s" : ""}
                  </span>
                  {s.enabled && (
                    <select
                      value={s.variation}
                      onChange={(e) => update(g.id, { variation: e.target.value })}
                      className="ml-auto max-w-[60%] rounded-md border border-[#2A2250] bg-[#0B091A] px-2.5 py-1.5 text-[12px] text-[#E8E4F5] focus:border-[#7C5CFC] focus:outline-none"
                    >
                      {g.variations.map((v) => (
                        <option key={v.number} value={v.number}>
                          {variationShortName(v.title)} — {v.description.slice(0, 56)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {s.enabled && v.previewSrc && (
                  <div className="mt-3 w-full max-w-[460px] mx-auto">
                    <button
                      type="button"
                      onClick={() => setVPreview({ src: v.previewSrc!, alt: v.title })}
                      aria-label={`Preview ${v.title}`}
                      className="group relative block w-full aspect-[2/1] overflow-hidden rounded-md border border-[#2A2250] bg-[#0B091A] cursor-zoom-in hover:border-[#7C5CFC] transition"
                    >
                      <Image
                        src={v.previewSrc}
                        alt={`${v.title} preview`}
                        fill
                        sizes="460px"
                        className="object-cover"
                        unoptimized
                      />
                      <span className="pointer-events-none absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        ⤢ Expand
                      </span>
                    </button>
                    {sampleForPreview(v.previewSrc) && (
                      <button
                        type="button"
                        onClick={() =>
                          setLive({
                            heading: v.title,
                            items: [
                              {
                                id: `${g.id}-${v.number}`,
                                title: v.title,
                                sampleSrc: sampleForPreview(v.previewSrc)!,
                              },
                            ],
                          })
                        }
                        className="mt-2 mx-auto flex w-fit items-center gap-1.5 rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[11px] font-semibold text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                      >
                        ▶ Live preview
                      </button>
                    )}
                  </div>
                )}
                {s.enabled && (
                  <textarea
                    value={s.copy}
                    onChange={(e) => update(g.id, { copy: e.target.value })}
                    rows={3}
                    placeholder={`Copy for ${g.label} — headline, subhead, CTA, body, names...`}
                    className={`${fieldCls} mt-3`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Options + generate */}
      <div className="flex flex-wrap items-center gap-3 mb-7">
        <label className="flex items-center gap-2 text-[12.5px] text-[#A09AB8] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeRef}
            onChange={(e) => setIncludeRef(e.target.checked)}
            className="h-4 w-4 accent-[#7C5CFC] cursor-pointer"
          />
          Include template reference in each block
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-[#2A2250] text-[#A09AB8] text-[12.5px] px-4 py-2.5 transition hover:border-[#F87171] hover:text-[#F87171]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              const items = funnelPreviewItems();
              if (items.length) setLive({ heading: "Full funnel preview", items });
            }}
            disabled={enabledCount === 0}
            title="Render the selected sections as one continuous page"
            className="rounded-md border border-[#2A2250] text-[#A09AB8] text-[12.5px] px-4 py-2.5 transition hover:border-[#7C5CFC] hover:text-[#E8E4F5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Preview Funnel
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={enabledCount === 0}
            className="rounded-md bg-[#7C5CFC] text-white text-[12.5px] font-bold px-5 py-2.5 transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            ⚡ Generate Prompts
          </button>
        </div>
      </div>

      {/* Results */}
      {results && results.length === 0 && (
        <p className="text-center text-[13px] text-[#A09AB8]">
          Select at least one section above, then generate.
        </p>
      )}
      {results && results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <h2
                className="text-[15px] font-bold"
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              >
                Generated · {results.length} section{results.length > 1 ? "s" : ""}
              </h2>
              <div className="text-[11px] text-[#A09AB8] mt-0.5">
                Updates live — change any variation or copy above and these refresh instantly.
              </div>
            </div>
            <CopyButton text={combined} label="📋 Copy All (separate)" className="shrink-0" />
          </div>

          {fullPrompt && (
            <div className="rounded-[14px] border-2 border-[#7C5CFC] bg-[#1A1540] mb-5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#2A2250]">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">🧩 Full Funnel — One Single HTML</div>
                  <div className="text-[11.5px] text-[#A09AB8]">
                    All {results.length} sections combined into one page, sharing one brand kit.
                  </div>
                </div>
                <CopyButton text={fullPrompt} className="shrink-0" label="📋 Copy Full Prompt" />
              </div>
              <pre className="font-mono text-[11px] text-[#C0B8E0] leading-[1.7] whitespace-pre-wrap px-5 py-4 max-h-[360px] overflow-auto">
                {fullPrompt}
              </pre>
            </div>
          )}

          {/* The prompt above is the hand-off path; this is the same thing built
              for you. Both stay available — generation can fail or be switched
              off, and the prompt must still be a real option when it does. */}
          {fullPrompt && (
            <div className="mb-5">
              <GeneratePanel />
            </div>
          )}

          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A09AB8] mb-2">
            Or build section-by-section
          </div>
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-[14px] border border-[#2A2250] bg-[#161330] mb-4 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#2A2250]">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate">{r.heading}</div>
                  <div className="text-[11.5px] text-[#A09AB8] truncate">{r.sub}</div>
                </div>
                <CopyButton text={r.text} className="shrink-0" />
              </div>
              <pre className="font-mono text-[11px] text-[#C0B8E0] leading-[1.7] whitespace-pre-wrap px-5 py-4 max-h-[340px] overflow-auto">
                {r.text}
              </pre>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* Brand Check */}
      {mode === "check" && (
        <>
          <section className="rounded-[14px] border border-[#2A2250] bg-[#161330] p-6 mb-5">
            <h2
              className="text-[15px] font-bold mb-1"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              <span className="text-[#7C5CFC]">2 ·</span> Paste Built HTML
            </h2>
            <p className="text-[12px] text-[#A09AB8] mb-4">
              Checked against the Brand Kit colors above — add your brand colors first so swaps can be suggested.
            </p>
            <textarea
              value={htmlIn}
              onChange={(e) => setHtmlIn(e.target.value)}
              rows={8}
              placeholder="Paste the generated section / page HTML here..."
              className={fieldCls}
            />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <span className="text-[11.5px] text-[#5A5478]">{htmlIn.trim().length.toLocaleString()} chars</span>
              <button
                type="button"
                onClick={runCheck}
                disabled={htmlIn.trim().length < 10}
                className="ml-auto rounded-md bg-[#7C5CFC] text-white text-[12.5px] font-bold px-5 py-2.5 transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              >
                🎨 Run Brand Check
              </button>
            </div>
          </section>

          {check && (
            <div>
              <div className="rounded-[14px] border border-[#2A2250] bg-[#161330] p-6 mb-5">
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                  <span className="text-[#4ADE80] font-semibold">
                    {check.onCount} on-brand color{check.onCount === 1 ? "" : "s"}
                  </span>
                  <span className={check.offColors.length ? "text-[#F87171] font-semibold" : "text-[#A09AB8]"}>
                    {check.offColors.length} off-brand color{check.offColors.length === 1 ? "" : "s"}
                  </span>
                  <span className={check.offFonts.length ? "text-[#F5C842] font-semibold" : "text-[#A09AB8]"}>
                    {check.offFonts.length} off-brand font{check.offFonts.length === 1 ? "" : "s"}
                  </span>
                </div>
                {check.brandHexes.length === 0 && (
                  <p className="text-[12px] text-[#F5C842] mt-3">
                    Add your brand colors in the Brand Kit panel above to enable swap suggestions.
                  </p>
                )}

                {check.offColors.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A09AB8] mb-2">
                      Off-brand colors → swap to
                    </div>
                    <div className="flex flex-col gap-2">
                      {check.offColors.map((o) => (
                        <div key={o.hex} className="flex items-center gap-2.5 text-[12.5px] flex-wrap">
                          <span className="inline-block w-5 h-5 rounded border border-white/15 shrink-0" style={{ background: o.hex }} />
                          <code className="text-[#C0B8E0]">{o.hex}</code>
                          <span className="text-[#5A5478]">×{o.count}</span>
                          <span className="text-[#5A5478]">→</span>
                          <span className="inline-block w-5 h-5 rounded border border-white/15 shrink-0" style={{ background: o.to || "transparent" }} />
                          <select
                            value={o.to}
                            onChange={(e) => setSwap(o.hex, e.target.value)}
                            className="rounded-md border border-[#2A2250] bg-[#0B091A] px-2 py-1 text-[12px] text-[#E8E4F5] focus:border-[#7C5CFC] focus:outline-none"
                          >
                            <option value="">keep as-is</option>
                            {check.brandHexes.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {check.offFonts.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A09AB8] mb-2">
                      Off-brand fonts (replace manually)
                    </div>
                    <div className="text-[12.5px] text-[#C0B8E0]">{check.offFonts.join(" · ")}</div>
                  </div>
                )}

                {check.offColors.length === 0 && check.offFonts.length === 0 ? (
                  <p className="text-[13px] text-[#4ADE80] mt-3">
                    ✓ All colors and fonts match the brand kit. Nothing to fix.
                  </p>
                ) : (
                  check.offColors.some((o) => o.to) && (
                    <div className="flex gap-2 mt-5">
                      <button
                        type="button"
                        onClick={applySwaps}
                        className="rounded-md bg-[#4ADE80] text-[#0D0B1F] text-[12.5px] font-bold px-5 py-2.5 transition hover:brightness-110 active:scale-[0.97]"
                      >
                        ✓ Apply Swaps → Corrected HTML
                      </button>
                    </div>
                  )
                )}
              </div>

              {fixedHtml && (
                <div className="rounded-[14px] border border-[#2A2250] bg-[#161330] mb-4 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#2A2250]">
                    <div className="text-[13px] font-bold">Brand-corrected HTML</div>
                    <CopyButton text={fixedHtml} className="shrink-0" />
                  </div>
                  <pre className="font-mono text-[11px] text-[#C0B8E0] leading-[1.7] whitespace-pre-wrap px-5 py-4 max-h-[340px] overflow-auto">
                    {fixedHtml}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {vPreview && (
        <Lightbox src={vPreview.src} alt={vPreview.alt} onClose={() => setVPreview(null)} />
      )}
      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={previewKit}
          onClose={() => setLive(null)}
        />
      )}
    </div>
  );
}

export function PrivateContent() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#0D0B1F] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[600px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />

      {/* Slim app bar. Browsing the catalogue lives on the hub now, so this page
          carries no section tabs and no marketing header — work starts at the
          top of the viewport instead of a screen and a half down. */}
      <header className="sticky top-0 z-30 border-b border-[#2A2250] bg-[#0D0B1F]/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="shrink-0 rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            ← Gallery
          </Link>
          <span
            className="truncate text-[13px] font-bold"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Funnel Builder
          </span>
        </div>
      </header>

      <div className="relative z-10">
        <FunnelBuilder />
      </div>
    </div>
  );
}
