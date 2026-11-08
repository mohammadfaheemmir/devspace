-- DevSpace security hardening
--
-- Fixes found while reviewing the baseline schema (20261108000000).
-- Applied to the live project "devspace" on 2026-11-08 (as one transaction,
-- outside the CLI's migration history). Before `supabase db push`, run:
--   npx supabase migration repair --status applied 20261108000100


-- ----------------------------------------------------------------------
-- 1. Admins could add ANY user to a project with ANY role, including
--    'owner'. An admin could add a second account of their own as owner
--    and then delete the project, or add people who were never invited.
--
--    The app never inserts into project_members directly: members join
--    through accept_project_invitation() and owners are added by the
--    add_project_owner() trigger. Both are SECURITY DEFINER functions
--    owned by postgres (which bypasses RLS), so this policy is not needed.
-- ----------------------------------------------------------------------

drop policy if exists "Admins can add project members" on public.project_members;


-- ----------------------------------------------------------------------
-- 2. Any project member could change a task's created_by to themselves
--    and then delete it, bypassing "task creators and admins can delete
--    tasks". They could also move a task into another project.
--    Make created_by and project_id read-only after creation.
-- ----------------------------------------------------------------------

create or replace function public.prevent_task_identity_changes()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
    if new.created_by is distinct from old.created_by then
        raise exception 'A task''s creator cannot be changed.';
    end if;

    if new.project_id is distinct from old.project_id then
        raise exception 'A task cannot be moved to another project.';
    end if;

    return new;
end;
$function$;

drop trigger if exists protect_task_identity on public.tasks;

create trigger protect_task_identity
    before update of created_by, project_id on public.tasks
    for each row execute function public.prevent_task_identity_changes();


-- ----------------------------------------------------------------------
-- 3. projects.owner_id could be changed by any admin, and it was never
--    updated by ownership transfers, so it could disagree with
--    project_members (which is what the access rules actually use).
--    Sync it once, keep it in sync on transfer, and block other changes.
-- ----------------------------------------------------------------------

-- One-time sync for projects whose ownership was already transferred.
update public.projects p
set owner_id = pm.user_id
from public.project_members pm
where pm.project_id = p.id
  and pm.role = 'owner'
  and p.owner_id is distinct from pm.user_id;

create or replace function public.prevent_project_owner_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
    if new.id is distinct from old.id then
        raise exception 'A project''s ID cannot be changed.';
    end if;

    -- owner_id may only change inside transfer_project_ownership(),
    -- which records an authorization for the current transaction.
    if new.owner_id is distinct from old.owner_id and not exists (
        select 1
        from private.project_transfer_authorizations
        where transaction_id = txid_current()
          and project_id = old.id
          and user_id = new.owner_id
          and authorized_by = (select auth.uid())
    ) then
        raise exception 'Use the ownership transfer function to change the project owner.';
    end if;

    return new;
end;
$function$;

drop trigger if exists protect_project_owner on public.projects;

create trigger protect_project_owner
    before update of id, owner_id on public.projects
    for each row execute function public.prevent_project_owner_changes();

-- Same as the live function, plus one step that updates projects.owner_id.
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(p_project_id uuid, p_new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_owner_id uuid;
    new_owner_role text;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;

    IF p_new_owner_id = (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'You are already the project owner.';
    END IF;

    -- Lock all membership rows for this project.
    PERFORM 1
    FROM public.project_members
    WHERE project_id = p_project_id
    ORDER BY user_id
    FOR UPDATE;

    -- Confirm that the caller is the current owner.
    SELECT user_id
    INTO current_owner_id
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = (SELECT auth.uid())
      AND role = 'owner';

    IF current_owner_id IS NULL THEN
        RAISE EXCEPTION
            'Only the current project owner can transfer ownership.';
    END IF;

    -- Confirm that the new owner is already a member.
    SELECT role
    INTO new_owner_role
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_new_owner_id;

    IF new_owner_role IS NULL THEN
        RAISE EXCEPTION
            'The new owner must already be a project member.';
    END IF;

    -- Create temporary authorization for these two role changes.
    INSERT INTO private.project_transfer_authorizations (
        transaction_id,
        project_id,
        user_id,
        authorized_by
    )
    VALUES
        (
            txid_current(),
            p_project_id,
            current_owner_id,
            (SELECT auth.uid())
        ),
        (
            txid_current(),
            p_project_id,
            p_new_owner_id,
            (SELECT auth.uid())
        );

    -- Previous owner becomes admin.
    UPDATE public.project_members
    SET role = 'admin'
    WHERE project_id = p_project_id
      AND user_id = current_owner_id;

    -- Selected member becomes owner.
    UPDATE public.project_members
    SET role = 'owner'
    WHERE project_id = p_project_id
      AND user_id = p_new_owner_id;

    -- NEW: keep projects.owner_id in sync with the owner membership.
    UPDATE public.projects
    SET owner_id = p_new_owner_id,
        updated_at = NOW()
    WHERE id = p_project_id;

    -- Remove temporary authorization records.
    DELETE FROM private.project_transfer_authorizations
    WHERE transaction_id = txid_current()
      AND project_id = p_project_id
      AND authorized_by = (SELECT auth.uid());

END;
$function$;


-- ----------------------------------------------------------------------
-- 4. Remove a leftover debugging function that anyone (even signed-out
--    visitors) could call through the API.
-- ----------------------------------------------------------------------

drop function if exists public.debug_auth_context();
