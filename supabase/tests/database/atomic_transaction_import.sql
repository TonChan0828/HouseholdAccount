begin;
select plan(22);

select ok(
  to_regprocedure('public.confirm_transaction_import(uuid,date,jsonb)') is not null,
  'atomic transaction import RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.confirm_transaction_import(uuid,date,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers cannot invoke transaction import'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.confirm_transaction_import(uuid,date,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers can invoke transaction import'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'import-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'import-b@example.test', '', now(), '{}', '{}', now(), now());
insert into public.households (id, name, created_by) values
  ('30000000-0000-0000-0000-000000000003', 'Import household A', '00000000-0000-0000-0000-0000000000c1'),
  ('40000000-0000-0000-0000-000000000004', 'Import household B', '00000000-0000-0000-0000-0000000000d1');
insert into public.categories (id, household_id, name, type) values
  ('33000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Shared', 'both');

create function pg_temp.try_valid_import() returns text language plpgsql as $$
begin
  return public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-06-01',
    '[
      {"type":"expense","categoryName":"Food","amount":100},
      {"type":"expense","categoryName":"food","amount":200},
      {"type":"income","categoryName":"Shared","amount":300}
    ]'::jsonb
  )::text;
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(pg_temp.try_valid_import(), '3', 'valid rows are imported in one call');
reset role;

select is(
  (select count(*)::integer from public.categories
   where household_id = '30000000-0000-0000-0000-000000000003'
     and lower(btrim(name)) = 'food'),
  1,
  'case-insensitive duplicate rows create only one category'
);
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003'),
  3,
  'all imported transactions are inserted'
);
select ok(
  exists (
    select 1 from public.transactions t
    join public.categories c on c.id = t.category_id
    where t.household_id = '30000000-0000-0000-0000-000000000003'
      and c.id = '33000000-0000-0000-0000-000000000003'
  ),
  'an existing both-type category is reused'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_valid_import(), '0', 'reimporting the same rows skips all duplicates');
reset role;
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003'),
  3,
  'reimporting does not add duplicate transactions'
);

create function pg_temp.try_partial_import() returns text language plpgsql as $$
begin
  return public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-06-01',
    '[
      {"type":"expense","categoryName":"FOOD","amount":100},
      {"type":"expense","categoryName":"Food","amount":250}
    ]'::jsonb
  )::text;
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_partial_import(), '1', 'partial reimport skips matched rows and inserts new rows');
reset role;
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003' and amount = 250),
  1,
  'the nonduplicate row from a partial reimport is inserted'
);

create function pg_temp.try_duplicate_rows() returns text language plpgsql as $$
begin
  return public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-07-01',
    '[
      {"type":"expense","categoryName":"Repeated","amount":55},
      {"type":"expense","categoryName":"Repeated","amount":55}
    ]'::jsonb
  )::text;
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_duplicate_rows(), '2', 'identical rows inside one import are both preserved');
select is(pg_temp.try_duplicate_rows(), '0', 'identical rows are skipped on a repeated import');
reset role;
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003' and amount = 55),
  2,
  'duplicate rows within the original import remain distinct'
);

insert into public.transactions (
  household_id, created_by, amount, type, date, category_id
) values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-0000000000c1',
  444, 'expense', '2026-06-01', '33000000-0000-0000-0000-000000000003'
);

create function pg_temp.try_manual_match_import() returns text language plpgsql as $$
begin
  return public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-06-01',
    '[{"type":"expense","categoryName":"Shared","amount":444}]'::jsonb
  )::text;
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_manual_match_import(), '1', 'an identical manual transaction does not suppress an Excel import');
reset role;
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003' and amount = 444),
  2,
  'a manual row and its identical Excel import are both preserved'
);

create function pg_temp.try_invalid_import() returns text language plpgsql as $$
begin
  perform public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-06-01',
    '[{"type":"expense","categoryName":"Malformed","amount":"100"}]'::jsonb
  );
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_invalid_import(), '22023', 'RPC rejects malformed rows independently of the Server Action');
reset role;
select is(
  (select count(*)::integer from public.categories
   where household_id = '30000000-0000-0000-0000-000000000003' and name = 'Malformed'),
  0,
  'invalid RPC input creates no categories'
);

create function pg_temp.fail_selected_import_transaction() returns trigger language plpgsql as $$
begin
  if new.amount = 1234567 then
    raise exception 'forced import failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger test_fail_selected_import_transaction
before insert on public.transactions
for each row execute function pg_temp.fail_selected_import_transaction();

create function pg_temp.try_failing_import() returns text language plpgsql as $$
begin
  perform public.confirm_transaction_import(
    '30000000-0000-0000-0000-000000000003',
    '2026-07-01',
    '[{"type":"expense","categoryName":"Atomic Failure","amount":1234567}]'::jsonb
  );
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_failing_import(), 'P0001', 'transaction failure is returned to the caller');
reset role;
select is(
  (select count(*)::integer from public.categories
   where household_id = '30000000-0000-0000-0000-000000000003' and name = 'Atomic Failure'),
  0,
  'categories roll back when transaction insertion fails'
);
select is(
  (select count(*)::integer from public.transactions
   where household_id = '30000000-0000-0000-0000-000000000003' and amount = 1234567),
  0,
  'failed import inserts no transactions'
);

create function pg_temp.try_cross_household_import() returns text language plpgsql as $$
begin
  perform public.confirm_transaction_import(
    '40000000-0000-0000-0000-000000000004',
    '2026-06-01',
    '[{"type":"expense","categoryName":"Outsider","amount":100}]'::jsonb
  );
  return 'allowed';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(pg_temp.try_cross_household_import(), '42501', 'non-members cannot import into another household');
reset role;

select * from finish();
rollback;
