-- Task attachments: files attached to tasks, stored in a PRIVATE bucket.
--
-- Files live at  task-attachments/<project_id>/<task_id>/<random>-<file name>
-- and are only reachable through short-lived signed URLs.
--
-- Who can do what (enforced by Row Level Security):
--   - project members: see, download and upload attachments on their
--     project's tasks
--   - the uploader, or a project owner/admin: delete an attachment
--
-- Note: Supabase blocks deleting files with SQL (storage.protect_delete),
-- so deleting a task removes its attachment rows (ON DELETE CASCADE) but
-- not the files; the app removes a task's files before deleting it.
--
-- Applied to the live project "devspace" on 2026-11-09 (outside the CLI's
-- migration history; see the README for `supabase migration repair`).

-- ---------------------------------------------------------------------
-- Private storage bucket: 10 MB per file, common document/image types
-- (no HTML or SVG, which could run scripts when opened).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'task-attachments',
    'task-attachments',
    false,
    10485760,
    array[
        'image/png', 'image/jpeg', 'image/webp', 'image/gif',
        'application/pdf',
        'text/plain', 'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
)
on conflict (id) do nothing;

-- Read the Nth folder of a storage path as a UUID; NULL if it is not one
-- (so a malformed path is simply denied instead of raising an error).
create or replace function public.storage_folder_uuid(object_name text, folder_position integer)
returns uuid
language plpgsql
immutable
set search_path to ''
as $function$
begin
    return (storage.foldername(object_name))[folder_position]::uuid;
exception
    when invalid_text_representation then
        return null;
end;
$function$;

-- ---------------------------------------------------------------------
-- Attachment records
-- ---------------------------------------------------------------------
create table public.task_attachments (
    id uuid default gen_random_uuid() not null,
    task_id uuid not null,
    project_id uuid not null,
    uploaded_by uuid,
    file_name text not null,
    storage_path text not null,
    size_bytes bigint not null,
    mime_type text not null,
    created_at timestamp with time zone default now() not null,

    constraint task_attachments_pkey primary key (id),
    constraint task_attachments_storage_path_key unique (storage_path),
    constraint task_attachments_task_project_fkey
        foreign key (task_id, project_id) references public.tasks(id, project_id) on delete cascade,
    constraint task_attachments_uploaded_by_fkey
        foreign key (uploaded_by) references public.profiles(id) on delete set null,
    constraint task_attachments_file_name_check
        check (char_length(file_name) between 1 and 255),
    constraint task_attachments_size_check
        check (size_bytes > 0 and size_bytes <= 10485760),
    -- The record must point inside its own project's and task's folder.
    constraint task_attachments_path_check
        check (storage_path like project_id::text || '/' || task_id::text || '/%')
);

create index task_attachments_task_idx on public.task_attachments (task_id);
create index task_attachments_project_idx on public.task_attachments (project_id);

alter table public.task_attachments enable row level security;

create policy "Project members can view attachments"
    on public.task_attachments for select to authenticated
    using (public.is_project_member(project_id));

create policy "Project members can add attachments"
    on public.task_attachments for insert to authenticated
    with check (
        public.is_project_member(project_id)
        and uploaded_by = (select auth.uid())
    );

create policy "Uploaders and admins can delete attachments"
    on public.task_attachments for delete to authenticated
    using (
        uploaded_by = (select auth.uid())
        or public.is_project_admin(project_id)
    );

-- ---------------------------------------------------------------------
-- Storage rules for the bucket (path: <project_id>/<task_id>/<file>)
-- ---------------------------------------------------------------------
create policy "Project members can read task attachments"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'task-attachments'
        and public.is_project_member(public.storage_folder_uuid(name, 1))
    );

create policy "Project members can upload task attachments"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'task-attachments'
        and public.is_project_member(public.storage_folder_uuid(name, 1))
        -- the task folder must be a task of that project
        and exists (
            select 1 from public.tasks t
            where t.id = public.storage_folder_uuid(name, 2)
              and t.project_id = public.storage_folder_uuid(name, 1)
        )
    );

create policy "Uploaders and admins can delete task attachments"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'task-attachments'
        and public.is_project_member(public.storage_folder_uuid(name, 1))
        and (
            owner_id = (select auth.uid())::text
            or public.is_project_admin(public.storage_folder_uuid(name, 1))
        )
    );

-- ---------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.task_attachments;
