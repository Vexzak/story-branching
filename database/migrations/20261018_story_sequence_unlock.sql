-- Persist the admin-defined story order and the per-story sequential unlock rule.
-- Existing stories retain their creation order when this migration is applied.
alter table public.stories
  add column if not exists sequence_order integer,
  add column if not exists unlock_after_previous boolean not null default true;

with ordered as (
  select id, row_number() over (order by created_at, id) - 1 as position
  from public.stories
)
update public.stories s
   set sequence_order = ordered.position
  from ordered
 where s.id = ordered.id
   and s.sequence_order is null;

alter table public.stories
  alter column sequence_order set default 0,
  alter column sequence_order set not null;

create index if not exists stories_sequence_idx
  on public.stories (status, sequence_order, created_at);
