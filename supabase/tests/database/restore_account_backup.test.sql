begin;
select plan(9);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','restore-owner@example.test','',now(),now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','restore-other@example.test','',now(),now());
insert into public.tasks(id,user_id,name,goal_kind,target_seconds,sort_order) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Old task','minimum',3600,0),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Other task','minimum',3600,0);
create function pg_temp.backup_payload(target integer) returns jsonb language sql as $payload$
select jsonb_build_object('schemaVersion',2,'profile',jsonb_build_object('id','22222222-2222-4222-8222-222222222222','displayName','Restored','timezone','UTC','theme','light','onboardingCompleted',true),'tasks',jsonb_build_array(jsonb_build_object('id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','userId','22222222-2222-4222-8222-222222222222','name','Imported','color','#197c67','goalKind','minimum','targetSeconds',target,'sortOrder',0,'archivedAt',null,'onDailyList',true)),'dailyGoals',jsonb_build_array(jsonb_build_object('id','dddddddd-dddd-4ddd-8ddd-dddddddddddd','effectiveDate','2020-01-01','goalSeconds',28800)),'entries','[]'::jsonb,'taskDailyTargets','[]'::jsonb);
$payload$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select public.restore_account_backup(pg_temp.backup_payload(3600),'confirm')$$,'P0001',null,'exact confirmation is required');
select lives_ok($$select public.restore_account_backup(pg_temp.backup_payload(3600),'CONFIRM')$$,'owner can atomically replace their data');
select results_eq($$select name from public.tasks$$,array['Imported'::text],'import replaces old tasks and ignores foreign ownership');
select results_eq($$select goal_seconds from public.daily_goal_changes$$,array[28800],'restore establishes the fixed eight-hour goal');
select throws_ok($$select public.restore_account_backup(pg_temp.backup_payload(0),'CONFIRM')$$,'23514',null,'invalid row rolls back replacement');
select results_eq($$select name from public.tasks$$,array['Imported'::text],'failed restore preserves existing data');
select lives_ok($$select public.restore_account_backup(jsonb_set(pg_temp.backup_payload(3600), '{entries}', '[{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","taskId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","localDate":"2020-01-01","durationSeconds":3600,"source":"timer","manuallyAdjusted":true,"mutationId":"ffffffff-ffff-4fff-8fff-ffffffffffff"}]'::jsonb),'CONFIRM')$$,'legacy corrected timers without originals can be restored');
select results_eq($$select manually_adjusted and correction_original_duration_seconds is null from public.time_entries$$,array[true],'legacy correction remains ineligible without invented originals');
reset role;
select is((select name from public.tasks where user_id='22222222-2222-4222-8222-222222222222'),'Other task','other account is untouched');
select * from finish();
rollback;
