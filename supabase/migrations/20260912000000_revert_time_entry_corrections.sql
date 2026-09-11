alter table public.time_entries
add column correction_original_task_id uuid,
add column correction_original_local_date date,
add column correction_original_duration_seconds integer;

alter table public.time_entries
add constraint time_entries_correction_state_valid check (
  (
    source = 'manual'
    and manually_adjusted
    and correction_original_task_id is null
    and correction_original_local_date is null
    and correction_original_duration_seconds is null
  )
  or
  (
    source <> 'manual'
    and (
      (
        not manually_adjusted
        and correction_original_task_id is null
        and correction_original_local_date is null
        and correction_original_duration_seconds is null
      )
      or
      (
        manually_adjusted
        and correction_original_task_id is not null
        and correction_original_local_date is not null
        and correction_original_duration_seconds between 1 and 86400
      )
    )
  )
),
add constraint time_entries_correction_original_task_fk
foreign key (user_id, correction_original_task_id)
references public.tasks (user_id, id)
on delete restrict;
