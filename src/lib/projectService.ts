import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Project, ProjectRole } from '../types/app'

export type ProjectInput = { name: string; description?: string | null }

export type ProjectSummary = {
    role: ProjectRole | null
    total: number
    done: number
    inProgress: number
}

// Fetch projects
export async function getProjects(): Promise<Project[]> {
    await getCurrentUser()

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch projects error:', error)
        throw new Error(error.message)
    }

    return data || []
}

// Create project
export async function createProject(project: ProjectInput): Promise<Project> {
    const user = await getCurrentUser()

    if (!project?.name?.trim()) {
        throw new Error('Project name is required.')
    }

    const projectId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    const projectData = {
        id: projectId,
        name: project.name.trim(),
        description: project.description?.trim() || null,
        owner_id: user.id,
    }

    const { error } = await supabase
        .from('projects')
        .insert(projectData)

    if (error) {
        console.error('Project creation error:', error)
        throw new Error(error.message)
    }

    return {
        ...projectData,
        created_at: createdAt,
        updated_at: createdAt,
    }
}

// Delete project
export async function deleteProject(projectId: string): Promise<true> {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const { data, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select('id')

    if (error) {
        console.error('Project deletion error:', error)
        throw new Error(error.message)
    }

    if (!data || data.length === 0) {
        throw new Error(
            'Project was not deleted. It may no longer exist, or you may not be its owner.'
        )
    }

    return true
}

// Update project settings
export async function updateProject(
    projectId: string,
    updates: ProjectInput
): Promise<Pick<Project, 'id' | 'name' | 'description'>> {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const name = updates?.name?.trim()

    if (!name) {
        throw new Error('Project name cannot be empty.')
    }

    const description = updates?.description?.trim() || null

    const { data, error } = await supabase
        .from('projects')
        .update({ name, description })
        .eq('id', projectId)
        .select('id, name, description')
        .maybeSingle()

    if (error) {
        console.error('Project update error:', error)
        throw new Error(error.message)
    }

    if (!data) {
        throw new Error(
            'Project settings were not updated. You may not have permission to edit this project.'
        )
    }

    return data
}

// For each project: the current user's role and task counts by status.
// Two queries in total, regardless of how many projects there are.
// Returns { [projectId]: { role, total, done, inProgress } }.
export async function getProjectSummaries(projectIds: string[]): Promise<Record<string, ProjectSummary>> {
    const user = await getCurrentUser()

    if (!projectIds?.length) return {}

    // Task counts are computed in the database: fetching every task row
    // would silently stop at Supabase's 1,000-row limit.
    const [membershipResult, countResult] = await Promise.all([
        supabase
            .from('project_members')
            .select('project_id, role')
            .eq('user_id', user.id)
            .in('project_id', projectIds),
        supabase.rpc('get_project_task_counts', { p_project_ids: projectIds }),
    ])

    if (membershipResult.error) throw new Error(membershipResult.error.message)
    if (countResult.error) throw new Error(countResult.error.message)

    const summaries: Record<string, ProjectSummary> = Object.fromEntries(
        projectIds.map((id): [string, ProjectSummary] => [id, { role: null, total: 0, done: 0, inProgress: 0 }])
    )

    membershipResult.data.forEach(({ project_id, role }) => {
        const summary = summaries[project_id]
        // role is text with a CHECK constraint (owner/admin/member).
        if (summary) summary.role = role as ProjectRole
    })

    for (const row of countResult.data ?? []) {
        const summary = summaries[row.project_id]
        if (!summary) continue

        summary.total = Number(row.total)
        summary.done = Number(row.done)
        summary.inProgress = Number(row.in_progress)
    }

    return summaries
}
