import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { fetchAllRows } from './pagination'
import type { Tables } from '../types/database'
import type { Task, TaskPriority, TaskStatus } from '../types/app'

// What the task form sends. Priority arrives as a plain string from a
// <select>, so it is validated before use.
export type TaskInput = {
    title: string
    description?: string | null
    priority?: string | null
    assignee_id?: string | null
    due_date?: string | null
}

const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high']
const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']

export function isTaskPriority(value: unknown): value is TaskPriority {
    return TASK_PRIORITIES.includes(value as TaskPriority)
}

export function isTaskStatus(value: unknown): value is TaskStatus {
    return TASK_STATUSES.includes(value as TaskStatus)
}

// The database's CHECK constraints guarantee status and priority are valid,
// so a row can safely be treated as the narrower app type.
function toTask(row: Tables<'tasks'>): Task {
    return row as Task
}

// Fetch project tasks
export async function getTasks(projectId: string): Promise<Task[]> {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    // Paged: a single request would silently stop at 1,000 tasks. Ordering
    // by id as a tie-breaker keeps pages stable.
    const rows = await fetchAllRows((from, to) =>
        supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to)
    )

    return rows.map(toTask)
}

// Create a task
export async function createTask(projectId: string, task: TaskInput): Promise<Task> {
    const user = await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const title = task?.title?.trim()

    if (!title) {
        throw new Error('Task title is required.')
    }

    const priority = task.priority || 'medium'

    if (!isTaskPriority(priority)) {
        throw new Error('Invalid task priority.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            project_id: projectId,
            title,
            description: task.description?.trim() || null,
            status: 'todo',
            priority,
            created_by: user.id,
            assignee_id: task.assignee_id || null,
            due_date: task.due_date || null,
        })
        .select()
        .single()

    if (error) throw new Error(error.message)

    return toTask(data)
}

// Update task status
export async function updateTaskStatus(taskId: string, status: string): Promise<Task> {
    await getCurrentUser()

    if (!taskId || !isTaskStatus(status)) {
        throw new Error('Invalid task ID or status.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return toTask(data)
}

// Assign or reassign a task
export async function updateTaskAssignee(taskId: string, assigneeId: string | null): Promise<Task> {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({ assignee_id: assigneeId || null })
        .eq('id', taskId)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return toTask(data)
}

// Edit a task's details (title, description, priority, assignee, due date).
export async function updateTask(taskId: string, task: TaskInput): Promise<Task> {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const title = task?.title?.trim()

    if (!title) {
        throw new Error('Task title is required.')
    }

    const priority = task.priority || 'medium'

    if (!isTaskPriority(priority)) {
        throw new Error('Invalid task priority.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({
            title,
            description: task.description?.trim() || null,
            priority,
            assignee_id: task.assignee_id || null,
            due_date: task.due_date || null,
        })
        .eq('id', taskId)
        .select()
        .maybeSingle()

    if (error) throw new Error(error.message)

    // Row Level Security returns no row (rather than an error) when the
    // user is not allowed to change this task.
    if (!data) {
        throw new Error(
            'Task was not updated. It may have been deleted, or you may not have permission to edit it.'
        )
    }

    return toTask(data)
}

// Delete a task. Its comments are removed with it (ON DELETE CASCADE).
export async function deleteTask(taskId: string): Promise<true> {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .select('id')

    if (error) throw new Error(error.message)

    if (!data || data.length === 0) {
        throw new Error(
            'Task was not deleted. It may already be gone, or you may not have permission to delete it.'
        )
    }

    return true
}
