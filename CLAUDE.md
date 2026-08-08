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

## Where things live

| What | Where |
|---|---|
| Section catalog — every variation, its prompt, its thumbnail | `app/private-content.tsx`, `const sections: Section[]` |
| Builder UI, brand kit inputs, Brand Check linter | `app/private-content.tsx`, `FunnelBuilder()` |
| Live preview modal (single section + full funnel) | `app/live-preview.tsx` |
| Sample resolution + brand re-skin logic | `lib/samples.ts` |
| Auth UI | `app/auth-gate.tsx` |
| Session refresh + `/private/*` asset gate | `middleware.ts` |
| Project CRUD (RLS-scoped) | `app/api/projects/`, `app/api/projects/[id]/` |
| Groq analyze endpoint | `app/api/funnel-analyze/route.ts` |
| Schema + RLS policies | `supabase/migrations/0001_init.sql` |
| Rendered section samples + thumbnails | `public/private/` |

`app/private-content.tsx` is ~13k lines, nearly all of it prompt text inside the
`sections` array. Read the specific line range you need — do not load the whole
file. New logic belongs in `lib/` or a new component, not appended here.

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
