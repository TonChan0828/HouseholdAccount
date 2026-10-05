-- 一覧表示のために期間全体の明細を転送せず、RLSの範囲内で日計を集計する。
create or replace function public.transaction_daily_summary(
  _household_id uuid,
  _start date,
  _end date,
  _type public.transaction_type default null,
  _category_id uuid default null,
  _member_id uuid default null,
  _memo_pattern text default null,
  _min_amount bigint default null,
  _max_amount bigint default null
)
returns table (date date, income bigint, expense bigint, count bigint)
language sql stable security invoker
set search_path = ''
as $$
  select t.date,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint,
    count(*)
  from public.transactions t
  where t.household_id = _household_id
    and t.date >= _start and t.date < _end
    and (_type is null or t.type = _type)
    and (_category_id is null or t.category_id = _category_id)
    and (_member_id is null or coalesce(t.on_behalf_of, t.created_by) = _member_id)
    and (_memo_pattern is null or t.memo ilike _memo_pattern)
    and (_min_amount is null or t.amount >= _min_amount)
    and (_max_amount is null or t.amount <= _max_amount)
  group by t.date
  order by t.date;
$$;

revoke all on function public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint) from public, anon;
grant execute on function public.transaction_daily_summary(uuid,date,date,public.transaction_type,uuid,uuid,text,bigint,bigint) to authenticated;

create index transactions_household_page_idx
  on public.transactions (household_id, date desc, created_at desc, id desc);
