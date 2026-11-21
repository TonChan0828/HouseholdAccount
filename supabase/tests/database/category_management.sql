begin;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'category-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'category-member@example.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'category-outsider@example.test');
insert into public.households (id, name, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'Category group', '00000000-0000-0000-0000-0000000000b1'),
  ('40000000-0000-0000-0000-000000000002', 'Other group', '00000000-0000-0000-0000-0000000000b3');
insert into public.household_members (household_id, user_id, role) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'member');
insert into public.categories (id, household_id, name, type) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Merge source', 'expense'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Merge destination', 'both'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Wrong type', 'income'),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Another group', 'expense');
insert into public.transactions (household_id, created_by, amount, type, date, category_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 1250, 'expense', '2024-02-29', '41000000-0000-0000-0000-000000000001');
insert into public.recurring_transactions (household_id, created_by, amount, type, category_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 1250, 'expense', '41000000-0000-0000-0000-000000000001');
insert into public.budgets (household_id, category_id, amount) values
  ('40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 2000),
  ('40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 3000);

create function pg_temp.merge(source uuid, destination uuid)
returns void language sql as $$
  select public.merge_category('40000000-0000-0000-0000-000000000001', source, destination)
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
set local role authenticated;
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'members cannot merge household categories');
select is((select count(*) from public.category_usage('40000000-0000-0000-0000-000000000001')), 0::bigint, 'members cannot fetch merge usage');
select lives_ok($$select public.set_preset_category_visibility(
  '40000000-0000-0000-0000-000000000001', (select id from public.categories
  where household_id = '40000000-0000-0000-0000-000000000001' and name = '給与'), true)$$, 'members may hide a preset');
select is((select is_hidden from public.categories where name = '給与'), true, 'preset visibility persists');
with deleted as (delete from public.categories where name = '給与' returning id)
select is((select count(*) from deleted), 0::bigint,
  'the database protects presets from deletion');
select throws_ok($$select public.set_preset_category_visibility(
  '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000004', true)$$,
  '42501', null, 'other household visibility cannot be changed');
select lives_ok($$select public.set_preset_category_visibility(
  '40000000-0000-0000-0000-000000000001', (select id from public.categories where name = '給与'), false)$$,
  'the same preset can be restored');
select is((select is_hidden from public.categories where name = '給与'), false, 'restoring a preset persists');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
set local role authenticated;
select results_eq($$select transactions, recurring, budgets from public.category_usage('40000000-0000-0000-0000-000000000001')
  where category_id = '41000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint, 1::bigint, 1::bigint)$$, 'owner sees all affected reference counts');
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001')$$,
  '22023', null, 'the same category cannot be merged into itself');
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003')$$,
  '22023', null, 'different transaction types are incompatible');
select throws_ok($$select pg_temp.merge(
  (select id from public.categories where name = '食費'), '41000000-0000-0000-0000-000000000002')$$,
  '22023', null, 'a preset cannot be merged away');
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000004')$$,
  '22023', null, 'the destination cannot be in another household');
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002')$$,
  '23505', null, 'conflicting budgets prevent the merge');
select is((select category_id from public.transactions), '41000000-0000-0000-0000-000000000001'::uuid,
  'failure leaves the source reference intact');
reset role;
delete from public.budgets where category_id = '41000000-0000-0000-0000-000000000002';

create function pg_temp.reject_budget_transfer() returns trigger language plpgsql as $$
begin
  raise exception 'fixture failure';
end;
$$;
create trigger category_management_test_failure before update on public.budgets
  for each row execute function pg_temp.reject_budget_transfer();
set local role authenticated;
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002')$$,
  'P0001', 'fixture failure', 'a late failure aborts the merge');
select results_eq(
  $$select category_id from public.transactions union all select category_id from public.recurring_transactions$$,
  $$values ('41000000-0000-0000-0000-000000000001'::uuid), ('41000000-0000-0000-0000-000000000001'::uuid)$$,
  'already moved transaction and recurring references roll back');
reset role;
drop trigger category_management_test_failure on public.budgets;

set local role authenticated;
select lives_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002')$$,
  'the owner can merge into a compatible category');
select results_eq($$select category_id, date, created_by, amount from public.transactions$$,
  $$values ('41000000-0000-0000-0000-000000000002'::uuid, date '2024-02-29', '00000000-0000-0000-0000-0000000000b2'::uuid, 1250)$$,
  'all transaction data except its category is preserved');
select results_eq(
  $$select category_id from public.recurring_transactions union all select category_id from public.budgets$$,
  $$values ('41000000-0000-0000-0000-000000000002'::uuid), ('41000000-0000-0000-0000-000000000002'::uuid)$$,
  'the recurring transaction and budget both follow the destination');
select throws_ok($$select pg_temp.merge('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002')$$,
  '22023', null, 'a repeated merge cannot affect the destination');
reset role;
select * from finish();
rollback;
