
import { supabase } from './supabase'

// Get authenticated user
async function getCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(`Authentication error: ${error.message}`)
    }

    if (!user) {
        throw new Error('Please log in to continue.')
    }

    return user
}

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
