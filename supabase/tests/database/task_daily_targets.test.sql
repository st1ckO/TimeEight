begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target-owner@example.test', '', now(), now()),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target-other@example.test', '', now(), now());
insert into public.tasks (id, user_id, name, goal_kind, target_seconds, sort_order)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '55555555-5555-4555-8555-555555555555', 'Reading', 'minimum', 3600, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok($$ insert into public.task_daily_targets values ('55555555-5555-4555-8555-555555555555', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-11', 3600) $$, 'owner can snapshot a task target');
select lives_ok($$ insert into public.task_daily_targets values ('55555555-5555-4555-8555-555555555555', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-12', 1200) $$, 'owner can choose a different target on another date');
select results_eq($$ select target_seconds from public.tasks where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$, array[3600], 'daily choice leaves task default unchanged');
select lives_ok($$ update public.tasks set target_seconds = 7200 where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$, 'owner can change the saved default');
select results_eq($$ select target_seconds from public.task_daily_targets order by local_date $$, array[3600,1200], 'default change preserves recorded daily targets');
select throws_ok($$ insert into public.task_daily_targets values ('55555555-5555-4555-8555-555555555555', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-13', 0) $$, '23514', null, 'duration bounds are enforced');
select throws_ok($$ insert into public.task_daily_targets values ('55555555-5555-4555-8555-555555555555', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '2026-09-13', 60) $$, '23503', null, 'targets require an owned task');

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select is((select count(*) from public.task_daily_targets), 0::bigint, 'another owner cannot read targets');
select results_eq($$ update public.task_daily_targets set target_seconds = 60 returning 1 $$, array[]::integer[], 'another owner cannot edit targets');
select throws_ok($$ insert into public.task_daily_targets values ('55555555-5555-4555-8555-555555555555', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-13', 60) $$, '42501', null, 'another owner cannot insert targets for this owner');
select throws_ok($$ insert into public.task_daily_targets values ('66666666-6666-4666-8666-666666666666', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-13', 60) $$, '23503', null, 'another owner cannot attach a target to this owner task');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$ select * from public.task_daily_targets $$, '42501', null, 'anonymous users cannot read targets');
select throws_ok($$ update public.task_daily_targets set target_seconds = 60 $$, '42501', null, 'anonymous users cannot edit targets');
select * from finish();
rollback;
