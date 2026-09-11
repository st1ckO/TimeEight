create type public.profile_theme as enum ('system', 'light', 'dark');
create type public.goal_kind as enum ('minimum', 'limit');
create type public.entry_source as enum ('timer', 'manual', 'recovered');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  theme public.profile_theme not null default 'system',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_goal_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_date date not null,
  goal_seconds integer not null check (goal_seconds between 900 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_date)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#197c67' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  goal_kind public.goal_kind not null,
  target_seconds integer not null check (target_seconds between 60 and 86400),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index tasks_active_sort_order_key
on public.tasks (user_id, sort_order)
where archived_at is null;

create table public.active_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null,
  started_at timestamptz not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  checkpointed_at timestamptz not null,
  checkpoint_seconds integer not null default 0 check (checkpoint_seconds >= 0),
  limit_override boolean not null default false,
  mutation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade,
  unique (user_id, task_id),
  unique (user_id, mutation_id)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null,
  local_date date not null,
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  source public.entry_source not null,
  started_at timestamptz,
  ended_at timestamptz,
  manually_adjusted boolean not null default false,
  mutation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete restrict,
  check (ended_at is null or started_at is null or ended_at > started_at),
  unique (user_id, mutation_id)
);

create index daily_goal_changes_lookup_idx
on public.daily_goal_changes (user_id, effective_date desc);
create index tasks_active_order_idx
on public.tasks (user_id, archived_at, sort_order);
create index time_entries_day_idx
on public.time_entries (user_id, local_date);
create index time_entries_task_day_idx
on public.time_entries (user_id, task_id, local_date);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger daily_goal_changes_set_updated_at before update on public.daily_goal_changes
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger active_timers_set_updated_at before update on public.active_timers
for each row execute function public.set_updated_at();
create trigger time_entries_set_updated_at before update on public.time_entries
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_name text;
begin
  initial_name := left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80);

  insert into public.profiles (id, display_name)
  values (new.id, initial_name);

  insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
  values (new.id, current_date, 28800);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace view public.daily_summaries
with (security_invoker = true)
as
select
  user_id,
  local_date,
  sum(duration_seconds)::bigint as tracked_seconds,
  count(*)::bigint as entry_count
from public.time_entries
group by user_id, local_date;

alter table public.profiles enable row level security;
alter table public.daily_goal_changes enable row level security;
alter table public.tasks enable row level security;
alter table public.active_timers enable row level security;
alter table public.time_entries enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.daily_goal_changes from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.active_timers from anon, authenticated;
revoke all on table public.time_entries from anon, authenticated;
revoke all on table public.daily_summaries from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.daily_goal_changes to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.active_timers to authenticated;
grant select, insert, update, delete on table public.time_entries to authenticated;
grant select on table public.daily_summaries to authenticated;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "daily_goals_select_own"
on public.daily_goal_changes for select to authenticated
using ((select auth.uid()) = user_id);
create policy "daily_goals_insert_own"
on public.daily_goal_changes for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "daily_goals_update_own"
on public.daily_goal_changes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "daily_goals_delete_own"
on public.daily_goal_changes for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "tasks_select_own"
on public.tasks for select to authenticated
using ((select auth.uid()) = user_id);
create policy "tasks_insert_own"
on public.tasks for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "tasks_update_own"
on public.tasks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own"
on public.tasks for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "active_timers_select_own"
on public.active_timers for select to authenticated
using ((select auth.uid()) = user_id);
create policy "active_timers_insert_own"
on public.active_timers for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "active_timers_update_own"
on public.active_timers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "active_timers_delete_own"
on public.active_timers for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "time_entries_select_own"
on public.time_entries for select to authenticated
using ((select auth.uid()) = user_id);
create policy "time_entries_insert_own"
on public.time_entries for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "time_entries_update_own"
on public.time_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "time_entries_delete_own"
on public.time_entries for delete to authenticated
using ((select auth.uid()) = user_id);
