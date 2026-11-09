-- Add a separate privilege for administering administrator accounts.
-- Existing administrator roles are unchanged; only the named account receives
-- this capability during migration.
alter table public.profiles
  add column if not exists can_manage_admins boolean not null default false;

update public.profiles p
   set can_manage_admins = true
  from auth.users u
 where p.id = u.id
   and p.role = 'admin'
   and lower(u.email) = 'essaksanty.baligod@msugensan';
