# Supabase setup (Phase 2 — full-stack layer)

The app runs today on the passcode gate alone. Adding these turns on real user
accounts + saved projects. It's env-detected: with no Supabase env vars the app
behaves exactly as it does now.

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
  - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## 4. Add env vars
Add to `.env.local` (local) **and** Vercel → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
Never commit these. `service_role` bypasses RLS — server-only, never expose to the browser.

## 5. Auth settings
- Dashboard → **Authentication → Providers → Email**: enable. For quick testing you can turn
  **Confirm email** off; leave on for production.
- **Authentication → URL Configuration**: add your Vercel URL + `http://localhost:3100` to
  redirect allow-list.

## What's already wired (works the moment keys are present)
- `lib/supabase/server.ts` / `lib/supabase/client.ts` — env-guarded clients.
- `app/api/projects` + `app/api/projects/[id]` — full CRUD (list / create / load / rename / delete),
  session-gated, RLS-scoped. Returns `503` until Supabase is configured.

## Still to wire after keys exist (I'll finish + test live)
- Sign-up / login / logout UI (replace or complement the passcode gate).
- "Save funnel" + "My Projects" load buttons inside the builder (persist brand kit + selections).
- Log each AI Analyze run to `analysis_history`.
- Verify RLS end-to-end (user B cannot read user A's projects).
