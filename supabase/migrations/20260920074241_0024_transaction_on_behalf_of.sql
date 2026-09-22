-- 収支の代理入力（名義人）（spec 41）
--
-- transactions.created_by は「実際に入力操作をした人」、新設の on_behalf_of は「名義人」。
-- on_behalf_of が NULL なら入力者本人が名義人であり、既存行はすべて NULL のまま＝従来どおり。
-- 集計上の帰属ユーザーはアプリ側で coalesce(on_behalf_of, created_by) として扱う。

alter table public.transactions
  add column on_behalf_of uuid;

comment on column public.transactions.on_behalf_of is
  '名義人（代理入力）。NULL なら created_by 本人が名義人。集計は coalesce(on_behalf_of, created_by)。';

-- 名義人がそのグループのメンバーであることを DB 側で強制する。
-- household_members には 0001 の unique (household_id, user_id) があるため参照先にできる。
-- 既定の MATCH SIMPLE では「いずれかの列が NULL なら検査をスキップ」するため、
-- on_behalf_of が NULL の行（既存全行・通常入力）は検査対象外になる。
--
-- 参照先の削除時の動作は NO ACTION（既定）のままにし、後述の BEFORE DELETE トリガーで
-- 先に on_behalf_of を NULL に戻す。household_id が NOT NULL なので列リスト無しの
-- ON DELETE SET NULL は使えず、列リスト付きの構文（PostgreSQL 15 以降）に頼るより、
-- 挙動が読みやすく DB バージョンに依存しないトリガー方式を採る。
alter table public.transactions
  add constraint transactions_household_on_behalf_fkey
  foreign key (household_id, on_behalf_of)
  references public.household_members (household_id, user_id)
  on update cascade;

-- 複合 FK の子側には自動でインデックスが作られない。脱退時の参照解決と、
-- 「帰属ユーザー = 特定メンバー」の絞り込み（PostgREST の or 句）の両方で効く。
create index transactions_household_on_behalf_idx
  on public.transactions (household_id, on_behalf_of)
  where on_behalf_of is not null;

-- メンバーが脱退・除外・退会した時点で、その人を名義人にしている収支の名義を外す。
-- （収支自体は消さず、帰属が入力者へフォールバックする）
-- 参照整合性チェックより先に解消したいので BEFORE DELETE で実行する。
create or replace function private.clear_departed_member_on_behalf_of()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  update public.transactions
  set on_behalf_of = null
  where household_id = old.household_id
    and on_behalf_of = old.user_id;
  return old;
end;
$$;

revoke execute on function private.clear_departed_member_on_behalf_of() from public;
revoke execute on function private.clear_departed_member_on_behalf_of() from anon;
revoke execute on function private.clear_departed_member_on_behalf_of() from authenticated;

create trigger household_member_clear_on_behalf_of
  before delete on public.household_members
  for each row execute function private.clear_departed_member_on_behalf_of();

-- UPDATE / DELETE は入力者（created_by）に加えて名義人（on_behalf_of）にも許可する。
-- 現在も対象 household のメンバーであることは 0023 と同様に必須（household_id の移動も防ぐ）。
-- INSERT ポリシーは変更しない（「入力者は必ず自分」は不変条件として維持し、
-- 名義人の妥当性は上の複合 FK が担保する）。
drop policy if exists transactions_update_creator on public.transactions;
create policy transactions_update_creator_or_subject on public.transactions
  for update
  using (
    (
      created_by = (select auth.uid())
      or on_behalf_of = (select auth.uid())
    )
    and private.is_household_member(household_id)
  )
  with check (
    (
      created_by = (select auth.uid())
      or on_behalf_of = (select auth.uid())
    )
    and private.is_household_member(household_id)
  );

drop policy if exists transactions_delete_creator on public.transactions;
create policy transactions_delete_creator_or_subject on public.transactions
  for delete
  using (
    (
      created_by = (select auth.uid())
      or on_behalf_of = (select auth.uid())
    )
    and private.is_household_member(household_id)
  );

-- UPDATE の条件を OR に緩めたことで、名義人が created_by を他人に書き換えれば
-- USING も WITH CHECK も通ってしまう（＝入力者のなりすまし）。
-- created_by と household_id を不変にして塞ぐ。
create or replace function private.freeze_transaction_identity()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.freeze_transaction_identity() from public;
revoke execute on function private.freeze_transaction_identity() from anon;
revoke execute on function private.freeze_transaction_identity() from authenticated;

create trigger transactions_freeze_identity
  before update on public.transactions
  for each row execute function private.freeze_transaction_identity();
