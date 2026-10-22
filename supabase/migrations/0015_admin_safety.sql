-- 0015: admin safety (backlog item 3a).
--
-- Replaces the role guard from 0001 so that:
--   1. A signed-in person can still never change their own role, and only an
--      admin can change anyone's role (unchanged).
--   2. The server itself (service-role key) and the SQL editor can change
--      roles. Before this, the guard also blocked the server, so deleting or
--      restoring a CREATOR account failed (deleting resets the role to viewer)
--      and the new Admins page could not promote anyone.
--   3. The last admin can never be removed, from anywhere. Accounts waiting
--      out their deletion window don't count as admins.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- It is safe to run twice.

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Signed-in callers must be an active admin. auth.uid() is null for the
    -- server's service-role key and for the SQL editor; both are trusted.
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.account_deleted_at is null
    ) then
      raise exception 'Only an admin can change a user role';
    end if;

    -- Never leave the app without an admin.
    if old.role = 'admin' and new.role <> 'admin' and not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.id <> old.id and p.account_deleted_at is null
    ) then
      raise exception 'Can''t remove the last admin. Make someone else an admin first.';
    end if;
  end if;
  return new;
end;
$$;

-- The trigger from 0001 already calls this function; recreate it in case it
-- was dropped.
drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();
