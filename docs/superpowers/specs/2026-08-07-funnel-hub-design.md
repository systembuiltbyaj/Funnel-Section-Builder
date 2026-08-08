# Funnel Hub — design

**Date:** 2026-08-07
**Status:** approved, ready for implementation planning
**Scope:** Phase 1 of two. This spec covers the hub only. The in-context guidance
layer (framework explanations, worked examples, mode help) is Phase 2 and gets its
own spec.

## Why

The app opened to public signup (commit `08b26d5`), but its shape is still an
internal tool's. A stranger who signs up lands directly in the builder: an empty
form, three unexplained modes, and fifteen tabs. The 116 rendered section previews
— the most persuasive asset in the product — are reachable only one section type at
a time, and browsing them leads nowhere. There is no home, no sense of the
catalogue, and no path from "this section looks right" to "it's in my funnel."

This adds a hub at `/` that leads with the library, shows saved funnels beneath it,
and lets you assemble a funnel by browsing.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Audience | Open signup — anyone | Determines that orientation and self-serve flow matter |
| Hub leads with | Library, funnels second | Strongest for a cold visitor with zero projects; makes the 116 previews the front door |
| Library layout | Grouped scroll in 10P order, sticky stage rail | Scrolling it teaches the framework; matches the order the builder asks for sections |
| Library → builder | Add to funnel, keep browsing, with a tray | Browsing becomes assembly instead of a dead end |
| Tray placement | Docked bottom bar | Must stay in view across a long scroll or collecting turns into second-guessing |
| Architecture | Shared context + real routes | Only option where the hub is a real place; the state lift is required by the tray regardless |

Rejected: a right-side tray panel (its advantage is reordering, but 10P order is
fixed by the framework); a floating collapsed pill (hides picks, reintroducing the
problem the tray solves); URL-param picks (no live tray state, breaks as selections
grow past an ID); keeping the 15 tabs (leaves the catalogue unbrowsable).

## Architecture

### Routes

| Route | Logged out | Logged in |
|---|---|---|
| `/` | `<AuthGate />` (unchanged) | Hub |
| `/build` | redirect to `/` | Builder (today's `FunnelBuilder`) |

`app/page.tsx` keeps its existing server-side `getUser()` guard; `app/build/page.tsx`
uses the same pattern. The `/private/*` asset gate is untouched.

**`middleware.ts` must add `/build` to its matcher** (currently
`["/", "/private/:path*"]`). Without it the Supabase session never refreshes on the
builder page and a long editing session expires mid-work with no clear cause.

**`app/layout.tsx` drops the blanket `robots: { index: false }`.** A public signup
page needs to be findable; `/build` and `/private/*` stay noindex.

### State

New `lib/funnel-selection.tsx` exports a `FunnelSelectionProvider`, mounted in the
root `app/layout.tsx` wrapping `{children}`. Root layout rather than a route group:
it is a client component wrapping server children, which App Router allows, and it
avoids introducing a `(app)` group for two routes. `AuthGate` sits inside it
harmlessly — the provider holds no data until something is added.

It owns exactly what both the library and the builder touch:

- `sel` — `Record<SectionId, BuilderSelection>`, written by the tray, read by the builder
- brand kit — `primary`, `background`, `fontHead`, `fontSub`, `fontBody`, `images`

Persisted to `localStorage` on change, hydrated on mount.

Everything else stays inside `FunnelBuilder`: modes, analyze results, and Brand
Check state.

**Prompt assembly moves once, first, and only to become testable.** The original
intent was to leave `buildOutputs` untouched, but it is a `useCallback` inside
`FunnelBuilder` and therefore uncallable from a test without adding a React
testing dependency — which is disallowed. Since the testing plan below depends on
snapshotting its output, it is extracted verbatim into `lib/prompt-assembly.ts` as
a pure function in the first task, before any other change. No logic is altered in
that move; the extraction is what makes every later task verifiable.

### Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/funnel-selection.tsx` | Owns `sel` + brand kit, persistence, hydrate validation | `builderGroups` shape only |
| `app/hub/library.tsx` | Grouped section rows in 10P order, sticky stage rail, add/remove | selection context, `lib/samples.ts` |
| `app/hub/funnel-tray.tsx` | Docked bar: count, chips, "Open builder" | selection context |
| `app/hub/saved-funnels.tsx` | Saved project cards, empty state, 401 vs empty | `/api/projects` |
| `app/page.tsx` | Existing auth guard; renders the hub instead of `PrivateContent` | the three `app/hub/*` units |
| `app/build/page.tsx` | Auth guard + renders `FunnelBuilder` | selection context |

`app/hub/` holds colocated components, not a route — App Router only creates routes
from `page.tsx`/`route.ts`, so there is no `/hub` URL. The hub renders at `/`.

Splitting the hub across small files is deliberate: `app/private-content.tsx` is
already ~13k lines, and none of this new surface belongs in it.

## Data flow

1. User scrolls the library. Each card's `+ Add` toggles that section in `sel` with
   the clicked variation pre-selected.
2. The tray reads `sel` and renders count plus chips. It appears only once `sel`
   has an enabled entry.
3. "Open builder" navigates to `/build`. The builder reads the same `sel` — no
   handoff, no serialisation.
4. Save/load against Supabase writes to and reads from the same context, so the
   existing project CRUD keeps working unchanged.

## Edge cases

- **Hydration.** Read `localStorage` in an effect after mount, never during render.
  Hold a `hydrated` flag so the tray renders quiet-empty on first paint rather than
  flashing. Reading during render causes a hydration mismatch.
- **Stale persisted state.** On hydrate, validate every entry against
  `builderGroups`; drop unknown section ids and variation numbers that no longer
  exist. Without this a renamed variation makes `find()` return undefined and the
  fallback silently substitutes a section the user never chose.
- **Loading a project over a dirty tray.** `loadProject` currently clobbers `sel`.
  Confirm first when the tray has unsaved picks.
- **Silent auth failure.** `refreshProjects` swallows all errors in `catch {}`. On
  the hub that renders "no funnels yet" to someone with an expired session and
  twelve saved funnels. Distinguish 401 from empty and say which it is.
- **Supabase unconfigured.** The saved-funnels block hides entirely rather than
  erroring — matching the app's existing env-guarded pattern.
- **116 thumbnails.** Native lazy loading on every card. Sticky rail active state
  via `IntersectionObserver`, not scroll math.
- **Re-adding an added section** toggles it off, with the card reflecting its state.
- **Narrow viewports.** The tray collapses to one line — count plus CTA, chips
  dropped — rather than switching to a different pattern.

## Testing

The risk of this change is that lifting `sel` out of `FunnelBuilder` alters
generated prompts. In order:

1. **Before any refactor:** capture generated prompt text for ~5 fixed
   selection/brand-kit combinations into a fixture file.
2. **After:** assert byte-identical output. This is the regression net.
3. **Unit tests** for the new pure logic: hydrate validation (drops unknown ids,
   keeps valid ones) and the persistence round-trip.
4. **Manual browser pass** for what unit tests can't reach: sticky rail behaviour,
   lazy loading, tray on a narrow viewport, and the live-preview modal — which is
   still browser-unverified from the earlier session and which this work promotes
   to the hub's front page.

Tests run on Node's built-in runner via `--experimental-strip-types`. No test
framework dependency is to be added.

## Out of scope

- Worked-example starter funnels in the empty state (Phase 2 — the slot is designed,
  not built)
- Framework explanations, mode help, onboarding copy (Phase 2)
- Section reordering (10P order is fixed by the framework)
- Splitting `app/private-content.tsx` beyond moving `sel` and the brand kit out
- Writing to `analysis_history`, which remains unwired

## Follow-up noted, not scheduled

`README.md` still calls this an "internal tool," which the move to public signup
made wrong. Fix alongside this work.
