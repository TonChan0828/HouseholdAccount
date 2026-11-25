-- A no-login role owns the RPCs and inherits the same row policies as authenticated users.
-- The only way to assume an identity here is to present a live token.
create role household_agent nologin inherit nobypassrls;
grant household_agent to postgres;
grant authenticated to household_agent;
grant usage on schema private to household_agent;
grant usage, create on schema public, private to household_agent;

create table private.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index agent_tokens_user_id_idx on private.agent_tokens(user_id);

create table private.agent_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  request_hash bytea not null,
  response jsonb not null,
  primary key (user_id, key)
);

create table private.agent_routing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personal_id uuid not null references public.households(id) on delete cascade,
  home_id uuid not null references public.households(id) on delete cascade,
  transfer_id uuid not null references public.households(id) on delete cascade,
  category_map jsonb not null default '{}'::jsonb,
  check (personal_id <> home_id and personal_id <> transfer_id and home_id <> transfer_id)
);

grant select, insert, update on private.agent_tokens, private.agent_routing to household_agent;
grant select, insert on private.agent_requests to household_agent;

create function public.create_agent_token(_label text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  token text := 'ha_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if caller is null then raise sqlstate 'PT401' using message = 'authentication_required'; end if;
  insert into private.agent_tokens(user_id, label, token_hash)
    values (caller, btrim(_label), sha256(convert_to(token, 'UTF8')));
  return token;
end;
$$;

create function public.list_agent_tokens()
returns table (id uuid, label text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.label, t.created_at from private.agent_tokens t
  where t.user_id = auth.uid() and t.revoked_at is null
  order by t.created_at desc, t.id desc;
$$;

create function public.revoke_agent_token(_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update private.agent_tokens t set revoked_at = now()
  where t.id = _id and t.user_id = auth.uid() and t.revoked_at is null;
$$;

create function private.agent_require_group(group_id uuid)
returns void language plpgsql stable set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_members m
      where m.household_id = group_id and m.user_id = auth.uid()) then
    raise sqlstate 'PT404' using message = 'group_not_found';
  end if;
end;
$$;

create function public.save_agent_routing(_personal_id uuid, _home_id uuid, _transfer_id uuid, _category_map jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.agent_require_group(_personal_id);
  perform private.agent_require_group(_home_id);
  perform private.agent_require_group(_transfer_id);
  if jsonb_typeof(_category_map) is distinct from 'object' or pg_column_size(_category_map) > 8192
    or exists (
      select 1 from jsonb_each_text(_category_map) m
      left join public.categories src on src.id = m.key::uuid and src.household_id = _home_id
      left join public.categories dst on dst.id = m.value::uuid and dst.household_id = _transfer_id
      where src.id is null or dst.id is null or dst.is_hidden
        or (dst.type <> 'both' and dst.type <> src.type)
    ) then
    raise sqlstate 'PT422' using message = 'invalid_category_mapping';
  end if;
  insert into private.agent_routing(user_id, personal_id, home_id, transfer_id, category_map)
  values (auth.uid(), _personal_id, _home_id, _transfer_id, _category_map)
  on conflict (user_id) do update set personal_id = excluded.personal_id,
    home_id = excluded.home_id, transfer_id = excluded.transfer_id, category_map = excluded.category_map;
end;
$$;

create function public.get_agent_routing()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('personalId', r.personal_id, 'homeId', r.home_id,
    'transferId', r.transfer_id, 'categoryMap', r.category_map)
  from private.agent_routing r where r.user_id = auth.uid();
$$;

create function private.agent_period_start(group_id uuid, ref date)
returns date language sql stable set search_path = ''
as $$
  select (date_trunc('month', ref::timestamp)
    - case when extract(day from ref) < h.period_start_day then interval '1 month' else interval '0' end
    + (h.period_start_day - 1) * interval '1 day')::date
  from public.households h where h.id = group_id;
$$;

create function private.agent_period_summary(group_id uuid, start_date date)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object('groupId', group_id, 'start', start_date,
    'endExclusive', (start_date + interval '1 month')::date, 'count', count(*),
    'income', coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    'expense', coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    'balance', coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0))
  from public.transactions t
  where t.household_id = group_id and t.date >= start_date and t.date < start_date + interval '1 month';
$$;

create function private.agent_read_transactions(args jsonb)
returns jsonb language plpgsql stable set search_path = ''
as $$
declare
  group_id uuid := (args->>'groupId')::uuid;
  start_date date := (args->>'start')::date;
  end_date date := (args->>'endExclusive')::date;
  category uuid := (args->>'categoryId')::uuid;
  member uuid := (args->>'memberId')::uuid;
  before_date date := (args->>'beforeDate')::date;
  before_id uuid := (args->>'beforeId')::uuid;
  page_size integer := coalesce((args->>'limit')::integer, 100);
  result jsonb;
begin
  perform private.agent_require_group(group_id);
  if args ? 'period' then
    start_date := private.agent_period_start(group_id, ((args->>'period') || '-28')::date);
    end_date := (start_date + interval '1 month')::date;
  end if;
  if start_date is null or end_date is null or end_date <= start_date
    or page_size not between 1 and 100
    or (before_date is null) <> (before_id is null) then
    raise sqlstate 'PT422' using message = 'invalid_range_or_page';
  end if;
  with matching as not materialized (
    select t.* from public.transactions t
    where t.household_id = group_id and t.date >= start_date and t.date < end_date
      and (category is null or t.category_id = category)
      and (member is null or coalesce(t.on_behalf_of, t.created_by) = member)
  ), page as (
    select t.*, c.name as category_name from matching t
    left join public.categories c on c.household_id = group_id and c.id = t.category_id
    where before_date is null or (t.date, t.id) < (before_date, before_id)
    order by t.date desc, t.id desc limit page_size + 1
  ), visible as (
    select * from page order by date desc, id desc limit page_size
  ), totals as (
    select count(*) as count,
      coalesce(sum(amount) filter (where type = 'income'), 0) as income,
      coalesce(sum(amount) filter (where type = 'expense'), 0) as expense
    from matching
  )
  select jsonb_build_object('groupId', group_id, 'start', start_date, 'endExclusive', end_date,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'date', date, 'type', type,
      'amount', amount, 'category', case when category_id is not null
        then jsonb_build_object('id', category_id, 'name', category_name) end,
      'memo', memo, 'memberId', coalesce(on_behalf_of, created_by))
      order by date desc, id desc) from visible), '[]'::jsonb),
    'next', case when (select count(*) from page) > page_size
      then (select jsonb_build_object('date', date, 'id', id) from visible order by date, id limit 1) end,
    'totals', jsonb_build_object('count', count, 'income', income, 'expense', expense, 'balance', income - expense))
  into result from totals;
  return result;
end;
$$;

create function private.agent_validate_transaction(group_id uuid, entry_type public.transaction_type,
  amount integer, category uuid, memo text, member uuid, entry_date date, shared boolean, allow_adjustment boolean)
returns void language plpgsql stable set search_path = ''
as $$
begin
  if amount is null or amount = 0 or (amount < 0 and (not allow_adjustment or shared))
     or entry_date is null or not isfinite(entry_date) or entry_type is null then
    raise sqlstate 'PT422' using message = 'invalid_transaction_amount_or_date';
  end if;
  if length(memo) > 200 then raise sqlstate 'PT422' using message = 'invalid_memo'; end if;
  if category is not null and not exists (
    select 1 from public.categories c where c.id = category and c.household_id = group_id
      and (c.type = 'both' or c.type::text = entry_type::text)
  ) then raise sqlstate 'PT422' using message = 'invalid_category'; end if;
  if member is not null and not exists (
    select 1 from public.household_members m where m.household_id = group_id and m.user_id = member
  ) then raise sqlstate 'PT422' using message = 'invalid_member'; end if;
end;
$$;

create function private.agent_transfer_category(group_id uuid, label text, entry_type public.transaction_type)
returns uuid language sql stable set search_path = ''
as $$
  select c.id from public.categories c where c.household_id = group_id and not c.is_hidden
    and lower(c.name) = lower(label) and (c.type = 'both' or c.type::text = entry_type::text)
  order by (c.type::text = entry_type::text) desc, c.id limit 1;
$$;

create function private.agent_routed_categories(group_id uuid, entry_type public.transaction_type,
  category uuid, routing_input jsonb)
returns table (destination uuid, destination_type public.transaction_type, destination_category uuid)
language plpgsql stable set search_path = ''
as $$
declare
  rules private.agent_routing%rowtype;
  kind text := routing_input->>'target';
  payment text := routing_input->>'payment';
  aeon boolean := payment in ('aeon_pay', 'aeon_card') and entry_type = 'expense';
  original_name text;
begin
  if routing_input is null then return; end if;
  if kind is null or kind not in ('home', 'personal') or payment is null
    or payment not in ('aeon_pay', 'aeon_card', 'other') then
    raise sqlstate 'PT422' using message = 'invalid_routing';
  end if;
  select * into rules from private.agent_routing r where r.user_id = auth.uid();
  if not found or group_id is distinct from (case kind when 'home' then rules.home_id else rules.personal_id end) then
    raise sqlstate 'PT422' using message = 'routing_not_configured_for_group';
  end if;
  if kind = 'personal' and not aeon then return; end if;

  destination := rules.transfer_id;
  perform private.agent_require_group(destination);
  destination_type := entry_type;
  if aeon then
    destination_category := private.agent_transfer_category(destination, 'イオン支払い', 'expense');
    if destination_category is null then
      raise sqlstate 'PT422' using message = 'aeon_expense_category_missing';
    end if;
  elsif category is not null then
    select c.name into original_name from public.categories c where c.id = category;
    if rules.category_map ? category::text then
      destination_category := (rules.category_map->>category::text)::uuid;
      if not exists (select 1 from public.categories c where c.id = destination_category
         and c.household_id = destination and not c.is_hidden
         and (c.type = 'both' or c.type::text = entry_type::text)) then
        raise sqlstate 'PT422' using message = 'invalid_category_mapping';
      end if;
    else
      destination_category := private.agent_transfer_category(destination, original_name, entry_type);
    end if;
    if destination_category is null then
      raise sqlstate 'PT422' using message = 'destination_category_missing';
    end if;
  end if;
  return next;

  if kind = 'personal' then
    destination_type := 'income';
    destination_category := private.agent_transfer_category(destination, 'その他収入', 'income');
    if destination_category is null then
      raise sqlstate 'PT422' using message = 'aeon_income_category_missing';
    end if;
    return next;
  end if;
end;
$$;

create function private.agent_create_transactions(args jsonb)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  group_id uuid := (args->>'groupId')::uuid;
  request_key text := args->>'key';
  hash bytea := sha256(convert_to((args - 'key')::text, 'UTF8'));
  existing private.agent_requests%rowtype;
  entry jsonb;
  entry_type public.transaction_type;
  amount integer;
  entry_date date;
  category uuid;
  memo text;
  member uuid;
  routed record;
  inserted uuid;
  created_ids uuid[] := '{}';
  result jsonb;
begin
  perform private.agent_require_group(group_id);
  if jsonb_typeof(args->'entries') is distinct from 'array' or request_key is null
    or request_key !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise sqlstate 'PT422' using message = 'invalid_entries_or_idempotency_key';
  end if;
  if jsonb_array_length(args->'entries') not between 1 and 100 or pg_column_size(args) > 262144 then
    raise sqlstate 'PT422' using message = 'invalid_batch_size';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('agent:' || caller::text || ':' || request_key, 0));
  select * into existing from private.agent_requests r where r.user_id = caller and r.key = request_key;
  if found then
    if existing.request_hash <> hash then
      raise sqlstate 'PT409' using message = 'idempotency_conflict';
    end if;
    -- A previously routed request can include another group. Recheck access before replay.
    perform private.agent_require_group((p->>'groupId')::uuid)
      from jsonb_array_elements(existing.response->'periods') p;
    return existing.response;
  end if;

  for entry in select value from jsonb_array_elements(args->'entries') loop
    entry_type := (entry->>'type')::public.transaction_type;
    amount := (entry->>'amount')::integer;
    entry_date := (entry->>'date')::date;
    category := (entry->>'categoryId')::uuid;
    memo := entry->>'memo';
    member := (entry->>'memberId')::uuid;

    perform private.agent_validate_transaction(group_id, entry_type, amount, category, memo, member,
      entry_date, false, false);
    insert into public.transactions(household_id, created_by, type, amount, date, category_id, memo, on_behalf_of)
    values (group_id, caller, entry_type, amount, entry_date, category, memo, nullif(member, caller))
    returning id into inserted;
    created_ids := array_append(created_ids, inserted);

    for routed in select * from private.agent_routed_categories(group_id, entry_type, category, entry->'routing') loop
      insert into public.transactions(household_id, created_by, type, amount, date, category_id, memo)
      values (routed.destination, caller, routed.destination_type, amount, entry_date, routed.destination_category, memo)
      returning id into inserted;
      created_ids := array_append(created_ids, inserted);
    end loop;
  end loop;

  select jsonb_build_object('ids', to_jsonb(created_ids), 'periods', jsonb_agg(
    private.agent_period_summary(p.household_id, p.start_date) order by p.household_id, p.start_date))
  into result from (
    select distinct t.household_id, private.agent_period_start(t.household_id, t.date) as start_date
    from public.transactions t where t.id = any(created_ids)
  ) p;

  insert into private.agent_requests(user_id, key, request_hash, response) values (caller, request_key, hash, result);
  return result;
end;
$$;

create function private.agent_change_transaction(operation text, args jsonb)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  tx public.transactions%rowtype;
  tx_id uuid := (args->>'id')::uuid;
  changes jsonb := args->'changes';
  category uuid;
  member uuid;
  new_amount integer;
  entry_date date;
  new_memo text;
begin
  select t.* into tx from public.transactions t
  where t.id = tx_id and t.created_by = auth.uid() for update;
  if not found then raise sqlstate 'PT404' using message = 'transaction_not_found'; end if;

  if operation = 'delete' then
    delete from public.transactions where id = tx.id;
    return jsonb_build_object('id', tx.id, 'period',
      private.agent_period_summary(tx.household_id, private.agent_period_start(tx.household_id, tx.date)));
  end if;

  if jsonb_typeof(changes) is distinct from 'object' or changes = '{}'::jsonb
    or (changes - array['categoryId', 'memberId', 'amount', 'date', 'memo']) <> '{}'::jsonb then
    raise sqlstate 'PT422' using message = 'invalid_changes';
  end if;
  category := case when changes ? 'categoryId' then (changes->>'categoryId')::uuid else tx.category_id end;
  member := case when changes ? 'memberId' then (changes->>'memberId')::uuid else tx.on_behalf_of end;
  new_amount := case when changes ? 'amount' then (changes->>'amount')::integer else tx.amount end;
  entry_date := case when changes ? 'date' then (changes->>'date')::date else tx.date end;
  new_memo := case when changes ? 'memo' then changes->>'memo' else tx.memo end;
  perform private.agent_validate_transaction(tx.household_id, tx.type, new_amount,
    case when changes ? 'categoryId' then category end, new_memo, member,
    entry_date, tx.is_shared, tx.amount < 0);

  update public.transactions set category_id = category, on_behalf_of = nullif(member, tx.created_by),
    amount = new_amount, date = entry_date, memo = new_memo
  where id = tx.id;
  return jsonb_build_object('id', tx.id);
end;
$$;

create function private.agent_dispatch(_operation text, _arguments jsonb)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  group_id uuid;
  result jsonb;
begin
  case _operation
    when 'groups' then
      select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name,
        'periodStartDay', h.period_start_day, 'members', (
          select jsonb_agg(jsonb_build_object('id', m.user_id,
            'name', coalesce(m.display_name, p.display_name, '不明なユーザー')) order by m.joined_at, m.user_id)
          from public.household_members m left join public.profiles p on p.id = m.user_id
          where m.household_id = h.id
        )) order by h.name, h.id), '[]'::jsonb)
      into result from public.households h join public.household_members mine
      on mine.household_id = h.id and mine.user_id = caller;
      return result;
    when 'categories' then
      group_id := (_arguments->>'groupId')::uuid;
      perform private.agent_require_group(group_id);
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
        'type', c.type, 'isPreset', c.is_default, 'isHidden', c.is_hidden)
        order by c.type, c.sort_order, c.name, c.id), '[]'::jsonb)
      into result from public.categories c where c.household_id = group_id;
      return result;
    when 'transactions' then return private.agent_read_transactions(_arguments);
    when 'create' then return private.agent_create_transactions(_arguments);
    when 'update' then return private.agent_change_transaction('update', _arguments);
    when 'delete' then return private.agent_change_transaction('delete', _arguments);
    else raise sqlstate 'PT422' using message = 'invalid_operation';
  end case;
end;
$$;

create function public.agent_api_v1(_token text, _operation text, _arguments jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid;
  result jsonb;
  original_sub text := coalesce(current_setting('request.jwt.claim.sub', true), '');
  original_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  original_claims text := coalesce(current_setting('request.jwt.claims', true), '');
begin
  if _token is null or _token !~ '^ha_[0-9a-f]{64}$' then
    raise sqlstate 'PT401' using message = 'invalid_token';
  end if;
  select t.user_id into caller from private.agent_tokens t
  where t.token_hash = sha256(convert_to(_token, 'UTF8')) and t.revoked_at is null for share;
  if not found then raise sqlstate 'PT401' using message = 'invalid_token'; end if;

  perform set_config('request.jwt.claim.sub', caller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', caller, 'role', 'authenticated')::text, true);
  result := private.agent_dispatch(_operation, _arguments);
  perform set_config('request.jwt.claims', original_claims, true);
  perform set_config('request.jwt.claim.role', original_role, true);
  perform set_config('request.jwt.claim.sub', original_sub, true);
  return result;
end;
$$;

-- Limit execution to the two entry points: app settings for signed-in users, API for Bearer requests.
revoke all on function public.agent_api_v1(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.agent_api_v1(text,text,jsonb) to anon;
revoke all on function public.create_agent_token(text), public.list_agent_tokens(),
  public.revoke_agent_token(uuid), public.save_agent_routing(uuid,uuid,uuid,jsonb),
  public.get_agent_routing() from public, anon, authenticated;
grant execute on function public.create_agent_token(text), public.list_agent_tokens(),
  public.revoke_agent_token(uuid), public.save_agent_routing(uuid,uuid,uuid,jsonb),
  public.get_agent_routing() to authenticated;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on p.pronamespace = n.oid
    where (n.nspname = 'private' and p.proname ~ '^agent_')
       or (n.nspname = 'public' and p.proname in ('agent_api_v1', 'create_agent_token',
         'list_agent_tokens', 'revoke_agent_token', 'save_agent_routing', 'get_agent_routing'))
  loop
    if fn.signature::text like 'private.%' then
      execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
    end if;
    execute format('alter function %s owner to household_agent', fn.signature);
  end loop;
end;
$$;

revoke create on schema public, private from household_agent;
