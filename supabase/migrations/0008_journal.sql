-- 0008: private journal entries.
--
-- Any number of entries per person, each up to 1,000 words (checked by the API;
-- the 12,000-character cap here is a backstop). created_at is the date and
-- time stamp shown on each entry; updated_at shows when it was last edited.
-- Only the owner can read or write their entries.
--
-- Run this in the Supabase SQL editor. It is safe to run twice.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);

alter table public.journal_entries enable row level security;

drop policy if exists "users manage their own journal" on public.journal_entries;
create policy "users manage their own journal"
  on public.journal_entries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
