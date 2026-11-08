-- Let a task's creator delete the attachments on their task.
--
-- Task creators may delete their tasks ("Task creators and admins can delete
-- tasks"), and the app removes a task's files before deleting it. Until now
-- only the uploader or an owner/admin could delete a file, so when a regular
-- member deleted their task, files other people had attached were left in
-- storage. This extends both delete rules to the task's creator, matching the
-- task delete rule. Nothing else changes.
--
-- Applied to the live project "devspace" on 2026-11-09 (outside the CLI's
-- migration history; see the README for `supabase migration repair`).

-- Attachment records
drop policy "Uploaders and admins can delete attachments" on public.task_attachments;

create policy "Uploaders, task creators and admins can delete attachments"
    on public.task_attachments for delete to authenticated
    using (
        uploaded_by = (select auth.uid())
        or public.is_project_admin(project_id)
        or exists (
            select 1 from public.tasks t
            where t.id = task_attachments.task_id
              and t.created_by = (select auth.uid())
        )
    );

-- Files in the bucket (path: <project_id>/<task_id>/<file>)
drop policy "Uploaders and admins can delete task attachments" on storage.objects;

create policy "Uploaders, task creators and admins can delete task attachments"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'task-attachments'
        and public.is_project_member(public.storage_folder_uuid(name, 1))
        and (
            owner_id = (select auth.uid())::text
            or public.is_project_admin(public.storage_folder_uuid(name, 1))
            or exists (
                select 1 from public.tasks t
                where t.id = public.storage_folder_uuid(name, 2)
                  and t.project_id = public.storage_folder_uuid(name, 1)
                  and t.created_by = (select auth.uid())
            )
        )
    );
