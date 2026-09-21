-- 認証・招待操作を複数インスタンス間で共有して制限する原子的カウンター。
-- キーはアプリ側で HMAC 化し、IP アドレスやメールアドレスを保存しない。

create table private.rate_limits (
  bucket text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  primary key (bucket, key_hash)
);
create index rate_limits_window_started_at_idx
  on private.rate_limits (window_started_at);

revoke all on table private.rate_limits from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  _bucket text,
  _key_hash text,
  _limit integer,
  _window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'private', 'pg_temp'
as $$
declare
  _now timestamptz := statement_timestamp();
  _count integer;
begin
  if _bucket !~ '^[a-z][a-z0-9_.-]{0,63}$'
    or _key_hash !~ '^[0-9a-f]{64}$'
    or _limit < 1 or _limit > 1000
    or _window_seconds < 1 or _window_seconds > 86400
  then
    raise exception 'invalid rate-limit arguments';
  end if;

  -- 常時 DELETE してホットパスを重くしないよう、約 1% の呼び出しで期限切れを回収する。
  if random() < 0.01 then
    delete from private.rate_limits
    where window_started_at < _now - interval '7 days';
  end if;

  insert into private.rate_limits as rate_limit (
    bucket,
    key_hash,
    window_started_at,
    attempt_count
  ) values (
    _bucket,
    _key_hash,
    _now,
    1
  )
  on conflict (bucket, key_hash) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= _now - make_interval(secs => _window_seconds)
        then _now
      else rate_limit.window_started_at
    end,
    attempt_count = case
      when rate_limit.window_started_at <= _now - make_interval(secs => _window_seconds)
        then 1
      else rate_limit.attempt_count + 1
    end
  returning attempt_count into _count;

  return _count <= _limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Atomically consumes one attempt in a fixed-window distributed rate limit.';
