-- 0013: auto refill of speech clips from channels you choose.
--
-- A daily job reads the latest uploads of the channels switched on here and
-- adds suitable ones to the PENDING queue (never straight to live). This adds
-- the switch and bookkeeping to each person, and a marker on added items.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice.

alter table public.people
  add column if not exists auto_refill boolean not null default false,
  add column if not exists refill_since timestamptz,        -- newest upload already looked at
  add column if not exists refill_last_run_at timestamptz,
  add column if not exists refill_last_added integer;

alter table public.content_items
  add column if not exists auto_added boolean not null default false;
