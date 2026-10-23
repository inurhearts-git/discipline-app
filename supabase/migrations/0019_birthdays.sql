-- 0019: birthdays.
--
-- birthdays              birthdays of people close to you, without names:
--                        who they are to you (spouse, child, friend ...),
--                        which word to use (her, him, them), and the day.
--                        People read and change only their own; the server
--                        reads them for the 9 AM reminder.
-- notification_settings  + birthdays: the reminder switch (on by default)
-- notifications.kind     + 'birthday'
-- notify()               knows the birthdays switch.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code
-- (after 0018). It is safe to run twice. Until it is run, the app works as
-- before and Profile says birthdays aren't switched on yet.

create table if not exists public.birthdays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  relation    text not null check (relation ~ '^[a-z_]{2,30}$'),
  pronoun     text not null default 'them' check (pronoun in ('her', 'him', 'them')),
  month       smallint not null check (month between 1 and 12),
  day         smallint not null check (day between 1 and 31),
  created_at  timestamptz not null default now(),
  check (day <= case when month = 2 then 29 when month in (4, 6, 9, 11) then 30 else 31 end)
);

create index if not exists birthdays_user_idx on public.birthdays (user_id);
create index if not exists birthdays_date_idx on public.birthdays (month, day);

alter table public.birthdays enable row level security;

drop policy if exists "people manage their own birthdays" on public.birthdays;
create policy "people manage their own birthdays"
  on public.birthdays for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.birthdays from anon;

alter table public.notification_settings add column if not exists birthdays boolean not null default true;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'streak_milestone', 'streak_at_risk', 'collection_new',
  'submission_approved', 'submission_rejected', 'comeback', 'birthday',
  'admin_job_failed', 'admin_reports', 'admin_submissions', 'admin_erasures'));

-- Same as 0018, plus the birthdays switch.
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
            when p_kind = 'birthday' then coalesce(s.birthdays, true)
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
