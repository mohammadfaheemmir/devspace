import { supabase } from './supabase'

// Get the currently logged-in user
async function getCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(error.message)
    }

    if (!user) {
        throw new Error('Please log in to continue.')
    }

    return user
}

// Create a project activity record
export async function createProjectActivity({
    projectId,
    taskId = null,
    activityType,
    description,
    metadata = {},
}) {
    const user = await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    if (!activityType || !description) {
        throw new Error('Activity type and description are required.')
    }

    const { data, error } = await supabase
        .from('project_activities')
        .insert({
            project_id: projectId,
            actor_id: user.id,
            task_id: taskId,
            activity_type: activityType,
            description,
            metadata,
        })
        .select()
        .single()

    if (error) {
        console.error('Create project activity error:', error)
        throw new Error(error.message)
    }

    return data
}

// Fetch project activity history
export async function getProjectActivities(projectId, limit = 50) {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const safeLimit = Math.min(
        Math.max(Number(limit) || 50, 1),
        100
    )

    const { data, error } = await supabase
        .from('project_activities')
        .select(`
            id,
            project_id,
            actor_id,
            task_id,
            activity_type,
            description,
            metadata,
            created_at,
            profiles (
                full_name,
                avatar_url
            ),
            tasks (
                title
            )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(safeLimit)

    if (error) {
        console.error('Fetch project activities error:', error)
        throw new Error(error.message)
    }

    return (data || []).map((activity) => ({
        ...activity,
        actor_name: activity.profiles?.full_name || 'A team member',
        actor_avatar: activity.profiles?.avatar_url || null,
        task_title: activity.tasks?.title || null,
    }))
}