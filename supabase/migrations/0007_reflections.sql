-- 0007: one-line daily reflections (private journal).
--
-- One row per person per UTC day (the same day boundary as usage and streaks).
-- content_id is the quote it was written about, if any. Only the owner can
-- read or write their rows; nobody else, including other users, can see them.
--
-- Run this in the Supabase SQL editor. It is safe to run twice.

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  text text not null check (char_length(text) between 1 and 280),
  content_id uuid references public.content_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists reflections_user_date_idx on public.reflections (user_id, date desc);

alter table public.reflections enable row level security;

drop policy if exists "users manage their own reflections" on public.reflections;
create policy "users manage their own reflections"
  on public.reflections for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
