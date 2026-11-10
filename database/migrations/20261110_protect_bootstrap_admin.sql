-- Ensure the configured bootstrap administrator has superadmin privileges.
-- The original account-management migration used a truncated email address.
update public.profiles p
   set can_manage_admins = true
  from auth.users u
 where p.id = u.id
   and p.role = 'admin'
   and lower(u.email) = lower('essaksanty.baligod@msugensan.edu.ph');
