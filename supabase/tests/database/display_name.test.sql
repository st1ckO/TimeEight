begin;

select plan(4);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'display-name@example.test',
  '',
  jsonb_build_object('full_name', repeat('N', 60)),
  now(),
  now()
);

select is(
  (select char_length(display_name) from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  40,
  'new-account metadata is limited to 40 characters'
);

select is(
  (select display_name from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  repeat('N', 40),
  'the profile keeps the first 40 characters of an imported provider name'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ update public.profiles set display_name = repeat('A', 40) where id = '44444444-4444-4444-8444-444444444444' $$,
  'a 40-character display name is accepted'
);

select throws_ok(
  $$ update public.profiles set display_name = repeat('A', 41) where id = '44444444-4444-4444-8444-444444444444' $$,
  '23514',
  null,
  'a 41-character display name is rejected'
);

select * from finish();
rollback;
