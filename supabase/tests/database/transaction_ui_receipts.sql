begin;
select plan(12);

insert into auth.users(id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'receipt-a@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'receipt-b@example.test');
insert into public.households(id, name, created_by) values
  ('89000000-0000-0000-0000-000000000001', 'UI Group', '00000000-0000-0000-0000-0000000000f1');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true) is not null;
select set_config('test.ui.entry', '[{"household_id":"89000000-0000-0000-0000-000000000001",
  "type":"expense","date":"2026-11-26","amount":250,"reflected_category_name":"水道代"}]', true) is not null;
select set_config('test.ui.response',public.create_ui_transaction(
  '91000000-0000-0000-0000-000000000001','89000000-0000-0000-0000-000000000001',
  repeat('f', 64),current_setting('test.ui.entry')::jsonb,'["未分類"]')::text, true) is not null;
select is(public.create_ui_transaction(
  '91000000-0000-0000-0000-000000000001','89000000-0000-0000-0000-000000000001',
  repeat('f', 64),current_setting('test.ui.entry')::jsonb,'["未分類"]'),
  current_setting('test.ui.response')::jsonb, 'same submission returns the original receipt');
select is(public.get_ui_transaction_receipt('91000000-0000-0000-0000-000000000001'),
  current_setting('test.ui.response')::jsonb, 'owner of the receipt can check it after a timeout');
select is((select count(*) from public.transactions
  where household_id = '89000000-0000-0000-0000-000000000001'), 1::bigint, 'replay inserts exactly once');
select throws_ok($$select public.create_ui_transaction(
  '91000000-0000-0000-0000-000000000001','89000000-0000-0000-0000-000000000001',
  repeat('a', 64),current_setting('test.ui.entry')::jsonb,'[]')$$,
  'PT409', 'submission_changed', 'different input for same submission is rejected');
select is((select reflected_category_name from public.transactions
  where id = (current_setting('test.ui.response')::jsonb->>'id')::uuid), '水道代', 'reflection preserves the source category name');

select set_config('test.ui.undo', (public.delete_transaction_with_undo(
  (current_setting('test.ui.response')::jsonb->>'id')::uuid, '89000000-0000-0000-0000-000000000001'))->>'id', true) is not null;
select is((select count(*) from public.transactions
  where household_id = '89000000-0000-0000-0000-000000000001'), 0::bigint, 'transaction is deleted immediately');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true) is not null;
select is(public.get_ui_transaction_receipt('91000000-0000-0000-0000-000000000001'),
  null::jsonb, 'other users cannot check the receipt');
select is(public.undo_transaction_delete(current_setting('test.ui.undo')::uuid), false, 'other users cannot undo');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true) is not null;
select is(public.undo_transaction_delete(current_setting('test.ui.undo')::uuid), true, 'deleter can undo before the deadline');
select is((select reflected_category_name from public.transactions
  where id = (current_setting('test.ui.response')::jsonb->>'id')::uuid), '水道代', 'undo restores the original transaction and metadata');
select is(public.undo_transaction_delete(current_setting('test.ui.undo')::uuid), false, 'undo consumes its receipt');

select set_config('test.ui.expired_id', (public.delete_transaction_with_undo(
  (current_setting('test.ui.response')::jsonb->>'id')::uuid, '89000000-0000-0000-0000-000000000001'))->>'id', true) is not null;
reset role;
update private.transaction_undo set expires_at = now() - interval '1 second'
where id = current_setting('test.ui.expired_id')::uuid;
set local role authenticated;
select is(public.undo_transaction_delete(current_setting('test.ui.expired_id')::uuid), false, 'undo expires on the server');
reset role;

select * from finish();
rollback;
