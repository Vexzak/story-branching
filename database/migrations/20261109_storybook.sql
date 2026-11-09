-- Book content is stored with the story draft and copied into each immutable published version.
alter table public.stories
  add column if not exists author text not null default '',
  add column if not exists full_story_text text not null default '';

alter table public.profiles
  add column if not exists book_tutorial_seen boolean not null default false;

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
             where sc.story_id = p_story_id
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
     set status = 'published', published_version_id = v_version_id
   where id = p_story_id;

  return v_version_id;
end;
$$;
