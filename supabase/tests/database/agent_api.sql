begin;
select plan(26);

insert into auth.users(id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'agent-a@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', 'agent-b@example.test');
insert into public.households(id, name, created_by, period_start_day) values
  ('86000000-0000-0000-0000-000000000001', 'Home', '00000000-0000-0000-0000-0000000000e1', 25),
  ('86000000-0000-0000-0000-000000000002', 'Personal', '00000000-0000-0000-0000-0000000000e1', 25),
  ('86000000-0000-0000-0000-000000000003', 'Transfer', '00000000-0000-0000-0000-0000000000e1', 25),
  ('86000000-0000-0000-0000-000000000004', 'Private', '00000000-0000-0000-0000-0000000000e2', 25);
insert into public.household_members(household_id, user_id, role)
  values ('86000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 'member');
insert into public.categories(id, household_id, name, type) values
  ('87000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '水道代', 'expense'),
  ('87000000-0000-0000-0000-000000000003', '86000000-0000-0000-0000-000000000003', 'イオン支払い', 'expense'),
  ('87000000-0000-0000-0000-000000000004', '86000000-0000-0000-0000-000000000001', '反映先なし', 'expense');
update public.categories set id = '87000000-0000-0000-0000-000000000002'
where household_id = '86000000-0000-0000-0000-000000000003' and name = '水道光熱費';
update public.categories set is_hidden = true
where household_id = '86000000-0000-0000-0000-000000000003' and name = 'その他収入';
insert into public.transactions(id, household_id, created_by, amount, type, date) values
  ('88000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 500, 'income', '2026-12-24'),
  ('88000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 800, 'income', '2026-11-24');

select ok(not (select rolbypassrls from pg_roles where rolname = 'household_agent'), 'agent role cannot bypass RLS');
select ok(not has_table_privilege('anon', 'private.agent_tokens', 'select'), 'token hashes are private');
select ok(not has_function_privilege('anon', 'public.create_agent_token(text)', 'execute'), 'anonymous users cannot issue a token');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true) is not null;
select set_config('test.agent.token', public.create_agent_token('Fixture'), true) is not null;
select is((select count(*) from public.list_agent_tokens()), 1::bigint, 'owner can list token metadata');
select public.save_agent_routing('86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000003', '{"87000000-0000-0000-0000-000000000001":"87000000-0000-0000-0000-000000000002"}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true) is not null;
select is((select count(*) from public.list_agent_tokens()), 0::bigint, 'other users cannot list the token');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true) is not null;
select throws_ok($$select public.agent_api_v1('invalid','groups','{}')$$, 'PT401', 'invalid_token', 'invalid token is rejected');
select is(jsonb_array_length(public.agent_api_v1(current_setting('test.agent.token'),'groups','{}')), 3, 'groups are scoped to the issuer');
select is(auth.uid(), null::uuid, 'issuer identity does not persist after the RPC');
select throws_ok($$select public.agent_api_v1(current_setting('test.agent.token'),'categories',
  '{"groupId":"86000000-0000-0000-0000-000000000004"}')$$, 'PT404', 'group_not_found', 'nonmember cannot read categories');
select is(jsonb_typeof(public.agent_api_v1(current_setting('test.agent.token'),'categories',
  '{"groupId":"86000000-0000-0000-0000-000000000001"}')), 'array', 'member can list categories');

select set_config('test.agent.create', '{"groupId":"86000000-0000-0000-0000-000000000001","key":"water-bill","entries":[
  {"date":"2026-11-25","type":"expense","amount":200,"categoryId":"87000000-0000-0000-0000-000000000001",
  "routing":{"target":"home","payment":"other"}}]}', true) is not null;
select set_config('test.agent.response',public.agent_api_v1(current_setting('test.agent.token'),'create',
  current_setting('test.agent.create')::jsonb)::text, true) is not null;
select is(jsonb_array_length(current_setting('test.agent.response')::jsonb->'ids'), 2, 'registration returns original and copy ids');
select is(public.agent_api_v1(current_setting('test.agent.token'),'create',
  current_setting('test.agent.create')::jsonb), current_setting('test.agent.response')::jsonb, 'replay returns the stored result');
select throws_ok($$select public.agent_api_v1(current_setting('test.agent.token'),'create',
  jsonb_set(current_setting('test.agent.create')::jsonb,'{entries,0,amount}','201'))$$, 'PT409', 'idempotency_conflict', 'changed replay is rejected');

select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
   '{"groupId":"86000000-0000-0000-0000-000000000001","period":"2026-11","limit":1}')#>>'{totals,count}', '2', 'totals include all matching rows but exclude the prior period');
select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
   '{"groupId":"86000000-0000-0000-0000-000000000001","period":"2026-11","limit":1}')#>>'{next,id}',
   '88000000-0000-0000-0000-000000000001', 'pagination returns a cursor');
select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
   '{"groupId":"86000000-0000-0000-0000-000000000003","period":"2026-11"}')#>>'{items,0,category,name}', '水道光熱費', 'configured category mapping is used');

select throws_ok($$select public.agent_api_v1(current_setting('test.agent.token'),'create',
  '{"groupId":"86000000-0000-0000-0000-000000000002","key":"aeon","entries":[
    {"date":"2026-12-02","type":"expense","amount":100,"routing":{"target":"personal","payment":"aeon_card"}}]}')$$,
  'PT422', 'aeon_income_category_missing', 'missing paired category rolls back');
select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
   '{"groupId":"86000000-0000-0000-0000-000000000002","period":"2026-11"}')#>>'{totals,count}', '0', 'failed registration leaves no partial source');

reset role;
update public.categories set is_hidden = false
where household_id = '86000000-0000-0000-0000-000000000003' and name = 'その他収入';
set local role anon;
select is(jsonb_array_length(public.agent_api_v1(current_setting('test.agent.token'),'create',
  '{"groupId":"86000000-0000-0000-0000-000000000002","key":"aeon","entries":[
    {"date":"2026-12-02","type":"expense","amount":100,"routing":{"target":"personal","payment":"aeon_card"}}]}')->'ids'), 3,
  'a personal Aeon payment creates the source plus two transfer entries');
select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
  '{"groupId":"86000000-0000-0000-0000-000000000003","period":"2026-11"}')#>>'{totals,income}', '100',
  'the Aeon transfer includes the matching income');
select is(public.agent_api_v1(current_setting('test.agent.token'),'transactions',
  '{"groupId":"86000000-0000-0000-0000-000000000003","period":"2026-11"}')#>>'{totals,expense}', '300',
  'the Aeon expense is added to other transfers');

select throws_ok($$select public.agent_api_v1(current_setting('test.agent.token'),'update',
  '{"id":"88000000-0000-0000-0000-000000000001","changes":{"amount":100}}')$$, 'PT404', 'transaction_not_found', 'issuer cannot update another author');
select is(public.agent_api_v1(current_setting('test.agent.token'),'update', jsonb_build_object(
  'id', current_setting('test.agent.response')::jsonb#>>'{ids,0}', 'changes', '{"amount":125}'::jsonb))->>'id',
  current_setting('test.agent.response')::jsonb#>>'{ids,0}', 'issuer can update a created transaction');
select is(public.agent_api_v1(current_setting('test.agent.token'),'delete', jsonb_build_object(
  'id', current_setting('test.agent.response')::jsonb#>>'{ids,0}'))#>>'{period,count}', '1', 'delete returns the remaining period total');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true) is not null;
select public.revoke_agent_token(id) from public.list_agent_tokens();
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true) is not null;
select throws_ok($$select public.agent_api_v1(current_setting('test.agent.token'),'groups','{}')$$,
  'PT401', 'invalid_token', 'revocation takes effect for the next request');
reset role;
select ok(not has_function_privilege('anon', 'private.agent_dispatch(text,jsonb)', 'execute'), 'anon cannot bypass the token check');
select * from finish();
rollback;
