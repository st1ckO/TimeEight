create table public.task_daily_targets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null,
  local_date date not null,
  target_seconds integer not null check (target_seconds between 60 and 86400),
  primary key (user_id, task_id, local_date),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade
);

-- Legacy days have no recorded task targets; retain their current defaults.
insert into public.task_daily_targets (user_id, task_id, local_date, target_seconds)
select distinct e.user_id, e.task_id, e.local_date, t.target_seconds
from public.time_entries e
join public.tasks t on t.user_id = e.user_id and t.id = e.task_id;

alter table public.task_daily_targets enable row level security;
revoke all on table public.task_daily_targets from anon, authenticated;
grant select, insert, update on table public.task_daily_targets to authenticated;
create policy task_daily_targets_select on public.task_daily_targets
for select to authenticated using ((select auth.uid()) = user_id);
create policy task_daily_targets_insert on public.task_daily_targets
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_daily_targets_update on public.task_daily_targets
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
