import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Tables } from '../types/database'

// An activity entry with the actor's and task's display details.
export type ProjectActivity = Pick<Tables<'project_activities'>,
    'id' | 'project_id' | 'actor_id' | 'task_id' | 'activity_type' | 'description' | 'metadata' | 'created_at'> & {
    actor_name: string
    actor_avatar: string | null
    task_title: string | null
}

// Note: activity records are created by database triggers, not by the client.

// Fetch project activity history
export async function getProjectActivities(projectId: string, limit = 50): Promise<ProjectActivity[]> {
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

    return (data || []).map(({ profiles, tasks, ...activity }) => ({
        ...activity,
        actor_name: profiles?.full_name || 'A team member',
        actor_avatar: profiles?.avatar_url || null,
        task_title: tasks?.title || null,
    }))
}