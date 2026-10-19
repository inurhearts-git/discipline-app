-- 0011: records Terms acceptance and age at sign-up, and adds error reports.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice.

-- 1) What each person agreed to, and when.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- 2) New accounts: copy date of birth and consent from the sign-up form's
--    metadata, and refuse anyone under 18. (Existing accounts are untouched.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  dob date;
  accepted timestamptz;
begin
  begin
    dob := nullif(new.raw_user_meta_data->>'birthdate', '')::date;
  exception when others then
    dob := null;
  end;

  -- A date of birth that makes the person under 18 (or is in the future)
  -- stops the account being created.
  if dob is not null and dob > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to use Discipline.';
  end if;

  begin
    accepted := nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz;
  exception when others then
    accepted := null;
  end;

  insert into public.profiles (id, display_name, email, birthdate, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    dob,
    accepted,
    nullif(new.raw_user_meta_data->>'terms_version', '')
  );
  return new;
end;
$$;

-- 3) "Report an error" on quotes, scripture and clips.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('wrong_source', 'inaccurate', 'inappropriate', 'broken_video', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);

-- Row level security on, no policies: only the server (service-role key)
-- reads or writes reports, after checking who is asking.
alter table public.content_reports enable row level security;

-- To undo step 2 (restore the original sign-up trigger function), run:
--   create or replace function public.handle_new_user() returns trigger language plpgsql
--   security definer set search_path = public as $$ begin
--     insert into public.profiles (id, display_name, email)
--     values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email);
--     return new; end; $$;
