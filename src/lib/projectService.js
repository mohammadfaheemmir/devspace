import { supabase } from './supabase'
import { getCurrentUser } from './auth'

// Fetch projects
export async function getProjects() {
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
export async function createProject(project) {
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
export async function deleteProject(projectId) {
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
export async function updateProject(projectId, updates) {
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
export async function getProjectSummaries(projectIds) {
    const user = await getCurrentUser()

    if (!projectIds?.length) return {}

    const [membershipResult, taskResult] = await Promise.all([
        supabase
            .from('project_members')
            .select('project_id, role')
            .eq('user_id', user.id)
            .in('project_id', projectIds),
        supabase
            .from('tasks')
            .select('project_id, status')
            .in('project_id', projectIds),
    ])

    if (membershipResult.error) throw new Error(membershipResult.error.message)
    if (taskResult.error) throw new Error(taskResult.error.message)

    const summaries = Object.fromEntries(
        projectIds.map((id) => [id, { role: null, total: 0, done: 0, inProgress: 0 }])
    )

    membershipResult.data.forEach(({ project_id, role }) => {
        if (summaries[project_id]) summaries[project_id].role = role
    })

    taskResult.data.forEach(({ project_id, status }) => {
        const summary = summaries[project_id]
        if (!summary) return

        summary.total += 1
        if (status === 'done') summary.done += 1
        if (status === 'in_progress') summary.inProgress += 1
    })

    return summaries
}
