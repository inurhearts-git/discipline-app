-- 0018: push notifications and the "we miss you" nudge.
--
-- push_subscriptions     one row per browser or phone that allowed
--                        notifications (the address the browser's push
--                        service gave us, and its keys). Server only.
-- notification_settings  + comeback: the "we miss you" switch (on by default)
--                        + last_seen_at: when the person last opened the app,
--                          so the nudge knows who has been away.
-- notifications.kind     + 'comeback'
-- notify()               knows the comeback switch.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code
-- (after 0017). It is safe to run twice. Until it is run, the app works as
-- before; push just stays off.

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh        text not null check (char_length(p256dh) <= 200),
  auth          text not null check (char_length(auth) <= 100),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Row level security on with no policies: only the server can read or write.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

alter table public.notification_settings add column if not exists comeback boolean not null default true;
alter table public.notification_settings add column if not exists last_seen_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'streak_milestone', 'streak_at_risk', 'collection_new',
  'submission_approved', 'submission_rejected', 'comeback',
  'admin_job_failed', 'admin_reports', 'admin_submissions', 'admin_erasures'));

-- Same as 0017, plus the comeback switch.
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
            when p_kind = 'comeback' then coalesce(s.comeback, true)
            else false
          end
      and (
        v_admin
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
