-- The invitation token is a 192-bit random capability. Keep the result to
-- status and the group name, and reject malformed tokens before any lookup.
create or replace function public.invitation_preview(_token text)
returns table (household_name text, status text)
language sql stable security definer set search_path = ''
as $$
  select h.name,
    case
      when i.id is null then 'not_found'
      when i.expires_at < now() then 'expired'
      when i.uses_count >= i.max_uses then 'exhausted'
      else 'valid'
    end
  from (select 1) as request
  left join public.household_invitations i
    on _token ~ '^[A-Za-z0-9_-]{32}$' and i.token = _token
  left join public.households h on h.id = i.household_id;
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
