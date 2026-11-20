-- Optional looping background music for a whole published story.
alter table public.stories
  add column if not exists background_music_path text;
