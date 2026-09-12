-- Preserve past goal snapshots; establish the fixed goal from each user's local today.
insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
select id, (now() at time zone timezone)::date, 28800
from public.profiles
on conflict (user_id, effective_date) do update set goal_seconds = 28800;

update public.daily_goal_changes as goals
set goal_seconds = 28800
from public.profiles as profile
where goals.user_id = profile.id
  and goals.effective_date > (now() at time zone profile.timezone)::date;

-- Old clients may still submit custom goals. Normalize current/future writes.
create function public.enforce_fixed_daily_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_today date;
begin
  select (now() at time zone timezone)::date into local_today
  from public.profiles where id = new.user_id;
  if new.effective_date >= local_today then
    new.goal_seconds := 28800;
  end if;
  return new;
end;
$$;

create trigger daily_goals_fixed_eight_hours
before insert or update on public.daily_goal_changes
for each row execute function public.enforce_fixed_daily_goal();
