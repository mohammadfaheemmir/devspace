-- Let an invited user decline a pending invitation.
--
-- Invitees can only SELECT their invitations (there is no UPDATE policy),
-- so declining goes through this function, which mirrors the checks in
-- accept_project_invitation(): signed in, invitation addressed to the
-- caller's email, and still pending.
--
-- Applied to the live project "devspace" on 2026-11-08 (outside the CLI's
-- migration history; see the README for `supabase migration repair`).

create or replace function public.decline_project_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    invitation_record record;
    current_user_email text;
begin
    if auth.uid() is null then
        raise exception 'You must be logged in.';
    end if;

    select email
    into current_user_email
    from auth.users
    where id = auth.uid();

    select *
    into invitation_record
    from public.project_invitations
    where id = invitation_id
    for update;

    if not found then
        raise exception 'Invitation not found.';
    end if;

    if lower(invitation_record.invited_email) <> lower(current_user_email) then
        raise exception 'This invitation belongs to another email address.';
    end if;

    if invitation_record.status <> 'pending' then
        raise exception 'This invitation is no longer pending.';
    end if;

    update public.project_invitations
    set status = 'declined'
    where id = invitation_id;
end;
$function$;

-- Only signed-in users may call it.
revoke execute on function public.decline_project_invitation(uuid) from public, anon;
grant execute on function public.decline_project_invitation(uuid) to authenticated;
