create table if not exists reset_link_logs (
  id              uuid        default gen_random_uuid() primary key,
  target_emp      text        not null,
  target_name     text        not null,
  generated_by_emp  text      not null,
  generated_by_name text      not null,
  created_at      timestamptz default now()
);

alter table reset_link_logs enable row level security;

-- Only admins can read the log
create policy "Admins can view reset_link_logs"
  on reset_link_logs for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
