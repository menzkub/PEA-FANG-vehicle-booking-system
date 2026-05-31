-- Returns last_sign_in_at and confirmed_at from auth.users for all members.
-- Only admins can call this (checked inside the function body).
create or replace function get_member_last_logins()
returns table (id uuid, last_sign_in_at timestamptz, confirmed_at timestamptz)
language sql
security definer
set search_path = auth, public
as $$
  select
    au.id,
    au.last_sign_in_at,
    au.confirmed_at
  from auth.users au
  inner join public.profiles p on p.id = au.id
  where (
    select role from public.profiles where public.profiles.id = auth.uid()
  ) = 'admin';
$$;
