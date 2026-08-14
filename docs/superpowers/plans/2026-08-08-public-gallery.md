# Public Section-Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the account-gated three-step wizard into a public, backend-free gallery of funnel section templates organised by the 10P framework.

**Architecture:** Two routes — `/` (gallery: category rail, two-up cards, search, sticky tray) and `/build` (funnel assembly). Supabase, Groq, all API routes and `middleware.ts` are deleted; `localStorage` alone carries state. Tasks are ordered so consumers are removed before the things they consume, keeping `npm run build` green at every commit.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-08-08-public-gallery-design.md`

**Deliberate deviation from the spec:** the spec listed `grid.tsx` and `search.tsx` as separate components. This plan folds both into `app/gallery/gallery.tsx`, which owns the two pieces of filter state (`activeGroup`, `query`) that both would need. Splitting them would mean lifting state into a parent that does nothing else. Four components instead of six.

**A note on verification honesty:** the test runner is bare `node --test` with type stripping — it cannot load `.tsx` or resolve the `@/` alias. React components therefore have **no unit tests** in this plan, and none are invented. Pure logic goes in `lib/*.ts` precisely so it *can* be tested; components are verified by typecheck, lint, build, and explicit manual checks.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/gallery-filter.ts` | Pure: flatten groups to items, filter by group + search query |
| `lib/gallery-filter.test.ts` | Tests for the above and for the extras |
| `lib/gallery-extras.ts` | The three browse-only collections shaped as gallery groups |
| `app/gallery/gallery.tsx` | Container: owns `activeGroup` + `query`, renders rail, search, grid, tray, preview modal |
| `app/gallery/rail.tsx` | The 10P category rail with counts |
| `app/gallery/card.tsx` | One variation card: thumbnail, name, descriptor, actions |
| `app/gallery/tray.tsx` | Sticky bottom tray + brand-kit panel trigger |
| `app/gallery/brand-kit-panel.tsx` | Brand inputs, opened from the tray |

**Modified**

| File | Change |
|---|---|
| `app/page.tsx` | Render `<Gallery />`, drop auth |
| `app/build/page.tsx` | Drop auth |
| `app/private-content.tsx` | Drop save/load UI, sign-out, `FlowSteps`, **and its own analyze mode** — it calls `/api/funnel-analyze` directly at line 409, so it must be stripped before Task 5 deletes that route |
| `lib/funnel-selection.ts` | Drop `AnalysisState`, bump `STORAGE_KEY` to v3 |
| `lib/funnel-selection-provider.tsx` | Drop `analysis` from context |
| `lib/funnel-selection.test.ts` | Update for v3 shape |
| `CLAUDE.md`, `README.md` | Routing table and flow description |

**Deleted**

`app/hub/`, `app/review/`, `app/sections/`, `app/reset/`, `app/auth/`, `app/auth-gate.tsx`, `app/actions.ts`, `app/api/`, `lib/supabase/`, `lib/analyze.ts`, `lib/projects-payload.ts`, `lib/projects-payload.test.ts`, `middleware.ts`, `supabase/`, `.env.example`

---

## Task 1: Pure gallery filter

**Files:**
- Create: `lib/gallery-filter.ts`
- Test: `lib/gallery-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/gallery-filter.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenGroups, filterGallery } from "./gallery-filter.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";

const GROUPS = [
  {
    id: "hero",
    label: "Hero",
    variations: [
      { id: "hero", number: "01a", label: "Hero", title: "Hero — Variation 1", description: "Centred hero with video block", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/hero-v1-thumb.webp" },
      { id: "hero", number: "01b", label: "Hero", title: "Hero — Variation 2", description: "Split layout, product shot right", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/hero-v2-thumb.webp" },
    ],
  },
  {
    id: "faq",
    label: "FAQ",
    variations: [
      { id: "faq", number: "11a", label: "FAQ", title: "FAQ — Variation 1", description: "Accordion list", labelClass: "", basePrompt: "x", varsPrompt: "y", previewSrc: "/private/faq-v1-thumb.webp" },
    ],
  },
] as never;

test("flattenGroups produces one item per variation, carrying its group", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(items.length, 3);
  assert.equal(items[0].groupId, "hero");
  assert.equal(items[0].groupLabel, "Hero");
  assert.equal(items[0].variation.number, "01a");
  assert.equal(items[2].groupId, "faq");
});

test("flattenGroups preserves previewSrc, which PromptVariation does not declare", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(items[0].variation.previewSrc, "/private/hero-v1-thumb.webp");
});

test("a null group means all groups", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "" }).length, 3);
});

test("filtering by group narrows to that group only", () => {
  const items = flattenGroups(GROUPS);
  const out = filterGallery(items, { groupId: "hero", query: "" });
  assert.equal(out.length, 2);
  assert.ok(out.every((i) => i.groupId === "hero"));
});

test("query matches the description", () => {
  const items = flattenGroups(GROUPS);
  const out = filterGallery(items, { groupId: null, query: "accordion" });
  assert.equal(out.length, 1);
  assert.equal(out[0].variation.number, "11a");
});

test("query matches the variation number and the group label", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "01b" }).length, 1);
  assert.equal(filterGallery(items, { groupId: null, query: "faq" }).length, 1);
});

test("query is case- and whitespace-insensitive", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "  SPLIT  " }).length, 1);
});

test("group and query compose", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: "hero", query: "accordion" }).length, 0);
});

test("a query matching nothing returns empty, not everything", () => {
  const items = flattenGroups(GROUPS);
  assert.equal(filterGallery(items, { groupId: null, query: "zzzzz" }).length, 0);
});

test("the real catalogue flattens to 110 items across 12 groups", () => {
  const items = flattenGroups(PROMPT_GROUPS);
  assert.equal(items.length, 110);
  assert.equal(new Set(items.map((i) => i.groupId)).size, 12);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "gallery-filter|# (pass|fail)"`
Expected: FAIL — `Cannot find module './gallery-filter.ts'`

- [ ] **Step 3: Write the implementation**

Create `lib/gallery-filter.ts`:

```ts
/**
 * Filtering for the public gallery.
 *
 * Kept as pure functions in `lib/` rather than inside the component because the
 * test runner is bare `node --test` with type stripping — it cannot load .tsx.
 * Logic that lives here is testable; logic that lives in the component is not.
 *
 * Types against `Section`, not `PromptVariation`: PROMPT_GROUPS is declared with
 * `satisfies`, so its variations keep the full Section type including
 * `previewSrc`. Typing against PromptVariation would silently drop thumbnails.
 */

import type { Section } from "./section-catalogue.ts";

export type GalleryGroup = { id: string; label: string; variations: Section[] };

export type GalleryItem = {
  groupId: string;
  groupLabel: string;
  variation: Section;
};

/** One flat list of every variation, each remembering the group it came from. */
export function flattenGroups(groups: readonly GalleryGroup[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const group of groups) {
    for (const variation of group.variations) {
      items.push({ groupId: group.id, groupLabel: group.label, variation });
    }
  }
  return items;
}

/** Everything a free-text query is matched against, lowercased once. */
function haystack(item: GalleryItem): string {
  const v = item.variation;
  return `${v.title} ${v.description} ${v.number} ${item.groupLabel}`.toLowerCase();
}

export function filterGallery(
  items: readonly GalleryItem[],
  opts: { groupId: string | null; query: string }
): GalleryItem[] {
  const query = opts.query.trim().toLowerCase();
  return items.filter((item) => {
    if (opts.groupId !== null && item.groupId !== opts.groupId) return false;
    if (query === "") return true;
    return haystack(item).includes(query);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: `# fail 0`, total count 46 + 10 = 56

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both silent (exit 0)

- [ ] **Step 6: Commit**

```bash
git add lib/gallery-filter.ts lib/gallery-filter.test.ts
git commit -m "feat(gallery): pure group + search filter for the section gallery"
```

---

## Task 2: Gallery components

Additive only — nothing routes to these yet, so the app keeps building.

**Files:**
- Create: `app/gallery/card.tsx`, `app/gallery/rail.tsx`, `app/gallery/brand-kit-panel.tsx`, `app/gallery/tray.tsx`, `app/gallery/gallery.tsx`

- [ ] **Step 1: Create the card**

Create `app/gallery/card.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { GalleryItem } from "@/lib/gallery-filter";
import { variationShortName } from "@/lib/prompt-assembly";

/**
 * One variation in the gallery.
 *
 * Three actions, deliberately separate: copying a single prompt and adding to a
 * funnel are different intents, and collapsing them into one button makes the
 * browse-and-leave visitor and the build-a-funnel visitor fight over it.
 *
 * `onPreview` is null when the variation has no rendered sample (the image-prompt
 * library, three of the five layouts, empathy-v9/v10). The button is hidden
 * rather than disabled — a dead control is worse than an absent one.
 */
export function GalleryCard({
  item,
  inFunnel,
  onPreview,
  onToggle,
  onCopy,
}: {
  item: GalleryItem;
  inFunnel: boolean;
  onPreview: (() => void) | null;
  onToggle: (() => void) | null;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const v = item.variation;

  function copy() {
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border bg-[#151230] transition ${
        inFunnel ? "border-[#7C5CFC]" : "border-[#2A2250] hover:border-[#4A3A8A]"
      }`}
    >
      {inFunnel && (
        <span className="absolute right-2 top-2 z-10 rounded-[3px] bg-[#7C5CFC] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.06em] text-white">
          IN FUNNEL
        </span>
      )}

      {v.previewSrc && (
        /* Plain img, not next/image: these thumbnails already pass unoptimized. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={v.previewSrc}
          alt={`${v.title} thumbnail`}
          loading="lazy"
          decoding="async"
          className="block aspect-[16/10] w-full object-cover"
        />
      )}

      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded-[3px] border border-[#2A2250] px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-[#6B6390]">
            {v.number}
          </span>
          <span className="truncate text-[13px] font-bold text-[#E8E4F5]" title={v.title}>
            {variationShortName(v.title)}
          </span>
        </div>

        <p className="mb-3 line-clamp-2 text-[11.5px] leading-[1.5] text-[#8B84A8]">
          {v.description}
        </p>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-md bg-[#F5C842] px-2 py-1.5 text-[11.5px] font-bold text-[#0D0B1F] transition hover:brightness-110"
          >
            {copied ? "Copied ✓" : "Copy prompt"}
          </button>

          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              title="Live preview"
              aria-label={`Live preview ${v.title}`}
              className="rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[11.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
            >
              Preview
            </button>
          )}

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title={inFunnel ? "Remove from funnel" : "Add to funnel"}
              aria-label={inFunnel ? `Remove ${v.title} from funnel` : `Add ${v.title} to funnel`}
              className={`rounded-md border px-2.5 py-1.5 text-[11.5px] transition ${
                inFunnel
                  ? "border-[#7C5CFC] text-[#9B82FF]"
                  : "border-[#2A2250] text-[#A09AB8] hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
              }`}
            >
              {inFunnel ? "✓" : "+"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the rail**

Create `app/gallery/rail.tsx`:

```tsx
"use client";

import { PROMPT_GROUPS } from "@/lib/prompt-groups";

/**
 * The 10P as a filter rail.
 *
 * It filters rather than scroll-jumps: with 110 variations a single stacked page
 * is a very long scroll, and a rail that only jumps does not earn its width.
 */
export function GalleryRail({
  activeGroup,
  onSelect,
  pickedIds,
}: {
  activeGroup: string | null;
  onSelect: (groupId: string | null) => void;
  pickedIds: string[];
}) {
  const total = PROMPT_GROUPS.reduce((n, g) => n + g.variations.length, 0);

  return (
    <nav
      aria-label="10P framework"
      className="sticky top-4 hidden h-fit w-[164px] shrink-0 flex-col gap-0.5 md:flex"
    >
      <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A5478]">
        10P Framework
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={activeGroup === null ? "true" : undefined}
        className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
          activeGroup === null
            ? "bg-[#F5C842] font-bold text-[#0D0B1F]"
            : "text-[#A09AB8] hover:text-[#E8E4F5]"
        }`}
      >
        <span>All sections</span>
        <span className={activeGroup === null ? "opacity-65" : "text-[#5A5478]"}>{total}</span>
      </button>

      {PROMPT_GROUPS.map((g) => {
        const active = activeGroup === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            aria-current={active ? "true" : undefined}
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
              active ? "bg-[#F5C842] font-bold text-[#0D0B1F]" : "text-[#A09AB8] hover:text-[#E8E4F5]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{g.label}</span>
              {pickedIds.includes(g.id) && (
                <span className={active ? "text-[#0D0B1F]" : "text-[#7C5CFC]"}>●</span>
              )}
            </span>
            <span className={active ? "opacity-65" : "text-[#5A5478]"}>{g.variations.length}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Create the brand-kit panel**

Create `app/gallery/brand-kit-panel.tsx`:

```tsx
"use client";

import { useFunnelSelection } from "@/lib/funnel-selection-provider";

/**
 * Brand inputs, lifted out of the old step 1.
 *
 * It opens from the tray instead of gating entry: a visitor arriving cold should
 * see sections first, and set a brand only once they care about the re-skin.
 */
export function BrandKitPanel({ onClose }: { onClose: () => void }) {
  const { kit, setKit } = useFunnelSelection();

  const field =
    "w-full rounded-md border border-[#2A2250] bg-[#0B091A] px-3 py-2 text-[12.5px] text-[#E8E4F5] outline-none focus:border-[#7C5CFC]";
  const label = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A5478]";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl border border-[#2A2250] bg-[#12102A] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-[#E8E4F5]">Brand kit</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md border border-[#2A2250] px-3 py-1.5 text-[11.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Done
          </button>
        </div>

        <p className="mb-4 text-[12px] leading-[1.6] text-[#8B84A8]">
          Two colours and up to three fonts. Every supporting shade is derived from these, so the
          whole funnel stays on-brand. Leave blank to keep each section&apos;s own palette.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="bk-primary">Primary</label>
            <input id="bk-primary" className={field} placeholder="#7C5CFC"
              value={kit.primary} onChange={(e) => setKit({ primary: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-background">Background</label>
            <input id="bk-background" className={field} placeholder="#0D0B1F"
              value={kit.background} onChange={(e) => setKit({ background: e.target.value })} />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className={label} htmlFor="bk-fh">Heading font</label>
            <input id="bk-fh" className={field} placeholder="Syne"
              value={kit.fontHead} onChange={(e) => setKit({ fontHead: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-fs">Sub font</label>
            <input id="bk-fs" className={field} placeholder="Inter"
              value={kit.fontSub} onChange={(e) => setKit({ fontSub: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-fb">Body font</label>
            <input id="bk-fb" className={field} placeholder="Inter"
              value={kit.fontBody} onChange={(e) => setKit({ fontBody: e.target.value })} />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="bk-images">Image notes</label>
          <textarea id="bk-images" rows={3} className={field} placeholder="Logo: /brand/logo.svg"
            value={kit.images} onChange={(e) => setKit({ images: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the tray**

Create `app/gallery/tray.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";
import { BrandKitPanel } from "./brand-kit-panel";

/**
 * What the visitor has collected, docked to the bottom.
 *
 * Hidden until something is picked, so a browse-only visitor never sees funnel
 * chrome they did not ask for.
 */
export function FunnelTray() {
  const { sel, hydrated, setSection } = useFunnelSelection();
  const [brandOpen, setBrandOpen] = useState(false);

  // Nothing until hydration finishes, so the bar cannot flash empty on first paint.
  if (!hydrated) return null;

  const picked = PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled).map((g) => {
    const v = g.variations.find((x) => x.number === sel[g.id].variation) ?? g.variations[0];
    return { id: g.id, label: g.label, name: variationShortName(v.title) };
  });
  if (picked.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#2A2250] bg-[#100C24]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3">
          <span className="shrink-0 text-[12.5px] font-bold text-[#E8E4F5]">
            {picked.length} section{picked.length === 1 ? "" : "s"}
          </span>

          {/* Chips drop below sm: on a phone the bar must not eat the viewport. */}
          <div className="hidden min-w-0 flex-1 flex-wrap gap-1.5 sm:flex">
            {picked.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSection(p.id, { enabled: false })}
                aria-label={`Remove ${p.label}`}
                title={`Remove ${p.label}`}
                className="rounded-md border border-[#2A2250] px-2 py-1 text-[11px] text-[#A09AB8] transition hover:border-[#F87171] hover:text-[#F87171]"
              >
                {p.label} · {p.name} ✕
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setBrandOpen(true)}
            className="ml-auto shrink-0 rounded-md border border-[#2A2250] px-3 py-2 text-[11.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Brand kit
          </button>

          <Link
            href="/build"
            className="shrink-0 rounded-md bg-[#7C5CFC] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
          >
            Build full funnel →
          </Link>
        </div>
      </div>

      {brandOpen && <BrandKitPanel onClose={() => setBrandOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 5: Create the container**

Create `app/gallery/gallery.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { flattenGroups, filterGallery } from "@/lib/gallery-filter";
import { buildOutputs } from "@/lib/prompt-assembly";
import { sampleForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";
import { GalleryRail } from "./rail";
import { GalleryCard } from "./card";
import { FunnelTray } from "./tray";

export function Gallery() {
  const { sel, kit, toggleSection } = useFunnelSelection();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);

  const items = useMemo(() => flattenGroups(PROMPT_GROUPS), []);
  const shown = useMemo(
    () => filterGallery(items, { groupId: activeGroup, query }),
    [items, activeGroup, query]
  );

  const pickedIds = Object.entries(sel).filter(([, v]) => v?.enabled).map(([id]) => id);
  const activeGroupMeta = PROMPT_GROUPS.find((g) => g.id === activeGroup) ?? null;

  /**
   * One section's prompt, assembled through the same path the builder uses so a
   * single-section copy and a full-funnel build cannot drift apart.
   */
  function copyPrompt(groupId: string, variationNumber: string) {
    const { blocks } = buildOutputs({
      groups: PROMPT_GROUPS,
      sel: { [groupId]: { enabled: true, variation: variationNumber, copy: "" } },
      kit,
      includeRef: true,
    });
    const text = blocks.map((b) => `${b.heading}\n${b.text}`).join("\n\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#0D0B1F] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[600px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10">
        <header className="px-4 pb-6 pt-10 text-center">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B6390]">
            10P Sales Page Framework
          </div>
          <h1
            className="text-[30px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Funnel Section <span className="text-[#F5C842]">Templates</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-[520px] text-[13px] leading-[1.6] text-[#A09AB8]">
            110 ready-made funnel sections across the 12 groups of the 10P framework. Preview any
            section live, recolour it to your brand, and take away a copy-ready prompt.
          </p>
        </header>

        <div className="mx-auto flex max-w-[1240px] gap-6 px-4 pb-28">
          <GalleryRail
            activeGroup={activeGroup}
            onSelect={setActiveGroup}
            pickedIds={pickedIds}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-5">
              <label htmlFor="gallery-search" className="sr-only">
                Search sections
              </label>
              <input
                id="gallery-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sections by name or style…"
                className="w-full rounded-lg border border-[#2A2250] bg-[#151230] px-3.5 py-2.5 text-[13px] text-[#E8E4F5] outline-none placeholder:text-[#5A5478] focus:border-[#7C5CFC]"
              />
            </div>

            <div className="mb-4">
              <h2
                className="text-[19px] font-bold"
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              >
                {activeGroupMeta ? activeGroupMeta.label : "All sections"}
              </h2>
              <p className="mt-1 text-[12px] text-[#8B84A8]">
                {shown.length} {shown.length === 1 ? "variation" : "variations"}
                {query.trim() !== "" && " matching your search"}
              </p>
            </div>

            {shown.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#2A2250] px-6 py-14 text-center">
                <p className="text-[13px] text-[#A09AB8]">
                  Nothing matches “{query}”. Try a shorter search, or pick a group on the left.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {shown.map((item) => {
                  const v = item.variation;
                  const sample = sampleForPreview(v.previewSrc);
                  const inFunnel =
                    Boolean(sel[item.groupId]?.enabled) &&
                    sel[item.groupId]?.variation === v.number;

                  return (
                    <GalleryCard
                      key={`${item.groupId}-${v.number}`}
                      item={item}
                      inFunnel={inFunnel}
                      onCopy={() => copyPrompt(item.groupId, v.number)}
                      onToggle={() => toggleSection(item.groupId, v.number)}
                      onPreview={
                        sample
                          ? () =>
                              setLive({
                                heading: v.title,
                                items: [
                                  { id: `${item.groupId}-${v.number}`, title: v.title, sampleSrc: sample },
                                ],
                              })
                          : null
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <FunnelTray />

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three exit 0. The gallery is not routed yet, so behaviour is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/gallery
git commit -m "feat(gallery): card, rail, tray, brand-kit panel and container"
```

---

## Task 3: Route `/` at the gallery, delete the wizard

**Files:**
- Modify: `app/page.tsx`
- Delete: `app/hub/`, `app/review/`, `app/sections/`

- [ ] **Step 1: Replace the home page**

Replace the whole of `app/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Gallery } from "./gallery/gallery";

export const metadata: Metadata = {
  title: "Funnel Section Templates — 10P Framework",
  description:
    "110 ready-made funnel sections across the 12 groups of the 10P Sales Page Framework. Preview live, recolour to your brand, and take a copy-ready prompt.",
};

export default function Home() {
  return <Gallery />;
}
```

Note the removals: `createClient`, the `getUser()` gate, `AuthGate`, `HubShell`, `StartFunnel`, `SavedFunnels`, and `export const dynamic = "force-dynamic"` — with no session to read, the page is static.

- [ ] **Step 2: Delete the wizard directories**

```bash
git rm -r app/hub app/review app/sections
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0, and the route list shows `/` and `/build` but no `/review` or `/sections`.

- [ ] **Step 4: Manual check**

Run: `npm run dev` then open `http://localhost:3100`.
Expected: the gallery renders with the rail, All sections selected, 110 cards. Clicking a group filters. Typing in search narrows. `+` on a card makes the tray appear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(gallery): make the gallery the front door, delete the three-step wizard"
```

---

## Task 4: Strip auth and saved funnels from the builder

**Files:**
- Modify: `app/build/page.tsx`, `app/private-content.tsx`
- Delete: `app/api/projects/`, `lib/projects-payload.ts`, `lib/projects-payload.test.ts`, `app/actions.ts`

- [ ] **Step 1: Replace the build page**

Replace the whole of `app/build/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PrivateContent } from "../private-content";

export const metadata: Metadata = {
  title: "Builder · Funnel Section Templates",
};

export default function BuildPage() {
  return <PrivateContent />;
}
```

The `redirect("/")` guard, the Supabase client and `robots: { index: false }` all go.

- [ ] **Step 2: Strip the builder shell**

In `app/private-content.tsx`, remove the `FlowSteps` import and its usage, the `lock` import, and the sign-out form. Replace the `PrivateContent` function's header block so it reads:

```tsx
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
```

- [ ] **Step 3: Remove save/load from the builder body**

In `FunnelBuilder()`, delete these three state declarations and every function and JSX block that reads them:

```tsx
  const [projects, setProjects] = useState<{ id: string; name: string; updated_at: string }[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projStatus, setProjStatus] = useState("");
```

That removes all five `fetch("/api/projects"…)` call sites, the "Save funnel" and "My Projects" controls, and the project-load handler containing `analysis: EMPTY_ANALYSIS`. Delete the now-unused `EMPTY_ANALYSIS` import on line 13.

Confirm:

```bash
grep -n "api/projects\|EMPTY_ANALYSIS\|projStatus" app/private-content.tsx
```
Expected: no output.

- [ ] **Step 4: Remove the analyze mode from the builder**

The builder has its own Groq caller at `app/private-content.tsx:409` — `fetch("/api/funnel-analyze"…)`. It is a second live consumer of the route Task 5 deletes, so it must go first or the build breaks.

Delete these five state declarations and everything that reads them (the analyze handler around lines 396–446, the analyze tab button, and the `mode === "analyze"` JSX block):

```tsx
  const [fullCopy, setFullCopy] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<{ niche: string; vibe: string } | null>(null);
```

Narrow the mode union and default it to manual:

```tsx
  const [mode, setMode] = useState<"manual" | "check">("manual");
```

Three places branch on the removed member and must be simplified — the step numbers were only offset to make room for the analyze step:

```tsx
  // was: {mode === "analyze" ? "2 ·" : "1 ·"} Brand Kit
  <span className="text-[#7C5CFC]">1 ·</span> Brand Kit

  // was: {mode === "analyze" ? "3 ·" : "2 ·"} …
  //      {mode === "analyze" ? "Review AI Picks & Copy" : "Pick Sections & Copy"}
  <span className="text-[#7C5CFC]">2 ·</span> Pick Sections & Copy
```

and the blurb around line 604 loses its `mode === "analyze"` arm, keeping the `mode === "check"` and manual arms.

Confirm:

```bash
grep -n "analyze\|Analyze" app/private-content.tsx
```
Expected: no output.

- [ ] **Step 5: Delete the API and its helpers**

```bash
git rm -r app/api/projects
git rm lib/projects-payload.ts lib/projects-payload.test.ts app/actions.ts
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: exit 0. Test total drops by 12 to 44 (56 − 12 from `projects-payload.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(build): drop auth, saved funnels and the builder's analyze mode"
```

---

## Task 5: Delete Groq

**Files:**
- Delete: `app/api/funnel-analyze/`, `lib/analyze.ts`

- [ ] **Step 1: Confirm nothing still imports it**

```bash
grep -rn "analyze\|analyzeFunnelCopy" app lib --include="*.ts" --include="*.tsx"
```
Expected: matches only inside `app/api/funnel-analyze/` and `lib/analyze.ts` themselves. There were **three** callers, all removed by now: `app/hub/start.tsx` and `app/review/review-picks.tsx` (deleted in Task 3), and the builder's own `fetch("/api/funnel-analyze"…)` (removed in Task 4 Step 4). If this grep still shows `app/private-content.tsx`, go back and finish Task 4 — deleting the route first would break the build.

- [ ] **Step 2: Delete**

```bash
git rm -r app/api/funnel-analyze
git rm lib/analyze.ts
```

- [ ] **Step 3: Verify `app/api` is now empty and remove it**

```bash
ls app/api 2>/dev/null || echo "app/api already gone"
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0. Route list has no `/api/*` entries.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ai): remove the Groq analyze endpoint and client"
```

---

## Task 6: Delete Supabase, middleware and the auth routes

**Files:**
- Delete: `lib/supabase/`, `middleware.ts`, `app/auth/`, `app/auth-gate.tsx`, `app/reset/`, `supabase/`, `.env.example`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Confirm nothing imports Supabase**

```bash
grep -rn "supabase\|createClient\|getUser" app lib middleware.ts --include="*.ts" --include="*.tsx" | grep -v "^lib/supabase/" | grep -v "^middleware.ts"
```
Expected: no output.

- [ ] **Step 2: Delete**

```bash
git rm -r lib/supabase app/auth app/reset supabase
git rm middleware.ts app/auth-gate.tsx .env.example
```

- [ ] **Step 3: Fix the stale comment in `app/layout.tsx`**

Replace the line reading `// The authed surfaces (/build, /private/*) set their own noindex.` with:

```tsx
// Public tool: every route is indexable. Nothing here is gated.
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: exit 0. Route list is exactly `/`, `/_not-found`, `/build`. No `ƒ Proxy (Middleware)` line.

- [ ] **Step 5: Manual check that assets still serve**

Run `npm run dev`, then open `http://localhost:3100/private/hero-v1-sample.html` directly.
Expected: the sample renders. Previously the middleware redirected this to `/` without a session.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(auth): remove Supabase, middleware and every environment variable"
```

---

## Task 7: State shape v3

Runs last of the code changes: every reader of `analysis` was deleted in Tasks 3–5.

**Files:**
- Modify: `lib/funnel-selection.ts`, `lib/funnel-selection-provider.tsx`, `lib/funnel-selection.test.ts`

- [ ] **Step 1: Update the test first**

In `lib/funnel-selection.test.ts`, change the storage-key assertion and remove every `analysis` expectation. The key test becomes:

```ts
test("storage key is versioned so a shape change cannot resurrect old state", () => {
  assert.match(STORAGE_KEY, /\.v\d+$/);
  assert.equal(STORAGE_KEY, "fsb.selection.v3");
});

test("v2 state with an analysis block still validates, ignoring the dead field", () => {
  const out = validatePersisted(
    {
      sel: { hero: { enabled: true, variation: "01b", copy: "hi" } },
      kit: KIT,
      analysis: { reasons: { hero: "why" }, meta: { niche: "n", vibe: "v" }, sourceCopy: "c" },
    },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b", copy: "hi" });
  assert.equal("analysis" in (out ?? {}), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: FAIL — `STORAGE_KEY` is still `fsb.selection.v2` and `analysis` is still returned.

- [ ] **Step 3: Update `lib/funnel-selection.ts`**

Change the key:

```ts
export const STORAGE_KEY = "fsb.selection.v3";
```

Delete `AnalysisMeta`, `AnalysisState` and `EMPTY_ANALYSIS`. Change `PersistedState` to:

```ts
export type PersistedState = {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
};
```

In `validatePersisted`, delete the `rawAnalysis`, `rawReasons`, `reasons` and `rawMeta` blocks, and drop `analysis` from the returned object so it ends:

```ts
  return {
    // Spread (not Object.assign) to convert back to a normal, Object.prototype-
    // rooted object: object-literal spread copies own keys via a data-property
    // definition, so a "__proto__" entry survives as an ordinary key instead of
    // re-triggering the setter Object.create(null) was used to avoid above.
    sel: { ...sel },
    kit: {
      primary: str(rawKit.primary), background: str(rawKit.background),
      fontHead: str(rawKit.fontHead), fontSub: str(rawKit.fontSub),
      fontBody: str(rawKit.fontBody), images: str(rawKit.images),
    },
  };
```

- [ ] **Step 4: Update the provider**

In `lib/funnel-selection-provider.tsx`: remove `EMPTY_ANALYSIS` and `AnalysisState` from the imports, delete the `analysis` state, `setAnalysis`, and the `analysis` entries in `ContextValue`, `replaceAll`, `reset`, the persist effect and the `useMemo` value. The persist effect becomes:

```tsx
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sel, kit }));
    } catch {
      // Quota or private-mode failures are non-fatal.
    }
  }, [sel, kit, hydrated]);
```

and the hydration effect drops its `setAnalysisState(parsed.analysis);` line.

- [ ] **Step 5: Verify**

Run: `npm test 2>&1 | grep -E "# (tests|pass|fail)"` then `npm run typecheck && npm run lint && npm run build`
Expected: `# fail 0`, and all three commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(state): drop AnalysisState, bump storage key to v3"
```

---

## Task 8: Extras collections

The three browse-only collections are exported as `Section[]`, the same type the 10P groups hold, so they reuse `GalleryItem`, `filterGallery` and `GalleryCard` unchanged. They differ in one way only: they cannot join a funnel, because the tray assembles 10P sections and an image prompt is not one.

**Files:**
- Create: `lib/gallery-extras.ts`
- Modify: `app/gallery/rail.tsx`, `app/gallery/gallery.tsx`
- Test: `lib/gallery-filter.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `lib/gallery-filter.test.ts`:

```ts
import { EXTRA_GROUPS, isExtraGroup } from "./gallery-extras.ts";

test("the extras collections expose 53 image prompts, 6 carousel and 5 layouts", () => {
  const byId = Object.fromEntries(EXTRA_GROUPS.map((g) => [g.id, g.variations.length]));
  assert.deepEqual(byId, { gptimage: 53, carousel: 6, local: 5 });
});

test("extras flatten and filter through the same functions as the 10P groups", () => {
  const items = flattenGroups(EXTRA_GROUPS);
  assert.equal(items.length, 64);
  assert.equal(filterGallery(items, { groupId: "carousel", query: "" }).length, 6);
});

test("isExtraGroup distinguishes extras from 10P groups", () => {
  assert.equal(isExtraGroup("carousel"), true);
  assert.equal(isExtraGroup("gptimage"), true);
  assert.equal(isExtraGroup("hero"), false);
  assert.equal(isExtraGroup(null), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: FAIL — `Cannot find module './gallery-extras.ts'`

- [ ] **Step 3: Write the implementation**

Create `lib/gallery-extras.ts`:

```ts
/**
 * The three browse-only collections, shaped like 10P groups so the gallery can
 * render them through the same filter and card code.
 *
 * They are not part of the 10P and cannot join a funnel: the tray assembles
 * sales-page sections, and an image prompt or a whole-page layout is not one.
 * `isExtraGroup` is what the gallery uses to withhold the add-to-funnel action.
 */

import { gptImageCards, carouselCards, localWebsiteCards } from "./section-catalogue.ts";
import type { GalleryGroup } from "./gallery-filter.ts";

export const EXTRA_GROUPS: GalleryGroup[] = [
  { id: "gptimage", label: "Image prompts", variations: gptImageCards },
  { id: "carousel", label: "Carousel", variations: carouselCards },
  { id: "local", label: "Full layouts", variations: localWebsiteCards },
];

const EXTRA_IDS = new Set(EXTRA_GROUPS.map((g) => g.id));

export function isExtraGroup(groupId: string | null): boolean {
  return groupId !== null && EXTRA_IDS.has(groupId);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 5: Add the Extras block to the rail**

In `app/gallery/rail.tsx`, import the collections and append this after the `PROMPT_GROUPS.map(...)` block, still inside the `<nav>`:

```tsx
      <div className="mt-3 border-t border-[#221C48] pt-3">
        <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A5478]">
          Extras
        </div>
        {EXTRA_GROUPS.map((g) => {
          const active = activeGroup === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g.id)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
                active ? "bg-[#F5C842] font-bold text-[#0D0B1F]" : "text-[#A09AB8] hover:text-[#E8E4F5]"
              }`}
            >
              <span className="truncate">{g.label}</span>
              <span className={active ? "opacity-65" : "text-[#5A5478]"}>{g.variations.length}</span>
            </button>
          );
        })}
      </div>
```

Add the import at the top:

```tsx
import { EXTRA_GROUPS } from "@/lib/gallery-extras";
```

Also fix the "All sections" count, which Task 2 computed from the 10P groups alone. Once extras are in the unfiltered grid the badge would say 110 while 174 cards render:

```tsx
  const total =
    PROMPT_GROUPS.reduce((n, g) => n + g.variations.length, 0) +
    EXTRA_GROUPS.reduce((n, g) => n + g.variations.length, 0);
```

- [ ] **Step 6: Include extras in the gallery**

In `app/gallery/gallery.tsx`, add the imports:

```tsx
import { EXTRA_GROUPS, isExtraGroup } from "@/lib/gallery-extras";
```

Change the `items` memo so extras are searchable alongside the 10P:

```tsx
  const items = useMemo(
    () => [...flattenGroups(PROMPT_GROUPS), ...flattenGroups(EXTRA_GROUPS)],
    []
  );
```

Change `activeGroupMeta` to look in both lists:

```tsx
  const activeGroupMeta =
    PROMPT_GROUPS.find((g) => g.id === activeGroup) ??
    EXTRA_GROUPS.find((g) => g.id === activeGroup) ??
    null;
```

And withhold the add-to-funnel action for extras — replace the `onToggle` prop on `<GalleryCard>` with:

```tsx
                      onToggle={
                        isExtraGroup(item.groupId)
                          ? null
                          : () => toggleSection(item.groupId, v.number)
                      }
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: exit 0.

- [ ] **Step 8: Manual check**

Run `npm run dev` and open `http://localhost:3100`.
Expected: the rail shows Extras with Image prompts 53, Carousel 6, Full layouts 5. Selecting Image prompts shows cards with **Copy prompt only** — no Preview (no sample) and no `+`. Selecting Carousel shows Copy prompt **and** Preview (those do have samples), still no `+`. "All sections" now totals 174.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(gallery): browse-only extras collections in the rail"
```

---

## Task 9: Documentation and final gates

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Rewrite the CLAUDE.md routing tables**

Replace the "The three-step flow" section with:

```markdown
## The two routes

| Route | Page | What it is |
|---|---|---|
| `/` | `app/page.tsx` → `app/gallery/gallery.tsx` | The gallery: rail, search, cards, tray |
| `/build` | `app/build/page.tsx` → `app/private-content.tsx` | Full-funnel assembly and the master prompt |

There is no auth, no API route, no middleware and no environment variable. State
lives in `localStorage` under `fsb.selection.v3`.
```

In the "Where things live" table, delete the rows for project CRUD, `lib/projects-payload.ts`, the Groq endpoint, auth UI, middleware and the schema, and add:

```markdown
| Gallery UI (rail, cards, search, tray) | `app/gallery/` |
| Gallery filtering (group + search) | `lib/gallery-filter.ts` |
```

- [ ] **Step 2: Rewrite the README's flow section**

Replace the numbered three-step list with:

```markdown
A public gallery of funnel section templates. Browse 110 sections across the 12
groups of the 10P framework, preview any of them live re-skinned to your brand,
and copy a ready-to-use prompt. Add sections to the tray to assemble a whole
funnel and get one combined master prompt from `/build`.

No account, no API keys, no backend — your work is kept in the browser.
```

Delete the `## Environment` table and the `## Auth` section entirely, and change the Run-locally block to drop the `.env.example` line.

- [ ] **Step 3: Confirm the docs match the code**

```bash
grep -niE "supabase|groq|passcode|three-step|/review|/sections" README.md CLAUDE.md
```
Expected: no output. Any hit is a doc that still describes deleted code.

- [ ] **Step 4: Run every gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all exit 0. Route list is exactly `/`, `/_not-found`, `/build`.

- [ ] **Step 5: Confirm no environment variables remain**

```bash
grep -rn "process.env" app lib --include="*.ts" --include="*.tsx" || echo "no env reads"
```
Expected: `no env reads`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: describe the public gallery, drop auth and Groq references"
```

---

## Post-implementation

Not part of the plan, to be done by the owner:

1. Delete `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `GROQ_API_KEY` from Vercel (Production and Preview).
2. Delete the paused Supabase project once satisfied nothing is needed from it.
3. Rotate the Groq API key — it was live in Vercel and is no longer used.
