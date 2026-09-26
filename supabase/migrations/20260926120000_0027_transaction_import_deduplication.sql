-- Excel 取込元の行にだけ安定したキーを付け、同じ行の再取込を冪等にする。
-- 手入力など import_key が NULL の取引は重複判定の対象にしない。
alter table public.transactions
  add column import_key text;

create unique index transactions_import_key_unique_idx
  on public.transactions (household_id, import_key)
  where import_key is not null;

comment on column public.transactions.import_key is
  'Excel取込行の冪等キー。通常登録ではNULL。取込行の削除時はキーも削除され、再取込可能。';

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
  v_inserted_count integer;
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

  -- 同一 household の取込を直列化し、キー確認から INSERT までの競合を防ぐ。
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

  -- 同じ内容・対象月・行の出現順には同じキーを付ける。
  -- 取込内に同一カテゴリ・金額の行が複数ある場合も、出現番号で区別して保持する。
  with source_rows as (
    select
      r.value,
      row_number() over (
        partition by
          r.value ->> 'type',
          lower(btrim(r.value ->> 'categoryName')),
          r.value ->> 'amount'
        order by r.ordinality
      ) as duplicate_index
    from jsonb_array_elements(_rows) with ordinality as r(value, ordinality)
  )
  insert into public.transactions (
    household_id, created_by, amount, type, date, category_id, memo, import_key
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
    null,
    md5(concat_ws(
      '|', _month::text, r.value ->> 'type',
      lower(btrim(r.value ->> 'categoryName')),
      r.value ->> 'amount', r.duplicate_index::text
    ))
  from source_rows as r
  on conflict (household_id, import_key) where import_key is not null do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.confirm_transaction_import(uuid, date, jsonb)
  from public, anon;
grant execute on function public.confirm_transaction_import(uuid, date, jsonb)
  to authenticated;

comment on function public.confirm_transaction_import(uuid, date, jsonb) is
  'Atomically creates missing categories and imports nonduplicate validated household transactions.';
