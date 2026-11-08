// App-level types built on the generated database types (database.ts).
// Regenerate database.ts after schema changes with:
//   npx supabase gen types --lang=typescript --remote=<project-ref> --schema public > src/types/database.ts
import type { Tables } from './database'

// These columns are plain `text` with CHECK constraints in the database, so
// the generated types only say `string`. Narrow them here.
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type ProjectRole = 'owner' | 'admin' | 'member'
export type NotificationType = 'task_assigned' | 'task_updated' | 'new_comment' | 'project_invitation'

export type Task = Omit<Tables<'tasks'>, 'status' | 'priority'> & {
    status: TaskStatus
    priority: TaskPriority
}

export type Notification = Omit<Tables<'notifications'>, 'type'> & {
    type: NotificationType
}

export type Project = Tables<'projects'>
export type Profile = Tables<'profiles'>

// Shape returned by projectMemberService.getProjectMembers().
export type ProjectMember = {
    id: string
    user_id: string
    role: ProjectRole
    joined_at: string | null
    full_name: string
    avatar_url: string | null
}
