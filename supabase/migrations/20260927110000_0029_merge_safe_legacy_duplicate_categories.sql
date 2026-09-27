-- 同一 household・同一種別に過去作成された、完全に同一なカテゴリだけを安全に統合する。
-- 予算が複数ある場合や、カテゴリ名/色/icon/default/reminder が異なる場合は触れずに残す。

create or replace function private.merge_safe_legacy_duplicate_categories()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_keep_id uuid;
  v_duplicate_id uuid;
  v_index integer;
  v_deleted integer := 0;
  v_row_count integer;
begin
  -- アプリからの書き込みと競合しないよう、参照元と対象テーブルを一括でロックする。
  lock table
    public.categories,
    public.transactions,
    public.recurring_transactions,
    public.budgets
  in share row exclusive mode;

  for v_group in
    with duplicate_groups as (
      select
        c.household_id,
        array_agg(c.id order by c.id) as category_ids
      from public.categories as c
      group by
        c.household_id,
        lower(btrim(c.name)),
        c.name,
        c.color,
        c.icon,
        c.type,
        c.is_default,
        c.reminder_enabled
      having count(*) > 1
    )
    select g.household_id, g.category_ids
    from duplicate_groups as g
    where (
      select count(*)
      from public.budgets as b
      where b.household_id = g.household_id
        and b.category_id = any(g.category_ids)
    ) <= 1
  loop
    v_keep_id := v_group.category_ids[1];

    for v_index in 2..cardinality(v_group.category_ids) loop
      v_duplicate_id := v_group.category_ids[v_index];

      update public.transactions
      set category_id = v_keep_id
      where household_id = v_group.household_id
        and category_id = v_duplicate_id;

      update public.recurring_transactions
      set category_id = v_keep_id
      where household_id = v_group.household_id
        and category_id = v_duplicate_id;

      update public.budgets
      set category_id = v_keep_id
      where household_id = v_group.household_id
        and category_id = v_duplicate_id;

      delete from public.categories
      where household_id = v_group.household_id
        and id = v_duplicate_id;
      get diagnostics v_row_count = row_count;
      v_deleted := v_deleted + v_row_count;
    end loop;
  end loop;

  return v_deleted;
end;
$$;

revoke all on function private.merge_safe_legacy_duplicate_categories()
  from public, anon, authenticated;

comment on function private.merge_safe_legacy_duplicate_categories() is
  'Merges only identical legacy categories with at most one budget; ambiguous groups are retained.';

do $$
declare
  v_merged integer;
  v_remaining_groups integer;
begin
  v_merged := private.merge_safe_legacy_duplicate_categories();

  select count(*)::integer
  into v_remaining_groups
  from (
    select 1
    from public.categories
    group by household_id, lower(btrim(name)), type
    having count(*) > 1
  ) as duplicate_groups;

  raise notice
    'Merged % identical legacy categories; % ambiguous duplicate groups remain for review.',
    v_merged,
    v_remaining_groups;
end;
$$;
