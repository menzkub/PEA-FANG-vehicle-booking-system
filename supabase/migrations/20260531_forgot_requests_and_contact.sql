-- Allow anon users to read reset_contact config (for forgot password screen)
create policy "Anon can read reset_contact config"
  on app_config for select
  to anon
  using (key = 'reset_contact');

-- Insert default reset_contact if not exists
insert into app_config (key, value, updated_at)
values ('reset_contact', '{"phone":"053-451-666 ต่อ 12","phoneLink":"tel:053451666","note":"แจ้งรหัสพนักงานและชื่อของคุณ"}', now())
on conflict (key) do nothing;

-- Table for tracking forgot password requests
create table if not exists forgot_password_requests (
  id           uuid        default gen_random_uuid() primary key,
  emp          text        not null,
  name         text        not null,
  requested_at timestamptz default now(),
  seen_by      text        default null,
  seen_at      timestamptz default null
);

alter table forgot_password_requests enable row level security;

-- Anyone (anon + authenticated) can submit a request
create policy "Anyone can submit forgot password request"
  on forgot_password_requests for insert
  to anon, authenticated
  with check (true);

-- Only admins can read requests
create policy "Admins can view forgot password requests"
  on forgot_password_requests for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins can mark as seen
create policy "Admins can update forgot password requests"
  on forgot_password_requests for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
