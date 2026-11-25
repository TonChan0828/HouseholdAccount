create function public.savings_goal_balance(_household_id uuid, _start_date date)
returns bigint
language sql stable security invoker
set search_path = ''
as $$
  select coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)::bigint
  from public.transactions t
  where t.household_id = _household_id and t.date >= _start_date;
$$;

revoke all on function public.savings_goal_balance(uuid, date) from public, anon;
grant execute on function public.savings_goal_balance(uuid, date) to authenticated;
