-- Household members can persist a preferred category order within each type.
-- Existing categories retain the alphabetical order that was already shown.
alter table public.categories
  add column sort_order integer not null default 0;

with ranked_categories as (
  select
    id,
    row_number() over (
      partition by household_id, type
      order by name asc, id asc
    )::integer as position
  from public.categories
)
update public.categories as c
set sort_order = ranked_categories.position
from ranked_categories
where ranked_categories.id = c.id;

create index categories_household_type_sort_order_idx
  on public.categories (household_id, type, sort_order, name);

-- New categories, and categories moved to a different type, are appended to
-- that household/type's order. The same advisory lock is used by the reorder
-- RPC so inserts cannot race with an order replacement.
create or replace function private.assign_category_sort_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (new.household_id, new.type) is not distinct from (old.household_id, old.type)
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'category-order:' || new.household_id::text || ':' || new.type::text,
      0
    )
  );

  select coalesce(max(c.sort_order), 0) + 1
  into new.sort_order
  from public.categories as c
  where c.household_id = new.household_id
    and c.type = new.type
    and c.id is distinct from new.id;

  return new;
end;
$$;

revoke all on function private.assign_category_sort_order()
  from public, anon, authenticated, service_role;

create trigger categories_assign_sort_order
before insert or update of household_id, type on public.categories
for each row execute function private.assign_category_sort_order();

-- A household's built-in categories are created after this migration has
-- already installed the append trigger. Insert the seed rows alphabetically
-- within each type so first-time households keep the existing initial order.
create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  insert into public.categories (household_id, name, color, icon, type, is_default)
  select new.id, seed.name, seed.color, seed.icon, seed.type, true
  from (
    values
      ('食費',       '#ef4444', 'utensils',      'expense'::public.category_type),
      ('日用品',     '#f59e0b', 'shopping-cart', 'expense'::public.category_type),
      ('住居費',     '#8b5cf6', 'home',          'expense'::public.category_type),
      ('水道光熱費', '#3b82f6', 'zap',           'expense'::public.category_type),
      ('交通費',     '#06b6d4', 'train',         'expense'::public.category_type),
      ('通信費',     '#0ea5e9', 'smartphone',    'expense'::public.category_type),
      ('娯楽費',     '#ec4899', 'gamepad-2',     'expense'::public.category_type),
      ('医療費',     '#14b8a6', 'heart-pulse',   'expense'::public.category_type),
      ('その他支出', '#6b7280', 'ellipsis',      'expense'::public.category_type),
      ('給与',       '#10b981', 'wallet',        'income'::public.category_type),
      ('ボーナス',   '#22c55e', 'gift',          'income'::public.category_type),
      ('その他収入', '#84cc16', 'plus',          'income'::public.category_type)
  ) as seed(name, color, icon, type)
  order by seed.type, seed.name;

  return new;
end;
$$;

-- Replace the complete order for one household/type in a single statement.
-- Validate the whole submitted set so stale or forged client state cannot
-- silently drop categories or move rows across household/type boundaries.
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

  update public.categories as c
  set sort_order = submitted.ordinality::integer
  from unnest(_category_ids) with ordinality as submitted(id, ordinality)
  where c.id = submitted.id
    and c.household_id = _household_id
    and c.type = _type;
end;
$$;

revoke all on function public.reorder_categories(uuid, public.category_type, uuid[])
  from public, anon;
grant execute on function public.reorder_categories(uuid, public.category_type, uuid[])
  to authenticated;
