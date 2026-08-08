# Supabase setup

Supabase is the app's auth and persistence layer: email/password accounts, saved
funnel projects, and Row-Level Security. It is env-detected — with no Supabase
env vars the app still runs, the middleware passes every request through, and the
project API returns `503`.

## 1. Create the project
1. Go to https://supabase.com → New project (free tier is fine). Pick a region near you (Singapore).
2. Wait for it to provision (~2 min).

## 2. Run the schema
- Supabase dashboard → **SQL Editor** → paste the contents of
  `supabase/migrations/0001_init.sql` → **Run**.
- Creates `profiles`, `funnel_projects`, `analysis_history`, the signup trigger,
  and **Row-Level Security** so each user only sees their own rows.

## 3. Get the keys
- Dashboard → **Project Settings → API**:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`service_role` is not read by any code path today. Only add it if you introduce a
server-side admin operation that must bypass RLS — it is server-only and must
never reach the browser.

## 4. Add env vars
Add to `.env.local` (local) **and** Vercel → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Never commit these.

## 5. Auth settings
- Dashboard → **Authentication → Providers → Email**: enable. For quick testing you can turn
  **Confirm email** off; leave on for production.
- **Authentication → URL Configuration**: add your Vercel URL and `http://localhost:3100`
  to the redirect allow-list. `npm run dev` binds 3100 (`next dev -p 3100`).

## What's wired
- `lib/supabase/server.ts` / `lib/supabase/client.ts` — env-guarded clients.
- `app/auth-gate.tsx` — sign-up / login / logout UI; open signup, no invite step.
- `middleware.ts` — refreshes the session on page loads; gates the `/private/*`
  asset tree on the presence of a Supabase auth cookie.
- `app/api/projects` + `app/api/projects/[id]` — full CRUD (list / create / load /
  rename / delete), session-gated via `getUser()`, RLS-scoped.
- `app/api/funnel-analyze` — Groq analyze endpoint, authorized against the session.
- **Save funnel** and **My Projects** (load / delete) in the builder, persisting the
  brand kit and section selections.

## Not yet wired
- Logging each AI Analyze run to `analysis_history` — the table exists and is
  RLS-scoped, but nothing writes to it.
- Automated end-to-end verification that user B cannot read user A's projects.
  RLS policies are in the migration; there is no test asserting them.
