-- Task labels: coloured tags defined per project and attached to tasks.
--
-- Who can do what (enforced by Row Level Security):
--   - project members: see labels, add/remove labels on tasks
--   - owners and admins: create, rename, recolour and delete labels
-- Labels and task links are deleted automatically with their project/task.
--
-- Applied to the live project "devspace" on 2026-11-09 (outside the CLI's
-- migration history; see the README for `supabase migration repair`).

-- ---------------------------------------------------------------------
-- Labels belonging to a project
-- ---------------------------------------------------------------------
create table public.project_labels (
    id uuid default gen_random_uuid() not null,
    project_id uuid not null,
    name text not null,
    color text not null,
    created_at timestamp with time zone default now() not null,

    constraint project_labels_pkey primary key (id),
    -- Lets task_labels reference (id, project_id) so a task can only get
    -- labels from its own project.
    constraint project_labels_id_project_id_key unique (id, project_id),
    constraint project_labels_project_id_fkey
        foreign key (project_id) references public.projects(id) on delete cascade,
    constraint project_labels_name_check
        check (char_length(btrim(name)) between 1 and 30),
    constraint project_labels_color_check
        check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink'))
);

-- No two labels in a project with the same name (ignoring case).
create unique index project_labels_project_name_key
    on public.project_labels (project_id, lower(btrim(name)));

-- ---------------------------------------------------------------------
-- Which labels are on which task
-- ---------------------------------------------------------------------
create table public.task_labels (
    task_id uuid not null,
    label_id uuid not null,
    project_id uuid not null,
    created_at timestamp with time zone default now() not null,

    constraint task_labels_pkey primary key (task_id, label_id),
    -- Both the task and the label must belong to the same project.
    constraint task_labels_task_project_fkey
        foreign key (task_id, project_id) references public.tasks(id, project_id) on delete cascade,
    constraint task_labels_label_project_fkey
        foreign key (label_id, project_id) references public.project_labels(id, project_id) on delete cascade
);

create index task_labels_project_idx on public.task_labels (project_id);
create index task_labels_label_idx on public.task_labels (label_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.project_labels enable row level security;
alter table public.task_labels enable row level security;

create policy "Project members can view labels"
    on public.project_labels for select to authenticated
    using (public.is_project_member(project_id));

create policy "Project admins can create labels"
    on public.project_labels for insert to authenticated
    with check (public.is_project_admin(project_id));

create policy "Project admins can update labels"
    on public.project_labels for update to authenticated
    using (public.is_project_admin(project_id))
    with check (public.is_project_admin(project_id));

create policy "Project admins can delete labels"
    on public.project_labels for delete to authenticated
    using (public.is_project_admin(project_id));

create policy "Project members can view task labels"
    on public.task_labels for select to authenticated
    using (public.is_project_member(project_id));

create policy "Project members can label tasks"
    on public.task_labels for insert to authenticated
    with check (public.is_project_member(project_id));

create policy "Project members can unlabel tasks"
    on public.task_labels for delete to authenticated
    using (public.is_project_member(project_id));

-- ---------------------------------------------------------------------
-- Live updates, so teammates see label changes without refreshing
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.project_labels;
alter publication supabase_realtime add table public.task_labels;
