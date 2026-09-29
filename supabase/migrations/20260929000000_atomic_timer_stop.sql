create function public.stop_active_timer(p_timer_id uuid, p_entries jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  stopped_task_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Timer stop entries must be an array' using errcode = '22023';
  end if;

  delete from public.active_timers
  where id = p_timer_id and user_id = owner_id
  returning task_id into stopped_task_id;

  if stopped_task_id is null then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entry(
      id uuid,
      task_id uuid,
      local_date date,
      duration_seconds integer,
      source text,
      started_at timestamptz,
      ended_at timestamptz,
      mutation_id uuid
    )
    where entry.task_id is distinct from stopped_task_id
       or entry.source not in ('timer', 'recovered')
  ) then
    raise exception 'Timer stop entries do not match the active timer' using errcode = '22023';
  end if;

  insert into public.time_entries (
    id,
    user_id,
    task_id,
    local_date,
    duration_seconds,
    source,
    started_at,
    ended_at,
    manually_adjusted,
    correction_original_task_id,
    correction_original_local_date,
    correction_original_duration_seconds,
    mutation_id
  )
  select
    entry.id,
    owner_id,
    stopped_task_id,
    entry.local_date,
    entry.duration_seconds,
    entry.source::public.entry_source,
    entry.started_at,
    entry.ended_at,
    false,
    null,
    null,
    null,
    entry.mutation_id
  from jsonb_to_recordset(p_entries) as entry(
    id uuid,
    task_id uuid,
    local_date date,
    duration_seconds integer,
    source text,
    started_at timestamptz,
    ended_at timestamptz,
    mutation_id uuid
  );

  return true;
end;
$$;

revoke all on function public.stop_active_timer(uuid, jsonb) from public, anon;
grant execute on function public.stop_active_timer(uuid, jsonb) to authenticated;
