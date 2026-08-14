# Public section-template gallery — design

**Date:** 2026-08-08
**Status:** approved in brainstorm, not yet planned
**Supersedes:** the guided three-step flow in `2026-08-07-funnel-hub-design.md`

## Goal

Turn the Funnel Section Builder from a private, account-gated three-step wizard into a
public, backend-free gallery of funnel section templates, organised by the 10P framework.

The reference model is a website-template gallery (`kape.tools/tools/templates`): categories
down the side, a grid of cards carrying a screenshot, a name, a style descriptor and a
primary action. Translated here: **niches → the 10P groups**, **templates → section
variations**, **screenshot → the existing `-thumb.webp`**, **"open live site" → the existing
live preview**, **"Download" → copy the prompt**.

## Why

The Supabase project is being retired. That removes auth and saved-funnel storage, and the
free tier's inactivity pausing had already locked the owner out of his own tool. Groq costs
money per run and, unauthenticated, is an abuse target. Removing both leaves an app that
needs no backend, no environment variables, and nothing that can expire.

## Decisions

Each of these was settled during the brainstorm. Recorded with rationale so they are not
silently reopened.

1. **Preview stays full-fidelity.** Considered stripping previews to wireframes or labelled
   blocks to protect the rendered sample HTML. Rejected: the prompt is the product and stays
   copyable regardless, so degrading the preview would cost real usability to guard
   comparatively little. Samples keep their brand re-skin.
2. **Consequence, stated deliberately:** `public/private/*` becomes publicly served. All
   thumbnails and all 100 sample documents are fetchable by anyone. This is accepted, not
   overlooked.
3. **No AI, no accounts.** Groq analyze and Supabase auth are both removed outright. This
   parks the lead-capture goal — the tool will collect nothing. Accepted knowingly; see
   *Deferred*.
4. **Gallery is the front door, not step 2.** A brand-kit form before anything visible is
   wizard-shaped and wrong for visitors arriving cold.
5. **Gallery and funnel assembly coexist.** Each card is independently useful (preview, copy
   one prompt, leave). Picks also accumulate in a tray for anyone who wants the combined
   full-funnel master prompt. The tray is a superset, not a required path.
6. **The left rail filters, it does not scroll-to.** With 110 variations a single stacked
   page is too long, and a rail that only jumps does not earn its width.
7. **Three actions per card.** `Copy prompt`, `Preview`, and `+` (add to funnel). Without the
   split, browse-and-leave and build-a-funnel visitors fight over one button.
8. **The stepper is deleted.** A gallery is not a wizard; there is no "step 2 of 3" when any
   card is independently useful. `FlowSteps` and `HubShell` both go.
9. **Pages become indexable.** `robots: { index: false, follow: false }` is removed. It was
   correct for a private tool and wrong for one strangers are meant to find. *Derived from
   the stated lead-gen purpose rather than explicitly confirmed — flag at spec review if
   the tool should stay unlisted.*

## Scope

### Removed

| Area | Files |
|---|---|
| Supabase auth | `lib/supabase/{client,server}.ts`, `app/auth-gate.tsx`, `app/auth/callback/`, `app/reset/`, `app/actions.ts` |
| Asset gate + session refresh | `middleware.ts` (both its jobs are auth) |
| Saved funnels | `app/api/projects/`, `app/api/projects/[id]/`, `lib/projects-payload.ts` + test, `app/hub/saved-funnels.tsx` |
| Groq | `app/api/funnel-analyze/`, `lib/analyze.ts` |
| Wizard chrome | `app/hub/shell.tsx` (`HubShell`, `FlowSteps`), `app/review/`, `app/sections/` |
| Step-1 entry form | `app/hub/start.tsx` — the copy textarea fed the analyzer and has no other reader; its brand-kit inputs move to `brand-kit-panel.tsx` |
| Dead schema | `supabase/` (retained in git history) |

`app/hub/library.tsx` and `app/hub/funnel-tray.tsx` are not deleted so much as **succeeded** by
`app/gallery/grid.tsx` and `app/gallery/tray.tsx`. The rendering logic transfers; the directory
does not. After this change `app/hub/` no longer exists.

### Unchanged

`lib/section-catalogue.ts`, `lib/prompt-groups.ts`, `lib/prompt-assembly.ts`, `lib/samples.ts`,
`app/live-preview.tsx`, and all of `public/private/`. This is the entire product surface and
none of it depends on a backend.

### Added

A gallery page, a category rail, a card component, a search/filter control, and a persistent
tray. Details below.

## Architecture

Two routes:

| Route | Purpose |
|---|---|
| `/` | The gallery. Browse, filter, search, preview, copy a prompt, add to funnel. |
| `/build` | Full-funnel assembly: per-section copy fields, brand kit, combined master prompt, Brand Check. |

No API routes, no middleware, no environment variables. `.env.example` is deleted and the
three Vercel variables can be removed.

### Components

- `app/gallery/rail.tsx` — the 10P category rail. Renders `PROMPT_GROUPS` with per-group
  counts, plus an "Extras" block for the browse-only collections. Selection is local UI
  state, not a route.
- `app/gallery/card.tsx` — one variation: thumbnail, variation number, name, style
  descriptor, and the three actions. Knows whether it is in the tray.
- `app/gallery/grid.tsx` — two-column responsive grid, filtered by active group and search
  query.
- `app/gallery/search.tsx` — free-text filter over name, descriptor and group.
- `app/gallery/tray.tsx` — sticky bottom bar; hidden until the funnel has at least one
  section. Holds picks, a Brand kit trigger, and "Build full funnel →".
- `app/gallery/brand-kit-panel.tsx` — the brand inputs lifted out of the old step 1, opened
  from the tray rather than gating entry.

`app/private-content.tsx` keeps `FunnelBuilder()` for `/build`, losing its save/load UI and
its sign-out button.

### Data

The catalogue as it stands:

| Group | Count | | Group | Count |
|---|---|---|---|---|
| hero | 9 | | social | 9 |
| empathy | 10 | | risk | 8 |
| opportunity | 11 | | authority | 10 |
| compare | 7 | | urgency | 8 |
| usp | 10 | | faq | 8 |
| offer | 12 | | footer | 8 |

**110 section variations across 12 groups.** Browse-only collections shown under Extras:
image prompts (53), carousel (6), full layouts (5).

Card descriptors come from the existing `label` and description fields. No catalogue schema
change is required.

**Extras cards carry only two actions.** `sampleForPreview()` returns `null` for the image
prompts and three of the five layouts, so those have no live sample and `Preview` is hidden
rather than shown disabled. They also cannot join a funnel — the tray assembles 10P sections,
and an image prompt is not one — so `+` is absent too. An Extras card is thumbnail, name,
descriptor, `Copy prompt`. The same applies to `empathy-v9`/`v10`, which are 10P sections that
happen to lack a sample: they keep `+` but hide `Preview`.

## State and persistence

`lib/funnel-selection-provider.tsx` already persists selection and brand kit to
`localStorage` under `fsb.selection.v2`. It carries the whole design — anonymous visitors
keep their work across refreshes with no account and no backend.

One change: `AnalysisState` (`reasons`, `meta`, `sourceCopy`) existed solely to carry Groq
output and the textarea that fed it. It is removed from the persisted shape and
`STORAGE_KEY` bumps to `fsb.selection.v3`. Bumping discards any in-progress funnel currently
in a browser, which is correct for a relaunch and avoids leaving a dead field to satisfy old
data. `validatePersisted`'s existing repair logic covers the rest.

## Testing

Surviving unchanged: `section-catalogue.test.ts` (including the `04g` hole lock),
`samples.test.ts`, `prompt-assembly.test.ts`, `prompt-assembly.fixture.test.ts`.

- `projects-payload.test.ts` — deleted with its module.
- `funnel-selection.test.ts` — updated for the `v3` shape without `analysis`.
- New: filter logic (group + search over 110 variations) as a pure function in `lib/`, tested
  directly. Keeping it out of the component is what makes it testable under the bare
  `node --test` runner.

Gates stay `npm run typecheck && npm run lint && npm test && npm run build`.

## Risks

- **Unmetered public assets.** Every sample and thumbnail is served to anyone. Accepted per
  decision 2, but it is a real bandwidth and copying exposure.
- **`.gitattributes` must keep covering `public/private/**/*.html`.** Those files are now
  served directly to visitors rather than behind a gate; a CRLF regression would ship to
  users, not just fail a test.
- **No analytics.** With no backend and nothing captured, there is no way to tell whether
  anyone uses it. If that matters, it should be a deliberate follow-up.

## Deferred (explicitly out of scope)

- **Email capture.** The lead-gen goal is on hold. It does not require Supabase to return —
  a form POSTing to a GoHighLevel webhook would work with no backend.
- **A quota mechanic** ("3 prompt copies a week"), as the reference gallery uses to drive
  signup. Needs identity to be meaningful; client-side limits are trivially bypassed.
- **Export/import funnel as JSON**, the small replacement for multi-project save/load if it
  is missed.
- **Pagination.** The reference paginates; 110 items behind a group filter does not need it.
