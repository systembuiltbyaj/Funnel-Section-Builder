# Funnel Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hub at `/` that leads with the section library, shows saved funnels beneath it, and lets a user assemble a funnel by browsing and adding sections to a docked tray.

**Architecture:** Prompt assembly is extracted to a pure module so its output can be snapshotted. Selection state (`sel` + brand kit) lifts out of `FunnelBuilder` into a `FunnelSelectionProvider` mounted in the root layout and persisted to `localStorage`. The builder moves to `/build`; `/` becomes the hub, composed of three small colocated components.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript, Supabase (`@supabase/ssr`). Tests: Node built-in runner via `--experimental-strip-types`.

## Global Constraints

- **No new dependencies.** No test framework, no state library, no UI kit. Tests run on `node --test` with `--experimental-strip-types`.
- Test files import with an explicit `.ts` extension (`allowImportingTsExtensions` is enabled; `noEmit` is on).
- **Node's type stripping handles `.ts` only — never `.tsx`.** Verified: importing a `.tsx` file fails with `Unknown file extension ".tsx"`. Therefore **any logic that needs a unit test must live in a `.ts` file with no JSX.** When a module needs both testable logic and React, split it: `name.ts` for the logic and types, `name.tsx` for the component that imports it. This constraint drives the file layout in Tasks 0, 1 and 2.
- ES modules, `async/await` (never `.then()` chains), 2-space indent.
- Comment the *why*, not the *what*. No dead code, no leftover `console.log`.
- Every gate must pass before a task is complete: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- `.env.example` and the code are the source of truth for configuration; docs describe, they do not define.
- Never point a prompt or component at an asset path that does not exist under `public/private/`.
- The dev server binds port **3100** (`next dev -p 3100`).
- Commit after every task. Never push; never merge to `main`.

## Source of truth

Design spec: `docs/superpowers/specs/2026-08-07-funnel-hub-design.md`

## Existing shapes this plan depends on

Read these before starting — they exist today in `app/private-content.tsx`:

```ts
type BuilderSelection = { enabled: boolean; variation: string; copy: string };
type BuilderGroup = { id: SectionId; label: string; variations: Section[] };

// builderGroups: 12 groups derived from `sections`, in 10P order:
// hero(9) empathy(10) opportunity(11) compare(7) usp(10) offer(12)
// social(9) risk(8) authority(10) urgency(8) faq(8) footer(8)
const builderGroups: BuilderGroup[];

// Brand kit lives as six separate useState strings inside FunnelBuilder:
// primary, background, fontHead, fontSub, fontBody, images

const freshSelections: () => Record<string, BuilderSelection>;
```

`gptImageCards`, `carouselCards`, and `localWebsiteCards` are **separate** arrays, not part of `builderGroups`. They are browse-only collections and are **not addable to a funnel**.

---

### Task 0: Move the section catalogue into a testable module

The catalogue currently lives in `app/private-content.tsx`, which Node cannot import (JSX). Until it moves, no test can see the real variations, and the regression net in Task 1 would only ever check synthetic data.

This is a **pure data move**. Verified before planning: the `sections` array contains no JSX — the `Section.preview?: ReactNode` field is used zero times across the whole catalogue. Every entry is strings and string arrays.

**Files:**
- Create: `lib/section-catalogue.ts`
- Modify: `app/private-content.tsx` (delete the moved declarations, import them back)

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type SectionId =
  | "hero" | "empathy" | "opportunity" | "compare" | "usp" | "offer"
  | "social" | "risk" | "authority" | "urgency" | "faq" | "footer"
  | "gptimage" | "carousel" | "local";

export type Section = {
  id: SectionId;
  number: string;
  label: string;
  title: string;
  description: string;
  labelClass: string;
  category?: string;
  group?: string;
  previewSrc?: string;
  funnelTypes?: string[];
  basePrompt: string;
  varsPrompt: string;
};

export const labelClasses: Record<SectionId, string>;
export const sections: Section[];
export const gptImageCards: Section[];
export const carouselCards: Section[];
export const localWebsiteCards: Section[];
```

**The `preview?: ReactNode` field is dropped** from the `Section` type. It is declared today but never populated, and keeping it would force a React import into a `.ts` file — the exact thing this task exists to avoid. Removing an unused optional field changes no behaviour; the `s.preview` render branch in `private-content.tsx` becomes dead and is deleted with it.

- [ ] **Step 1: Move the declarations verbatim**

Cut from `app/private-content.tsx` and paste into `lib/section-catalogue.ts`, in this order, **without editing any content**:
1. the `SectionId` type
2. the `Section` type — minus the `preview?: ReactNode` field
3. `const labelClasses`
4. `const sections`
5. `const gptImageCards`
6. `const carouselCards`
7. `const localWebsiteCards`

Add `export` to each. The file needs **no imports at all** — if you find yourself adding one, something non-data came along by mistake; put it back.

Head the file with a comment explaining that it is data only, and that it must stay JSX-free so the test runner can import it.

- [ ] **Step 2: Import them back**

In `app/private-content.tsx`, replace the deleted declarations with:

```tsx
import {
  labelClasses, sections, gptImageCards, carouselCards, localWebsiteCards,
  type Section, type SectionId,
} from "@/lib/section-catalogue";
```

`type TabId = SectionId | "builder";` stays in `private-content.tsx` — it is a UI concern, not catalogue data.

Delete the now-dead `s.preview` branch in the card renderer (the `) : (` fallback that renders `{s.preview}`), keeping the `s.previewSrc` branch.

- [ ] **Step 3: Prove the catalogue is importable and intact**

Create `lib/section-catalogue.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sections, gptImageCards, carouselCards, localWebsiteCards, labelClasses } from "./section-catalogue.ts";

test("the catalogue is importable by the test runner", () => {
  assert.ok(sections.length > 0, "sections is empty — the move lost data");
});

test("the catalogue still holds every funnel section group", () => {
  const ids = [...new Set(sections.map((s) => s.id))];
  assert.deepEqual(ids, [
    "hero", "empathy", "opportunity", "compare", "usp", "offer",
    "social", "risk", "authority", "urgency", "faq", "footer",
  ], "group set or 10P ordering changed");
});

test("variation counts per group are unchanged", () => {
  const counts: Record<string, number> = {};
  for (const s of sections) counts[s.id] = (counts[s.id] ?? 0) + 1;
  assert.deepEqual(counts, {
    hero: 9, empathy: 10, opportunity: 11, compare: 7, usp: 10, offer: 12,
    social: 9, risk: 8, authority: 10, urgency: 8, faq: 8, footer: 8,
  }, "a variation was lost or duplicated in the move");
});

test("the browse-only collections survived", () => {
  assert.ok(gptImageCards.length > 0);
  assert.ok(carouselCards.length > 0);
  assert.ok(localWebsiteCards.length > 0);
});

test("every variation carries the fields the builder and prompts rely on", () => {
  for (const s of sections) {
    assert.ok(s.number, `${s.title}: missing number`);
    assert.ok(s.label, `${s.title}: missing label`);
    assert.ok(s.basePrompt, `${s.title}: missing basePrompt`);
    assert.ok(s.varsPrompt, `${s.title}: missing varsPrompt`);
    assert.ok(labelClasses[s.id], `${s.id}: missing label class`);
  }
});

test("variation numbers are unique within a group", () => {
  const seen = new Set<string>();
  for (const s of sections) {
    const key = `${s.id}/${s.number}`;
    assert.ok(!seen.has(key), `duplicate variation number ${key}`);
    seen.add(key);
  }
});
```

The exact counts above were measured on `main` before the move. **If a count assertion fails, the move lost data — do not edit the expected numbers to match.**

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS — 6 new tests plus the existing 12 in `lib/samples.test.ts`.

- [ ] **Step 5: Confirm the app is unchanged**

```bash
npm run typecheck && npm run lint && npm run build
```
All must pass. Then `npm run dev`, log in, and confirm the builder and every section-library tab render exactly as before. This move touches the largest file in the repo; the visual check is the one that catches a mis-paste.

- [ ] **Step 6: Commit**

```bash
git add lib/section-catalogue.ts lib/section-catalogue.test.ts app/private-content.tsx
git commit -m "refactor(catalogue): move the section catalogue into a JSX-free module"
```

---

### Task 1: Extract prompt assembly into a pure, testable module

Nothing else can be verified until this exists. Move the code **verbatim** — no logic changes, no cleanups, no renames beyond what the signature requires. Any behaviour change here is a bug.

**Files:**
- Create: `lib/prompt-assembly.ts`
- Create: `lib/prompt-assembly.test.ts`
- Modify: `app/private-content.tsx` (remove the moved helpers and `buildOutputs` body; call the new module)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
```ts
export type BuilderSelection = { enabled: boolean; variation: string; copy: string };

// Named FunnelBrandKit, NOT BrandKit: lib/samples.ts already exports a `BrandKit`
// (5 optional fields, used for preview re-skinning). Two same-named exported types
// is a footgun. This one has 6 required fields and includes `images`.
// It is structurally assignable to samples.BrandKit, so it can be passed to
// LivePreview directly.
export type FunnelBrandKit = {
  primary: string; background: string;
  fontHead: string; fontSub: string; fontBody: string;
  images: string;
};
export type PromptVariation = {
  number: string; title: string; description: string;
  basePrompt: string; varsPrompt: string;
};
export type PromptGroup = { id: string; label: string; variations: PromptVariation[] };
export type PromptBlock = { id: string; heading: string; sub: string; text: string };

export function variationShortName(title: string): string;
export function stripBrandBlocks(vars: string, labels: string[]): string;
export function sectionSpecForCombined(base: string): string;
export function buildOutputs(args: {
  groups: PromptGroup[];
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  includeRef: boolean;
}): { blocks: PromptBlock[]; full: string | null };
```

`PromptGroup`/`PromptVariation` are structural subsets of the existing `BuilderGroup`/`Section`, so `builderGroups` is assignable without moving the big `Section` type out of `private-content.tsx`.

- [ ] **Step 1: Write the failing test**

Create `lib/prompt-assembly.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutputs, variationShortName, stripBrandBlocks } from "./prompt-assembly.ts";
import type { PromptGroup, FunnelBrandKit } from "./prompt-assembly.ts";

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

const GROUPS: PromptGroup[] = [
  {
    id: "hero",
    label: "HERO",
    variations: [
      {
        number: "01a",
        title: "Hero Variation 1",
        description: "A centered hero.",
        basePrompt: "Intro line.\n\n=== OUTPUT ===\nSingle file\n\n=== LAYOUT ===\nCentered\n\nBuild the complete file now.",
        varsPrompt: "— BRAND COLORS —\n--bg: #000\n\n— FONTS —\nInter\n\n— COPY —\nHeadline",
      },
    ],
  },
];

test("variationShortName pulls the variation label out of a title", () => {
  assert.equal(variationShortName("Hero Variation 1"), "Variation 1");
  assert.equal(variationShortName("Kampo ni DOK Resort"), "Kampo ni DOK Resort");
});

test("stripBrandBlocks removes only the labelled blocks", () => {
  const vars = "— BRAND COLORS —\n#000\n\n— FONTS —\nInter\n\n— COPY —\nKeep me";
  const out = stripBrandBlocks(vars, ["BRAND COLORS", "FONTS"]);
  assert.ok(out.includes("Keep me"));
  assert.ok(!out.includes("#000"));
  assert.ok(!out.includes("Inter"));
});

test("stripBrandBlocks is a no-op with no labels", () => {
  const vars = "— BRAND COLORS —\n#000";
  assert.equal(stripBrandBlocks(vars, []), vars);
});

test("buildOutputs returns no blocks and no full prompt when nothing is enabled", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: false, variation: "01a", copy: "" } },
    kit: EMPTY_KIT,
    includeRef: true,
  });
  assert.deepEqual(out.blocks, []);
  assert.equal(out.full, null);
});

test("buildOutputs emits a block and a full prompt for an enabled section", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a", copy: "My headline" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.equal(out.blocks.length, 1);
  assert.equal(out.blocks[0].id, "hero");
  assert.ok(out.blocks[0].heading.includes("HERO"));
  assert.ok(out.blocks[0].text.includes("My headline"));
  assert.ok(out.full?.includes("My headline"));
});

test("buildOutputs puts the authoritative brand kit ahead of the spec when a kit is set", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "01a", copy: "Copy" } },
    kit: { ...EMPTY_KIT, primary: "#7C5CFC", fontHead: "Syne" },
    includeRef: false,
  });
  const text = out.blocks[0].text;
  assert.ok(text.startsWith("╔══ BRAND KIT"), "brand kit must lead the prompt");
  assert.ok(text.includes("#7C5CFC"));
  assert.ok(text.includes("Syne"));
});

test("buildOutputs falls back to the first variation when the number is unknown", () => {
  const out = buildOutputs({
    groups: GROUPS,
    sel: { hero: { enabled: true, variation: "does-not-exist", copy: "" } },
    kit: EMPTY_KIT,
    includeRef: false,
  });
  assert.equal(out.blocks.length, 1);
  assert.ok(out.blocks[0].heading.includes("Variation 1"));
});

test("sectionSpecForCombined drops the single-file output block and trailing build line", async () => {
  const { sectionSpecForCombined } = await import("./prompt-assembly.ts");
  const out = sectionSpecForCombined(GROUPS[0].variations[0].basePrompt);
  assert.ok(!out.includes("=== OUTPUT ==="), "single-file output block survived");
  assert.ok(!out.includes("Build the complete file now"), "trailing build line survived");
  assert.ok(out.includes("=== LAYOUT ==="), "section spec was lost");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './prompt-assembly.ts'`

- [ ] **Step 3: Create the module by moving code verbatim**

Create `lib/prompt-assembly.ts`. Move these from `app/private-content.tsx` **without editing their bodies**:
- `variationShortName` (currently ~line 11887)
- `stripBrandBlocks` (~11899)
- `sectionSpecForCombined` (~11918)

Then move the body of the `buildOutputs` `useCallback` (~12135–12292) into the exported function. The only permitted edits:
- Read `sel`, `includeRef` and `groups` from the `args` parameter instead of closure.
- Read `primary`, `background`, `fontHead`, `fontSub`, `fontBody`, `images` from `args.kit` — e.g. add `const { primary, background, fontHead, fontSub, fontBody, images } = args.kit;` at the top so the moved body needs no further changes.
- Replace the closed-over `builderGroups` with `args.groups`.

Add the type exports listed in the Interfaces block above. Prefix the file with a doc comment explaining that it is a verbatim extraction whose output is snapshot-tested.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 8 new tests plus the existing 12 from `lib/samples.test.ts`.

- [ ] **Step 5: Rewire `private-content.tsx` to the module**

In `app/private-content.tsx`:
- Delete the three moved helper functions and import them from `@/lib/prompt-assembly`.
- Keep the local `BuilderSelection` type or import it from the module — do not define it twice.
- Replace the `buildOutputs` `useCallback` body with a call:

```tsx
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
```

Import as `import { buildOutputs as assemblePrompts } from "@/lib/prompt-assembly";` to avoid shadowing the local name.

- [ ] **Step 6: Capture the regression fixture**

Create `lib/prompt-assembly.fixture.test.ts`. This is the net that protects every later task — it asserts real catalogue output, not toy data:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildOutputs } from "./prompt-assembly.ts";
import type { FunnelBrandKit } from "./prompt-assembly.ts";
import { PROMPT_GROUPS } from "./prompt-groups.ts";

const SNAPSHOT = new URL("./__snapshots__/prompt-output.txt", import.meta.url);

const KIT: FunnelBrandKit = {
  primary: "#7C5CFC", background: "#101020",
  fontHead: "Syne", fontSub: "Inter", fontBody: "Inter",
  images: "Logo: /brand/logo.svg",
};

const CASES = [
  { name: "hero only, no kit, no ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" } }, kit: null, includeRef: false },
  { name: "hero only, kit, ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" } }, kit: KIT, includeRef: true },
  { name: "four sections, kit, ref", sel: { hero: { enabled: true, variation: "01a", copy: "A" }, empathy: { enabled: true, variation: "02a", copy: "B" }, offer: { enabled: true, variation: "06a", copy: "C" }, faq: { enabled: true, variation: "11a", copy: "D" } }, kit: KIT, includeRef: true },
  { name: "nothing enabled", sel: {}, kit: KIT, includeRef: true },
];

const EMPTY: FunnelBrandKit = { primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" };

function render(): string {
  return CASES.map((c) => {
    const out = buildOutputs({
      groups: PROMPT_GROUPS,
      sel: c.sel as never,
      kit: c.kit ?? EMPTY,
      includeRef: c.includeRef,
    });
    return `### ${c.name}\n--- blocks ---\n${out.blocks.map((b) => b.heading + "\n" + b.text).join("\n\n")}\n--- full ---\n${out.full ?? "(null)"}`;
  }).join("\n\n========\n\n");
}

test("generated prompt output is unchanged", () => {
  const current = render();
  if (!existsSync(SNAPSHOT) || process.env.UPDATE_SNAPSHOT === "1") {
    writeFileSync(SNAPSHOT, current, "utf8");
    console.log("snapshot written — re-run without UPDATE_SNAPSHOT to assert");
    return;
  }
  assert.equal(current, readFileSync(SNAPSHOT, "utf8"), "prompt output changed");
});
```

The variation numbers in `CASES` are illustrative. **Before running, open the app and read the real `number` values** for the first variation of `hero`, `empathy`, `offer` and `faq` from `app/private-content.tsx`, and substitute them. A wrong number silently falls back to the first variation and weakens the fixture.

- [ ] **Step 7: Derive the groups from the catalogue**

Task 0 moved the catalogue into `lib/section-catalogue.ts`, so the grouping can be derived there — importable by tests and by the app alike.

Create `lib/prompt-groups.ts`:

```ts
import { sections } from "./section-catalogue.ts";
import type { PromptGroup } from "./prompt-assembly.ts";

/**
 * The catalogue grouped by section id, preserving the order the sections
 * array declares — which is 10P funnel order. Both the builder and the hub
 * library render from this, so they cannot drift apart.
 */
export const PROMPT_GROUPS: PromptGroup[] = (() => {
  const order: string[] = [];
  const byId = new Map<string, typeof sections>();
  for (const s of sections) {
    if (s.basePrompt.trim().toLowerCase().startsWith("coming soon")) continue;
    if (!byId.has(s.id)) {
      byId.set(s.id, []);
      order.push(s.id);
    }
    byId.get(s.id)!.push(s);
  }
  return order.map((id) => ({ id, label: byId.get(id)![0].label, variations: byId.get(id)! }));
})();
```

This is the existing `builderGroups` derivation moved verbatim — including the `coming soon` filter, which currently matches nothing but must be preserved.

In `app/private-content.tsx`, delete the local `builderGroups` IIFE and `import { PROMPT_GROUPS as builderGroups } from "@/lib/prompt-groups";` so the rest of the file needs no changes.

- [ ] **Step 8: Generate and verify the snapshot**

```bash
mkdir -p lib/__snapshots__
UPDATE_SNAPSHOT=1 npm test
npm test
```
Expected: second run PASSES against the written snapshot. Open `lib/__snapshots__/prompt-output.txt` and confirm it contains real prompt text (not empty, not `(null)` for the enabled cases).

- [ ] **Step 9: Verify against the running app**

Start `npm run dev`, log in, enable Hero + Empathy + Offer + FAQ with the same brand kit and copy as the fixture, generate, and spot-check that the on-screen prompt matches the snapshot for one section. This is the only check that the extraction preserved behaviour end-to-end.

- [ ] **Step 10: Run all gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add lib/prompt-assembly.ts lib/prompt-assembly.test.ts lib/prompt-assembly.fixture.test.ts lib/prompt-groups.ts lib/__snapshots__ app/private-content.tsx
git commit -m "refactor(prompts): extract prompt assembly into a pure, snapshot-tested module"
```

---

### Task 2: Selection provider with validated hydration

**Split across two files by necessity, not preference:** `validatePersisted` must be unit-tested, and Node cannot import `.tsx`. The pure logic and types go in `lib/funnel-selection.ts`; the React provider goes in `lib/funnel-selection.tsx` and imports from it.

**Files:**
- Create: `lib/funnel-selection.ts` (types, `STORAGE_KEY`, `validatePersisted` — no JSX, no React import)
- Create: `lib/funnel-selection.tsx` (`FunnelSelectionProvider`, `useFunnelSelection`)
- Create: `lib/funnel-selection.test.ts`

**Interfaces:**
- Consumes: `BuilderSelection`, `FunnelBrandKit` from `lib/prompt-assembly.ts` (Task 1).
- Produces:
```ts
export const STORAGE_KEY = "fsb.selection.v1";
export type PersistedState = { sel: Record<string, BuilderSelection>; kit: FunnelBrandKit };
export type CatalogueShape = Record<string, string[]>; // group id -> valid variation numbers

export function validatePersisted(raw: unknown, catalogue: CatalogueShape): PersistedState | null;
export function FunnelSelectionProvider(props: {
  children: React.ReactNode;
  catalogue: CatalogueShape;
  initialSel: Record<string, BuilderSelection>;
}): React.ReactElement;
export function useFunnelSelection(): {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  hydrated: boolean;
  enabledIds: string[];
  setSection: (id: string, patch: Partial<BuilderSelection>) => void;
  toggleSection: (id: string, variation: string) => void;
  setKit: (patch: Partial<FunnelBrandKit>) => void;
  replaceAll: (next: PersistedState) => void;
  reset: () => void;
};
```

- [ ] **Step 1: Write the failing test**

Create `lib/funnel-selection.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePersisted, STORAGE_KEY } from "./funnel-selection.ts";

const CATALOGUE = { hero: ["01a", "01b"], faq: ["11a"] };
const KIT = { primary: "#7C5CFC", background: "", fontHead: "", fontSub: "", fontBody: "", images: "" };

test("storage key is versioned so a shape change cannot resurrect old state", () => {
  assert.match(STORAGE_KEY, /\.v\d+$/);
});

test("validatePersisted keeps entries that match the catalogue", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: true, variation: "01b", copy: "hi" } }, kit: KIT },
    CATALOGUE
  );
  assert.deepEqual(out?.sel.hero, { enabled: true, variation: "01b", copy: "hi" });
  assert.equal(out?.kit.primary, "#7C5CFC");
});

test("validatePersisted drops group ids that no longer exist", () => {
  const out = validatePersisted(
    { sel: { ghost: { enabled: true, variation: "99z", copy: "" } }, kit: KIT },
    CATALOGUE
  );
  assert.deepEqual(out?.sel, {});
});

test("validatePersisted repairs a dead variation number to the group's first", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: true, variation: "gone", copy: "keep" } }, kit: KIT },
    CATALOGUE
  );
  assert.equal(out?.sel.hero.variation, "01a", "should fall back to the first valid variation");
  assert.equal(out?.sel.hero.copy, "keep", "copy must survive the repair");
});

test("validatePersisted rejects junk rather than throwing", () => {
  assert.equal(validatePersisted(null, CATALOGUE), null);
  assert.equal(validatePersisted("nope", CATALOGUE), null);
  assert.equal(validatePersisted({ sel: "bad" }, CATALOGUE), null);
  assert.equal(validatePersisted({}, CATALOGUE), null);
});

test("validatePersisted coerces malformed entry fields", () => {
  const out = validatePersisted(
    { sel: { hero: { enabled: "yes", variation: "01a", copy: 42 } }, kit: {} },
    CATALOGUE
  );
  assert.equal(out?.sel.hero.enabled, true);
  assert.equal(out?.sel.hero.copy, "");
  assert.equal(out?.kit.primary, "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './funnel-selection.tsx'`

- [ ] **Step 3: Implement the module**

Create `lib/funnel-selection.tsx` with `"use client"` at the top. `validatePersisted` must be pure and exported separately from the React parts so the test can import it without a DOM.

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";

/** Bumped whenever PersistedState's shape changes, so stale state is ignored. */
export const STORAGE_KEY = "fsb.selection.v1";

export type PersistedState = { sel: Record<string, BuilderSelection>; kit: FunnelBrandKit };
export type CatalogueShape = Record<string, string[]>;

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Validate state read back from localStorage against the live catalogue.
 * A tray saved weeks ago can name a variation that no longer exists; left
 * unchecked the builder's `find()` returns undefined and silently substitutes a
 * section the user never picked. Unknown groups are dropped, dead variations are
 * repaired to the group's first, and the user's copy is preserved either way.
 */
export function validatePersisted(raw: unknown, catalogue: CatalogueShape): PersistedState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sel !== "object" || obj.sel === null) return null;

  const sel: Record<string, BuilderSelection> = {};
  for (const [id, value] of Object.entries(obj.sel as Record<string, unknown>)) {
    const valid = catalogue[id];
    if (!valid || valid.length === 0) continue;
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    const variation = str(entry.variation);
    sel[id] = {
      enabled: Boolean(entry.enabled),
      variation: valid.includes(variation) ? variation : valid[0],
      copy: str(entry.copy),
    };
  }

  const rawKit = (typeof obj.kit === "object" && obj.kit !== null ? obj.kit : {}) as Record<string, unknown>;
  return {
    sel,
    kit: {
      primary: str(rawKit.primary), background: str(rawKit.background),
      fontHead: str(rawKit.fontHead), fontSub: str(rawKit.fontSub),
      fontBody: str(rawKit.fontBody), images: str(rawKit.images),
    },
  };
}

type ContextValue = ReturnType<typeof useFunnelSelection>;
const Ctx = createContext<ContextValue | null>(null);

export function FunnelSelectionProvider({
  children, catalogue, initialSel,
}: {
  children: React.ReactNode;
  catalogue: CatalogueShape;
  initialSel: Record<string, BuilderSelection>;
}) {
  const [sel, setSel] = useState(initialSel);
  const [kit, setKitState] = useState<FunnelBrandKit>(EMPTY_KIT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount, never during render: localStorage does not exist on the
  // server and reading it in render causes a hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = validatePersisted(JSON.parse(stored), catalogue);
        if (parsed) {
          setSel((prev) => ({ ...prev, ...parsed.sel }));
          setKitState(parsed.kit);
        }
      }
    } catch {
      // Corrupt or unavailable storage is not worth failing the app over.
    }
    setHydrated(true);
  }, [catalogue]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sel, kit }));
    } catch {
      // Quota or private-mode failures are non-fatal.
    }
  }, [sel, kit, hydrated]);

  const setSection = useCallback((id: string, patch: Partial<BuilderSelection>) => {
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const toggleSection = useCallback((id: string, variation: string) => {
    setSel((prev) => {
      const current = prev[id];
      const turningOff = current?.enabled && current.variation === variation;
      return { ...prev, [id]: { ...current, enabled: !turningOff, variation } };
    });
  }, []);

  const setKit = useCallback((patch: Partial<FunnelBrandKit>) => {
    setKitState((prev) => ({ ...prev, ...patch }));
  }, []);

  const replaceAll = useCallback((next: PersistedState) => {
    setSel(next.sel);
    setKitState(next.kit);
  }, []);

  const reset = useCallback(() => {
    setSel(initialSel);
    setKitState(EMPTY_KIT);
  }, [initialSel]);

  const enabledIds = useMemo(
    () => Object.entries(sel).filter(([, v]) => v?.enabled).map(([id]) => id),
    [sel]
  );

  const value = useMemo(
    () => ({ sel, kit, hydrated, enabledIds, setSection, toggleSection, setKit, replaceAll, reset }),
    [sel, kit, hydrated, enabledIds, setSection, toggleSection, setKit, replaceAll, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnelSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFunnelSelection must be used inside FunnelSelectionProvider");
  return ctx;
}
```

Note the `ContextValue` type refers to `useFunnelSelection`'s return type; if TypeScript complains about the circularity, declare an explicit `ContextValue` interface listing the fields from the Interfaces block instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 new tests.

- [ ] **Step 5: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add lib/funnel-selection.tsx lib/funnel-selection.test.ts
git commit -m "feat(state): add funnel selection provider with validated hydration"
```

---

### Task 3: Mount the provider and move the builder onto it

The riskiest task. The fixture from Task 1 is what proves it worked.

**Files:**
- Modify: `app/layout.tsx` (mount provider)
- Create: `lib/catalogue.ts` (derive `CatalogueShape` from `builderGroups`)
- Modify: `app/private-content.tsx` (`FunnelBuilder` reads context instead of local state)

**Interfaces:**
- Consumes: `FunnelSelectionProvider`, `useFunnelSelection`, `CatalogueShape` (Task 2); `PROMPT_GROUPS` (Task 1).
- Produces: `export const CATALOGUE: CatalogueShape` from `lib/catalogue.ts`.

- [ ] **Step 1: Create the catalogue shape**

```ts
// lib/catalogue.ts
import { PROMPT_GROUPS } from "./prompt-groups.ts";
import type { CatalogueShape } from "./funnel-selection.ts";

/** group id -> the variation numbers that currently exist for it. */
export const CATALOGUE: CatalogueShape = Object.fromEntries(
  PROMPT_GROUPS.map((g) => [g.id, g.variations.map((v) => v.number)])
);

export const INITIAL_SEL = Object.fromEntries(
  PROMPT_GROUPS.map((g) => [g.id, { enabled: false, variation: g.variations[0].number, copy: "" }])
);
```

- [ ] **Step 2: Mount the provider in the root layout**

In `app/layout.tsx`, wrap `{children}`:

```tsx
<body className="font-sans">
  <FunnelSelectionProvider catalogue={CATALOGUE} initialSel={INITIAL_SEL}>
    {children}
  </FunnelSelectionProvider>
</body>
```

Also in this step, **remove the blanket `robots: { index: false, follow: false }`** from the root `metadata` — a public signup page must be findable. Add it back per-route in Task 4.

- [ ] **Step 3: Point `FunnelBuilder` at the context**

In `app/private-content.tsx`, inside `FunnelBuilder`:
- Delete the six brand-kit `useState` lines and `const [sel, setSel] = useState(...)`.
- Replace with `const { sel, kit, setSection, setKit, replaceAll, reset: resetSelection } = useFunnelSelection();`
- Every `setPrimary(x)` becomes `setKit({ primary: x })`; same for the other five.
- Every read of `primary` becomes `kit.primary`; same for the rest.
- `update(id, patch)` becomes `setSection(id, patch)` — delete the local `update`.
- `loadProject` calls `replaceAll({ sel: d.sel ?? INITIAL_SEL, kit: {...} })`.
- The local `reset` calls `resetSelection()` for the selection/kit portion and keeps clearing its own local state (`fullCopy`, `reasons`, `meta`, `generated`).
- `freshSelections` is superseded by `INITIAL_SEL` — delete it and its uses.

- [ ] **Step 4: Guard project load over a dirty tray**

In `loadProject`, before `replaceAll`:

```tsx
const dirty = Object.values(sel).some((s) => s?.enabled);
if (dirty && !window.confirm("Loading this funnel will replace the sections you have selected. Continue?")) {
  setProjStatus("");
  return;
}
```

- [ ] **Step 5: Run the fixture and confirm output is byte-identical**

Run: `npm test`
Expected: PASS, **including `generated prompt output is unchanged`**. If that test fails, the state lift changed behaviour — diff the snapshot and fix before continuing. Do **not** regenerate the snapshot to make it pass.

- [ ] **Step 6: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/layout.tsx lib/catalogue.ts app/private-content.tsx
git commit -m "refactor(state): lift selection and brand kit into the shared provider"
```

---

### Task 4: Add the `/build` route

**Files:**
- Create: `app/build/page.tsx`
- Modify: `middleware.ts:57` (matcher)

**Interfaces:**
- Consumes: `PrivateContent` from `app/private-content.tsx`.
- Produces: the `/build` route.

- [ ] **Step 1: Create the route**

```tsx
// app/build/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrivateContent } from "../private-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Builder · Funnel Section Builder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/");
  return <PrivateContent />;
}
```

- [ ] **Step 2: Add `/build` to the middleware matcher**

In `middleware.ts`, change:

```ts
export const config = {
  matcher: ["/", "/build", "/private/:path*"],
};
```

Without this the Supabase session never refreshes on the builder page, and a long editing session expires with no visible cause.

- [ ] **Step 3: Verify both routes by hand**

```bash
npm run dev
```
- Logged out, visit `/build` → redirected to `/`.
- Logged in, visit `/build` → the builder renders.
- Select a section at `/build`, navigate to `/`, come back → the selection is still there (provider + localStorage).

- [ ] **Step 4: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/build/page.tsx middleware.ts
git commit -m "feat(routes): add /build route with session refresh and auth guard"
```

---

### Task 5: The library — grouped 10P scroll with a sticky stage rail

**Files:**
- Create: `app/hub/library.tsx`

**Interfaces:**
- Consumes: `useFunnelSelection` (Task 2); `PROMPT_GROUPS` (Task 1); `sampleForPreview`, `LivePreview`, `PreviewItem` (already shipped).
- Produces: `export function SectionLibrary(): React.ReactElement`

**Behaviour:**
- Render one row per group from `PROMPT_GROUPS`, in array order (already 10P order: hero → footer).
- Each row: a `.label` header (`{index+1} · {group.label} — {n} variations`) and a horizontally scrolling strip of variation cards.
- Each card shows the thumbnail (`variation.previewSrc`, `loading="lazy"`), the short variation name, an **Add / Added** toggle calling `toggleSection(group.id, variation.number)`, and a **▶ Live** button when `sampleForPreview(previewSrc)` is non-null.
- Sticky left rail lists the 12 groups; clicking scrolls to that row. Active state driven by `IntersectionObserver` on the row headings — not scroll maths.
- Do **not** render `gptImageCards`, `carouselCards`, or `localWebsiteCards` here; they are not funnel sections and are not addable.

- [ ] **Step 1: Build the component**

Thumbnails must lazy-load (116 of them) and the observer must be cleaned up. Use plain `<img loading="lazy" decoding="async">` rather than `next/image`: the existing code already passes `unoptimized`, so `next/image` adds no value here and complicates a 116-item grid.

`PROMPT_GROUPS` carries only the prompt fields, so the library also needs `previewSrc`. Extend `PromptVariation` in `lib/prompt-assembly.ts` with `previewSrc?: string` — it is already present on every `Section`, and `buildOutputs` simply ignores it.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";
import { sampleForPreview } from "@/lib/samples";
import { LivePreview, type PreviewItem } from "../live-preview";

export function SectionLibrary() {
  const { sel, kit, toggleSection } = useFunnelSelection();
  const [activeId, setActiveId] = useState(PROMPT_GROUPS[0]?.id ?? "");
  const [live, setLive] = useState<{ heading: string; items: PreviewItem[] } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  // Drive the rail's active state off what is actually on screen. Scroll maths
  // breaks as soon as rows have different heights, which they do.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id.replace("group-", ""));
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    rowRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mx-auto flex max-w-[1200px] gap-6 px-4 py-8">
      <nav
        aria-label="Funnel stages"
        className="sticky top-6 hidden h-fit w-[150px] shrink-0 flex-col gap-0.5 md:flex"
      >
        {PROMPT_GROUPS.map((g, i) => (
          <a
            key={g.id}
            href={`#group-${g.id}`}
            aria-current={activeId === g.id ? "true" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-[11.5px] transition ${
              activeId === g.id
                ? "bg-[#1A1540] font-semibold text-[#E8E4F5]"
                : "text-[#5A5478] hover:text-[#A09AB8]"
            }`}
          >
            {String(i + 1).padStart(2, "0")} · {g.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {PROMPT_GROUPS.map((g, i) => (
          <div
            key={g.id}
            id={`group-${g.id}`}
            ref={(el) => {
              if (el) rowRefs.current.set(g.id, el);
              else rowRefs.current.delete(g.id);
            }}
            className="mb-9 scroll-mt-6"
          >
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A09AB8]">
              {String(i + 1).padStart(2, "0")} · {g.label} — {g.variations.length} variations
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {g.variations.map((v) => {
                const active = sel[g.id]?.enabled && sel[g.id]?.variation === v.number;
                const sample = sampleForPreview(v.previewSrc);
                return (
                  <div
                    key={v.number}
                    className={`w-[230px] shrink-0 overflow-hidden rounded-lg border bg-[#0B091A] transition ${
                      active ? "border-[#7C5CFC]" : "border-[#2A2250] hover:border-[#4A3A8A]"
                    }`}
                  >
                    {v.previewSrc && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={v.previewSrc}
                        alt={`${v.title} thumbnail`}
                        loading="lazy"
                        decoding="async"
                        className="block aspect-[2/1] w-full object-cover"
                      />
                    )}
                    <div className="p-2.5">
                      <div className="mb-2 truncate text-[12px] font-semibold text-[#E8E4F5]">
                        {variationShortName(v.title)}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSection(g.id, v.number)}
                          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                            active
                              ? "bg-[#7C5CFC] text-white"
                              : "border border-[#2A2250] text-[#A09AB8] hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                          }`}
                        >
                          {active ? "✓ Added" : "+ Add"}
                        </button>
                        {sample && (
                          <button
                            type="button"
                            onClick={() =>
                              setLive({
                                heading: v.title,
                                items: [{ id: `${g.id}-${v.number}`, title: v.title, sampleSrc: sample }],
                              })
                            }
                            aria-label={`Live preview ${v.title}`}
                            className="rounded-md border border-[#2A2250] px-2 py-1.5 text-[11px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {live && (
        <LivePreview
          heading={live.heading}
          items={live.items}
          kit={kit}
          onClose={() => setLive(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify by hand**

`npm run dev`, log in, open `/`. Confirm: all 12 groups render in 10P order; the rail highlights the group you are looking at; **Add** flips to **Added** and the card shows it; **▶ Live** opens the preview; scrolling stays smooth with thumbnails loading lazily.

- [ ] **Step 3: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/hub/library.tsx
git commit -m "feat(hub): section library grouped in 10P order with sticky stage rail"
```

---

### Task 6: The docked funnel tray

**Files:**
- Create: `app/hub/funnel-tray.tsx`

**Interfaces:**
- Consumes: `useFunnelSelection` (Task 2); `PROMPT_GROUPS` (Task 1).
- Produces: `export function FunnelTray(): React.ReactElement | null`

**Behaviour:**
- Returns `null` when `!hydrated` or no section is enabled — no empty bar, and nothing flashes on first paint.
- Fixed to the viewport bottom, above all page content.
- Shows the count, then one chip per enabled section in `PROMPT_GROUPS` order (`{label} {variationShortName}`), each chip removable.
- Primary action: **Open builder →**, a `next/link` to `/build`.
- Below `sm`, chips are hidden and only the count plus the CTA remain — the bar must not eat vertical space on a phone.

- [ ] **Step 1: Build the component**

```tsx
"use client";

import Link from "next/link";
import { useFunnelSelection } from "@/lib/funnel-selection";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";

export function FunnelTray() {
  const { sel, hydrated, setSection } = useFunnelSelection();
  if (!hydrated) return null;

  const picked = PROMPT_GROUPS
    .filter((g) => sel[g.id]?.enabled)
    .map((g) => {
      const v = g.variations.find((x) => x.number === sel[g.id].variation) ?? g.variations[0];
      return { id: g.id, label: g.label, name: variationShortName(v.title) };
    });
  if (picked.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#2A2250] bg-[#100C24]/95 backdrop-blur px-4 py-3">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <span className="shrink-0 text-[12.5px] font-bold text-[#E8E4F5]">
          {picked.length} section{picked.length === 1 ? "" : "s"}
        </span>
        <div className="hidden sm:flex min-w-0 flex-1 flex-wrap gap-1.5">
          {picked.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSection(p.id, { enabled: false })}
              aria-label={`Remove ${p.label}`}
              className="rounded-md border border-[#2A2250] px-2 py-1 text-[11px] text-[#A09AB8] transition hover:border-[#F87171] hover:text-[#F87171]"
            >
              {p.label} · {p.name} ✕
            </button>
          ))}
        </div>
        <Link
          href="/build"
          className="ml-auto shrink-0 rounded-md bg-[#7C5CFC] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
        >
          Open builder →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Add sections on `/` and confirm: the bar appears only after the first add; chips match the picks; removing a chip clears the card's **Added** state; **Open builder** lands on `/build` with the same sections enabled; refreshing `/` keeps the tray; at a 375px viewport only the count and CTA show.

- [ ] **Step 3: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/hub/funnel-tray.tsx
git commit -m "feat(hub): docked funnel tray with removable section chips"
```

---

### Task 7: Saved funnels, with honest failure states

**Files:**
- Create: `app/hub/saved-funnels.tsx`

**Interfaces:**
- Consumes: `/api/projects`.
- Produces: `export function SavedFunnels(): React.ReactElement | null`

**Behaviour:**
- Returns `null` when `!process.env.NEXT_PUBLIC_SUPABASE_URL` — matches the app's existing env-guarded pattern.
- Four distinct states, never conflated: `loading`, `error` (any non-OK response, message names it), `empty` ("No funnels yet — add sections above and they'll collect here."), `list`.
- A 401 must render "Your session expired — sign in again", **not** the empty state. The current `refreshProjects` swallows every error in `catch {}`, which tells a logged-out user with twelve funnels that they have none.

- [ ] **Step 1: Build the component**

```tsx
"use client";

import { useEffect, useState } from "react";

type Project = { id: string; name: string; updated_at: string };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; projects: Project[] };

export function SavedFunnels() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "error", message: "Your session expired — sign in again to see your funnels." });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: "Could not load your funnels. Try again in a moment." });
          return;
        }
        const data = await res.json();
        setState({ kind: "ready", projects: data.projects ?? [] });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Could not reach the server." });
      }
    })();
    return () => { cancelled = true; };
  }, [configured]);

  if (!configured) return null;

  return (
    <section className="mx-auto max-w-[1200px] border-t border-[#2A2250] px-4 py-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A09AB8]">
        Your funnels
      </h2>

      {state.kind === "loading" && (
        <p className="text-[12.5px] text-[#5A5478]">Loading your funnels…</p>
      )}

      {state.kind === "error" && (
        <p className="rounded-lg border border-[#4A2250] bg-[#1A0F24] px-4 py-3 text-[12.5px] text-[#F87171]">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && state.projects.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#2A2250] px-4 py-6 text-center text-[12.5px] text-[#5A5478]">
          No funnels yet — add sections above and they&apos;ll collect here.
        </p>
      )}

      {state.kind === "ready" && state.projects.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.projects.map((p) => (
            <li key={p.id}>
              <Link
                href="/build"
                className="block rounded-lg border border-[#2A2250] bg-[#0B091A] p-3.5 transition hover:border-[#7C5CFC]"
              >
                <div className="truncate text-[13px] font-semibold text-[#E8E4F5]">{p.name}</div>
                <div className="mt-1 text-[11px] text-[#5A5478]">
                  Updated {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Add `import Link from "next/link";` at the top. Loading a project's contents stays in the builder's existing **My Projects** control — these cards navigate to `/build`; they do not duplicate the load logic.

- [ ] **Step 2: Verify the failure states by hand**

- Signed in with saved funnels → cards listing name, section count and relative date.
- Signed in with none → the empty message.
- **Force the 401:** in devtools delete the `sb-*-auth-token` cookies, reload → the expiry message, **not** "no funnels yet". This is the specific lie being fixed; confirm it.

- [ ] **Step 3: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/hub/saved-funnels.tsx
git commit -m "feat(hub): saved funnels with distinct loading, error and empty states"
```

---

### Task 8: Compose the hub at `/` and verify end to end

**Files:**
- Modify: `app/page.tsx`
- Modify: `README.md` (fix the "internal tool" line the spec flagged)

**Interfaces:**
- Consumes: `SectionLibrary` (Task 5), `FunnelTray` (Task 6), `SavedFunnels` (Task 7).

- [ ] **Step 1: Render the hub**

`app/page.tsx` keeps its existing `getUser()` guard; when a user is present it renders the hub instead of `PrivateContent`:

```tsx
import type { Metadata } from "next";
import { AuthGate } from "./auth-gate";
import { SectionLibrary } from "./hub/library";
import { SavedFunnels } from "./hub/saved-funnels";
import { FunnelTray } from "./hub/funnel-tray";
import { lock } from "./actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Browse 116 ready-made funnel sections across the 10P framework and turn them into copy-ready AI prompts.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return <AuthGate />;

  return (
    // pb-24 reserves room for the docked tray so it cannot cover the last row.
    <main className="relative min-h-[100dvh] bg-[#0D0B1F] pb-24 text-white">
      <header className="mx-auto flex max-w-[1200px] items-start justify-between gap-4 px-4 pt-10 pb-2">
        <div>
          <h1
            className="text-[26px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Build a funnel, <em className="not-italic text-[#F5C842]">section by section</em>
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-[1.6] text-[#A09AB8]">
            Ready-made sections across the 10P framework. Browse, add what fits, then fill in
            your copy in the builder.
          </p>
        </div>
        <form action={lock}>
          <button
            type="submit"
            className="shrink-0 rounded-md border border-[#2A2250] px-3 py-1.5 text-[11.5px] text-[#A09AB8] transition hover:border-[#F87171] hover:text-[#F87171]"
          >
            Sign out
          </button>
        </form>
      </header>
      <SectionLibrary />
      <SavedFunnels />
      <FunnelTray />
    </main>
  );
}
```

The header is written inline rather than extracted — it is a dozen lines used in exactly one place, and a separate file would add indirection without a boundary worth having.

`lock` is the existing server action in `app/actions.ts`; it signs the user out and redirects to `/`.

- [ ] **Step 2: Fix the stale README line**

Replace "Internal tool that turns…" with wording that matches open signup, and mention the hub. The audit flagged this; leaving it is the same drift the CLAUDE.md precedence rule exists to prevent.

- [ ] **Step 3: Full manual pass**

With `npm run dev` on port 3100:
1. Signed out at `/` → `AuthGate`.
2. Sign up fresh → hub, library first, empty-funnels message, no tray.
3. Add four sections across different stages → tray shows four chips.
4. Refresh → tray survives.
5. **Open builder →** `/build` with those four enabled and the right variations.
6. Enter a brand kit, generate prompts → output correct.
7. Save the funnel → back at `/`, it appears under Saved funnels.
8. Load it with a dirty tray → the confirm fires.
9. **▶ Live** and **Preview Funnel** still work, brand toggle included — the feature shipped earlier today and this is its first real browser check.
10. 375px viewport → tray collapses to count + CTA; rail and rows usable.

- [ ] **Step 4: Run gates and commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add app/page.tsx README.md
git commit -m "feat(hub): compose the hub at / and point the builder at /build"
```

---

## Out of scope

Do not build these; they belong to Phase 2 or were explicitly excluded:

- Worked-example starter funnels in the empty state
- Framework explanations, mode help, onboarding copy
- Section reordering (10P order is fixed by the framework)
- Any further split of `app/private-content.tsx` beyond what Tasks 1 and 3 require
- Writing to `analysis_history`
- Pushing to GitHub or deploying
