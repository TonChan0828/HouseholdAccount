alter table public.categories add column is_hidden boolean not null default false;
alter table public.categories add constraint categories_hidden_preset_only
  check (not is_hidden or is_default);

alter policy categories_insert_member on public.categories
  with check (not is_default and private.is_household_member(household_id));

alter policy categories_delete_member on public.categories
  using (not is_default and private.is_household_member(household_id));

create function private.guard_category_preset_status()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (new.is_default is distinct from old.is_default
      or new.is_hidden is distinct from old.is_hidden
      or (old.is_default and (new.type is distinct from old.type
        or new.household_id is distinct from old.household_id))) then
    raise exception 'category preset status cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_category_preset_status() from public, anon, authenticated;
create trigger guard_category_preset_status
  before update on public.categories
  for each row execute function private.guard_category_preset_status();

create function public.set_preset_category_visibility(
  _household_id uuid, _category_id uuid, _hidden boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_type public.category_type;
begin
  if auth.uid() is null or _hidden is null then
    raise exception 'invalid visibility change' using errcode = '42501';
  end if;
  perform 1 from public.household_members where household_id = _household_id
    and user_id = auth.uid() for key share;
  if not found then
    raise exception 'invalid visibility change' using errcode = '42501';
  end if;
  select type into v_type from public.categories
    where household_id = _household_id and id = _category_id and is_default;
  if not found then
    raise exception 'preset category not found' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('category-order:' || _household_id::text || ':' || v_type::text, 0)
  );
  update public.categories set is_hidden = _hidden
    where household_id = _household_id and id = _category_id and type = v_type and is_default;
  if not found then
    raise exception 'preset category not found' using errcode = '22023';
  end if;
end;
$$;

create function public.category_usage(_household_id uuid)
returns table (category_id uuid, transactions bigint, recurring bigint, budgets bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  select c.id,
    (select count(*) from public.transactions t where t.household_id = _household_id and t.category_id = c.id),
    (select count(*) from public.recurring_transactions r where r.household_id = _household_id and r.category_id = c.id),
    (select count(*) from public.budgets b where b.household_id = _household_id and b.category_id = c.id)
  from public.categories c
  where c.household_id = _household_id and not c.is_default
    and private.is_household_owner(_household_id);
$$;

create function public.merge_category(
  _household_id uuid, _source_id uuid, _destination_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  source public.categories%rowtype;
  destination public.categories%rowtype;
begin
  -- オーナー交代や退会中に権限を使い続けないよう所属行を保持する。
  perform 1 from public.household_members where household_id = _household_id
    and user_id = auth.uid() and role = 'owner' for share;
  if not found then
    raise exception 'only the household owner can merge categories' using errcode = '42501';
  end if;
  if _source_id is null or _destination_id is null or _source_id = _destination_id then
    raise exception 'invalid merge categories' using errcode = '22023';
  end if;
  perform 1 from public.categories where household_id = _household_id
    and id in (_source_id, _destination_id) order by id for update;

  select * into source from public.categories where household_id = _household_id and id = _source_id;
  select * into destination from public.categories where household_id = _household_id and id = _destination_id;
  if source.id is null or source.is_default or destination.id is null or destination.is_hidden
    or destination.type not in (source.type, 'both') then
    raise exception 'invalid merge categories' using errcode = '22023';
  end if;
  -- カテゴリの種別が変更されても過去明細の種別は保持される。
  if destination.type <> 'both' and (
    exists (select 1 from public.transactions where household_id = _household_id
      and category_id = _source_id and type::text <> destination.type::text)
    or exists (select 1 from public.recurring_transactions where household_id = _household_id
      and category_id = _source_id and type::text <> destination.type::text)
    or (destination.type = 'income' and exists (
      select 1 from public.budgets where household_id = _household_id and category_id = _source_id
    ))
  ) then
    raise exception 'destination category does not support existing references' using errcode = '22023';
  end if;
  if (select count(*) from public.budgets where household_id = _household_id
      and category_id in (_source_id, _destination_id)) > 1 then
    raise exception 'both categories already have budgets' using errcode = '23505';
  end if;

  update public.transactions set category_id = _destination_id
    where household_id = _household_id and category_id = _source_id;
  update public.recurring_transactions set category_id = _destination_id
    where household_id = _household_id and category_id = _source_id;
  update public.budgets set category_id = _destination_id
    where household_id = _household_id and category_id = _source_id;
  delete from public.categories where household_id = _household_id and id = _source_id;
  if not found then
    raise exception 'source category not found' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.set_preset_category_visibility(uuid, uuid, boolean) from public, anon;
revoke execute on function public.category_usage(uuid) from public, anon;
revoke execute on function public.merge_category(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_preset_category_visibility(uuid, uuid, boolean) to authenticated;
grant execute on function public.category_usage(uuid) to authenticated;
grant execute on function public.merge_category(uuid, uuid, uuid) to authenticated;

-- 非表示カテゴリを含む古い画面からの操作で位置が変わることを防ぐ。
create or replace function public.reorder_categories(
  _household_id uuid,
  _type public.category_type,
  _category_ids uuid[]
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_current_count integer;
  v_distinct_count integer;
begin
  if auth.uid() is null or not private.is_household_member(_household_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  if _household_id is null or _type is null or _category_ids is null then
    raise exception 'invalid category order' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(_category_ids) as submitted(id) where id is null) then
    raise exception 'category ids must not contain null' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'category-order:' || _household_id::text || ':' || _type::text,
      0
    )
  );

  select count(*)::integer
  into v_current_count
  from public.categories as c
  where c.household_id = _household_id
    and c.type = _type;

  select count(distinct submitted.id)::integer
  into v_distinct_count
  from unnest(_category_ids) as submitted(id);

  if cardinality(_category_ids) <> v_current_count
    or v_distinct_count <> cardinality(_category_ids)
    or exists (
      select 1
      from public.categories as c
      where c.household_id = _household_id
        and c.type = _type
        and not (c.id = any(_category_ids))
    )
    or exists (
      select 1
      from unnest(_category_ids) as submitted(id)
      where not exists (
        select 1
        from public.categories as c
        where c.id = submitted.id
          and c.household_id = _household_id
          and c.type = _type
      )
    )
  then
    raise exception 'category order is stale or invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select id, is_hidden, row_number() over (order by sort_order, name, id) as position
      from public.categories where household_id = _household_id and type = _type
    ) as current_order
    join unnest(_category_ids) with ordinality as submitted(id, position) using (id)
    where current_order.is_hidden and current_order.position <> submitted.position
  ) then
    raise exception 'category visibility changed; reload the order' using errcode = '22023';
  end if;

  update public.categories as c
  set sort_order = submitted.ordinality::integer
  from unnest(_category_ids) with ordinality as submitted(id, ordinality)
  where c.id = submitted.id
    and c.household_id = _household_id
    and c.type = _type;
end;
$$;
