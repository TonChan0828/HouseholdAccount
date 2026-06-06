-- 家計簿アプリ 初期スキーマ
-- households / household_members / categories / transactions

-- 列挙型 ----------------------------------------------------------------------
create type public.member_role as enum ('owner', 'member');
create type public.transaction_type as enum ('income', 'expense');
create type public.category_type as enum ('income', 'expense', 'both');

-- households ------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- household_members -----------------------------------------------------------
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_id_idx on public.household_members (household_id);

-- categories ------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text,
  icon text,
  type public.category_type not null default 'both',
  is_default boolean not null default false
);

create index categories_household_id_idx on public.categories (household_id);

-- transactions ----------------------------------------------------------------
-- 金額は円建てのため整数（小数なし）
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount >= 0),
  type public.transaction_type not null,
  category_id uuid references public.categories (id) on delete set null,
  date date not null,
  memo text,
  created_at timestamptz not null default now()
);

create index transactions_household_date_idx on public.transactions (household_id, date desc);
create index transactions_created_by_idx on public.transactions (created_by);
create index transactions_category_id_idx on public.transactions (category_id);
