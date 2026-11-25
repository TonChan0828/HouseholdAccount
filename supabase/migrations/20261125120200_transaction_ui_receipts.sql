alter table public.transactions add column reflected_category_name text
  check (length(reflected_category_name) between 1 and 50);

create table private.transaction_ui_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
alter table private.transaction_ui_receipts enable row level security;
grant select, insert on private.transaction_ui_receipts to authenticated;
create policy own_receipt on private.transaction_ui_receipts to authenticated
  using (user_id = (select auth.uid()) and private.is_household_member(household_id))
  with check (user_id = (select auth.uid()) and private.is_household_member(household_id));

create function public.create_ui_transaction(_request_id uuid, _household_id uuid, _request_hash text,
  _rows jsonb, _warnings jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  receipt private.transaction_ui_receipts%rowtype;
  entry jsonb;
  transaction_id uuid;
  source_id uuid;
  result jsonb;
begin
  if caller is null or not private.is_household_member(_household_id) then
    raise insufficient_privilege;
  end if;
  if _request_hash is null or _request_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(_rows) is distinct from 'array'
    or jsonb_typeof(_warnings) is distinct from 'array'
    or pg_column_size(_rows) > 262144 or pg_column_size(_warnings) > 32768 then
    raise exception 'invalid submission' using errcode = '22023';
  end if;
  if jsonb_array_length(_rows) not between 1 and 100
    or (_rows->0->>'household_id')::uuid is distinct from _household_id then
    raise exception 'invalid registration groups' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ui:' || caller::text || ':' || _request_id::text, 0));
  select r.* into receipt from private.transaction_ui_receipts r
    where r.user_id = caller and r.request_id = _request_id;
  if found then
    if receipt.request_hash <> _request_hash or receipt.household_id <> _household_id then
      raise sqlstate 'PT409' using message = 'submission_changed';
    end if;
    return receipt.result;
  end if;

  for entry in select value from jsonb_array_elements(_rows) loop
    insert into public.transactions(household_id, created_by, on_behalf_of, amount, type,
      category_id, date, memo, is_shared, reflected_category_name)
    values ((entry->>'household_id')::uuid, caller, (entry->>'on_behalf_of')::uuid,
      (entry->>'amount')::integer, (entry->>'type')::public.transaction_type,
      (entry->>'category_id')::uuid, (entry->>'date')::date, entry->>'memo',
      coalesce((entry->>'is_shared')::boolean, false), entry->>'reflected_category_name')
    returning id into transaction_id;
    source_id := coalesce(source_id, transaction_id);
  end loop;
  result := jsonb_build_object('id', source_id, 'warnings', _warnings);
  insert into private.transaction_ui_receipts(user_id, request_id, household_id, request_hash, result)
    values (caller, _request_id, _household_id, _request_hash, result);
  return result;
end;
$$;

create function public.get_ui_transaction_receipt(_request_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select result from private.transaction_ui_receipts where request_id = _request_id and user_id = auth.uid();
$$;

create table private.transaction_undo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  expires_at timestamptz not null,
  transaction_data jsonb not null
);
create index transaction_undo_expiry_idx on private.transaction_undo(expires_at);

create function public.delete_transaction_with_undo(_transaction_id uuid, _household_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  deleted public.transactions%rowtype;
  undo_id uuid;
  deadline timestamptz;
begin
  if caller is null or not private.is_household_member(_household_id) then raise insufficient_privilege; end if;
  delete from public.transactions t
    where t.id = _transaction_id and t.household_id = _household_id
      and (t.created_by = caller or t.on_behalf_of = caller)
    returning t.* into deleted;
  if not found then return null; end if;
  delete from private.transaction_undo where expires_at <= clock_timestamp();
  deadline := clock_timestamp() + interval '10 seconds';
  insert into private.transaction_undo(user_id, household_id, expires_at, transaction_data)
    values (caller, _household_id, deadline, to_jsonb(deleted))
    returning id into undo_id;
  return jsonb_build_object('id', undo_id, 'expiresAt', deadline);
end;
$$;

create function public.undo_transaction_delete(_undo_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  receipt private.transaction_undo%rowtype;
begin
  if caller is null then raise insufficient_privilege; end if;
  delete from private.transaction_undo
    where id = _undo_id and user_id = caller and expires_at > clock_timestamp()
      and private.is_household_member(household_id)
    returning * into receipt;
  if not found then return false; end if;
  insert into public.transactions select tx.*
    from jsonb_populate_record(null::public.transactions, receipt.transaction_data) tx;
  return true;
end;
$$;

create function public.prune_transaction_undo()
returns void language sql security definer set search_path = ''
as $$
  delete from private.transaction_undo where expires_at <= clock_timestamp();
$$;

revoke all on function public.create_ui_transaction(uuid,uuid,text,jsonb,jsonb),
  public.get_ui_transaction_receipt(uuid), public.delete_transaction_with_undo(uuid,uuid),
  public.undo_transaction_delete(uuid), public.prune_transaction_undo()
  from public, anon, authenticated;
grant execute on function public.create_ui_transaction(uuid,uuid,text,jsonb,jsonb),
  public.get_ui_transaction_receipt(uuid), public.delete_transaction_with_undo(uuid,uuid),
  public.undo_transaction_delete(uuid) to authenticated;
grant execute on function public.prune_transaction_undo() to service_role;
