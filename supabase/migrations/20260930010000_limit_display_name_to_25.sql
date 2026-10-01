update public.profiles
set display_name = left(trim(display_name), 25)
where char_length(display_name) > 25 or display_name <> trim(display_name);

alter table public.profiles
drop constraint if exists profiles_display_name_length_check;

alter table public.profiles
add constraint profiles_display_name_length_check
check (char_length(display_name) <= 25);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_name text;
begin
  initial_name := left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 25);

  insert into public.profiles (id, display_name)
  values (new.id, initial_name);

  insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
  values (new.id, current_date, 28800);

  return new;
end;
$$;
