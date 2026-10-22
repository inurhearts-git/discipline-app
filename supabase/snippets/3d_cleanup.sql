-- Backlog 3d clean-ups. Run the parts you need in the Supabase SQL editor.
-- These change data only (no schema), so they are snippets, not migrations.

-- 1. Music: see which tracks still have placeholder names.
select id, title, artist, audio_url, source_url
from public.music_tracks
where title ilike 'REPLACE%' or artist ilike 'REPLACE%'
order by created_at;

-- Then set the real name for each one. The source_url (Pixabay page) shows
-- the real title and artist. Copy one line per track and fill it in:
-- update public.music_tracks set title = 'Real title', artist = 'Real artist' where id = 'PASTE-ID';

-- Until then the player shows "Background music" for these tracks.

-- 2. Test profile bio: find the bio and clear it (or edit it on Profile).
select id, display_name, email, bio from public.profiles where bio ilike '%27 Sep%';
-- update public.profiles set bio = null where bio = 'This is on 27 Sep';
