alter table public.categories add column is_hidden boolean not null default false;
alter table public.categories add constraint categories_hidden_preset_only
  check (not is_hidden or is_default);

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
    and new.is_default is distinct from old.is_default then
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
security invoker
set search_path to ''
as $$
begin
  if _hidden is null or not private.is_household_member(_household_id) then
    raise exception 'invalid visibility change' using errcode = '42501';
  end if;
  update public.categories set is_hidden = _hidden
    where household_id = _household_id and id = _category_id and is_default;
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
