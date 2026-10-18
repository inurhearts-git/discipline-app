-- 0009: plain-language meanings for quotes and scripture.
--
-- One row per content item. Claude writes a draft; an admin edits and
-- approves it in /moderate/meanings. Readers only ever see approved meanings.
-- All writes go through server routes using the service-role client after an
-- admin check, so there is no insert/update policy for normal users.
--
-- Run this in the Supabase SQL editor. It is safe to run twice.

create table if not exists public.content_meanings (
  content_id uuid primary key references public.content_items (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1200),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  source text not null default 'ai' check (source in ('ai', 'ai_edited', 'human')),
  model text,
  updated_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz
);

create index if not exists content_meanings_status_idx on public.content_meanings (status);

alter table public.content_meanings enable row level security;

drop policy if exists "approved meanings are readable" on public.content_meanings;
create policy "approved meanings are readable"
  on public.content_meanings for select
  to authenticated
  using (
    status = 'approved'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
