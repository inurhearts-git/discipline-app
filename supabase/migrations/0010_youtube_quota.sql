-- 0010: count YouTube API quota used per day, so the admin pages can show
-- "N searches left today".
--
-- YouTube gives 10,000 units a day (searches cost 100, video lookups 1) and
-- resets at midnight Pacific time. YouTube can't tell us what's left, so the
-- app keeps its own tally here. Only the server touches this table.
--
-- Run this in the Supabase SQL editor. It is safe to run twice.

create table if not exists public.youtube_quota_usage (
  day date primary key,          -- the Pacific-time date the units count against
  units integer not null default 0,
  searches integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row level security on, with no policies: only the service-role key
-- (used by the server routes) can read or write it.
alter table public.youtube_quota_usage enable row level security;
