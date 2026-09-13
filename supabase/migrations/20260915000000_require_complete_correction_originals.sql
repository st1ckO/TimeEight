-- CHECK accepts NULL results, so explicitly require every original field.
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
    and correction_original_duration_seconds is not null
    and correction_original_duration_seconds between 1 and 86400
  )
);
