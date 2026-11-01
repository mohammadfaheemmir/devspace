
import { supabase } from './supabase'

// Get the currently logged-in user
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

// Create an invitation for an email address
export async function createProjectInvitation(projectId, email) {
    const user = await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const invitedEmail = email?.trim().toLowerCase()

    if (
        !invitedEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)
    ) {
        throw new Error('Please enter a valid email address.')
    }

    const { data, error } = await supabase
        .from('project_invitations')
        .insert({
            project_id: projectId,
            invited_email: invitedEmail,
            invited_by: user.id,
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            throw new Error(
                'This email already has a pending invitation.'
            )
        }

        throw new Error(error.message)
    }

    return data
}

// Get all invitations for a project
export async function getProjectInvitations(projectId) {
    await getCurrentUser()

    if (!projectId) {
        throw new Error('Project ID is required.')
    }

    const { data, error } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(error.message)
    }

    return data || []
}

// Get pending invitations sent to the logged-in user's email
export async function getMyInvitations() {
    await getCurrentUser()

    const { data, error } = await supabase.rpc(
        'get_my_project_invitations'
    )

    if (error) {
        console.error('Fetch my invitations error:', error)
        throw new Error(error.message)
    }

    return data || []
}

// Accept a project invitation
export async function acceptProjectInvitation(invitationId) {
    await getCurrentUser()

    if (!invitationId) {
        throw new Error('Invitation ID is required.')
    }

    const { data, error } = await supabase.rpc(
        'accept_project_invitation',
        {
            invitation_id: invitationId,
        }
    )

    if (error) {
        throw new Error(error.message)
    }

    // Returns the project ID after successful acceptance
    return data
}

// Cancel a project invitation
export async function cancelProjectInvitation(invitationId) {
    await getCurrentUser()

    if (!invitationId) {
        throw new Error('Invitation ID is required.')
    }

    const { error } = await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitationId)

    if (error) {
        throw new Error(error.message)
    }

    return true
}
