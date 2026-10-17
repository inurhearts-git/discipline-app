-- 0006: remember WHEN something was liked or saved.
--
-- Used by the limit-screen recap ("what you carried today"). Existing likes
-- and saves keep NULL timestamps, so they simply don't appear as "today";
-- nothing else reads these columns.
--
-- Run this in the Supabase SQL editor. It is safe to run twice.

alter table public.user_content_interactions
  add column if not exists liked_at timestamptz,
  add column if not exists saved_at timestamptz;
