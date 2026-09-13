-- Older corrected timers have no saved original; preserve them without offering revert.
alter table public.time_entries drop constraint time_entries_correction_state_valid;
alter table public.time_entries add constraint time_entries_correction_state_valid check (
  (
    correction_original_task_id is null
    and correction_original_local_date is null
    and correction_original_duration_seconds is null
    and (source <> 'manual' or manually_adjusted)
  )
  or (
    source <> 'manual' and manually_adjusted
    and correction_original_task_id is not null
    and correction_original_local_date is not null
    and correction_original_duration_seconds between 1 and 86400
  )
);

-- All replacement writes run in one transaction and remain scoped by RLS.
create function public.restore_account_backup(backup jsonb, confirmation text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null or confirmation is distinct from 'CONFIRM' then
    raise exception 'Authenticated confirmation required';
  end if;
  if backup ->> 'schemaVersion' is distinct from '2'
    or jsonb_typeof(backup -> 'profile') is distinct from 'object'
    or jsonb_typeof(backup -> 'tasks') is distinct from 'array'
    or jsonb_typeof(backup -> 'entries') is distinct from 'array'
    or jsonb_typeof(backup -> 'dailyGoals') is distinct from 'array'
    or jsonb_typeof(backup -> 'taskDailyTargets') is distinct from 'array'
    or octet_length(backup::text) > 5242880 then
    raise exception 'Invalid backup';
  end if;
  if jsonb_array_length(backup -> 'tasks') > 1000
    or jsonb_array_length(backup -> 'entries') > 10000
    or jsonb_array_length(backup -> 'dailyGoals') <> 1
    or jsonb_array_length(backup -> 'taskDailyTargets') > 20000 then
    raise exception 'Backup exceeds record limits';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = backup -> 'profile' ->> 'timezone') then
    raise exception 'Invalid timezone';
  end if;
  perform 1 from public.profiles where id = owner_id for update;
  if not found then raise exception 'Profile not found'; end if;

  delete from public.time_entries where user_id = owner_id;
  delete from public.active_timers where user_id = owner_id;
  -- Daily targets are removed by the task foreign-key cascade.
  delete from public.tasks where user_id = owner_id;
  delete from public.daily_goal_changes where user_id = owner_id;
  update public.profiles set
    display_name = backup -> 'profile' ->> 'displayName',
    timezone = backup -> 'profile' ->> 'timezone',
    theme = (backup -> 'profile' ->> 'theme')::public.profile_theme,
    onboarding_completed = (backup -> 'profile' ->> 'onboardingCompleted')::boolean
  where id = owner_id;
  insert into public.tasks (id, user_id, name, color, goal_kind, target_seconds, sort_order, archived_at, on_daily_list)
  select x.id, owner_id, x.name, x.color, x."goalKind"::public.goal_kind, x."targetSeconds", x."sortOrder", x."archivedAt", x."onDailyList"
  from jsonb_to_recordset(backup -> 'tasks') as x(id uuid, name text, color text, "goalKind" text, "targetSeconds" integer, "sortOrder" integer, "archivedAt" timestamptz, "onDailyList" boolean);
  insert into public.daily_goal_changes (id, user_id, effective_date, goal_seconds)
  select x.id, owner_id, x."effectiveDate", 28800
  from jsonb_to_recordset(backup -> 'dailyGoals') as x(id uuid, "effectiveDate" date, "goalSeconds" integer);
  insert into public.task_daily_targets (user_id, task_id, local_date, target_seconds)
  select owner_id, x."taskId", x."localDate", x."targetSeconds"
  from jsonb_to_recordset(backup -> 'taskDailyTargets') as x("taskId" uuid, "localDate" date, "targetSeconds" integer);
  insert into public.time_entries (id, user_id, task_id, local_date, duration_seconds, source, started_at, ended_at, manually_adjusted, correction_original_task_id, correction_original_local_date, correction_original_duration_seconds, mutation_id)
  select x.id, owner_id, x."taskId", x."localDate", x."durationSeconds", x.source::public.entry_source, x."startedAt", x."endedAt", x."manuallyAdjusted", x."correctionOriginalTaskId", x."correctionOriginalLocalDate", x."correctionOriginalDurationSeconds", x."mutationId"
  from jsonb_to_recordset(backup -> 'entries') as x(id uuid, "taskId" uuid, "localDate" date, "durationSeconds" integer, source text, "startedAt" timestamptz, "endedAt" timestamptz, "manuallyAdjusted" boolean, "correctionOriginalTaskId" uuid, "correctionOriginalLocalDate" date, "correctionOriginalDurationSeconds" integer, "mutationId" uuid);
end;
$$;
revoke all on function public.restore_account_backup(jsonb, text) from public, anon;
grant execute on function public.restore_account_backup(jsonb, text) to authenticated;
