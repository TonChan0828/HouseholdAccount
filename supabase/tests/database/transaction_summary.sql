begin;
select plan(15);

select ok(to_regprocedure('public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint)') is not null, 'summary RPC exists');
select ok((select not prosecdef from pg_proc where oid = 'public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint)'::regprocedure), 'summary uses caller permissions and RLS');
select ok(not has_function_privilege('anon', 'public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint)', 'EXECUTE'), 'anonymous callers cannot aggregate');
select ok(has_function_privilege('authenticated', 'public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint)', 'EXECUTE'), 'authenticated callers can aggregate');
select ok(to_regclass('public.transactions_household_page_idx') is not null, 'page traversal index exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'summary-a@example.test', '', now(), '{}', '{}', now(), now()),
('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'summary-b@example.test', '', now(), '{}', '{}', now(), now());
insert into public.households (id, name, created_by) values
('83000000-0000-0000-0000-000000000001', 'Summary A', '00000000-0000-0000-0000-0000000000b1'),
('83000000-0000-0000-0000-000000000002', 'Summary B', '00000000-0000-0000-0000-0000000000b2');
insert into public.household_members (household_id, user_id, role) values
('83000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'member');
insert into public.categories (id, household_id, name, type) values
('84000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Summary category', 'expense');
insert into public.transactions (household_id, created_by, on_behalf_of, amount, type, date, memo)
select '83000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 100, 'expense', '2026-10-10', 'proxy'
from generate_series(1, 51);
insert into public.transactions (household_id, created_by, amount, type, date, memo, category_id) values
('83000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 500, 'income', '2026-10-10', 'salary', null),
('83000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 200, 'expense', '2026-10-09', 'literal 100%_ memo', '84000000-0000-0000-0000-000000000001'),
('83000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 999999, 'expense', '2026-10-10', 'private', null);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is((select count(*) from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01')), 2::bigint, 'returns days instead of every transaction');
select is((select sum(count)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01')), 53::bigint, 'counts all matching records');
select is((select sum(income)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01')), 500::bigint, 'income totals match');
select is((select sum(expense)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01')), 5300::bigint, 'expense totals match');
select is((select count from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01') where date = '2026-10-10'), 52::bigint, 'daily total does not depend on 50-row page boundaries');
select is((select sum(count)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01',_member_id => '00000000-0000-0000-0000-0000000000b2')), 51::bigint, 'member attribution uses proxy subject');
select is((select sum(count)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01',_type => 'expense', _category_id => '84000000-0000-0000-0000-000000000001', _member_id => '00000000-0000-0000-0000-0000000000b1', _memo_pattern => E'%100\\%\\_%', _min_amount => 200, _max_amount => 200)), 1::bigint, 'combined filters and literal LIKE characters match');
select is((select sum(count)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01',_type => 'income')), 1::bigint, 'type filter matches');
select is((select count(*) from public.transaction_daily_summary('83000000-0000-0000-0000-000000000002','2026-10-01','2026-11-01')), 0::bigint, 'other household records stay inaccessible');
select is((select sum(count)::bigint from public.transaction_daily_summary('83000000-0000-0000-0000-000000000001','2026-10-09','2026-10-10')), 1::bigint, 'range end is exclusive');
reset role;
select * from finish();
rollback;
