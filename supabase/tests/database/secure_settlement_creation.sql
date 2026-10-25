begin;
select no_plan();

select ok(not has_function_privilege('anon', 'public.create_settlement(uuid,date)', 'EXECUTE'), 'anonymous execution is forbidden');
select ok(has_function_privilege('authenticated', 'public.create_settlement(uuid,date)', 'EXECUTE'), 'members can call the trusted API');
select ok(not has_table_privilege('authenticated', 'public.settlements', 'INSERT'), 'direct inserts are forbidden');
select ok(not has_table_privilege('authenticated', 'public.settlements', 'UPDATE'), 'snapshot updates are forbidden');

insert into auth.users (id, email) values
('00000000-0000-0000-0000-0000000000d1', 'settlement-a@example.test'),
('00000000-0000-0000-0000-0000000000d2', 'settlement-b@example.test'),
('00000000-0000-0000-0000-0000000000d3', 'settlement-c@example.test'),
('00000000-0000-0000-0000-0000000000d4', 'settlement-outsider@example.test');
update public.profiles set display_name = 'Global B' where id = '00000000-0000-0000-0000-0000000000d2';
insert into public.households (id, name, created_by, period_start_day) values
('85000000-0000-0000-0000-000000000001', 'Settlement A', '00000000-0000-0000-0000-0000000000d1', 25),
('85000000-0000-0000-0000-000000000002', 'Settlement private', '00000000-0000-0000-0000-0000000000d4', 1),
('85000000-0000-0000-0000-000000000003', 'Settlement solo', '00000000-0000-0000-0000-0000000000d1', 1);
insert into public.household_members (household_id, user_id, role, display_name) values
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2', 'member', null),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d3', 'member', 'C');
update public.household_members set joined_at = '2026-01-01T00:00:00Z'
where household_id = '85000000-0000-0000-0000-000000000001';
update public.household_members set display_name = 'Group A'
where household_id = '85000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000d1';
insert into public.transactions (household_id, created_by, amount, type, date, is_shared) values
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 100, 'expense', '2026-10-25', true),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d4', 777, 'expense', '2026-10-26', true),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 999, 'income', '2026-10-26', true),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 888, 'expense', '2026-10-26', false),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 666, 'expense', '2026-10-24', true),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 555, 'expense', '2026-11-25', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000002','2026-11-24')$$, '42501', null, 'other household is forbidden');
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000003','2026-11-24')$$, 'P0001', 'settlement_members_required', 'single member is rejected');
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001',null)$$, '22023', null, 'null date is rejected');
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','infinity')$$, '22023', null, 'infinite date is rejected');
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','2025-01-01')$$, 'P0001', 'settlement_no_expenses', 'empty period is rejected');
select throws_ok($$insert into public.settlements(household_id,period_start,settled_by,snapshot) values ('85000000-0000-0000-0000-000000000001','2026-10-25','00000000-0000-0000-0000-0000000000d1','{}')$$, '42501', null, 'forged snapshots cannot be inserted directly');
select lives_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','2026-11-24')$$, 'member creates settlement with a mid-period reference');
select is((select period_start from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'), date '2026-10-25', 'period start follows household setting');
select is((select settled_by from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-0000000000d1'::uuid, 'creator is derived from authentication');
select is((select snapshot from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'),
'{"total":100,"perMember":33,"rows":[{"userId":"00000000-0000-0000-0000-0000000000d1","displayName":"Group A","paid":100,"balance":66},{"userId":"00000000-0000-0000-0000-0000000000d2","displayName":"Global B","paid":0,"balance":-33},{"userId":"00000000-0000-0000-0000-0000000000d3","displayName":"C","paid":0,"balance":-33}],"transfers":[{"fromUserId":"00000000-0000-0000-0000-0000000000d2","toUserId":"00000000-0000-0000-0000-0000000000d1","amount":33},{"fromUserId":"00000000-0000-0000-0000-0000000000d3","toUserId":"00000000-0000-0000-0000-0000000000d1","amount":33}]}'::jsonb,
'snapshot preserves rounding, order, names, filters and transfer suggestions');
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','2026-10-30')$$, '23505', null, 'duplicate period is rejected');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
delete from public.settlements where household_id = '85000000-0000-0000-0000-000000000001';
select is((select count(*) from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'), 1::bigint, 'other members cannot cancel');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
delete from public.settlements where household_id = '85000000-0000-0000-0000-000000000001';
select is((select count(*) from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'), 0::bigint, 'creator can cancel');

reset role;
insert into public.transactions (household_id,created_by,on_behalf_of,amount,type,date,is_shared)
values ('85000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2',50,'expense','2026-10-25',true);
set local role authenticated;
select lives_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','2026-11-24')$$, 'settlement can be recreated after cancellation');
select is((select snapshot->'rows'->1->>'paid' from public.settlements where household_id = '85000000-0000-0000-0000-000000000001'), '50', 'proxy entry is attributed to its subject');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.create_settlement('85000000-0000-0000-0000-000000000001','2026-11-24')$$, '42501', null, 'missing identity is rejected');
reset role;
select * from finish();
rollback;
