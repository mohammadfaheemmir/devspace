import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { ProjectMember, ProjectRole } from '../types/app'

// Fetch project members.
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const { data, error } = await supabase
        .from('project_members')
        .select(`
            id,
            user_id,
            role,
            joined_at,
            profiles (
                id,
                full_name,
                avatar_url
            )
        `)
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true })

    if (error) {
        console.error('Fetch project members error:', error)
        throw new Error(error.message)
    }

    return (data || []).map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role as ProjectRole,
        joined_at: member.joined_at,
        full_name: member.profiles?.full_name || 'Unnamed member',
        avatar_url: member.profiles?.avatar_url || null,
    }))
}

// Transfer project ownership.
export async function transferProjectOwnership(projectId: string, newOwnerId: string): Promise<true> {
    const currentUser = await getCurrentUser()

    if (!projectId || !newOwnerId) {
        throw new Error('Project ID and new owner ID are required.')
    }

    if (currentUser.id === newOwnerId) {
        throw new Error('You are already the project owner.')
    }

    const { error } = await supabase.rpc('transfer_project_ownership', {
        p_project_id: projectId,
        p_new_owner_id: newOwnerId,
    })

    if (error) {
        console.error('Ownership transfer error:', error)
        throw new Error(error.message)
    }

    return true
}

// Promote a member to admin or demote an admin to member.
export async function updateProjectMemberRole(
    projectId: string,
    memberUserId: string,
    nextRole: string
): Promise<{ id: string; user_id: string; role: ProjectRole }> {
    await getCurrentUser()

    if (!projectId || !memberUserId) {
        throw new Error('Project ID and member user ID are required.')
    }

    if (nextRole !== 'admin' && nextRole !== 'member') {
        throw new Error('Only admin and member roles can be assigned here.')
    }

    const { data, error } = await supabase
        .from('project_members')
        .update({ role: nextRole })
        .eq('project_id', projectId)
        .eq('user_id', memberUserId)
        .neq('role', 'owner')
        .select('id, user_id, role')
        .maybeSingle()

    if (error) {
        console.error('Update project member role error:', error)
        throw new Error(error.message)
    }

    if (!data) {
        throw new Error(
            'No member was updated. Check your permissions and try again.'
        )
    }

    return { ...data, role: data.role as ProjectRole }
}

// Remove another project member.
export async function removeProjectMember(projectId: string, memberUserId: string): Promise<true> {
    const currentUser = await getCurrentUser()

    if (!projectId || !memberUserId) {
        throw new Error('Project ID and member user ID are required.')
    }

    if (currentUser.id === memberUserId) {
        throw new Error('Use the leave-project action to remove yourself.')
    }

    const { data, error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', memberUserId)
        .neq('role', 'owner')
        .select('id')

    if (error) {
        console.error('Remove project member error:', error)
        throw new Error(error.message)
    }

    if (!data || data.length === 0) {
        throw new Error(
            'No member was removed. Check your permissions and try again.'
        )
    }

    return true
}

// Leave a project.
export async function leaveProject(projectId: string): Promise<true> {
    const currentUser = await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const { data, error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', currentUser.id)
        .neq('role', 'owner')
        .select('id')

    if (error) {
        console.error('Leave project error:', error)
        throw new Error(error.message)
    }

    if (!data || data.length === 0) {
        throw new Error(
            'You could not leave this project. If you are the owner, transfer ownership first.'
        )
    }

    return true
}
