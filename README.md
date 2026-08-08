# Funnel Section Builder

Internal tool that turns the **10P Sales Page Framework** into copy-ready AI
prompts for building GoHighLevel custom-code funnel sections. It runs as a
guided three-step flow:

1. **Copy & brand** (`/`) — paste the client's funnel copy and set the brand kit,
   or reopen a saved funnel. Running the analyzer sends the copy to a Groq LLM,
   which maps it onto the 10P sections and recommends a variation for each
   (`app/api/funnel-analyze`).
2. **Sections** — review what the analyzer proposed with its reasoning
   (`/review`), or browse the full library and pick by hand (`/sections`). Both
   doors write to the same selection, so you can mix them.
3. **Build** (`/build`) — assembles per-section prompts plus one combined "full
   funnel" master prompt. **Brand Check** lives here too: a client-side linter
   that parses hex colors / `font-family` out of pasted HTML and flags off-brand
   values against your brand kit.

Most variations ship a rendered HTML sample, so a section — or the whole selected
funnel — can be previewed live and re-skinned in the client's brand kit before a
prompt is generated (`app/live-preview.tsx`, `lib/samples.ts`). Entries with no
sample (the image-prompt library, layout screenshots) fall back to their static
thumbnail; see `CLAUDE.md` for which and why.

Extracted from the System Built by AJ portfolio into its own app.

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 · Groq (LLM) · Supabase
(Postgres + Auth + RLS for user accounts and saved projects).

## Run locally
```bash
npm install
# copy .env.example -> .env.local and fill values
npm run dev            # http://localhost:3100
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # node --test, no extra dependencies
```

## Environment
`.env.example` is the source of truth for what the app reads — this table only
describes it. Never commit `.env.local`.

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — enables auth + saved projects |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GROQ_API_KEY` | Groq API key for AI Analyze |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server-only. Not read by any code path today |

## Auth
Supabase email/password with open signup. `middleware.ts` refreshes the session on
page loads and gates the `/private/*` asset tree (thumbnails and preview HTML) to
requests carrying a Supabase auth cookie. API routes authorize per-request with
`getUser()`, and Postgres Row-Level Security scopes every row to its owner.

With no Supabase env vars present the app degrades gracefully: the middleware
passes everything through and the project API returns `503`. See
`SUPABASE_SETUP.md` for provisioning.

## Deploy (Vercel)
Push to a GitHub repo, import in Vercel, add the env vars above. Add the same
Supabase URL/anon key and Groq key, then add the deployed URL to Supabase →
Authentication → URL Configuration.
