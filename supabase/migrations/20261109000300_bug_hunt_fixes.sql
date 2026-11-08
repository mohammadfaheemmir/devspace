-- Database fixes from the bug hunt (2026-11-09).
--
-- 1. Unassign a member's tasks when they leave or are removed.
-- 2. Stop expired invitations from blocking re-invites, and make expiry
--    actually saved when someone tries to accept an expired invitation.
-- 3. Count tasks per project in the database (the dashboard previously
--    fetched every task row, which Supabase caps at 1,000).
-- 4. Live updates for project members.
--
-- Applied to the live project "devspace" on 2026-11-09 and verified, including
-- a scenario test run inside a transaction that was always rolled back.


-- ---------------------------------------------------------------------
-- 1. Unassign tasks when a member leaves or is removed
--
-- The task UPDATE policy requires the assignee to be a project member, so a
-- task assigned to someone who left could no longer be changed at all
-- (status, title, due date...). Clear the assignee when the membership ends.
-- ---------------------------------------------------------------------
create or replace function public.unassign_departed_member_tasks()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
    -- When the whole project is being deleted, its tasks go with it. Skip:
    -- unassigning would log activity for a project that no longer exists,
    -- which would make the project deletion fail.
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old;
    end if;

    update public.tasks
    set assignee_id = null
    where project_id = old.project_id
      and assignee_id = old.user_id;

    return old;
end;
$function$;

create trigger unassign_tasks_on_member_removal
    after delete on public.project_members
    for each row execute function public.unassign_departed_member_tasks();

-- One-time cleanup of tasks already assigned to non-members (0 at the time
-- of writing).
update public.tasks t
set assignee_id = null
where t.assignee_id is not null
  and not exists (
      select 1 from public.project_members m
      where m.project_id = t.project_id and m.user_id = t.assignee_id
  );


-- ---------------------------------------------------------------------
-- 2. Expired invitations
--
-- Only one *pending* invitation per project and email is allowed. Expired
-- invitations stayed 'pending' forever (invitees cannot see them, so they
-- never trigger the expiry), which blocked re-inviting that person.
-- ---------------------------------------------------------------------

-- Before a new invitation is created, retire expired pending ones for the
-- same project and email, so they no longer count as pending.
create or replace function public.expire_stale_project_invitations()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
    update public.project_invitations
    set status = 'expired'
    where project_id = new.project_id
      and lower(invited_email) = lower(new.invited_email)
      and status = 'pending'
      and expires_at <= now();

    return new;
end;
$function$;

create trigger expire_stale_invitations_before_insert
    before insert on public.project_invitations
    for each row execute function public.expire_stale_project_invitations();

-- accept_project_invitation used to set status = 'expired' and then RAISE,
-- which rolled the update back, so the expiry was never saved. It now saves
-- the expiry and returns NULL; the app shows "This invitation has expired".
-- Everything else is unchanged.
CREATE OR REPLACE FUNCTION public.accept_project_invitation(invitation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    invitation_record RECORD;
    current_user_email TEXT;
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;

    -- Get the authenticated user's email
    SELECT email
    INTO current_user_email
    FROM auth.users
    WHERE id = auth.uid();

    -- Lock and retrieve the invitation
    SELECT *
    INTO invitation_record
    FROM public.project_invitations
    WHERE id = invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found.';
    END IF;

    -- Verify invitation belongs to this user
    IF LOWER(invitation_record.invited_email)
       <> LOWER(current_user_email) THEN
        RAISE EXCEPTION 'This invitation belongs to another email address.';
    END IF;

    -- Verify invitation is pending
    IF invitation_record.status <> 'pending' THEN
        RAISE EXCEPTION 'This invitation is no longer pending.';
    END IF;

    -- Check expiration: save the expiry (no RAISE, which would undo it)
    -- and return NULL so the caller can report it.
    IF invitation_record.expires_at <= NOW() THEN
        UPDATE public.project_invitations
        SET status = 'expired'
        WHERE id = invitation_id;

        RETURN NULL;
    END IF;

    -- Add user to project as a member
    INSERT INTO public.project_members (
        project_id,
        user_id,
        role
    )
    VALUES (
        invitation_record.project_id,
        auth.uid(),
        'member'
    )
    ON CONFLICT (project_id, user_id)
    DO NOTHING;

    -- Mark invitation as accepted
    UPDATE public.project_invitations
    SET status = 'accepted'
    WHERE id = invitation_id;

    RETURN invitation_record.project_id;
END;
$function$;

-- One-time cleanup (0 at the time of writing).
update public.project_invitations
set status = 'expired'
where status = 'pending' and expires_at <= now();


-- ---------------------------------------------------------------------
-- 3. Task counts per project, computed in the database
--
-- SECURITY INVOKER: Row Level Security still applies, so users only get
-- counts for projects they can see.
-- ---------------------------------------------------------------------
create or replace function public.get_project_task_counts(p_project_ids uuid[])
returns table (project_id uuid, total bigint, done bigint, in_progress bigint)
language sql
stable
security invoker
set search_path to ''
as $function$
    select
        t.project_id,
        count(*) as total,
        count(*) filter (where t.status = 'done') as done,
        count(*) filter (where t.status = 'in_progress') as in_progress
    from public.tasks t
    where t.project_id = any(p_project_ids)
    group by t.project_id;
$function$;

revoke execute on function public.get_project_task_counts(uuid[]) from public, anon;
grant execute on function public.get_project_task_counts(uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Live updates for project members (joins, removals, role changes)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.project_members;
