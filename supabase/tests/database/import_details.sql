begin;
select plan(15);

select ok(not has_function_privilege('anon', 'public.confirm_transaction_import_v2(uuid,date,jsonb,uuid)', 'EXECUTE'),
  'anonymous callers cannot confirm import');
select ok(not has_function_privilege('authenticated', 'public.consume_rate_limit_with_reset(text,text,integer,integer)', 'EXECUTE'),
  'only the server can consume detailed limits');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'import-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'import-member@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'import-outsider@example.test');
insert into public.households (id, name, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'Import group', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-000000000002', 'Other group', '00000000-0000-0000-0000-0000000000a3');
insert into public.household_members (household_id, user_id, role)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'member');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is(public.confirm_transaction_import(
  '30000000-0000-0000-0000-000000000001', '2024-02-01',
  '[{"type":"expense","categoryName":"Import adjustment","amount":3500}]'
), 1, 'old app still imports its usual rows');
select is(public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000001', '2024-02-01',
  '[{"type":"expense","categoryName":"Import adjustment","amount":3500}]', null
), 0, 'new app deduplicates old self import');
select is(public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000001', '2024-02-01',
  '[{"type":"expense","categoryName":"Import adjustment","amount":3500},{"type":"expense","categoryName":"Import adjustment","amount":-3500,"date":"2024-02-29"}]',
  '00000000-0000-0000-0000-0000000000a2'
), 2, 'a different member and signed leap-day row are saved');
select is(public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000001', '2024-03-01',
  '[{"type":"expense","categoryName":"Import adjustment","amount":-3500,"date":"2024-02-29"}]',
  '00000000-0000-0000-0000-0000000000a2'
), 0, 'explicit row date deduplicates across default months');
select results_eq(
  $$select date, created_by, on_behalf_of, is_shared from public.transactions where amount = -3500$$,
  $$values (date '2024-02-29', '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, false)$$,
  'adjustment retains actor, subject, and date'
);
select throws_ok($$update public.transactions set is_shared = true where amount = -3500$$,
  '23514', null, 'adjustments cannot be shared');
select throws_ok($$insert into public.transactions (household_id, created_by, amount, type, date, import_key)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), -1, 'expense', '2024-02-01', 'untrusted')$$,
  '42501', null, 'ordinary insert cannot originate an adjustment');
select throws_ok($$select public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000001', '2024-02-01',
  '[{"type":"expense","categoryName":"Unauthorized import","amount":10}]',
  '00000000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'outsider cannot be selected as the subject');
select throws_ok($$select public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000002', '2024-02-01',
  '[{"type":"expense","categoryName":"Unauthorized import","amount":10}]', null)$$,
  '42501', null, 'outsider cannot import into the group');
select throws_ok($$select public.confirm_transaction_import_v2(
  '30000000-0000-0000-0000-000000000001', '2024-02-01',
  '[{"type":"expense","categoryName":"Unauthorized import","amount":1},{"type":"expense","categoryName":"Unauthorized import","amount":-2147483648}]', null)$$,
  '22023', null, 'out-of-range amount rejects the complete batch');
select is((select count(*) from public.categories where name = 'Unauthorized import'), 0::bigint,
  'failed import leaves no categories');
reset role;

select is((
  select count(*) from generate_series(1,6)
  where public.consume_rate_limit('import.parse', repeat('a', 64), 5, 600)
), 5::bigint, 'the legacy wrapper and detailed counter share the same five-attempt window');
select is(
  (public.consume_rate_limit_with_reset('import.parse', repeat('a', 64), 5, 600) ->> 'resetAt')::timestamptz,
  (select window_started_at + interval '10 minutes' from private.rate_limits where key_hash = repeat('a', 64)),
  'a limited response reports the fixed expiry of its window'
);

select * from finish();
rollback;
