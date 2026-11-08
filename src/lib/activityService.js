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

// Note: activity records are created by database triggers, not by the client.

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