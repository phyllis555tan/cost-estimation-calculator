-- ODD STUDIO Cost Estimator: database setup.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this file -> Run.
-- Safe to read first: it makes two tables that only the signed-in owner can read or change,
-- plus one function that lets a client open a project through a private share link.

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default 'Untitled project',
  client        text not null default '',
  -- { "board": { walls, rooms, furniture, underlay, ... }, "estimate": { lines, tier, budget, ... } }
  data          jsonb not null default '{}'::jsonb,
  share_enabled boolean not null default false,
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint share_needs_token check (not share_enabled or share_token is not null),
  constraint share_token_length check (share_token is null or length(share_token) >= 32)
);

create index if not exists projects_owner_updated_idx on public.projects (owner, updated_at desc);

-- One row of rates per user.
create table if not exists public.rates (
  owner      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rates      jsonb not null,
  real       boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Keep updated_at honest.
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists rates_set_updated_at on public.rates;
create trigger rates_set_updated_at before update on public.rates
  for each row execute function public.set_updated_at();

-- Row level security: with no policy for anonymous visitors, they can read nothing.
alter table public.projects enable row level security;
alter table public.rates    enable row level security;

drop policy if exists "owner reads projects"   on public.projects;
drop policy if exists "owner inserts projects" on public.projects;
drop policy if exists "owner updates projects" on public.projects;
drop policy if exists "owner deletes projects" on public.projects;

create policy "owner reads projects"   on public.projects for select to authenticated using (owner = (select auth.uid()));
create policy "owner inserts projects" on public.projects for insert to authenticated with check (owner = (select auth.uid()));
create policy "owner updates projects" on public.projects for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "owner deletes projects" on public.projects for delete to authenticated using (owner = (select auth.uid()));

drop policy if exists "owner reads rates"   on public.rates;
drop policy if exists "owner inserts rates" on public.rates;
drop policy if exists "owner updates rates" on public.rates;

create policy "owner reads rates"   on public.rates for select to authenticated using (owner = (select auth.uid()));
create policy "owner inserts rates" on public.rates for insert to authenticated with check (owner = (select auth.uid()));
create policy "owner updates rates" on public.rates for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- Be explicit: visitors who are not signed in get no direct table access at all.
revoke all on public.projects from anon;
revoke all on public.rates    from anon;

-- Client share links.
-- A client opens view.html?t=<token>. This function returns ONLY the layout (walls, rooms, furniture,
-- mood board) of ONE project whose sharing is switched on and whose token matches.
-- It never returns the estimate, budget, rates or any other project.
create or replace function public.get_shared_project(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'name',       p.name,
           'board',      p.data -> 'board',
           'updated_at', p.updated_at
         )
  from public.projects p
  where p.share_enabled
    and p.share_token is not null
    and p.share_token = t
  limit 1
$$;

revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
