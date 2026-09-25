-- Discipline app — initial schema
-- Implements blueprint §3 (data model) with row-level security designed so that:
--   * a user can never self-promote to admin
--   * content only becomes visible after admin approval
--   * usage_sessions is only ever written by the server (service role),
--     never directly by an authenticated client — this is what makes the
--     60-minute cap actually enforceable instead of just client state.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('viewer', 'creator', 'admin');
create type content_type as enum ('quote', 'scripture', 'video');
create type content_tag as enum ('QUOTE', 'SCRIPTURE', 'SPEECH');
create type video_platform as enum ('youtube', 'other');
create type maturity_rating as enum ('general', 'mature');
create type content_status as enum ('pending', 'approved', 'rejected');
create type mood_tag as enum ('somber', 'driving', 'triumphant', 'contemplative', 'neutral');

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text unique not null,
  role user_role not null default 'viewer',
  birthdate date,
  bio text,
  avatar_color text,
  interests content_tag[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can read profiles (needed to show "submitted by" in
-- moderation, and to check your own role client-side after login).
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users insert their own row once, at signup, via the trigger below —
-- no direct client insert policy is needed/granted.

-- Enforce "admin only settable by another admin, never self-service":
-- block any client-side attempt to change `role` unless the caller
-- already is an admin. The update policy above already restricts rows to
-- "your own row" for authenticated users, so combined with this trigger a
-- normal user editing their own profile can change everything except role.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only an admin can change a user role';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- people  (for the "collection of videos from a searched person" feature)
-- ---------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  youtube_channel_id text,
  bio text,
  verified boolean not null default false
);

alter table public.people enable row level security;

create policy "people are readable by authenticated users"
  on public.people for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- audio_tracks
-- ---------------------------------------------------------------------------
create table public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mood_tag mood_tag not null default 'neutral',
  file_url text not null,
  license_note text
);

alter table public.audio_tracks enable row level security;

create policy "audio tracks are readable by authenticated users"
  on public.audio_tracks for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- content_items
-- ---------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type content_type not null,
  tag content_tag not null,
  text text not null,
  attributed_to text not null,
  source text,
  video_platform video_platform,
  video_id text,
  audio_track_id uuid references public.audio_tracks (id),
  person_id uuid references public.people (id),
  maturity_rating maturity_rating not null default 'general',
  status content_status not null default 'pending',
  submitted_by uuid not null references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  view_count bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.content_items enable row level security;

-- Everyone can see approved content. Submitters can see their own pending/
-- rejected items (so a creator can track their own submission). Admins can
-- see everything (needed for the moderation queue).
create policy "approved content is readable by authenticated users"
  on public.content_items for select
  to authenticated
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Only creators/admins may submit, and only as themselves, and only ever
-- landing in `pending` — status can't be set to approved by the client.
create policy "creators and admins can submit content"
  on public.content_items for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('creator', 'admin')
    )
  );

-- No direct client update policy: approve/reject is done server-side only,
-- via the service-role client in /api/moderate/[id], after the route has
-- independently verified the caller is an admin. This is the fix for the
-- prototype's biggest gap (client-side-only moderation writes).

-- ---------------------------------------------------------------------------
-- user_content_interactions  (likes, saves, view dedup)
-- ---------------------------------------------------------------------------
create table public.user_content_interactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_id uuid not null references public.content_items (id) on delete cascade,
  liked boolean not null default false,
  saved boolean not null default false,
  collection_label text,
  viewed_at timestamptz,
  primary key (user_id, content_id)
);

alter table public.user_content_interactions enable row level security;

create policy "users manage their own interactions"
  on public.user_content_interactions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- usage_sessions  (server-authoritative daily usage cap)
-- ---------------------------------------------------------------------------
create table public.usage_sessions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  ms_spent bigint not null default 0,
  primary key (user_id, date)
);

alter table public.usage_sessions enable row level security;

-- Users may READ their own usage (so the profile page can show a chart),
-- but there is deliberately no insert/update policy for the `authenticated`
-- role — all writes happen through /api/usage/heartbeat using the
-- service-role client, which is the whole point of making this
-- server-authoritative rather than client-trusted.
create policy "users can read their own usage"
  on public.usage_sessions for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_content_items_status on public.content_items (status);
create index idx_content_items_tag on public.content_items (tag);
create index idx_content_items_person on public.content_items (person_id);
create index idx_interactions_user on public.user_content_interactions (user_id);
create index idx_usage_sessions_user_date on public.usage_sessions (user_id, date);
