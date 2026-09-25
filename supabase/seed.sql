-- Seed content mirroring the prototype's SEED_CONTENT array.
-- Run this AFTER you have at least one admin user, and replace
-- :'admin_id' with that user's profiles.id (see README "First admin").
--
-- Example:
--   psql "$DATABASE_URL" -v admin_id="'00000000-0000-0000-0000-000000000000'" -f supabase/seed.sql

insert into public.content_items (type, tag, text, attributed_to, source, status, submitted_by, reviewed_by)
values
  ('quote', 'QUOTE', 'You have power over your mind, not outside events. Realize this, and you will find strength.', 'Marcus Aurelius', 'Meditations', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('scripture', 'SCRIPTURE', 'Be strong and of a good courage; be not afraid, for the Lord thy God is with thee.', 'Joshua 1:9', 'The Bible, KJV', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('quote', 'QUOTE', 'The man who has no imagination has no wings.', 'Muhammad Ali', null, 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('scripture', 'SCRIPTURE', 'You have the right to work, but never to the fruit of work.', 'Bhagavad Gita 2.47', null, 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('quote', 'QUOTE', 'You may not control all the events that happen to you, but you can decide not to be reduced by them.', 'Maya Angelou', null, 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('scripture', 'SCRIPTURE', E'Indeed, with hardship comes ease.', E'Qur''an 94:5\u20136', null, 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('quote', 'SPEECH', 'It is not the critic who counts. Credit belongs to the man actually in the arena.', 'Theodore Roosevelt', 'Man in the Arena, 1910', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('quote', 'SPEECH', E'Never give in \u2014 never, never, never, never.', 'Winston Churchill', 'Harrow School, 1941', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1');

insert into public.content_items (type, tag, text, attributed_to, source, video_platform, video_id, status, submitted_by, reviewed_by)
values
  ('video', 'SPEECH', 'Stay hungry. Stay foolish.', 'Steve Jobs', 'Stanford Commencement, 2005', 'youtube', 'UF8uR6Z6KLc', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1'),
  ('video', 'SPEECH', 'Great leaders make people feel safe, not attacked.', 'Simon Sinek', 'TED Talk', 'youtube', 'qp0HIF3SfI4', 'approved', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1', '120c5ec8-5eca-4aee-8ac6-9962e9594ce1');
