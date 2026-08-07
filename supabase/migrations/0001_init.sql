-- Funnel Section Builder — initial schema (Supabase / Postgres)
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ---------- Tables ----------

-- 1:1 profile per auth user
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

-- A saved builder state (brand kit + section selections + generated outputs)
create table if not exists public.funnel_projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Untitled funnel',
  data       jsonb not null default '{}'::jsonb,   -- { brandKit, selections, outputs }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funnel_projects_user_idx
  on public.funnel_projects (user_id, updated_at desc);

-- Log of AI "Analyze Copy" runs
create table if not exists public.analysis_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  input_excerpt text,
  result        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists analysis_history_user_idx
  on public.analysis_history (user_id, created_at desc);

-- ---------- Triggers ----------

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists funnel_projects_set_updated_at on public.funnel_projects;
create trigger funnel_projects_set_updated_at
  before update on public.funnel_projects
  for each row execute function public.set_updated_at();

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row-Level Security (each user sees only their own rows) ----------

alter table public.profiles         enable row level security;
alter table public.funnel_projects  enable row level security;
alter table public.analysis_history enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "funnel_projects_select_own" on public.funnel_projects
  for select using (auth.uid() = user_id);
create policy "funnel_projects_insert_own" on public.funnel_projects
  for insert with check (auth.uid() = user_id);
create policy "funnel_projects_update_own" on public.funnel_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "funnel_projects_delete_own" on public.funnel_projects
  for delete using (auth.uid() = user_id);

create policy "analysis_history_select_own" on public.analysis_history
  for select using (auth.uid() = user_id);
create policy "analysis_history_insert_own" on public.analysis_history
  for insert with check (auth.uid() = user_id);
create policy "analysis_history_delete_own" on public.analysis_history
  for delete using (auth.uid() = user_id);
