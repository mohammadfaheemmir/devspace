-- DevSpace baseline schema
--
-- Reconstructed on 2026-11-08 from the live Supabase project "devspace"
-- (ref hoffodsvcnyjnqrimtja) using read-only catalog queries. It recreates the
-- public schema, the private ownership-transfer table, functions, triggers,
-- Row Level Security policies, the avatars storage bucket and Realtime setup.
--
-- The live database already contains all of this. Before using
-- `supabase db push` against it, mark this migration as applied:
--   npx supabase migration repair --status applied 20261108000000 20261108000100 20261108000200

-- ======================================================================
-- Private schema (not exposed through the API)
-- ======================================================================

create schema if not exists private;

create table private.project_transfer_authorizations (
    transaction_id bigint not null,
    project_id uuid not null,
    user_id uuid not null,
    authorized_by uuid not null,
    constraint project_transfer_authorizations_pkey primary key (transaction_id, project_id, user_id)
);

alter table private.project_transfer_authorizations enable row level security;

-- ======================================================================
-- Tables
-- ======================================================================

create table public.profiles (
    id uuid not null,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.projects (
    id uuid default gen_random_uuid() not null,
    name text not null,
    description text,
    owner_id uuid not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.project_members (
    id uuid default gen_random_uuid() not null,
    project_id uuid not null,
    user_id uuid not null,
    role text default 'member'::text not null,
    joined_at timestamp with time zone default now()
);

create table public.tasks (
    id uuid default gen_random_uuid() not null,
    project_id uuid not null,
    title text not null,
    description text,
    status text default 'todo'::text not null,
    priority text default 'medium'::text not null,
    assignee_id uuid,
    created_by uuid not null,
    due_date date,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.comments (
    id uuid default gen_random_uuid() not null,
    task_id uuid not null,
    project_id uuid not null,
    author_id uuid not null,
    content text not null,
    created_at timestamp with time zone default now()
);

create table public.project_invitations (
    id uuid default gen_random_uuid() not null,
    project_id uuid not null,
    invited_email text not null,
    invited_by uuid not null,
    status text default 'pending'::text not null,
    created_at timestamp with time zone default now(),
    expires_at timestamp with time zone default (now() + '7 days'::interval)
);

create table public.project_activities (
    id uuid default gen_random_uuid() not null,
    project_id uuid not null,
    actor_id uuid,
    task_id uuid,
    activity_type text not null,
    description text not null,
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null
);

create table public.notifications (
    id uuid default gen_random_uuid() not null,
    user_id uuid not null,
    actor_id uuid,
    project_id uuid,
    task_id uuid,
    type text not null,
    title text not null,
    message text,
    is_read boolean default false not null,
    created_at timestamp with time zone default now() not null
);


-- ======================================================================
-- Constraints
-- ======================================================================

alter table public.comments add constraint comments_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.project_activities add constraint project_activities_pkey PRIMARY KEY (id);
alter table public.project_invitations add constraint project_invitations_pkey PRIMARY KEY (id);
alter table public.project_members add constraint project_members_pkey PRIMARY KEY (id);
alter table public.projects add constraint projects_pkey PRIMARY KEY (id);
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);

alter table public.project_members add constraint project_members_project_id_user_id_key UNIQUE (project_id, user_id);
alter table public.tasks add constraint tasks_id_project_id_key UNIQUE (id, project_id);

alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['task_assigned'::text, 'task_updated'::text, 'new_comment'::text, 'project_invitation'::text])));
alter table public.project_activities add constraint project_activities_activity_type_check CHECK ((activity_type = ANY (ARRAY['project_created'::text, 'task_created'::text, 'task_assigned'::text, 'task_unassigned'::text, 'task_status_changed'::text, 'comment_added'::text, 'member_invited'::text, 'member_joined'::text])));
alter table public.project_invitations add constraint project_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'expired'::text])));
alter table public.project_members add constraint project_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])));
alter table public.tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])));

alter table public.comments add constraint comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id);
alter table public.comments add constraint comments_task_id_project_id_fkey FOREIGN KEY (task_id, project_id) REFERENCES tasks(id, project_id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.project_activities add constraint project_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.project_activities add constraint project_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.project_activities add constraint project_activities_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
alter table public.project_invitations add constraint project_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.project_invitations add constraint project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.project_members add constraint project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.project_members add constraint project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.projects add constraint projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);
alter table public.tasks add constraint tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.tasks add constraint tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


-- ======================================================================
-- Indexes
-- ======================================================================

CREATE INDEX idx_comments_task ON public.comments USING btree (task_id);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX project_activities_actor_idx ON public.project_activities USING btree (actor_id);
CREATE INDEX project_activities_project_created_idx ON public.project_activities USING btree (project_id, created_at DESC);
CREATE UNIQUE INDEX unique_pending_project_invitation ON public.project_invitations USING btree (project_id, lower(invited_email)) WHERE (status = 'pending'::text);
CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id);
CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee_id);
CREATE INDEX idx_tasks_project ON public.tasks USING btree (project_id);

-- ======================================================================
-- Functions
-- ======================================================================

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

    -- Check expiration
    IF invitation_record.expires_at <= NOW() THEN
        UPDATE public.project_invitations
        SET status = 'expired'
        WHERE id = invitation_id;

        RAISE EXCEPTION 'This invitation has expired.';
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

CREATE OR REPLACE FUNCTION public.add_project_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        target_user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.project_members AS mine
            JOIN public.project_members AS theirs
              ON mine.project_id = theirs.project_id
            WHERE mine.user_id = (SELECT auth.uid())
              AND theirs.user_id = target_user_id
        );
$function$;

CREATE OR REPLACE FUNCTION public.debug_auth_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role()
  );
$function$;

CREATE OR REPLACE FUNCTION public.enforce_project_member_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    caller_is_owner boolean;
    transfer_authorized boolean;
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN

        -- Check authorization for this exact transfer.
        SELECT EXISTS (
            SELECT 1
            FROM private.project_transfer_authorizations
            WHERE transaction_id = txid_current()
              AND project_id = OLD.project_id
              AND user_id = OLD.user_id
              AND authorized_by = (SELECT auth.uid())
        )
        INTO transfer_authorized;

        -- Allow only the two role changes required for ownership transfer.
        IF transfer_authorized THEN

            IF NOT (
                (OLD.role = 'owner' AND NEW.role = 'admin')
                OR
                (OLD.role IN ('member', 'admin') AND NEW.role = 'owner')
            ) THEN
                RAISE EXCEPTION
                    'Invalid ownership transfer role change.';
            END IF;

            RETURN NEW;
        END IF;

        -- Check whether the caller is the current project owner.
        SELECT EXISTS (
            SELECT 1
            FROM public.project_members
            WHERE project_id = OLD.project_id
              AND user_id = (SELECT auth.uid())
              AND role = 'owner'
        )
        INTO caller_is_owner;

        -- All ordinary role changes must be made by the owner.
        IF NOT caller_is_owner THEN
            RAISE EXCEPTION
                'Only the project owner can change member roles.';
        END IF;

        -- Ownership changes must use the transfer RPC.
        IF OLD.role = 'owner' OR NEW.role = 'owner' THEN
            RAISE EXCEPTION
                'Ownership changes must use the ownership transfer function.';
        END IF;

        -- Only member and admin roles can be changed normally.
        IF OLD.role NOT IN ('member', 'admin')
           OR NEW.role NOT IN ('member', 'admin') THEN
            RAISE EXCEPTION 'Invalid project member role change.';
        END IF;

    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_project_invitations()
 RETURNS TABLE(invitation_id uuid, project_id uuid, project_name text, invited_email text, created_at timestamp with time zone, expires_at timestamp with time zone, invited_by_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        pi.id,
        pi.project_id,
        p.name,
        pi.invited_email,
        pi.created_at,
        pi.expires_at,
        COALESCE(pr.full_name, 'Project admin')
    FROM public.project_invitations pi
    JOIN auth.users u
        ON u.id = auth.uid()
    JOIN public.projects p
        ON p.id = pi.project_id
    LEFT JOIN public.profiles pr
        ON pr.id = pi.invited_by
    WHERE LOWER(pi.invited_email) = LOWER(u.email)
      AND pi.status = 'pending'
      AND pi.expires_at > NOW();
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'full_name'
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = p_project_id
          AND user_id = (SELECT auth.uid())
          AND role IN ('owner', 'admin')
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = p_project_id
          AND user_id = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = p_project_id
          AND user_id = (SELECT auth.uid())
          AND role = 'owner'
    );
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_task_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    task_creator UUID;
    task_assignee UUID;
    notification_user UUID;
    task_title TEXT;
BEGIN
    SELECT created_by, assignee_id, title
    INTO task_creator, task_assignee, task_title
    FROM public.tasks
    WHERE id = NEW.task_id
      AND project_id = NEW.project_id;

    -- Notify the task creator
    IF task_creator IS NOT NULL
       AND task_creator <> NEW.author_id
    THEN
        INSERT INTO public.notifications (
            user_id, actor_id, project_id, task_id,
            type, title, message
        )
        VALUES (
            task_creator, NEW.author_id, NEW.project_id, NEW.task_id,
            'new_comment', 'New comment on your task',
            'Someone commented on "' || task_title || '".'
        );
    END IF;

    -- Notify the assignee, avoiding duplicate notifications
    IF task_assignee IS NOT NULL
       AND task_assignee <> NEW.author_id
       AND task_assignee IS DISTINCT FROM task_creator
    THEN
        INSERT INTO public.notifications (
            user_id, actor_id, project_id, task_id,
            type, title, message
        )
        VALUES (
            task_assignee, NEW.author_id, NEW.project_id, NEW.task_id,
            'new_comment', 'New comment on an assigned task',
            'Someone commented on "' || task_title || '".'
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_project_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    invited_user_id UUID;
    project_title TEXT;
    inviter_name TEXT;
BEGIN
    -- Find an existing account matching the invited email
    SELECT id
    INTO invited_user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.invited_email)
    LIMIT 1;

    -- No account exists yet, so skip the notification
    IF invited_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get project name
    SELECT name
    INTO project_title
    FROM public.projects
    WHERE id = NEW.project_id;

    -- Get inviter's name
    SELECT full_name
    INTO inviter_name
    FROM public.profiles
    WHERE id = NEW.invited_by;

    INSERT INTO public.notifications (
        user_id,
        actor_id,
        project_id,
        type,
        title,
        message
    )
    VALUES (
        invited_user_id,
        NEW.invited_by,
        NEW.project_id,
        'project_invitation',
        'New project invitation',
        COALESCE(inviter_name, 'Someone') ||
        ' invited you to join "' ||
        COALESCE(project_title, 'a project') || '".'
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_assignee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_actor UUID;
BEGIN
    -- Identify the person performing the action.
    current_actor := COALESCE(auth.uid(), NEW.created_by);

    -- Notify the assignee if someone else assigned the task.
    IF NEW.assignee_id IS NOT NULL
       AND NEW.assignee_id <> current_actor
       AND (
           TG_OP = 'INSERT'
           OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       )
    THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            project_id,
            task_id,
            type,
            title,
            message
        )
        VALUES (
            NEW.assignee_id,
            current_actor,
            NEW.project_id,
            NEW.id,
            'task_assigned',
            'New task assigned to you',
            'You have been assigned a task: ' || NEW.title
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_status_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_actor UUID;
BEGIN
    current_actor := COALESCE(auth.uid(), NEW.created_by);

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.assignee_id IS NOT NULL
       AND NEW.assignee_id <> current_actor
    THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            project_id,
            task_id,
            type,
            title,
            message
        )
        VALUES (
            NEW.assignee_id,
            current_actor,
            NEW.project_id,
            NEW.id,
            'task_updated',
            'Task status updated',
            'The task "' || NEW.title ||
            '" is now ' || REPLACE(NEW.status, '_', ' ') || '.'
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_project_member_identity_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
    THEN
        RAISE EXCEPTION
            'Project member identity and project assignment cannot be changed.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_comment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.project_activities (
        project_id,
        actor_id,
        task_id,
        activity_type,
        description
    )
    VALUES (
        NEW.project_id,
        NEW.author_id,
        NEW.task_id,
        'comment_added',
        'Added a comment to a task.'
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_invitation_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.project_activities (
        project_id,
        actor_id,
        activity_type,
        description,
        metadata
    )
    VALUES (
        NEW.project_id,
        NEW.invited_by,
        'member_invited',
        'Invited ' || NEW.invited_email || ' to the project.',
        jsonb_build_object(
            'invited_email', NEW.invited_email
        )
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_member_join_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    member_name TEXT;
    project_title TEXT;
BEGIN
    SELECT full_name
    INTO member_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    SELECT name
    INTO project_title
    FROM public.projects
    WHERE id = NEW.project_id;

    INSERT INTO public.project_activities (
        project_id,
        actor_id,
        activity_type,
        description,
        metadata
    )
    VALUES (
        NEW.project_id,
        NEW.user_id,
        'member_joined',
        COALESCE(member_name, 'A member') ||
        ' joined "' || COALESCE(project_title, 'the project') || '".',
        jsonb_build_object(
            'role', NEW.role,
            'member_id', NEW.user_id
        )
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_project_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.project_activities (
        project_id,
        actor_id,
        activity_type,
        description
    )
    VALUES (
        NEW.id,
        NEW.owner_id,
        'project_created',
        'Created the project "' || NEW.name || '".'
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_task_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_actor UUID;
BEGIN
    current_actor := COALESCE(
        auth.uid(),
        NEW.created_by
    );

    -- New task created
    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.project_activities (
            project_id,
            actor_id,
            task_id,
            activity_type,
            description
        )
        VALUES (
            NEW.project_id,
            current_actor,
            NEW.id,
            'task_created',
            'Created the task "' || NEW.title || '".'
        );

        -- Task initially assigned to another member
        IF NEW.assignee_id IS NOT NULL
           AND NEW.assignee_id <> current_actor
        THEN
            INSERT INTO public.project_activities (
                project_id,
                actor_id,
                task_id,
                activity_type,
                description,
                metadata
            )
            VALUES (
                NEW.project_id,
                current_actor,
                NEW.id,
                'task_assigned',
                'Assigned "' || NEW.title || '" to a team member.',
                jsonb_build_object(
                    'assignee_id', NEW.assignee_id
                )
            );
        END IF;

        RETURN NEW;
    END IF;

    -- Task status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN

        INSERT INTO public.project_activities (
            project_id,
            actor_id,
            task_id,
            activity_type,
            description,
            metadata
        )
        VALUES (
            NEW.project_id,
            current_actor,
            NEW.id,
            'task_status_changed',
            'Changed "' || NEW.title || '" from ' ||
            REPLACE(OLD.status, '_', ' ') || ' to ' ||
            REPLACE(NEW.status, '_', ' ') || '.',
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );

    END IF;

    -- Assignee changed
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN

        IF NEW.assignee_id IS NOT NULL THEN

            INSERT INTO public.project_activities (
                project_id,
                actor_id,
                task_id,
                activity_type,
                description,
                metadata
            )
            VALUES (
                NEW.project_id,
                current_actor,
                NEW.id,
                'task_assigned',
                'Assigned "' || NEW.title || '" to a team member.',
                jsonb_build_object(
                    'assignee_id', NEW.assignee_id
                )
            );

        ELSIF OLD.assignee_id IS NOT NULL THEN

            INSERT INTO public.project_activities (
                project_id,
                actor_id,
                task_id,
                activity_type,
                description,
                metadata
            )
            VALUES (
                NEW.project_id,
                current_actor,
                NEW.id,
                'task_unassigned',
                'Removed the assignee from "' || NEW.title || '".',
                jsonb_build_object(
                    'previous_assignee_id', OLD.assignee_id
                )
            );

        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

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

    -- Remove temporary authorization records.
    DELETE FROM private.project_transfer_authorizations
    WHERE transaction_id = txid_current()
      AND project_id = p_project_id
      AND authorized_by = (SELECT auth.uid());

END;
$function$;


-- ======================================================================
-- Triggers
-- ======================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER comment_activity_recorder AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.record_comment_activity();
CREATE TRIGGER new_comment_notification AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_new_task_comment();
CREATE TRIGGER invitation_activity_recorder AFTER INSERT ON public.project_invitations FOR EACH ROW WHEN ((new.status = 'pending'::text)) EXECUTE FUNCTION public.record_invitation_activity();
CREATE TRIGGER project_invitation_notification AFTER INSERT ON public.project_invitations FOR EACH ROW WHEN ((new.status = 'pending'::text)) EXECUTE FUNCTION public.notify_project_invitation();
CREATE TRIGGER member_join_activity_recorder AFTER INSERT ON public.project_members FOR EACH ROW WHEN ((new.role <> 'owner'::text)) EXECUTE FUNCTION public.record_member_join_activity();
CREATE TRIGGER protect_project_member_identity BEFORE UPDATE OF user_id, project_id ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.prevent_project_member_identity_changes();
CREATE TRIGGER protect_project_member_roles BEFORE UPDATE OF role ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.enforce_project_member_role_changes();
CREATE TRIGGER on_project_created AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.add_project_owner();
CREATE TRIGGER project_creation_activity AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.record_project_creation();
CREATE TRIGGER task_activity_recorder AFTER INSERT OR UPDATE OF status, assignee_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.record_task_activity();
CREATE TRIGGER task_assigned_notification AFTER INSERT OR UPDATE OF assignee_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignee();
CREATE TRIGGER task_status_update_notification AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_update();

-- ======================================================================
-- Row Level Security
-- ======================================================================

alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.project_activities enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "Authors and admins can delete comments"
    on public.comments
    as permissive
    for delete
    to authenticated
    using (((author_id = ( SELECT auth.uid() AS uid)) OR is_project_admin(project_id)));

create policy "Authors and admins can update comments"
    on public.comments
    as permissive
    for update
    to authenticated
    using (((author_id = ( SELECT auth.uid() AS uid)) OR is_project_admin(project_id)))
    with check (((author_id = ( SELECT auth.uid() AS uid)) OR is_project_admin(project_id)));

create policy "Project members can add comments"
    on public.comments
    as permissive
    for insert
    to authenticated
    with check (((author_id = ( SELECT auth.uid() AS uid)) AND is_project_member(project_id)));

create policy "Project members can view comments"
    on public.comments
    as permissive
    for select
    to authenticated
    using (is_project_member(project_id));

create policy "Users can update their own notifications"
    on public.notifications
    as permissive
    for update
    to authenticated
    using ((user_id = ( SELECT auth.uid() AS uid)))
    with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy "Users can view their own notifications"
    on public.notifications
    as permissive
    for select
    to authenticated
    using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "Users can update their own profile"
    on public.profiles
    as permissive
    for update
    to authenticated
    using ((id = ( SELECT auth.uid() AS uid)))
    with check ((id = ( SELECT auth.uid() AS uid)));

create policy "Users can view permitted profiles"
    on public.profiles
    as permissive
    for select
    to authenticated
    using (can_view_profile(id));

create policy "Project members can view activities"
    on public.project_activities
    as permissive
    for select
    to authenticated
    using (is_project_member(project_id));

create policy "Admins and invitees can view invitations"
    on public.project_invitations
    as permissive
    for select
    to authenticated
    using ((is_project_admin(project_id) OR (lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));

create policy "Project admins can create invitations"
    on public.project_invitations
    as permissive
    for insert
    to authenticated
    with check (((invited_by = auth.uid()) AND is_project_admin(project_id)));

create policy "Project admins can delete invitations"
    on public.project_invitations
    as permissive
    for delete
    to authenticated
    using (is_project_admin(project_id));

create policy "Admins can add project members"
    on public.project_members
    as permissive
    for insert
    to authenticated
    with check (is_project_admin(project_id));

create policy "Members can view their project team"
    on public.project_members
    as permissive
    for select
    to authenticated
    using (is_project_member(project_id));

create policy "Owners and admins can update permitted members"
    on public.project_members
    as permissive
    for update
    to authenticated
    using ((is_project_owner(project_id) OR (is_project_admin(project_id) AND (role = 'member'::text))))
    with check ((is_project_owner(project_id) OR (is_project_admin(project_id) AND (role = 'member'::text))));

create policy "Project members can leave and admins can remove members"
    on public.project_members
    as permissive
    for delete
    to authenticated
    using (((role <> 'owner'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (is_project_admin(project_id) AND ((role = 'member'::text) OR is_project_owner(project_id))))));

create policy "Admins can update projects"
    on public.projects
    as permissive
    for update
    to authenticated
    using (is_project_admin(id))
    with check (is_project_admin(id));

create policy "Members can view their projects"
    on public.projects
    as permissive
    for select
    to authenticated
    using (is_project_member(id));

create policy "Owners can delete projects"
    on public.projects
    as permissive
    for delete
    to authenticated
    using (is_project_owner(id));

create policy "authenticated_users_create_own_projects"
    on public.projects
    as permissive
    for insert
    to authenticated
    with check (((auth.uid() IS NOT NULL) AND (owner_id = auth.uid())));

create policy "Project members can create tasks"
    on public.tasks
    as permissive
    for insert
    to authenticated
    with check ((is_project_member(project_id) AND (created_by = ( SELECT auth.uid() AS uid)) AND ((assignee_id IS NULL) OR (EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = tasks.assignee_id)))))));

create policy "Project members can update tasks"
    on public.tasks
    as permissive
    for update
    to authenticated
    using (is_project_member(project_id))
    with check ((is_project_member(project_id) AND ((assignee_id IS NULL) OR (EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = tasks.assignee_id)))))));

create policy "Project members can view tasks"
    on public.tasks
    as permissive
    for select
    to authenticated
    using (is_project_member(project_id));

create policy "Task creators and admins can delete tasks"
    on public.tasks
    as permissive
    for delete
    to authenticated
    using (((created_by = ( SELECT auth.uid() AS uid)) OR is_project_admin(project_id)));

create policy "Users can delete their own avatars"
    on storage.objects
    as permissive
    for delete
    to authenticated
    using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "Users can update their own avatars"
    on storage.objects
    as permissive
    for update
    to authenticated
    using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
    with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "Users can upload their own avatars"
    on storage.objects
    as permissive
    for insert
    to authenticated
    with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));


-- ======================================================================
-- Storage: avatars bucket
-- ======================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do nothing;

-- ======================================================================
-- Realtime
-- ======================================================================

alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.project_activities;
alter publication supabase_realtime add table public.tasks;
