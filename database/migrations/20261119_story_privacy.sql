-- Allow admins to hide published stories from students until they are ready.
alter table public.stories
  add column if not exists is_private boolean not null default false;
