begin;
select plan(4);

insert into auth.users (id, aud, role, email) values
('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'goal-a@example.test'),
('00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 'goal-b@example.test');
insert into public.households (id, name, created_by) values
('85000000-0000-0000-0000-000000000001', 'Goal A', '00000000-0000-0000-0000-0000000000d1'),
('85000000-0000-0000-0000-000000000002', 'Goal B', '00000000-0000-0000-0000-0000000000d2');

insert into public.transactions (household_id, created_by, amount, type, date)
select '85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 100, 'income', '2026-10-25'
from generate_series(1, 1001);
insert into public.transactions (household_id, created_by, amount, type, date) values
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 999999, 'expense', '2026-10-24'),
('85000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 37, 'expense', '2026-10-26'),
('85000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d2', 888888, 'income', '2026-10-25');

select ok(not has_function_privilege('anon', 'public.savings_goal_balance(uuid,date)', 'execute'), 'anonymous callers cannot read balances');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
set local role authenticated;
select is(public.savings_goal_balance('85000000-0000-0000-0000-000000000001', '2026-10-25'), 100063::bigint, 'sums every in-group row from the start date');
select is(public.savings_goal_balance('85000000-0000-0000-0000-000000000002', '2026-10-25'), 0::bigint, 'RLS hides transactions in other households');
select is(public.savings_goal_balance('85000000-0000-0000-0000-000000000001', '2026-10-27'), 0::bigint, 'empty period has a zero balance');

reset role;
select * from finish();
rollback;
