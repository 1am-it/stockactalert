-- 1AM-180: Foundation schema for cross-device sync + auth.
--
-- Adds three tables to support user accounts on top of Supabase Auth:
--   1. public.users         - app-side user record, FK to auth.users
--   2. public.user_profiles - per-user settings (onboarding state, email prefs)
--   3. public.follows       - which politicians a user follows (by bioguide_id)
--
-- RLS is enabled on all three. Policies are conservative: users can only see
-- and modify their own rows. The auth.users -> public.users link is maintained
-- by a trigger so app code never has to INSERT into public.users directly.
--
-- This migration is additive. It does not touch the existing `filings` table
-- (created out-of-band in 1AM-113). filings stays exactly as it is.

-- ──────────────────────────────────────────────────────────────────────────
-- TABLE: public.users
-- ──────────────────────────────────────────────────────────────────────────
-- Mirror of auth.users for app-side use. We never JOIN against auth.users
-- directly from application code (it lives in a separate schema with
-- restricted access). public.users gives us a clean PK to FK against.

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

comment on table public.users is
  '1AM-180: app-side mirror of auth.users. One row per authenticated user.';

-- ──────────────────────────────────────────────────────────────────────────
-- TABLE: public.user_profiles
-- ──────────────────────────────────────────────────────────────────────────
-- One row per user. Holds preferences and onboarding state.
-- Created automatically by trigger when a new auth.users row appears.

create table public.user_profiles (
  user_id              uuid primary key references public.users (id) on delete cascade,
  display_name         text,
  email_notifications  boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.user_profiles is
  '1AM-180: per-user settings. One row per user, auto-created on signup.';

-- Auto-update updated_at on any UPDATE.
create function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.touch_user_profiles_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- TABLE: public.follows
-- ──────────────────────────────────────────────────────────────────────────
-- Replaces the localStorage-only followedPoliticians array. Each row is one
-- (user, politician) pair. bioguide_id is NOT a FK because congress.json is
-- a static asset, not a DB table.

create table public.follows (
  user_id     uuid not null references public.users (id) on delete cascade,
  bioguide_id text not null,
  followed_at timestamptz not null default now(),
  primary key (user_id, bioguide_id)
);

comment on table public.follows is
  '1AM-180: which politicians (bioguide_id) each user follows.';

-- Index on bioguide_id alone supports the push-notification fan-out in
-- 1AM-72: "for politician X who filed a trade, find all followers".
create index follows_bioguide_id_idx on public.follows (bioguide_id);

-- ──────────────────────────────────────────────────────────────────────────
-- TRIGGER: auth.users insert -> public.users + public.user_profiles
-- ──────────────────────────────────────────────────────────────────────────
-- When Supabase Auth creates a new user, mirror that into public.users and
-- create the matching user_profiles row. App code never has to do this.

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  insert into public.user_profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: public.users
-- ──────────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;

-- Users see only their own row.
create policy users_select_own
  on public.users
  for select
  using (auth.uid() = id);

-- No INSERT/UPDATE/DELETE policies = blocked from client. The trigger handles
-- inserts. Deletes cascade from auth.users via the FK.

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: public.user_profiles
-- ──────────────────────────────────────────────────────────────────────────

alter table public.user_profiles enable row level security;

create policy user_profiles_select_own
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

create policy user_profiles_update_own
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No INSERT policy = blocked from client (trigger handles it).
-- No DELETE policy = blocked from client (cascade from users).

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: public.follows
-- ──────────────────────────────────────────────────────────────────────────

alter table public.follows enable row level security;

create policy follows_select_own
  on public.follows
  for select
  using (auth.uid() = user_id);

create policy follows_insert_own
  on public.follows
  for insert
  with check (auth.uid() = user_id);

create policy follows_delete_own
  on public.follows
  for delete
  using (auth.uid() = user_id);

-- No UPDATE policy = follow/unfollow is binary, not editable.
