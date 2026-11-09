-- Required by the admin-approved password recovery flow.
alter table public.password_reset_requests
  add column if not exists tracking_key_hash text;

create unique index if not exists password_reset_tracking_key_hash_idx
  on public.password_reset_requests (tracking_key_hash)
  where tracking_key_hash is not null;
