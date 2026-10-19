-- 0014: Collections.
--
-- A collection is a named, saved filter over approved content: a title, a short
-- blurb, an emoji, and which topics (QUOTE / SCRIPTURE / SPEECH) and moods it
-- covers. Opening one shows a feed of the approved items that match.
-- Admins manage them; signed-in people can read the active ones.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice.

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 60),
  blurb       text not null default '' check (char_length(blurb) <= 160),
  emoji       text not null default '📚' check (char_length(emoji) <= 8),
  tags        text[] not null default '{}',
  moods       text[] not null default '{}',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.collections enable row level security;

drop policy if exists "active collections are readable" on public.collections;
create policy "active collections are readable"
  on public.collections for select
  to authenticated
  using (is_active = true);

-- Writes happen only through the server (service role), so no insert/update/delete policies.

-- Three starter collections (edit or remove them in Profile > Collections).
insert into public.collections (title, blurb, emoji, tags, moods, sort_order)
select * from (values
  ('Mornings',            'Start the day with something that moves you.', '🌅', array['QUOTE','SCRIPTURE','SPEECH']::text[], array['unmotivated','grateful','driven']::text[], 1),
  ('Before a big moment', 'Courage and focus before a meeting, exam or hard conversation.', '🎯', array['QUOTE','SPEECH']::text[], array['driven','stressed']::text[], 2),
  ('Hard days',           'For when it feels like too much.', '🌧️', array['QUOTE','SCRIPTURE','SPEECH']::text[], array['stressed','overthinking','unmotivated']::text[], 3)
) as v(title, blurb, emoji, tags, moods, sort_order)
where not exists (select 1 from public.collections);
