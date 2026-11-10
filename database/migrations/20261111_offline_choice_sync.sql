create table if not exists public.offline_choice_sync_actions (
  action_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  choice_id uuid not null,
  expected_scene_id uuid not null,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.offline_choice_sync_actions enable row level security;
revoke all on public.offline_choice_sync_actions from public, anon, authenticated;

create or replace function public.submit_choice_idempotent(
  p_action_id uuid,
  p_session_id uuid,
  p_student_id uuid,
  p_choice_id uuid,
  p_expected_scene_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.offline_choice_sync_actions%rowtype;
  v_current_scene_id uuid;
  v_result jsonb;
begin
  insert into public.offline_choice_sync_actions (
    action_id,
    student_id,
    game_session_id,
    choice_id,
    expected_scene_id
  )
  values (
    p_action_id,
    p_student_id,
    p_session_id,
    p_choice_id,
    p_expected_scene_id
  )
  on conflict (action_id) do nothing;

  if not found then
    select *
    into v_existing
    from public.offline_choice_sync_actions
    where action_id = p_action_id;

    if v_existing.student_id is distinct from p_student_id
      or v_existing.game_session_id is distinct from p_session_id
      or v_existing.choice_id is distinct from p_choice_id
      or v_existing.expected_scene_id is distinct from p_expected_scene_id then
      raise exception 'OFFLINE_ACTION_MISMATCH';
    end if;

    if v_existing.result is null then
      raise exception 'OFFLINE_ACTION_INCOMPLETE';
    end if;

    return v_existing.result;
  end if;

  select current_scene_id
  into v_current_scene_id
  from public.game_sessions
  where id = p_session_id
    and student_id = p_student_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_current_scene_id is distinct from p_expected_scene_id then
    raise exception 'OFFLINE_PROGRESS_CONFLICT';
  end if;

  v_result := to_jsonb(public.submit_choice(p_session_id, p_student_id, p_choice_id));

  update public.offline_choice_sync_actions
  set result = v_result
  where action_id = p_action_id;

  return v_result;
end;
$$;

revoke all on function public.submit_choice_idempotent(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_choice_idempotent(uuid, uuid, uuid, uuid, uuid)
  to service_role;
