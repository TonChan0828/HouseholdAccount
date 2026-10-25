-- Phase 2: apply only after the application uses create_settlement().
-- Existing snapshots, read permissions and creator-only cancellation are preserved.
drop policy if exists settlements_insert_member on public.settlements;
revoke insert, update on public.settlements from anon, authenticated;
