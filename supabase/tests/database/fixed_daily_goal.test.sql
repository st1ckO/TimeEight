begin;
select plan(3);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'goal@example.test', '', now(), now());
update public.profiles set timezone = 'Asia/Manila' where id = '33333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
values ('33333333-3333-4333-8333-333333333333', (now() at time zone 'Asia/Manila')::date, 3600)
on conflict (user_id, effective_date) do update set goal_seconds = 3600;
select is((select goal_seconds from public.daily_goal_changes where effective_date = (now() at time zone 'Asia/Manila')::date), 28800, 'legacy current goal writes use eight hours');
insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
values ('33333333-3333-4333-8333-333333333333', (now() at time zone 'Asia/Manila')::date + 1, 14400);
select is((select goal_seconds from public.daily_goal_changes where effective_date = (now() at time zone 'Asia/Manila')::date + 1), 28800, 'future goals use eight hours');
insert into public.daily_goal_changes (user_id, effective_date, goal_seconds)
values ('33333333-3333-4333-8333-333333333333', date '2000-01-01', 14400);
select is((select goal_seconds from public.daily_goal_changes where effective_date = date '2000-01-01'), 14400, 'historical snapshots retain their original goals');
select * from finish();
rollback;
