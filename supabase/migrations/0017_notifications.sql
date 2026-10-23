-- 0017: in-app notifications (backlog item 8n).
--
-- notifications          one row per notice a person sees under the bell.
-- notification_settings  each person's switches (streak, collections,
--                        submissions) and their time zone, used to send the
--                        "streak at risk" notice in their evening. No row
--                        means everything is switched on.
-- public.notify(...)     the only way notices are created. Called by the
--                        server (service-role key) only. It applies the
--                        rules in one place: nothing for deleted accounts,
--                        respects each person's switches, at most one notice
--                        per key (a key usually includes the day, so a kind
--                        appears at most once a day), and at most 4 new
--                        non-admin notices per person per day. A notice that
--                        already exists can be "merged": its count goes up
--                        and it becomes unread again ("3 submissions
--                        approved") instead of adding another row.
--
-- People can read their own notices and mark them read. Nothing else is
-- writable from the browser.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice. Until it is run, the app works as before; the bell
-- just stays empty.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in (
                'streak_milestone', 'streak_at_risk', 'collection_new',
                'submission_approved', 'submission_rejected',
                'admin_job_failed', 'admin_reports', 'admin_submissions', 'admin_erasures')),
  title       text not null check (char_length(title) between 1 and 120),
  body        text check (body is null or char_length(body) <= 300),
  -- Only links inside the app ("/feed?item=..."), never another site.
  link        text check (link is null or (link ~ '^/[^/\\]' and char_length(link) <= 300)),
  dedupe_key  text not null check (char_length(dedupe_key) <= 200),
  count       integer not null default 1 check (count >= 1),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create unique index if not exists notifications_user_key_idx on public.notifications (user_id, dedupe_key);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_link_idx on public.notifications (link);

alter table public.notifications enable row level security;

drop policy if exists "people read their own notifications" on public.notifications;
create policy "people read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "people mark their own notifications read" on public.notifications;
create policy "people mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The update policy above picks the rows; these grants limit it to the one
-- column. A signed-in person can set read_at and nothing else.
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table if not exists public.notification_settings (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  streak       boolean not null default true,
  collections  boolean not null default true,
  submissions  boolean not null default true,
  time_zone    text check (time_zone is null or char_length(time_zone) <= 64),
  updated_at   timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "people read their own notification settings" on public.notification_settings;
create policy "people read their own notification settings"
  on public.notification_settings for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through the server, which checks the values first.
revoke all on public.notification_settings from anon;
revoke insert, update, delete on public.notification_settings from authenticated;
grant select on public.notification_settings to authenticated;

-- ---------------------------------------------------------------------------
-- notify(): create or merge one notice for each of p_users.
--
--   p_kind        one of the kinds above
--   p_key         dedupe key; one row per (person, key) ever
--   p_title       title when count = 1
--   p_title_many  title once merged; "{n}" becomes the count (null: keep p_title)
--   p_body, p_body_many   the same for the second line
--   p_link        where tapping it goes
--   p_merge       true: an existing row with this key is updated, its count
--                 goes up (or is set to p_count) and it becomes unread again.
--                 false: an existing row means nothing happens.
--   p_count       when merging, set the count to this instead of adding 1
--
-- Returns the person and count for each notice created or updated.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_users uuid[],
  p_kind text,
  p_key text,
  p_title text,
  p_title_many text default null,
  p_body text default null,
  p_body_many text default null,
  p_link text default null,
  p_merge boolean default false,
  p_count integer default null
)
returns table (user_id uuid, count integer)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin boolean := p_kind like 'admin\_%';
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_cap constant integer := 4;
  v_first integer := greatest(coalesce(p_count, 1), 1);
begin
  return query
  with targets as (
    select distinct u as uid
    from unnest(p_users) as u
    join public.profiles p on p.id = u
    left join public.notification_settings s on s.user_id = u
    where p.account_deleted_at is null
      and (not v_admin or p.role = 'admin')
      and case
            when v_admin then true
            when p_kind like 'streak\_%' then coalesce(s.streak, true)
            when p_kind = 'collection_new' then coalesce(s.collections, true)
            when p_kind like 'submission\_%' then coalesce(s.submissions, true)
            else false
          end
      and (
        v_admin
        -- merging into an existing notice is not a new notice
        or exists (select 1 from public.notifications n where n.user_id = u and n.dedupe_key = p_key)
        or (select count(*) from public.notifications n
            where n.user_id = u and n.kind not like 'admin\_%' and n.created_at >= v_day_start) < v_cap
      )
  ),
  written as (
    insert into public.notifications as n (user_id, kind, title, body, link, dedupe_key, count)
    select t.uid, p_kind,
           case when v_first > 1 and p_title_many is not null then replace(p_title_many, '{n}', v_first::text) else p_title end,
           case when v_first > 1 and p_body_many is not null then replace(p_body_many, '{n}', v_first::text) else p_body end,
           p_link, p_key, v_first
    from targets t
    on conflict (user_id, dedupe_key) do update
      set count = case when p_count is not null then greatest(p_count, 1) else n.count + 1 end,
          title = case
                    when (case when p_count is not null then greatest(p_count, 1) else n.count + 1 end) > 1 and p_title_many is not null
                      then replace(p_title_many, '{n}', (case when p_count is not null then greatest(p_count, 1) else n.count + 1 end)::text)
                    else excluded.title
                  end,
          body = case
                   when (case when p_count is not null then greatest(p_count, 1) else n.count + 1 end) > 1 and p_body_many is not null
                     then replace(p_body_many, '{n}', (case when p_count is not null then greatest(p_count, 1) else n.count + 1 end)::text)
                   else excluded.body
                 end,
          link = excluded.link,
          created_at = now(),
          read_at = null
      where p_merge
    returning n.user_id, n.count
  )
  select w.user_id, w.count from written w;
end;
$$;

revoke all on function public.notify(uuid[], text, text, text, text, text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.notify(uuid[], text, text, text, text, text, text, text, boolean, integer) to service_role;
