begin;

select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), now());

insert into public.tasks (id, user_id, name, goal_kind, target_seconds, sort_order)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Owner task', 'minimum', 3600, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$ select count(*)::integer from public.tasks $$,
  array[1],
  'owner can select their task'
);

select lives_ok(
  $$ insert into public.tasks (user_id, name, goal_kind, target_seconds, sort_order) values ('11111111-1111-4111-8111-111111111111', 'Another task', 'limit', 1800, 1) $$,
  'owner can insert their task'
);

select lives_ok(
  $$ insert into public.time_entries (id, user_id, task_id, local_date, duration_seconds, source, mutation_id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 3600, 'timer', gen_random_uuid()) $$,
  'owner can insert a timer entry'
);

select lives_ok(
  $$ update public.time_entries set duration_seconds = 1800, manually_adjusted = true, correction_original_task_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', correction_original_local_date = current_date, correction_original_duration_seconds = 3600 where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  'owner can preserve the original values when correcting timer time'
);

select lives_ok(
  $$ update public.time_entries set duration_seconds = correction_original_duration_seconds, task_id = correction_original_task_id, local_date = correction_original_local_date, manually_adjusted = false, correction_original_task_id = null, correction_original_local_date = null, correction_original_duration_seconds = null where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  'owner can restore the original timer entry'
);

select lives_ok(
  $$ update public.time_entries set manually_adjusted = true where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  'legacy corrected timers may have no original snapshot'
);

select results_eq(
  $$ select manually_adjusted and correction_original_task_id is null and correction_original_local_date is null and correction_original_duration_seconds is null and duration_seconds = 3600 from public.time_entries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  array[true],
  'legacy correction retains its duration and adjusted flag without inventing originals'
);

select throws_ok(
  $$ update public.time_entries set correction_original_task_id = task_id where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'a task-only original snapshot is rejected'
);

select throws_ok(
  $$ update public.time_entries set correction_original_local_date = local_date where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'a date-only original snapshot is rejected'
);

select throws_ok(
  $$ update public.time_entries set correction_original_duration_seconds = duration_seconds where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'a duration-only original snapshot is rejected'
);

select throws_ok(
  $$ update public.time_entries set correction_original_task_id = task_id, correction_original_local_date = local_date where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'an original snapshot missing its duration is rejected'
);

select throws_ok(
  $$ update public.time_entries set correction_original_task_id = task_id, correction_original_duration_seconds = duration_seconds where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'an original snapshot missing its date is rejected'
);

select throws_ok(
  $$ update public.time_entries set correction_original_local_date = local_date, correction_original_duration_seconds = duration_seconds where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '23514',
  null,
  'an original snapshot missing its task is rejected'
);

select throws_ok(
  $$ insert into public.tasks (user_id, name, goal_kind, target_seconds, sort_order) values ('22222222-2222-4222-8222-222222222222', 'Wrong owner', 'minimum', 1800, 2) $$,
  '42501',
  null,
  'owner cannot insert for another user'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select results_eq(
  $$ select count(*)::integer from public.tasks where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  array[0],
  'another user cannot read the owner task'
);

select results_eq(
  $$ update public.tasks set name = 'Changed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$,
  array[]::integer[],
  'another user cannot update the owner task'
);

select results_eq(
  $$ delete from public.tasks where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1 $$,
  array[]::integer[],
  'another user cannot delete the owner task'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$ select * from public.tasks $$,
  '42501',
  null,
  'anonymous users cannot select tasks'
);

select throws_ok(
  $$ insert into public.time_entries (user_id, task_id, local_date, duration_seconds, source, mutation_id) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 300, 'manual', gen_random_uuid()) $$,
  '42501',
  null,
  'anonymous users cannot insert time'
);

select * from finish();
rollback;
