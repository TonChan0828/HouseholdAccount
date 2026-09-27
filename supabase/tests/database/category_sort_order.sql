begin;
select plan(15);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'sort_order'
      and is_nullable = 'NO'
  ),
  'categories have a non-null sort_order column'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'categories_assign_sort_order'
      and not tgisinternal
  ),
  'new categories and type changes receive an appended order'
);
select ok(
  to_regprocedure('public.reorder_categories(uuid,public.category_type,uuid[])') is not null,
  'atomic category reorder function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reorder_categories(uuid,public.category_type,uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot reorder categories'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reorder_categories(uuid,public.category_type,uuid[])',
    'EXECUTE'
  ),
  'authenticated members can invoke the reorder function'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'category-sort-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'category-sort-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.households (id, name, created_by) values
  ('80000000-0000-0000-0000-000000000001', 'Category sort household A', '00000000-0000-0000-0000-0000000000a1'),
  ('80000000-0000-0000-0000-000000000002', 'Category sort household B', '00000000-0000-0000-0000-0000000000a2');

select is(
  (
    select array_agg(c.name order by c.sort_order)
    from public.categories as c
    where c.household_id = '80000000-0000-0000-0000-000000000002'
      and c.type = 'expense'
  ),
  (
    select array_agg(c.name order by c.name)
    from public.categories as c
    where c.household_id = '80000000-0000-0000-0000-000000000002'
      and c.type = 'expense'
  ),
  'new household defaults start in the existing alphabetical order'
);

insert into public.categories (id, household_id, name, type) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Zebra', 'expense'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'Alpha', 'expense'),
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'Other household', 'expense');

create function pg_temp.try_reorder_categories(
  _household_id uuid,
  _type public.category_type,
  _category_ids uuid[]
) returns text language plpgsql as $$
begin
  perform public.reorder_categories(_household_id, _type, _category_ids);
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  pg_temp.try_reorder_categories(
    '80000000-0000-0000-0000-000000000001',
    'expense',
    array['81000000-0000-0000-0000-000000000002'::uuid,
          '81000000-0000-0000-0000-000000000001'::uuid]
      || array(
        select c.id
        from public.categories as c
        where c.household_id = '80000000-0000-0000-0000-000000000001'
          and c.type = 'expense'
          and c.id not in (
            '81000000-0000-0000-0000-000000000001',
            '81000000-0000-0000-0000-000000000002'
          )
        order by c.sort_order
      )
  ),
  '00000',
  'a household member can atomically replace the complete expense order'
);
select is(
  (select sort_order from public.categories where id = '81000000-0000-0000-0000-000000000002'),
  1,
  'the submitted first category receives the first position'
);
select is(
  (select sort_order from public.categories where id = '81000000-0000-0000-0000-000000000001'),
  2,
  'the submitted second category receives the second position'
);
select is(
  pg_temp.try_reorder_categories(
    '80000000-0000-0000-0000-000000000001', 'expense',
    array['81000000-0000-0000-0000-000000000001'::uuid]
  ),
  '22023',
  'partial order submissions are rejected'
);
select is(
  pg_temp.try_reorder_categories(
    '80000000-0000-0000-0000-000000000001', 'expense',
    array['81000000-0000-0000-0000-000000000001'::uuid,
          '81000000-0000-0000-0000-000000000001'::uuid]
  ),
  '22023',
  'duplicate category ids are rejected'
);
select is(
  pg_temp.try_reorder_categories(
    '80000000-0000-0000-0000-000000000001',
    'expense',
    array['82000000-0000-0000-0000-000000000001'::uuid]
      || array(
        select c.id
        from public.categories as c
        where c.household_id = '80000000-0000-0000-0000-000000000001'
          and c.type = 'expense'
          and c.id <> '81000000-0000-0000-0000-000000000002'
        order by c.sort_order
      )
  ),
  '22023',
  'ids from another household cannot be substituted into the order'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is(
  pg_temp.try_reorder_categories(
    '80000000-0000-0000-0000-000000000001', 'expense', array[]::uuid[]
  ),
  '42501',
  'a non-member cannot reorder another household'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
insert into public.categories (id, household_id, name, type)
values ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'Appended', 'expense');
select is(
  (select sort_order from public.categories where id = '81000000-0000-0000-0000-000000000003'),
  (select max(sort_order) from public.categories where household_id = '80000000-0000-0000-0000-000000000001' and type = 'expense'),
  'new categories are appended after the persisted order'
);
update public.categories
set type = 'income'
where id = '81000000-0000-0000-0000-000000000003';
select is(
  (select sort_order from public.categories where id = '81000000-0000-0000-0000-000000000003'),
  (select max(sort_order) from public.categories where household_id = '80000000-0000-0000-0000-000000000001' and type = 'income'),
  'changing category type appends it within the destination type'
);
reset role;

select * from finish();
rollback;
