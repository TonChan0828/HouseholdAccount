begin;
select plan(7);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'categories_enforce_name_uniqueness'
      and not tgisinternal
  ),
  'category name uniqueness trigger is installed'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'category-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'category-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.households (id, name, created_by) values
  ('50000000-0000-0000-0000-000000000005', 'Category household A', '00000000-0000-0000-0000-0000000000e1'),
  ('60000000-0000-0000-0000-000000000006', 'Category household B', '00000000-0000-0000-0000-0000000000e2');

insert into public.categories (id, household_id, name, type) values
  ('55000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', 'Groceries', 'expense'),
  ('55000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000005', 'Groceries', 'income');

create function pg_temp.try_insert_category(
  _household_id uuid,
  _name text,
  _type public.category_type
) returns text language plpgsql as $$
begin
  insert into public.categories (household_id, name, type)
  values (_household_id, _name, _type);
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.try_rename_category(_id uuid, _name text) returns text language plpgsql as $$
begin
  update public.categories set name = _name where id = _id;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.try_recolor_category(_id uuid) returns text language plpgsql as $$
begin
  update public.categories set color = '#ef4444' where id = _id;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  pg_temp.try_insert_category('50000000-0000-0000-0000-000000000005', ' groceries ', 'expense'),
  '23505',
  'same-type names are unique ignoring surrounding whitespace and case'
);
select is(
  pg_temp.try_insert_category('50000000-0000-0000-0000-000000000005', 'Groceries', 'both'),
  '00000',
  'the same label remains allowed for a different category type'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
set local role authenticated;
select is(
  pg_temp.try_insert_category('60000000-0000-0000-0000-000000000006', ' groceries ', 'expense'),
  '00000',
  'the same name is allowed in another household'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
set local role authenticated;
select is(
  pg_temp.try_rename_category('55000000-0000-0000-0000-000000000006', ' groceries '),
  '23505',
  'renaming into an existing same-type name is rejected'
);
select is(
  pg_temp.try_rename_category('55000000-0000-0000-0000-000000000005', ' groceries '),
  '00000',
  'a case and whitespace-only rename keeps the same normalized name'
);
select is(
  pg_temp.try_recolor_category('55000000-0000-0000-0000-000000000005'),
  '00000',
  'editing a non-name field remains allowed'
);
reset role;

select * from finish();
rollback;
