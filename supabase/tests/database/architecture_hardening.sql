begin;
select plan(23);

select ok(
  to_regclass('public.transactions') is not null,
  'transactions table exists'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'transactions_household_category_fkey'),
  'transactions category is household scoped'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'recurring_transactions_household_category_fkey'),
  'recurring category is household scoped'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'budgets_household_category_fkey'),
  'budget category is household scoped'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'transactions_amount_check'),
  'transaction amount constraint exists'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'transactions_memo_length_check'),
  'transaction memo constraint exists'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'savings_goals_target_date_check'),
  'savings target date constraint exists'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions'
      and policyname = 'transactions_update_creator_or_subject'
      and with_check like '%is_household_member%'
      and with_check like '%on_behalf_of%'
  ),
  'transaction update checks current membership'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recurring_transactions'
      and policyname = 'recurring_update_creator'
      and with_check like '%is_household_member%'
  ),
  'recurring update checks current membership'
);
select ok(
  to_regprocedure('public.generate_all_due_recurring(date)') is not null,
  'scheduled recurring function exists'
);
select ok(
  not has_function_privilege('authenticated', 'public.generate_all_due_recurring(date)', 'EXECUTE'),
  'authenticated cannot execute scheduled recurring function'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'household_member_deactivate_recurring' and not tgisinternal
  ),
  'departed member recurring trigger exists'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'transactions_household_on_behalf_fkey'),
  'transaction subject is household scoped'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'transactions_freeze_identity' and not tgisinternal
  ),
  'transaction identity freeze trigger exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'household_member_clear_on_behalf_of' and not tgisinternal
  ),
  'departed member subject trigger exists'
);

-- 実データを使って複合FK・RLS・脱退トリガの挙動も確認する。
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'arch-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'arch-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.households (id, name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'A household', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', 'B household', '00000000-0000-0000-0000-0000000000b1');
insert into public.categories (id, household_id, name, type) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A category', 'expense'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'B category', 'expense');
insert into public.transactions (id, household_id, created_by, amount, type, date) values
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a1', 100, 'expense', '2026-07-01');
insert into public.recurring_transactions
  (id, household_id, created_by, amount, type, is_active) values
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a1', 100, 'expense', true);

create function pg_temp.try_cross_category() returns text language plpgsql as $$
begin
  insert into public.transactions
    (household_id, created_by, amount, type, date, category_id)
  values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
     100, 'expense', '2026-07-01', '22000000-0000-0000-0000-000000000002');
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.try_move_transaction() returns text language plpgsql as $$
begin
  update public.transactions
  set household_id = '20000000-0000-0000-0000-000000000002'
  where id = '12000000-0000-0000-0000-000000000001';
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.try_outsider_subject() returns text language plpgsql as $$
begin
  insert into public.transactions
    (household_id, created_by, amount, type, date, on_behalf_of)
  values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
     100, 'expense', '2026-07-01', '00000000-0000-0000-0000-0000000000b1');
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

select is(pg_temp.try_cross_category(), '23503', 'cross-household category is rejected');
select is(
  pg_temp.try_outsider_subject(), '23503',
  'non-member cannot be named as transaction subject'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(pg_temp.try_move_transaction(), '42501', 'creator cannot move transaction outside membership');
reset role;

-- 代理入力（spec 41）: b1 を h1 のメンバーにし、a1 が b1 名義で登録した収支を用意する。
insert into public.household_members (household_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'member');
insert into public.transactions
  (id, household_id, created_by, amount, type, date, on_behalf_of) values
  ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a1', 100, 'expense', '2026-07-01',
   '00000000-0000-0000-0000-0000000000b1');

-- 名義人は自分の行を更新できるため、created_by を自分に書き換えると RLS の
-- WITH CHECK は通ってしまう。不変トリガーだけがこれを止める。
create function pg_temp.try_forge_author() returns text language plpgsql as $$
begin
  update public.transactions
  set created_by = '00000000-0000-0000-0000-0000000000b1'
  where id = '12000000-0000-0000-0000-000000000002';
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(pg_temp.try_forge_author(), '42501', 'subject cannot forge transaction author');
reset role;

delete from public.household_members
where household_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select on_behalf_of::text from public.transactions
   where id = '12000000-0000-0000-0000-000000000002'),
  null::text,
  'departed subject falls back to the author'
);
select is(
  (select created_by::text from public.transactions
   where id = '12000000-0000-0000-0000-000000000002'),
  '00000000-0000-0000-0000-0000000000a1',
  'departed subject does not delete the transaction'
);

delete from public.household_members
where household_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select is_active from public.recurring_transactions
   where id = '13000000-0000-0000-0000-000000000001'),
  false,
  'departed member recurring item is deactivated'
);
select is(
  (select household_id::text from public.transactions
   where id = '12000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001',
  'rejected move leaves transaction in original household'
);

select * from finish();
rollback;
