import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { LABEL_COLORS, type LabelColor, type ProjectLabel } from '../types/app'

export type TaskLabelLink = { task_id: string; label_id: string }

export const MAX_LABEL_NAME_LENGTH = 30

export function isLabelColor(value: unknown): value is LabelColor {
    return LABEL_COLORS.includes(value as LabelColor)
}

// Unique-index violation (duplicate name in the same project).
const UNIQUE_VIOLATION = '23505'

// A project's labels, alphabetically.
export async function getProjectLabels(projectId: string): Promise<ProjectLabel[]> {
    await getCurrentUser()

    if (!projectId) throw new Error('Project ID is required.')

    const { data, error } = await supabase
        .from('project_labels')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    // The CHECK constraint guarantees a known colour.
    return (data || []) as ProjectLabel[]
}

// Create a label (owners and admins only; enforced by RLS).
export async function createLabel(projectId: string, name: string, color: string): Promise<ProjectLabel> {
    await getCurrentUser()

    const trimmedName = name?.trim()

    if (!projectId) throw new Error('Project ID is required.')
    if (!trimmedName) throw new Error('Label name is required.')
    if (trimmedName.length > MAX_LABEL_NAME_LENGTH) {
        throw new Error(`Label names can be at most ${MAX_LABEL_NAME_LENGTH} characters.`)
    }
    if (!isLabelColor(color)) throw new Error('Please choose a label colour.')

    const { data, error } = await supabase
        .from('project_labels')
        .insert({ project_id: projectId, name: trimmedName, color })
        .select()
        .single()

    if (error) {
        if (error.code === UNIQUE_VIOLATION) {
            throw new Error(`A label called "${trimmedName}" already exists in this project.`)
        }
        throw new Error(error.message)
    }

    return data as ProjectLabel
}

// Delete a label; it is removed from all tasks too (ON DELETE CASCADE).
export async function deleteLabel(labelId: string): Promise<true> {
    await getCurrentUser()

    if (!labelId) throw new Error('Label ID is required.')

    const { data, error } = await supabase
        .from('project_labels')
        .delete()
        .eq('id', labelId)
        .select('id')

    if (error) throw new Error(error.message)

    // RLS returns no rows (rather than an error) when the user may not delete.
    if (!data || data.length === 0) {
        throw new Error('Label was not deleted. You may not have permission to manage labels.')
    }

    return true
}

// Which labels are on which task, for a whole project.
export async function getTaskLabelLinks(projectId: string): Promise<TaskLabelLink[]> {
    await getCurrentUser()

    if (!projectId) throw new Error('Project ID is required.')

    const { data, error } = await supabase
        .from('task_labels')
        .select('task_id, label_id')
        .eq('project_id', projectId)

    if (error) throw new Error(error.message)

    return data || []
}

// Group links into { taskId: [labelId, ...] }.
export function groupLabelIdsByTask(links: readonly TaskLabelLink[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {}

    for (const link of links) {
        ;(groups[link.task_id] ??= []).push(link.label_id)
    }

    return groups
}

// Make a task's labels exactly `nextLabelIds`, adding and removing only
// what changed.
export async function setTaskLabels(
    taskId: string,
    projectId: string,
    currentLabelIds: readonly string[],
    nextLabelIds: readonly string[]
): Promise<string[]> {
    await getCurrentUser()

    if (!taskId || !projectId) throw new Error('Task ID and project ID are required.')

    const toAdd = nextLabelIds.filter((id) => !currentLabelIds.includes(id))
    const toRemove = currentLabelIds.filter((id) => !nextLabelIds.includes(id))

    if (toAdd.length > 0) {
        const { error } = await supabase
            .from('task_labels')
            .insert(toAdd.map((labelId) => ({ task_id: taskId, label_id: labelId, project_id: projectId })))

        if (error) throw new Error(error.message)
    }

    if (toRemove.length > 0) {
        const { error } = await supabase
            .from('task_labels')
            .delete()
            .eq('task_id', taskId)
            .in('label_id', toRemove)

        if (error) throw new Error(error.message)
    }

    return [...nextLabelIds]
}
