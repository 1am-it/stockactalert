-- 1AM-78: track cron run history so /api/health can report a real
-- "last successful FMP poll" timestamp instead of guessing from filings
-- rows (which don't update on days with zero new trades — a silent
-- cron failure would otherwise look identical to "no new trades today").
--
-- Only the service_role (used by scripts/cron-fetch-trades.mjs and the
-- api/health.js edge function) ever touches this table, so RLS is enabled
-- with no policies — anon/authenticated are denied by default, service_role
-- bypasses RLS as usual.

create table public.cron_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null check (status in ('success', 'partial', 'failure')),
  detail text,
  ran_at timestamptz not null default now()
);

create index cron_runs_job_name_ran_at_idx
  on public.cron_runs (job_name, ran_at desc);

alter table public.cron_runs enable row level security;
