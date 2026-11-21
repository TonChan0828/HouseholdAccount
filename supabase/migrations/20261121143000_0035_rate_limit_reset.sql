create or replace function public.consume_rate_limit_with_reset(
  _bucket text,
  _key_hash text,
  _limit integer,
  _window_seconds integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'private', 'pg_temp'
as $$
declare
  _now timestamptz := statement_timestamp();
  _count integer;
  _started_at timestamptz;
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
  returning attempt_count, window_started_at into _count, _started_at;

  return jsonb_build_object(
    'allowed', _count <= _limit,
    'resetAt', _started_at + make_interval(secs => _window_seconds)
  );
end;
$$;

revoke execute on function public.consume_rate_limit_with_reset(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit_with_reset(text, text, integer, integer)
  to service_role;

comment on function public.consume_rate_limit_with_reset(text, text, integer, integer) is
  'Atomically consumes one attempt in a fixed-window distributed rate limit.';

-- 既存の認証・招待呼び出し元には従来の型を返す。
create or replace function public.consume_rate_limit(
  _bucket text,
  _key_hash text,
  _limit integer,
  _window_seconds integer
)
returns boolean
language sql
volatile
security invoker
set search_path to ''
as $$
  select (public.consume_rate_limit_with_reset(_bucket, _key_hash, _limit, _window_seconds) ->> 'allowed')::boolean;
$$;
