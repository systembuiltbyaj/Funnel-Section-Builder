# Single-page layout picker — restoring the tutorial-video flow

**Date:** 2026-08-30
**Status:** approved in brainstorm, not yet planned
**Supersedes:** decision 3 ("No AI, no accounts") of `2026-08-08-public-gallery-design.md`,
in part — see *Reopening the abuse decision*.

## Goal

Return the app to the shape demonstrated in the owner's tutorial video
(`youtube.com/watch?v=iIZPsP7MTYs`, recorded 2026-05-30 against the pre-extraction
version at `workwithaj.ajautomate.co/tools/private`), while keeping the well-factored
internals built since.

Three changes:

1. **One page.** Collapse the `/` gallery + `/build` split back into a single page with a
   horizontal pill rail, `🧩 Funnel Builder` first, the 10P groups after it.
2. **Restore Analyze Copy (AI).** A third mode beside Manual and Brand Check: paste a
   client's page, the model recommends the best-fit variation per section with a one-line
   reason.
3. **Drop copy entirely.** The tool becomes a *layout picker*. No per-section copy
   textareas, no copy in the prompts, no copy in the analyzer's reply.

## Why

The owner rebuilt substantially after the video and judged the result worse than what he
had demonstrated. The video is the reference for "working", so it is the target.

The copy removal is not part of that restoration — it is a new simplification decided
during this brainstorm. The product is the section library and its layouts; copy handling
was the part that made the flow heavy.

## Decisions

Settled during the brainstorm. Recorded with rationale so they are not silently reopened.

1. **Hybrid browse, not a faithful reproduction.** The video's horizontal pill rail returns
   and becomes the primary navigation, but the section views keep today's search box,
   two-column card grid, and live preview. Considered reproducing the video exactly
   (pills only, no search): rejected because browsing 174 variations without search is a
   real regression, and search postdates the video rather than replacing anything in it.
2. **`/build` survives as a redirect** to `/?tab=builder`. The portfolio site links into
   this tool; a hard removal would 404 those links. The shell reads `?tab=` on first load
   only, so switching afterwards is instant client state, matching the video's feel.
3. **Analyze confirms before overwriting.** Analyze replaces the whole selection. In the
   video, browsing and building were one undivided flow so this never surfaced; today the
   tray keeps picks visible, and wiping them silently would read as a bug. Merge-instead
   was considered and rejected: the model reasons about the page as a whole, so a partial
   fill produces incoherent recommendations.
4. **The cold-open title sequence stays.** Unrelated to what was not working, pure CSS,
   zero JS, and it does not touch the builder flow.
5. **No auth, and none is reintroduced.** The app is already public — no Supabase, no login
   route, no middleware. The deleted analyze route's `isAuthed()` gate is dropped rather
   than restored.
6. **The tool is a layout picker.** No copy is attached to a section, persisted, or
   assembled into a prompt. The per-section textareas go away entirely.

   The one place text is still typed is the analyzer's paste box, and it is **transient**:
   the pasted page is sent to the provider to derive recommendations, then discarded. It is
   never written to `localStorage`, never attached to a selection, and never forwarded to
   `/api/generate-section`. "No copy" means no copy in the *output path*, not that the
   analyzer has nothing to read.

   Consequence, stated deliberately: **generated HTML comes out with placeholder copy, not
   a client's words.** Accepted knowingly — the owner chose this over keeping manual copy
   boxes.
7. **The analyzer returns no copy.** It returns `{sectionId, recommendedVariation, reason}`
   plus a detected niche/vibe. This follows from decision 6, and has a large secondary
   benefit — see *Reopening the abuse decision*.

## Reopening the abuse decision

`2026-08-08-public-gallery-design.md` removed the Groq analyzer because, unauthenticated,
it was "an abuse target" and cost money per run. That reasoning is reopened here, so the
counter-argument is on the record.

Two things have changed since:

- **Generation already came back.** `/api/generate-section` is live and unauthenticated.
  The "no AI" half of that decision was already superseded in practice; this spec only
  makes it explicit for the analyzer.
- **The analyzer is now far cheaper than the thing that replaced it.** Dropping copy from
  the reply (decision 7) takes its output from thousands of tokens to a few hundred — one
  short line per section. It is the cheapest model call in the app.

Four properties keep it from being a useful general-purpose LLM proxy:

1. **The catalogue is built server-side from `PROMPT_GROUPS`.** The deleted route accepted
   `catalog` from the request body, which — combined with free-form `copy` — is close to an
   arbitrary prompt channel. The request body now carries only `copy`. This mirrors the
   rule that already shapes `/api/generate-section` in `CLAUDE.md`.
2. **The reply is constrained to strict JSON** and every `sectionId` / `recommendedVariation`
   is validated against the live catalogue before it reaches the client. An attacker gets
   back section ids and short reasons, not text they chose.
3. **Input is capped** by `MAX_COPY`, with a minimum length to reject empty probes.
4. **Groq's free tier is the default**, so the default configuration costs nothing.

The backstop remains what `CLAUDE.md` already names: **a hard monthly budget cap set in the
provider console.** With no accounts there is no reliable per-user limit, and this spec does
not invent one.

## Architecture

### The shell

New `app/shell.tsx`, a client component owning exactly one piece of state:
`view: "builder" | <groupId>`. It renders the pill rail, then either the builder or the
browse grid. Everything below it keeps its current boundaries.

| File | Change |
|---|---|
| `app/shell.tsx` | **new** — view state + rail host |
| `app/page.tsx` | renders `<Shell/>` |
| `app/build/page.tsx` | redirects to `/?tab=builder` |
| `app/gallery/rail.tsx` | vertical sidebar → horizontal pill bar, gains the Funnel Builder pill |
| `app/gallery/gallery.tsx` | `activeGroup` becomes a prop; browse-only |
| `app/gallery/tray.tsx` | `<Link href="/build">` → view-switch callback |

### The analyzer

Rebuilt to the shape of `/api/generate-section` rather than restored verbatim from
`83bb5a6^`.

| File | Purpose |
|---|---|
| `lib/analyze-contract.ts` | **new** — caps, server-side catalogue construction, validating the reply against the live catalogue |
| `lib/analyze-prompt.ts` | **new** — the analyzer's system and user messages |
| `lib/analyze.ts` | **new** — client call returning `{sel, reasons, meta}` |
| `app/api/funnel-analyze/route.ts` | **new** — thin route |
| `app/build/analyze-panel.tsx` | **new** — the paste box UI |

`lib/generation-provider.ts` gains one additive change: `buildProviderRequest` takes an
optional `{temperature, json}` argument. It currently hardcodes `temperature: 0.4` and has
no JSON mode; classification wants `0.2` and Groq's `response_format: json_object`. Existing
callers are unaffected.

Rate limiting follows the generate route: a 429 returns `rate_limited` with a wait derived
from the provider's headers. Given decision 7 this should be rare — the reply is small.

### Removing copy

`BuilderSelection` loses its `copy` field, becoming `{enabled, variation}`.

The storage key **stays `fsb.selection.v3`**. `validatePersisted` drops the now-unknown
`copy` on read, which is backward compatible in the direction that matters: every saved
funnel keeps its sections and variations. A key bump would reset them for no benefit.

Thirteen call sites follow the type. The notable one is `lib/prompt-assembly.ts`, which
emits a `— COPY —` block at three points, already falling back to `______` when copy is
empty. Those blocks are **removed rather than left emitting `______`**, and replaced with an
instruction to use realistic placeholder copy appropriate to the section's purpose. An empty
labelled block tells the model nothing; an explicit instruction produces a usable layout
preview.

`lib/generate-contract.ts` drops `copy` from `GenerateRequest`. This strengthens the
anti-proxy property already documented in `CLAUDE.md` — less free-form client text reaches
the model, not more.

### Provider state

`lib/funnel-selection-provider.tsx` gains `analysis: {reasons, meta}` and an
`applyAnalysis()` action that confirms when sections are already picked (decision 3).
`PersistedState` gains `analysis` as an **optional** field, so the `v3` key is preserved and
older saved state loads unchanged.

## Testing

`node --test` via type stripping, no new dependencies, `.ts` extension imports — matching
the existing setup.

- `lib/analyze-contract.test.ts` — unknown `sectionId` dropped; a dead variation number
  repaired to the group's first; `MAX_COPY` and minimum-length enforced; catalogue built
  from `PROMPT_GROUPS` rather than input.
- `lib/analyze-prompt.test.ts` — the message names real section ids and carries no copy.
- Existing snapshots in `lib/__snapshots__` are re-recorded once, deliberately: removing the
  copy blocks changes every assembled prompt.
- `lib/funnel-selection.test.ts` gains a case for reading a `v3` record that still has
  `copy`, asserting sections and variations survive.

Then `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Documentation

`CLAUDE.md` is updated in the same change — the routing table, the generation section
(`/api/generate-section` no longer receives copy), and a row for each new `lib/*` module.
A `PostToolUse` hook enforces this, and the file's own precedence rule makes a stale table
a bug. `README.md` is checked for route claims.

## Out of scope

Untouched: the live preview modal, `/api/generate-section`'s generation pipeline, the
generate panel, `lib/section-catalogue.ts`, gallery extras, `lib/design-tokens.ts`, and the
cold-open.

## Deferred

- **Deep-linking a group** (`/?tab=hero` as a first-class shareable URL). The shell reads
  `?tab=` on load, so this half-works by construction, but it is not designed for or tested.
- **Re-adding copy as an optional layer.** If placeholder-only output proves too thin in
  practice, the honest fix is a deliberate redesign, not quietly restoring the textareas.
