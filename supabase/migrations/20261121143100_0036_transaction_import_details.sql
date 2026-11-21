-- 負額は取り込み処理で追加した明細に限定する。
alter table public.transactions drop constraint transactions_amount_check;
alter table public.transactions add constraint transactions_amount_check check (
  amount >= 1 or
  (amount between -2147483647 and -1 and import_key is not null and not is_shared and recurring_id is null)
);

create function private.guard_imported_adjustment()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if new.amount < 0 and current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      raise exception 'adjustments must be imported' using errcode = '42501';
    end if;
    if old.amount >= 0 or old.import_key is distinct from new.import_key then
      raise exception 'adjustments must be imported' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_imported_adjustment() from public, anon, authenticated;
create trigger guard_imported_adjustment
  before insert or update on public.transactions
  for each row execute function private.guard_imported_adjustment();

create or replace function public.confirm_transaction_import_v2(
  _household_id uuid,
  _month date,
  _rows jsonb,
  _member_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path to ''
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
  v_date_text text;
  v_actor uuid := auth.uid();
  v_subject uuid;
  v_category_colors constant text[] := array[
    '#ef4444', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
  ];
begin
  if v_actor is null then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  v_subject := nullif(_member_id, v_actor);
  -- 確定中の退会と競合しないよう、必要な所属行をID順でロックする。
  perform 1 from public.household_members
    where household_id = _household_id and user_id in (v_actor, coalesce(v_subject, v_actor))
    order by user_id for key share;
  if not exists (select 1 from public.household_members where household_id = _household_id and user_id = v_actor)
    or (v_subject is not null and not exists (
      select 1 from public.household_members where household_id = _household_id and user_id = v_subject
    )) then
    raise exception 'invalid import membership' using errcode = '42501';
  end if;
  if _month is null or _month < date '0001-01-01' or _month > date '9999-12-01'
    or _month <> date_trunc('month', _month)::date then
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
    if v_amount_text !~ '^-?[1-9][0-9]*$' or char_length(v_amount_text) > 11 then
      raise exception 'invalid import amount' using errcode = '22023';
    end if;
    if abs(v_amount_text::numeric) > 2147483647 then
      raise exception 'import amount is too large' using errcode = '22023';
    end if;
    if v_row ? 'date' then
      v_date_text := v_row ->> 'date';
      if jsonb_typeof(v_row -> 'date') is distinct from 'string'
        or v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then
        raise exception 'invalid import date' using errcode = '22023';
      end if;
      if to_char(v_date_text::date, 'YYYY-MM-DD') <> v_date_text then
        raise exception 'invalid import date' using errcode = '22023';
      end if;
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
      coalesce((r.value ->> 'date')::date, _month) as entry_date,
      row_number() over (
        partition by
          coalesce((r.value ->> 'date')::date, _month),
          r.value ->> 'type',
          lower(btrim(r.value ->> 'categoryName')),
          r.value ->> 'amount'
        order by r.ordinality
      ) as duplicate_index
    from jsonb_array_elements(_rows) with ordinality as r(value, ordinality)
  )
  insert into public.transactions (
    household_id, created_by, on_behalf_of, amount, type, date, category_id, memo, import_key
  )
  select
    _household_id,
    v_actor,
    v_subject,
    (r.value ->> 'amount')::integer,
    (r.value ->> 'type')::public.transaction_type,
    r.entry_date,
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
    case
      when v_subject is null and keys.legacy is not null and not exists (
        select 1 from public.transactions t
        where t.household_id = _household_id and t.import_key in (keys.legacy, keys.detailed)
      ) then keys.legacy
      else keys.detailed
    end
  from source_rows as r
  cross join lateral (
    select case when extract(day from r.entry_date) = 1 and (r.value ->> 'amount')::integer > 0
      then md5(concat_ws('|', r.entry_date::text, r.value ->> 'type',
        lower(btrim(r.value ->> 'categoryName')), r.value ->> 'amount', r.duplicate_index::text))
      end as legacy,
      'v2:' || md5(jsonb_build_array(r.entry_date, coalesce(v_subject, v_actor), r.value ->> 'type',
        lower(btrim(r.value ->> 'categoryName')), r.value ->> 'amount', r.duplicate_index)::text) as detailed
  ) as keys
  where not exists (
    select 1 from public.transactions t where t.household_id = _household_id
      and t.import_key = keys.legacy and t.created_by = coalesce(v_subject, v_actor)
  )
  on conflict (household_id, import_key) where import_key is not null do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.confirm_transaction_import_v2(uuid, date, jsonb, uuid)
  from public, anon;
grant execute on function public.confirm_transaction_import_v2(uuid, date, jsonb, uuid)
  to authenticated;

comment on function public.confirm_transaction_import_v2(uuid, date, jsonb, uuid) is
  'Atomically creates missing categories and imports nonduplicate validated household transactions.';
