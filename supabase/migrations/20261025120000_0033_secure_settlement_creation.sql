-- Phase 1: add the trusted creation API before deploying the new application.
-- The snapshot is computed from one database snapshot, never supplied by a client.
create or replace function public.create_settlement(_household_id uuid, _ref date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_start_day integer;
  v_start date;
  v_end date;
  v_ids uuid[];
  v_names text[];
  v_paid bigint[];
  v_balances bigint[] := '{}';
  v_remaining bigint[];
  v_total bigint;
  v_n integer;
  v_deficit integer;
  v_share double precision;
  v_raw double precision[] := '{}';
  v_index integer;
  v_rows jsonb := '[]';
  v_transfers jsonb := '[]';
  v_creditor integer;
  v_debtor integer;
  v_amount bigint;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if _ref is null or not isfinite(_ref) or _ref < date '0001-01-01' or _ref > date '9998-12-31' then
    raise exception 'invalid reference date' using errcode = '22023';
  end if;

  -- Keep the caller a member until the insert commits, even during concurrent removal.
  perform 1 from public.household_members
    where household_id = _household_id and user_id = v_uid for share;
  if not found then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  select period_start_day into v_start_day from public.households
    where id = _household_id for share;
  v_start := date_trunc('month', _ref)::date + (v_start_day - 1);
  if _ref < v_start then
    v_start := (date_trunc('month', _ref) - interval '1 month')::date + (v_start_day - 1);
  end if;
  v_end := (v_start + interval '1 month')::date;

  with members as materialized (
    select m.user_id, m.joined_at,
      coalesce(m.display_name, p.display_name, '不明なユーザー') as name
    from public.household_members m
    left join public.profiles p on p.id = m.user_id
    where m.household_id = _household_id
  ), paid as (
    select coalesce(t.on_behalf_of, t.created_by) as user_id, sum(t.amount)::bigint as amount
    from public.transactions t
    where t.household_id = _household_id and t.date >= v_start and t.date < v_end
      and t.type = 'expense' and t.is_shared
    group by coalesce(t.on_behalf_of, t.created_by)
  )
  select array_agg(m.user_id order by m.joined_at, m.user_id),
    array_agg(m.name order by m.joined_at, m.user_id),
    array_agg(coalesce(p.amount, 0) order by m.joined_at, m.user_id),
    coalesce(sum(p.amount), 0)::bigint
  into v_ids, v_names, v_paid, v_total
  from members m left join paid p using (user_id);

  v_n := coalesce(cardinality(v_ids), 0);
  if v_n < 2 then
    raise exception 'settlement_members_required' using errcode = 'P0001';
  end if;
  if v_total = 0 then
    raise exception 'settlement_no_expenses' using errcode = 'P0001';
  end if;
  if v_total > 9007199254740991 then
    raise exception 'settlement exceeds safe integer range' using errcode = '22003';
  end if;
  -- Match the existing JavaScript IEEE-754 calculation, including fractional
  -- remainder ordering. Exact numeric arithmetic changes existing one-yen ties.
  v_share := v_total::double precision / v_n;
  for i in 1..v_n loop
    v_raw := array_append(v_raw, v_paid[i]::double precision - v_share);
    v_balances := array_append(v_balances, floor(v_raw[i])::bigint);
  end loop;
  select (-sum(b))::integer into v_deficit from unnest(v_balances) b;
  for v_index in
    select i from generate_subscripts(v_raw, 1) s(i)
    order by (v_raw[i] - floor(v_raw[i])) desc, i limit v_deficit
  loop
    v_balances[v_index] := v_balances[v_index] + 1;
  end loop;
  for i in 1..v_n loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'userId', v_ids[i], 'displayName', v_names[i], 'paid', v_paid[i], 'balance', v_balances[i]
    ));
  end loop;
  v_remaining := v_balances;
  -- Keep the original sorted creditor/debtor order while reducing remaining balances.
  -- Re-sorting after each payment would change the existing transfer suggestions.
  for v_debtor in
    select i from generate_subscripts(v_balances, 1) s(i)
    where v_balances[i] < 0 order by v_balances[i], i
  loop
    for v_creditor in
      select i from generate_subscripts(v_balances, 1) s(i)
      where v_balances[i] > 0 order by v_balances[i] desc, i
    loop
      exit when v_remaining[v_debtor] = 0;
      if v_remaining[v_creditor] <= 0 then continue; end if;
      v_amount := least(-v_remaining[v_debtor], v_remaining[v_creditor]);
      v_transfers := v_transfers || jsonb_build_array(jsonb_build_object(
        'fromUserId', v_ids[v_debtor], 'toUserId', v_ids[v_creditor], 'amount', v_amount
      ));
      v_remaining[v_debtor] := v_remaining[v_debtor] + v_amount;
      v_remaining[v_creditor] := v_remaining[v_creditor] - v_amount;
    end loop;
  end loop;

  insert into public.settlements (household_id, period_start, settled_by, snapshot)
  values (_household_id, v_start, v_uid, jsonb_build_object(
    'total', v_total, 'perMember', floor(v_share + 0.5)::bigint,
    'rows', v_rows, 'transfers', v_transfers
  )) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_settlement(uuid, date) from public, anon;
grant execute on function public.create_settlement(uuid, date) to authenticated;
