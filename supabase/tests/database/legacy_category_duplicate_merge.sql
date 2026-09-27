begin;
select plan(16);

select ok(
  to_regprocedure('private.merge_safe_legacy_duplicate_categories()') is not null,
  'safe legacy category merge function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.merge_safe_legacy_duplicate_categories()',
    'EXECUTE'
  ),
  'anonymous callers cannot run legacy category merge'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.merge_safe_legacy_duplicate_categories()',
    'EXECUTE'
  ),
  'authenticated callers cannot run legacy category merge'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'legacy-category@example.test', '', now(),
  '{}', '{}', now(), now()
);
insert into public.households (id, name, created_by) values (
  '70000000-0000-0000-0000-000000000007',
  'Legacy duplicate categories',
  '00000000-0000-0000-0000-0000000000f1'
);

-- Simulate records that predate the current uniqueness trigger.
alter table public.categories disable trigger categories_enforce_name_uniqueness;
insert into public.categories (
  id, household_id, name, color, icon, type, is_default, reminder_enabled
) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   'Food', '#123456', 'utensils', 'expense', false, false),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007',
   'Food', '#123456', 'utensils', 'expense', false, false),
  ('72000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   'Rent', '#234567', 'house', 'expense', false, false),
  ('72000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007',
   'Rent', '#234567', 'house', 'expense', false, false),
  ('73000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   'Fuel', '#345678', 'car', 'expense', false, false),
  ('73000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007',
   'Fuel', '#456789', 'car', 'expense', false, false),
  ('74000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   ' Dining ', '#567890', 'utensils', 'expense', false, false),
  ('74000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007',
   'Dining', '#567890', 'utensils', 'expense', false, false),
  ('75000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   'Transfer', '#678901', 'repeat', 'income', false, false),
  ('75000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007',
   'Transfer', '#678901', 'repeat', 'expense', false, false);
alter table public.categories enable trigger categories_enforce_name_uniqueness;

insert into public.budgets (household_id, category_id, amount) values
  ('70000000-0000-0000-0000-000000000007', '71000000-0000-0000-0000-000000000002', 50000),
  ('70000000-0000-0000-0000-000000000007', '72000000-0000-0000-0000-000000000001', 80000),
  ('70000000-0000-0000-0000-000000000007', '72000000-0000-0000-0000-000000000002', 90000);
insert into public.transactions (
  household_id, created_by, amount, type, category_id, date
) values
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000f1',
   1000, 'expense', '71000000-0000-0000-0000-000000000001', '2026-01-01'),
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000f1',
   2000, 'expense', '71000000-0000-0000-0000-000000000002', '2026-01-02'),
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000f1',
   3000, 'expense', '72000000-0000-0000-0000-000000000002', '2026-01-03');
insert into public.recurring_transactions (
  id, household_id, created_by, type, amount, category_id
) values
  ('76000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-0000000000f1', 'expense', 5000,
   '71000000-0000-0000-0000-000000000002');

select is(
  private.merge_safe_legacy_duplicate_categories(),
  1,
  'one identical duplicate category is merged'
);
select is(
  (select count(*)::integer from public.categories
   where household_id = '70000000-0000-0000-0000-000000000007'
     and lower(btrim(name)) = 'food' and type = 'expense'),
  1,
  'the identical duplicate category row is removed'
);
select is(
  (select count(*)::integer from public.transactions
   where household_id = '70000000-0000-0000-0000-000000000007'
     and category_id = '71000000-0000-0000-0000-000000000001'),
  2,
  'transaction references are moved to the retained category'
);
select is(
  (select count(*)::integer from public.transactions
   where household_id = '70000000-0000-0000-0000-000000000007'),
  3,
  'all transactions are preserved'
);
select is(
  (select count(*)::integer from public.recurring_transactions
   where household_id = '70000000-0000-0000-0000-000000000007'
     and category_id = '71000000-0000-0000-0000-000000000001'),
  1,
  'recurring transaction references are moved to the retained category'
);
select is(
  (select amount from public.budgets
   where household_id = '70000000-0000-0000-0000-000000000007'
     and category_id = '71000000-0000-0000-0000-000000000001'),
  50000,
  'a single budget is moved to the retained category without changing its amount'
);
select is(
  (select count(*)::integer from public.categories
   where household_id = '70000000-0000-0000-0000-000000000007'
     and name = 'Rent' and type = 'expense'),
  2,
  'duplicate categories with two budgets are retained'
);
select is(
  (select count(*)::integer from public.budgets
   where household_id = '70000000-0000-0000-0000-000000000007'
     and category_id in (
       '72000000-0000-0000-0000-000000000001',
       '72000000-0000-0000-0000-000000000002'
     )),
  2,
  'both conflicting budgets are preserved unchanged'
);
select is(
  (select count(*)::integer from public.transactions
   where household_id = '70000000-0000-0000-0000-000000000007'
     and category_id = '72000000-0000-0000-0000-000000000002'),
  1,
  'references for budget-conflicted categories are left unchanged'
);
select is(
  (select count(*)::integer from public.categories
   where household_id = '70000000-0000-0000-0000-000000000007'
     and name = 'Fuel' and type = 'expense'),
  2,
  'categories with different colors are retained'
);
select is(
  (select count(*)::integer from public.categories
   where household_id = '70000000-0000-0000-0000-000000000007'
     and lower(btrim(name)) = 'dining' and type = 'expense'),
  2,
  'categories with different labels are retained'
);
select is(
  (select count(*)::integer from public.categories
   where household_id = '70000000-0000-0000-0000-000000000007'
     and name = 'Transfer'),
  2,
  'categories with different types are not treated as duplicates'
);
select is(
  private.merge_safe_legacy_duplicate_categories(),
  0,
  'running the merge again is idempotent'
);

select * from finish();
rollback;
