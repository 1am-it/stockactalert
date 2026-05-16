-- 1AM-183: GRANT DML permissions to the `authenticated` role on the
-- public-schema tables created in 1AM-180.
--
-- WHY THIS IS NEEDED
-- ==================
-- Postgres has two layers of access control:
--   1. Table-level GRANTs (CREATE/SELECT/INSERT/UPDATE/DELETE etc.)
--   2. Row-level security (RLS) policies
--
-- RLS policies only matter if the role has been granted access to the
-- table in the first place. Without a GRANT, Postgres rejects the query
-- at layer 1 with error code 42501 (insufficient_privilege), and the
-- RLS policy is never evaluated.
--
-- The 1AM-180 migration created tables + RLS policies but did NOT issue
-- explicit GRANTs. Supabase used to grant ALL on public schema to the
-- `authenticated` role by default, but for newer projects that default
-- has changed — the authenticated role no longer receives implicit DML
-- privileges on public tables. Migrations must grant them explicitly.
--
-- Symptom observed (1AM-183 testing, 2026-05-16):
--   `[userState] supabase delete failed`
--   Error: { code: '42501', hint: 'Grant the [followedPoliticians]...' }
--   HTTP status: 403 (Forbidden)
--
-- WHAT EACH GRANT ENABLES
-- =======================
-- public.users:
--   SELECT only. RLS limits to auth.uid() = id. INSERT/UPDATE/DELETE
--   are handled by the auth-trigger from 1AM-180 (SECURITY DEFINER —
--   bypasses RLS by design).
--
-- public.user_profiles:
--   SELECT + UPDATE. RLS limits both to auth.uid() = user_id. INSERT
--   is handled by the auth-trigger. DELETE is via cascade from auth.users.
--
-- public.follows:
--   SELECT + INSERT + DELETE. RLS limits all three to auth.uid() = user_id.
--   No UPDATE because follow/unfollow is binary (a row exists or doesn't);
--   matches the design decision documented in 1AM-180.
--
-- The `anon` role intentionally receives no grants here — anonymous app
-- users only use localStorage; they never hit these tables directly.

grant select on public.users to authenticated;

grant select, update on public.user_profiles to authenticated;

grant select, insert, delete on public.follows to authenticated;
