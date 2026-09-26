-- Excel 取り込みで不足カテゴリ作成と取引登録を1つのDBトランザクションにまとめる。
-- 同じ household の並行インポートも直列化し、同名カテゴリの二重作成を防ぐ。

create or replace function public.confirm_transaction_import(
  _household_id uuid,
  _month date,
  _rows jsonb
)
returns integer
language plpgsql
volatile
security invoker
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_row jsonb;
  v_needed record;
  v_category_id uuid;
  v_row_count integer;
  v_color_base integer;
  v_created_count integer := 0;
  v_amount_text text;
  v_category_colors constant text[] := array[
    '#ef4444', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
  ];
begin
  if auth.uid() is null or not private.is_household_member(_household_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  if _month is null or _month <> date_trunc('month', _month)::date then
    raise exception 'month must be the first day of a month' using errcode = '22023';
  end if;
  if jsonb_typeof(_rows) is distinct from 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;

  v_row_count := jsonb_array_length(_rows);
  if v_row_count < 1 or v_row_count > 500 then
    raise exception 'rows must contain between 1 and 500 items' using errcode = '22023';
  end if;
  -- RPC は Server Action 以外からも呼べるため、JSON 入力をDB境界で再検証する。
  for v_row in select value from jsonb_array_elements(_rows)
  loop
    if jsonb_typeof(v_row) is distinct from 'object'
      or jsonb_typeof(v_row -> 'type') is distinct from 'string'
      or v_row ->> 'type' not in ('income', 'expense')
      or jsonb_typeof(v_row -> 'categoryName') is distinct from 'string'
      or char_length(btrim(v_row ->> 'categoryName')) not between 1 and 50
      or jsonb_typeof(v_row -> 'amount') is distinct from 'number'
    then
      raise exception 'invalid import row' using errcode = '22023';
    end if;

    v_amount_text := v_row ->> 'amount';
    if v_amount_text !~ '^[1-9][0-9]*$' or char_length(v_amount_text) > 10 then
      raise exception 'invalid import amount' using errcode = '22023';
    end if;
    if v_amount_text::numeric > 2147483647 then
      raise exception 'import amount is too large' using errcode = '22023';
    end if;
  end loop;

  -- import RPC 同士を household 単位で直列化し、既存カテゴリの再検索を競合させない。
  perform pg_advisory_xact_lock(hashtextextended('transaction-import:' || _household_id::text, 0));
  select count(*)::integer into v_color_base
  from public.categories
  where household_id = _household_id;

  for v_needed in
    select
      (array_agg(r.value ->> 'categoryName' order by r.ordinality))[1] as category_name,
      r.value ->> 'type' as row_type
    from jsonb_array_elements(_rows) with ordinality as r(value, ordinality)
    group by lower(btrim(r.value ->> 'categoryName')), r.value ->> 'type'
    order by min(r.ordinality)
  loop
    select c.id into v_category_id
    from public.categories as c
    where c.household_id = _household_id
      and lower(btrim(c.name)) = lower(btrim(v_needed.category_name))
      and c.type in (v_needed.row_type::public.category_type, 'both'::public.category_type)
    order by (c.type = v_needed.row_type::public.category_type) desc, c.id
    limit 1;

    if v_category_id is null then
      insert into public.categories (household_id, name, type, color, is_default)
      values (
        _household_id,
        btrim(v_needed.category_name),
        v_needed.row_type::public.category_type,
        v_category_colors[(v_color_base + v_created_count) % cardinality(v_category_colors) + 1],
        false
      )
      returning id into v_category_id;
      v_created_count := v_created_count + 1;
    end if;
    v_category_id := null;
  end loop;

  -- categories と transactions は同一関数呼び出し=同一トランザクションで確定する。
  insert into public.transactions (
    household_id, created_by, amount, type, date, category_id, memo
  )
  select
    _household_id,
    auth.uid(),
    (r.value ->> 'amount')::integer,
    (r.value ->> 'type')::public.transaction_type,
    _month,
    (
      select c.id
      from public.categories as c
      where c.household_id = _household_id
        and lower(btrim(c.name)) = lower(btrim(r.value ->> 'categoryName'))
        and c.type in (
          (r.value ->> 'type')::public.category_type,
          'both'::public.category_type
        )
      order by (c.type = (r.value ->> 'type')::public.category_type) desc, c.id
      limit 1
    ),
    null
  from jsonb_array_elements(_rows) as r(value);

  return v_row_count;
end;
$$;

revoke all on function public.confirm_transaction_import(uuid, date, jsonb)
  from public, anon;
grant execute on function public.confirm_transaction_import(uuid, date, jsonb)
  to authenticated;

comment on function public.confirm_transaction_import(uuid, date, jsonb) is
  'Atomically creates missing categories and imports validated household transactions.';
