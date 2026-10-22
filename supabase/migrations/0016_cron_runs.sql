-- 0016: a record of every daily job run (backlog item 3e, error monitoring).
--
-- The purge and auto-refill crons write one row per run: whether it worked
-- and a one-line summary. The Admins page and Profile read it to warn when a
-- job failed or stopped running. Only the server (service-role key) can read
-- or write it. Rows older than 90 days are deleted by the jobs themselves.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice. Until it is run, jobs still work; they just
-- can't be recorded.

create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null,                 -- 'purge-deleted', 'refill', 'alert-test'
  ok boolean not null,
  summary text not null,
  details jsonb,
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

create index if not exists cron_runs_job_finished_idx on public.cron_runs (job, finished_at desc);

-- Row level security on with no policies: service role only.
alter table public.cron_runs enable row level security;
