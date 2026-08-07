# Funnel Section Builder

Internal tool that turns the **10P Sales Page Framework** into copy-ready AI
prompts for building GoHighLevel custom-code funnel sections. Three modes:

- **Analyze Copy (AI)** — paste a client's full funnel copy; a Groq LLM maps it
  onto the 10P sections, recommends the best-fit variation for each, and pre-fills
  the copy (`app/api/funnel-analyze`).
- **Manual** — toggle sections, pick variations, enter brand kit + copy; the tool
  assembles per-section and one combined "full funnel" master prompt.
- **Brand Check** — client-side linter that parses hex colors / `font-family` out
  of pasted HTML and flags/fixes off-brand values against your brand kit.

Extracted from the System Built by AJ portfolio into its own app.

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 · Groq (LLM) · Supabase (Phase 2:
Postgres + Auth + RLS for user accounts and saved projects).

## Run locally
```bash
npm install
# copy .env.example -> .env.local and fill values
npm run dev            # http://localhost:3100 (or 3000)
```

## Environment
| Var | Purpose |
|-----|---------|
| `PRIVATE_TOOL_PASSCODE` | passcode for the gate |
| `PRIVATE_TOOL_COOKIE_SECRET` | HMAC secret for the auth cookie |
| `GROQ_API_KEY` | Groq API key for AI Analyze |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Phase 2) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (Phase 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role, server-only (Phase 2) |

## Auth
- **Phase 1 (now):** shared passcode → HMAC httpOnly cookie; `middleware.ts` gates
  the `/private/*` static previews.
- **Phase 2 (Supabase):** real user accounts + saved funnels with Row-Level Security.
  See `SUPABASE_SETUP.md`.

## Deploy (Vercel)
Push to a GitHub repo, import in Vercel, add the env vars above. Set the same
passcode/secret/Groq key; add the Supabase keys once the project exists.
