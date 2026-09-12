begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task-owner@example.test', '', now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task-other@example.test', '', now(), now());

insert into public.tasks (id, user_id, name, goal_kind, target_seconds, sort_order)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'Occasional task', 'minimum', 3600, 0);

insert into public.time_entries (user_id, task_id, local_date, duration_seconds, source, mutation_id)
values ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-09-11', 3600, 'timer', gen_random_uuid());

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq($$ select on_daily_list from public.tasks where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, array[true], 'existing visible tasks default to the daily list');
select lives_ok($$ update public.tasks set on_daily_list = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, 'owner can remove daily selection');
select results_eq($$ select duration_seconds from public.time_entries where task_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, array[3600], 'removal keeps tracked history');
select lives_ok($$ update public.tasks set archived_at = now(), on_daily_list = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, 'owner can archive a saved task');
select results_eq($$ select on_daily_list from public.tasks where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, array[false], 'database prevents archived daily selection');
select lives_ok($$ update public.tasks set archived_at = null where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, 'owner can restore a task');
select results_eq($$ select on_daily_list from public.tasks where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, array[false], 'restoring does not silently select the task');
select results_eq($$ select local_date::text from public.time_entries where task_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, array['2026-09-11'], 'restoration preserves historical local dates');
select lives_ok($$ insert into public.tasks (user_id, name, goal_kind, target_seconds, sort_order) values ('33333333-3333-4333-8333-333333333333', 'Another task', 'limit', 1800, 0) $$, 'reorder positions may overlap without changing task identity');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select results_eq($$ update public.tasks set on_daily_list = true, archived_at = null where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1 $$, array[]::integer[], 'another user cannot change selection or restore the owner task');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok($$ update public.tasks set on_daily_list = false $$, '42501', null, 'anonymous users cannot change task selection');

select * from finish();
rollback;
