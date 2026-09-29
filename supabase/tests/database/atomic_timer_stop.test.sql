begin;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), now());

insert into public.tasks (id, user_id, name, goal_kind, target_seconds, sort_order)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Owner task', 'minimum', 3600, 0),
  ('abababab-abab-4bab-8bab-abababababab', '11111111-1111-4111-8111-111111111111', 'Second owner task', 'minimum', 3600, 1);

insert into public.active_timers (id, user_id, task_id, started_at, timezone, checkpointed_at, checkpoint_seconds, mutation_id)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-09-29T01:00:00Z', 'UTC', '2026-09-29T01:01:00Z', 60, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'abababab-abab-4bab-8bab-abababababab', '2026-09-29T02:00:00Z', 'UTC', '2026-09-29T02:01:00Z', 60, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.stop_active_timer(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '[{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","task_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","local_date":"2026-09-29","duration_seconds":60,"source":"timer","started_at":"2026-09-29T01:00:00Z","ended_at":"2026-09-29T01:01:00Z","mutation_id":"99999999-9999-4999-8999-999999999999"}]'::jsonb
  ),
  true,
  'the first device claims and stops the active timer'
);

select results_eq(
  $$ select count(*)::integer from public.active_timers where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  array[0],
  'the claimed timer is removed'
);

select results_eq(
  $$ select duration_seconds from public.time_entries where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' $$,
  array[60],
  'the winning device writes one authoritative entry'
);

select is(
  public.stop_active_timer(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '[{"id":"77777777-7777-4777-8777-777777777777","task_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","local_date":"2026-09-29","duration_seconds":120,"source":"timer","started_at":"2026-09-29T01:00:00Z","ended_at":"2026-09-29T01:02:00Z","mutation_id":"88888888-8888-4888-8888-888888888888"}]'::jsonb
  ),
  false,
  'a second device sees that the timer was already stopped'
);

select results_eq(
  $$ select count(*)::integer from public.time_entries where task_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  array[1],
  'the losing stop cannot create a duplicate entry'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select is(
  public.stop_active_timer('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '[]'::jsonb),
  false,
  'another account cannot claim the owner timer'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select results_eq(
  $$ select count(*)::integer from public.active_timers where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  array[1],
  'the owner timer remains after another account tries to stop it'
);

select throws_ok(
  $$ select public.stop_active_timer(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '[{"id":"12121212-1212-4212-8212-121212121212","task_id":"abababab-abab-4bab-8bab-abababababab","local_date":"2026-09-29","duration_seconds":60,"source":"manual","mutation_id":"34343434-3434-4434-8434-343434343434"}]'::jsonb
  ) $$,
  '22023',
  null,
  'timer stops reject entry data that did not come from a timer'
);

select results_eq(
  $$ select count(*)::integer from public.active_timers where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  array[1],
  'invalid entry data rolls back the timer deletion'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$ select public.stop_active_timer('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '[]'::jsonb) $$,
  '42501',
  null,
  'anonymous callers cannot execute the stop function'
);

select * from finish();
rollback;
