-- ============================================================================
-- Branching Story PWA - Database Schema (Phase 1)
-- Target: Supabase PostgreSQL (PostgreSQL 14+)
--
-- HOW TO RUN
--   1. Open your Supabase project -> SQL Editor -> New query.
--   2. Paste and run this entire file first.
--   3. Then run database/seed.sql.
--
-- This file is idempotent-ish: it uses IF NOT EXISTS where practical so it can
-- be re-run safely while developing. It does NOT drop existing tables.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared helper: keep updated_at current
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- One row per Supabase Auth user. Never stores passwords.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  display_name text not null,
  role         text not null default 'student' check (role in ('student', 'admin')),
  can_manage_admins boolean not null default false,
  book_tutorial_seen boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Case-insensitive username uniqueness (e.g. "Sam" and "sam" collide).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- stories (mutable draft record + pointer to the immutable published version)
-- ----------------------------------------------------------------------------
create table if not exists public.stories (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  author               text not null default '',
  full_story_text      text not null default '',
  description          text not null default '',
  cover_image_path     text,
  status               text not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  sequence_order      integer not null default 0,
  unlock_after_previous boolean not null default true,
  starting_scene_id    uuid,
  published_version_id uuid,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists stories_status_idx on public.stories (status);
create index if not exists stories_sequence_idx
  on public.stories (status, sequence_order, created_at);

drop trigger if exists trg_stories_updated_at on public.stories;
create trigger trg_stories_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- story_versions
-- Immutable snapshot of a story's scenes + choices at publish time.
-- Active game sessions bind to a version so later edits do not change them.
-- ----------------------------------------------------------------------------
create table if not exists public.story_versions (
  id             uuid primary key default gen_random_uuid(),
  story_id       uuid not null references public.stories(id) on delete cascade,
  version_number integer not null,
  content        jsonb not null,
  published_by   uuid references public.profiles(id) on delete set null,
  published_at   timestamptz not null default now(),
  unique (story_id, version_number)
);

create index if not exists story_versions_story_idx
  on public.story_versions (story_id, version_number desc);

-- ----------------------------------------------------------------------------
-- scenes (draft content)
-- ----------------------------------------------------------------------------
create table if not exists public.scenes (
  id                   uuid primary key default gen_random_uuid(),
  story_id             uuid not null references public.stories(id) on delete cascade,
  title                text not null default '',
  scene_type           text not null default 'narrative'
                         check (scene_type in ('start', 'decision', 'narrative', 'failure', 'ending')),
  narration            text not null default '',
  dialogue             text,
  background_image_path text,
  sound_effect_path    text,
  character_config     jsonb,
  display_order        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Composite key lets choices prove, via foreign key, that they stay in-story.
  unique (id, story_id)
);

create index if not exists scenes_story_idx on public.scenes (story_id, display_order);

drop trigger if exists trg_scenes_updated_at on public.scenes;
create trigger trg_scenes_updated_at
  before update on public.scenes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- choices (draft content)
-- Branching is by destination_scene_id, never by comparing choice text.
-- ----------------------------------------------------------------------------
create table if not exists public.choices (
  id                   uuid primary key default gen_random_uuid(),
  scene_id             uuid not null,
  story_id             uuid not null references public.stories(id) on delete cascade,
  text                 text not null default '',
  destination_scene_id uuid,
  failure_scene_id     uuid,
  is_correct           boolean not null default false,
  feedback             text,
  display_order        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint choices_scene_fk foreign key (scene_id, story_id)
    references public.scenes(id, story_id) on delete cascade,
  constraint choices_destination_fk foreign key (destination_scene_id, story_id)
    references public.scenes(id, story_id) on delete restrict,
  constraint choices_failure_fk foreign key (failure_scene_id, story_id)
    references public.scenes(id, story_id) on delete restrict
);

create index if not exists choices_scene_idx on public.choices (scene_id, display_order);
create index if not exists choices_story_idx on public.choices (story_id);

-- At most one correct choice per scene (validation enforces "exactly one").
create unique index if not exists choices_one_correct_per_scene
  on public.choices (scene_id) where is_correct;

drop trigger if exists trg_choices_updated_at on public.choices;
create trigger trg_choices_updated_at
  before update on public.choices
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- game_sessions
-- ----------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  story_id         uuid not null references public.stories(id) on delete cascade,
  story_version_id uuid references public.story_versions(id) on delete set null,
  status           text not null default 'in_progress'
                     check (status in ('in_progress', 'completed', 'abandoned')),
  current_scene_id uuid,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  last_activity_at timestamptz not null default now()
);

create index if not exists game_sessions_student_idx
  on public.game_sessions (student_id, started_at desc);
create index if not exists game_sessions_story_idx
  on public.game_sessions (story_id, status);

-- ----------------------------------------------------------------------------
-- choice_logs
-- One row per selection. Stores text snapshots so old reports stay readable
-- after story content is edited.
-- ----------------------------------------------------------------------------
create table if not exists public.choice_logs (
  id                  uuid primary key default gen_random_uuid(),
  game_session_id     uuid not null references public.game_sessions(id) on delete cascade,
  student_id          uuid not null references public.profiles(id) on delete cascade,
  story_id            uuid not null references public.stories(id) on delete cascade,
  scene_id            uuid,
  choice_id           uuid references public.choices(id) on delete set null,
  scene_title_snapshot text,
  choice_text_snapshot text,
  is_correct          boolean not null default false,
  attempt_number      integer not null default 1,
  selected_at         timestamptz not null default now(),
  resulting_scene_id  uuid
);

create index if not exists choice_logs_session_idx
  on public.choice_logs (game_session_id, selected_at);
create index if not exists choice_logs_student_idx
  on public.choice_logs (student_id, selected_at desc);
create index if not exists choice_logs_scene_idx
  on public.choice_logs (game_session_id, scene_id);

-- ----------------------------------------------------------------------------
-- password_reset_requests
-- ----------------------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected', 'completed', 'expired')),
  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  approved_at  timestamptz,
  completed_at timestamptz,
  expires_at   timestamptz,
  tracking_key_hash text unique
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status, requested_at desc);
create index if not exists password_reset_requests_student_idx
  on public.password_reset_requests (student_id, requested_at desc);

-- Prevent more than one pending request per student.
create unique index if not exists password_reset_one_pending_per_student
  on public.password_reset_requests (student_id) where status = 'pending';

-- ----------------------------------------------------------------------------
-- password_reset_tokens
-- Only a SHA-256 hash of the single-use token is ever stored.
-- ----------------------------------------------------------------------------
create table if not exists public.password_reset_tokens (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.password_reset_requests(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists password_reset_tokens_request_idx
  on public.password_reset_tokens (request_id);

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- Deferred foreign keys that close the circular references
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stories_starting_scene_fk'
  ) then
    alter table public.stories
      add constraint stories_starting_scene_fk
      foreign key (starting_scene_id) references public.scenes(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stories_published_version_fk'
  ) then
    alter table public.stories
      add constraint stories_published_version_fk
      foreign key (published_version_id) references public.story_versions(id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- publish_story_version(story_id, published_by)
-- Builds an immutable JSON snapshot of the story's scenes + choices, stores it
-- in story_versions, and marks the story published. Returns the version id.
-- Used by seed.sql now and by the admin publish endpoint in Phase 3.
-- ============================================================================
create or replace function public.publish_story_version(
  p_story_id uuid,
  p_user_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version_id     uuid;
  v_version_number integer;
  v_content        jsonb;
begin
  select jsonb_build_object(
           'story', jsonb_build_object(
             'id', s.id,
             'title', s.title,
             'author', s.author,
             'full_story_text', s.full_story_text,
             'description', s.description,
             'cover_image_path', s.cover_image_path
           ),
           'starting_scene_id', s.starting_scene_id,
           'scenes', coalesce((
             select jsonb_object_agg(sc.id::text, jsonb_build_object(
               'id', sc.id,
               'title', sc.title,
               'scene_type', sc.scene_type,
               'narration', sc.narration,
               'dialogue', sc.dialogue,
               'background_image_path', sc.background_image_path,
               'sound_effect_path', sc.sound_effect_path,
               'character_config', sc.character_config,
               'display_order', sc.display_order,
               'choices', coalesce((
                 select jsonb_agg(jsonb_build_object(
                   'id', c.id,
                   'text', c.text,
                   'destination_scene_id', c.destination_scene_id,
                   'failure_scene_id', c.failure_scene_id,
                   'is_correct', c.is_correct,
                   'feedback', c.feedback,
                   'display_order', c.display_order
                 ) order by c.display_order, c.created_at)
                 from public.choices c
                 where c.scene_id = sc.id
               ), '[]'::jsonb)
             ))
             from public.scenes sc
             where sc.story_id = s.id
           ), '{}'::jsonb)
         )
    into v_content
    from public.stories s
   where s.id = p_story_id;

  if v_content is null then
    raise exception 'Story % not found', p_story_id;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
    from public.story_versions
   where story_id = p_story_id;

  insert into public.story_versions (story_id, version_number, content, published_by)
  values (p_story_id, v_version_number, v_content, p_user_id)
  returning id into v_version_id;

  update public.stories
     set published_version_id = v_version_id,
         status = 'published'
   where id = p_story_id;

  return v_version_id;
end;
$$;

-- ============================================================================
-- Row Level Security
-- All writes and all privileged reads go through the Express backend using the
-- service-role key, which bypasses RLS. These policies are defense-in-depth for
-- any direct client access with the anon/authenticated key.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles                enable row level security;
alter table public.stories                 enable row level security;
alter table public.story_versions          enable row level security;
alter table public.scenes                  enable row level security;
alter table public.choices                 enable row level security;
alter table public.game_sessions           enable row level security;
alter table public.choice_logs             enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.password_reset_tokens   enable row level security;
alter table public.audit_logs              enable row level security;

-- profiles: a user may read their own profile; admins may read all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- stories: everyone may read published stories; admins read all.
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
  for select using (status = 'published' or public.is_admin());

-- story_versions: readable when the story is published, or by admins.
drop policy if exists story_versions_select on public.story_versions;
create policy story_versions_select on public.story_versions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.stories s
      where s.id = story_versions.story_id and s.status = 'published'
    )
  );

-- scenes: readable when their story is published, or by admins.
drop policy if exists scenes_select on public.scenes;
create policy scenes_select on public.scenes
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.stories s
      where s.id = scenes.story_id and s.status = 'published'
    )
  );

-- choices: same rule as scenes.
drop policy if exists choices_select on public.choices;
create policy choices_select on public.choices
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.stories s
      where s.id = choices.story_id and s.status = 'published'
    )
  );

-- game_sessions: a student sees only their own; admins see all.
drop policy if exists game_sessions_select on public.game_sessions;
create policy game_sessions_select on public.game_sessions
  for select using (student_id = auth.uid() or public.is_admin());

-- choice_logs: a student sees only their own; admins see all.
drop policy if exists choice_logs_select on public.choice_logs;
create policy choice_logs_select on public.choice_logs
  for select using (student_id = auth.uid() or public.is_admin());

-- password_reset_requests: a student sees only their own; admins see all.
drop policy if exists password_reset_requests_select on public.password_reset_requests;
create policy password_reset_requests_select on public.password_reset_requests
  for select using (student_id = auth.uid() or public.is_admin());

-- password_reset_tokens: admins only (the student never reads the raw token row).
drop policy if exists password_reset_tokens_select on public.password_reset_tokens;
create policy password_reset_tokens_select on public.password_reset_tokens
  for select using (public.is_admin());

-- audit_logs: admins only.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (public.is_admin());

-- ============================================================================
-- Done. Next: run database/seed.sql
-- ============================================================================
