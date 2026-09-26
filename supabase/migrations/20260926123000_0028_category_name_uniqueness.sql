-- カテゴリ名の重複をDB境界で防ぐ。
-- household・種別単位で、前後空白と大文字小文字を無視して比較する。
-- 既存の重複レコードは統合・削除せず、新しい重複だけを拒否する。

create or replace function public.enforce_category_name_uniqueness()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  -- 既存重複データの色など、識別キー以外の編集は妨げない。
  if tg_op = 'UPDATE'
    and (old.household_id, lower(btrim(old.name)), old.type)
      is not distinct from
        (new.household_id, lower(btrim(new.name)), new.type)
  then
    return new;
  end if;

  -- 同じキーへの同時作成・変更を直列化する。
  perform pg_advisory_xact_lock(
    hashtextextended(
      'category-name:' || new.household_id::text || ':' ||
      lower(btrim(new.name)) || ':' || new.type::text,
      0
    )
  );

  if exists (
    select 1
    from public.categories as c
    where c.household_id = new.household_id
      and lower(btrim(c.name)) = lower(btrim(new.name))
      and c.type = new.type
      and c.id is distinct from new.id
  ) then
    raise exception 'category name already exists for this household and type'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_category_name_uniqueness() from public, anon, authenticated;

create trigger categories_enforce_name_uniqueness
before insert or update of household_id, name, type on public.categories
for each row execute function public.enforce_category_name_uniqueness();
