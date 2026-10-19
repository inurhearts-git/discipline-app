-- 0012: "Delete my account" with a restore window.
--
-- When someone deletes their account, the app copies their personal data
-- (journal, reflections, likes and saves, usage, profile details) into one
-- ENCRYPTED archive row, erases the live copies, and flags the account as
-- deleted. If they come back within the window they can restore it or start
-- fresh. After the window (or as soon as they start fresh) the archive is
-- erased for good.
--
-- The encryption key lives only in the server's environment
-- (ACCOUNT_ARCHIVE_KEY); the database holds ciphertext it cannot read.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice.

-- The flag: set while an account is deleted and waiting out its window.
alter table public.profiles
  add column if not exists account_deleted_at timestamptz;

create table if not exists public.account_archives (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,            -- AES-256-GCM, base64
  iv text not null,                    -- base64
  tag text not null,                   -- GCM authentication tag, base64
  key_version integer not null default 1,
  deleted_at timestamptz not null default now(),
  purge_after timestamptz not null     -- erased for good after this moment
);

create index if not exists account_archives_purge_idx on public.account_archives (purge_after);

-- Row level security on with no policies: only the server's service-role key
-- can read or write archives.
alter table public.account_archives enable row level security;
