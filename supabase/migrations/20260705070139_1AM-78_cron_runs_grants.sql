-- 1AM-78 hotfix: grant DML rights on cron_runs to service_role (fixes 42501).
--
-- The 20260704120000_1AM-78_cron_runs.sql migration enabled RLS but never
-- issued an explicit GRANT. As established in 1AM-183
-- (20260516194500_1AM-183_table_grants.sql), this Supabase project does not
-- give roles implicit privileges on public-schema tables — RLS is only
-- evaluated after a table-level GRANT succeeds. Without it, service_role
-- (used by scripts/cron-fetch-trades.mjs and api/health.js) gets
-- "permission denied for table cron_runs" (42501) before RLS is ever
-- checked.
--
-- anon/authenticated intentionally receive no grants: only the cron script
-- and the health endpoint ever touch this table.

grant select, insert on public.cron_runs to service_role;
