-- Background music library. Safe to run even if a music_tracks table already exists.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.music_tracks add column if not exists title text;
alter table public.music_tracks add column if not exists artist text;
alter table public.music_tracks add column if not exists audio_url text;
alter table public.music_tracks add column if not exists mood_tags text[] not null default '{}';
alter table public.music_tracks add column if not exists license text default 'Pixabay Content License';
alter table public.music_tracks add column if not exists source_url text;
alter table public.music_tracks add column if not exists is_active boolean not null default true;

-- content_items.audio_track_id already exists; this just makes sure it does
alter table public.content_items add column if not exists audio_track_id uuid;

alter table public.music_tracks enable row level security;
drop policy if exists "music readable by signed-in users" on public.music_tracks;
create policy "music readable by signed-in users"
  on public.music_tracks for select to authenticated using (is_active);

-- Public bucket for the audio files (upload the MP3s in the dashboard)
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do nothing;
