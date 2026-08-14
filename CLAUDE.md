# Funnel Section Builder — project instructions

Next.js 16 (App Router) internal tool. Turns the 10P Sales Page Framework into
copy-ready prompts for GoHighLevel custom-code sections, and previews the
resulting sections live from a library of rendered HTML samples.

## Precedence — read this before trusting any claim

`.env.example` and the code are the source of truth for configuration and
behaviour. `README.md` and `SUPABASE_SETUP.md` describe; they do not define. If a
doc and the code disagree, the code wins and **the doc is the bug** — fix it in
the same change.

The passcode gate that earlier docs described is gone (commit `08b26d5`). Auth is
Supabase email/password with open signup. Do not reintroduce a passcode.

## The three-step flow

The app is a guided flow, not a single builder page. `HubShell` renders the
chrome for steps 1–2; step 3 carries its own app bar and renders `FlowSteps`
directly (wrapping it in `HubShell` would stack two headers).

| Step | Route | Page |
|---|---|---|
| 1 — Copy & brand | `/` | `app/page.tsx` → `app/hub/start.tsx`, `app/hub/saved-funnels.tsx` |
| 2 — Sections (AI door) | `/review` | `app/review/page.tsx` → `review-picks.tsx` |
| 2 — Sections (manual door) | `/sections` | `app/sections/page.tsx` → `app/hub/library.tsx`, `funnel-tray.tsx` |
| 3 — Build | `/build` | `app/build/page.tsx` → `app/private-content.tsx` |

Step 2 has two doors and both write to the same selection store, so either can
precede step 3. Outside the flow: `/reset` (password reset) and
`/auth/callback` (auth code exchange).

## Where things live

| What | Where |
|---|---|
| **Section catalog** — every variation, its prompt, its thumbnail | `lib/section-catalogue.ts`, `export const sections: Section[]` |
| Section groups + display order | `lib/prompt-groups.ts` |
| Public gallery filtering (`flattenGroups`, `filterGallery`, `GalleryGroup`/`GalleryItem` types) | `lib/gallery-filter.ts` |
| Gallery's three browse-only "Extras" collections (image prompts, carousel, full layouts) — reuse `GalleryGroup`/`Section`, cannot join a funnel | `lib/gallery-extras.ts` |
| Initial/empty selection shape | `lib/catalogue.ts`, `lib/funnel-selection.ts` |
| Selection + brand kit shared across the flow | `lib/funnel-selection-provider.tsx` |
| Prompt assembly (per-section + full-funnel master) | `lib/prompt-assembly.ts` |
| Groq request/response shaping | `lib/analyze.ts` |
| Builder UI, brand kit inputs, Brand Check linter | `app/private-content.tsx`, `FunnelBuilder()` |
| Flow chrome + stepper | `app/hub/shell.tsx` (`HubShell`, `FlowSteps`) |
| Live preview modal (single section + full funnel) | `app/live-preview.tsx` |
| Sample resolution + brand re-skin logic | `lib/samples.ts` |
| Auth UI | `app/auth-gate.tsx` |
| Session refresh + `/private/*` asset gate | `middleware.ts` |
| Project CRUD (RLS-scoped) | `app/api/projects/`, `app/api/projects/[id]/` |
| Request-body shaping for those routes (mass-assignment guard) | `lib/projects-payload.ts` |
| Groq analyze endpoint | `app/api/funnel-analyze/route.ts` |
| Schema + RLS policies | `supabase/migrations/0001_init.sql` |
| Rendered section samples + thumbnails | `public/private/` |

`lib/section-catalogue.ts` is ~11.7k lines, nearly all of it prompt text inside
the `sections` array. Read the specific line range you need — do not load the
whole file. To find a variation, grep for its slug rather than scrolling.

New logic belongs in `lib/` or a new component. `app/private-content.tsx` is the
builder UI only (~1.1k lines) — do not append catalogue data to it.

## Asset naming convention

Every variation's `previewSrc` is `/private/{slug}-thumb.webp`, and its rendered
sample is `/private/{slug}-sample.html`. `sampleForPreview()` in `lib/samples.ts`
derives one from the other; sub-folder collections (`ai-academy/`, `carousel/`,
`local/`) are mapped explicitly in the same file.

**When you add a variation:** add the thumbnail, add the sample HTML, and add the
slug to `FLAT_SAMPLES` (or `NESTED_SAMPLES`) in `lib/samples.ts` — otherwise the
live preview silently falls back to the static thumbnail with no error.

Sample documents drive their palette from a `:root` custom-property block. Keep
that convention: the brand re-skin reads `--accent` / `--bg` from it, and a
template that hard-codes colours outside `:root` will only partially re-skin.

### Variations that intentionally have no live sample

`sampleForPreview()` returns `null` for these and the UI falls back to the static
thumbnail. That is by design — don't "fix" them by inventing sample HTML:

- the 51 `gpt-img-*` entries (image-prompt library, nothing to render)
- `layout-3-kampo`, `layout-muni-1-san-antonio`, `layout-muni-2-san-antonio`
  (layout screenshots; `layout-1-lunara` and `layout-2-isla-serena` do have samples)

### Two catalogue holes that are deliberately left alone

Both were audited and closed as "leave it" — closing either one destroys
something. Do not "tidy" these:

- **`empathy-v9` (`02i`) and `empathy-v10` (`02j`) have no `-sample.html`.** They
  are otherwise complete: thumbnail, prompt, the lot. The prompt is the product
  and it works; only the live preview degrades to the thumbnail. Deleting the
  entries to close the gap would throw away two working variations. Add the
  sample HTML if you ever want the preview — don't remove the variations.
- **`before-after` skips `v7`/`04g`** (it runs `04a`–`04f`, then `04h`). Slug and
  number skip together, so nothing is broken — the sequence just has a hole.
  **Do not renumber `04h` to `04g` to close it.** Variation numbers are persisted
  inside saved funnels, and `validatePersisted` silently repairs an unrecognised
  number to the group's first (`lib/funnel-selection.ts`). Renumbering would
  reset every saved funnel using `04h` back to `04a`, with no error. A test in
  `lib/section-catalogue.test.ts` locks this.

## Conventions

- Prompt text in the `sections` array uses `______` for values the client must
  supply. Never point a prompt at an asset path that does not exist in
  `public/private/` — use `______` and describe the image instead.
- Preview iframes are sandboxed (`allow-scripts`, no same-origin). They report
  their own height via `postMessage`; the builder cannot measure them directly.

## Before saying done

```bash
npm run typecheck
npm run lint
npm test          # node --test via type stripping — no test framework installed
npm run build
```

Tests run on Node's built-in runner with `--experimental-strip-types`, so test
files import with an explicit `.ts` extension. Do not add Jest/Vitest without
asking — the current setup has zero test dependencies.

`npm run dev` binds port **3100**; that port is what belongs in Supabase's
redirect allow-list.

## Keeping this file true

A `PostToolUse` hook (`.claude/hooks/check-routing-doc.mjs`, wired in
`.claude/settings.json`) warns when a new `lib/*.ts` module or
`app/<route>/page.tsx` is written and its name appears nowhere above. It exists
because this table has gone stale twice — both times pointing at a file that
still existed, so nothing errored and the wrong file just got opened.

If you move something, fix the table in the same commit. The precedence rule at
the top applies to this file too: when it disagrees with the code, it is the bug.
