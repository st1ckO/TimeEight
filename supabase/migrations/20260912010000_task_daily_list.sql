-- Daily-list choices persist until changed. Entries continue to reference tasks.
alter table public.tasks
add column on_daily_list boolean not null default true;

update public.tasks set on_daily_list = false where archived_at is not null;

-- Ordering is presentation, not identity. Sequential offline reorder upserts
-- may temporarily share a position; task IDs still uniquely identify cards.
drop index public.tasks_active_sort_order_key;

create function public.keep_archived_tasks_off_daily_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null then
    new.on_daily_list = false;
  end if;
  return new;
end;
$$;

create trigger tasks_daily_list_state
before insert or update on public.tasks
for each row execute function public.keep_archived_tasks_off_daily_list();

alter table public.tasks
add constraint tasks_archived_off_daily_list
check (archived_at is null or not on_daily_list);
