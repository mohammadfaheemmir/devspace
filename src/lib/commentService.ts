import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Tables } from '../types/database'

// A comment with its author's display details, as shown in the UI.
export type TaskComment = Pick<Tables<'comments'>, 'id' | 'task_id' | 'project_id' | 'author_id' | 'content' | 'created_at'> & {
    author_name: string
    author_avatar: string | null
}

// Fetch comments for a task
export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
    await getCurrentUser()

    if (!taskId) {
        throw new Error('Task ID is required.')
    }

    const { data, error } = await supabase
        .from('comments')
        .select(`
      id,
      task_id,
      project_id,
      author_id,
      content,
      created_at,
      profiles (
        full_name,
        avatar_url
      )
    `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Fetch comments error:', error)
        throw new Error(error.message)
    }

    return (data || []).map(({ profiles, ...comment }) => ({
        ...comment,
        author_name: profiles?.full_name || 'Unknown user',
        author_avatar: profiles?.avatar_url || null,
    }))
}

// Add a comment to a task
export async function createTaskComment(taskId: string, projectId: string, content: string): Promise<TaskComment> {
    const user = await getCurrentUser()

    if (!taskId || !projectId) {
        throw new Error('Task ID and project ID are required.')
    }

    const trimmedContent = content?.trim()

    if (!trimmedContent) {
        throw new Error('Comment cannot be empty.')
    }

    const { data, error } = await supabase
        .from('comments')
        .insert({
            task_id: taskId,
            project_id: projectId,
            author_id: user.id,
            content: trimmedContent,
        })
        .select(`
      id,
      task_id,
      project_id,
      author_id,
      content,
      created_at,
      profiles (
        full_name,
        avatar_url
      )
    `)
        .single()

    if (error) {
        console.error('Create comment error:', error)
        throw new Error(error.message)
    }

    const { profiles, ...comment } = data

    return {
        ...comment,
        author_name: profiles?.full_name || 'Unknown user',
        author_avatar: profiles?.avatar_url || null,
    }
}

// Edit the text of a comment. Only the content changes; the author,
// task and project stay the same.
export async function updateTaskComment(commentId: string, content: string): Promise<Pick<Tables<'comments'>, 'id' | 'content'>> {
    await getCurrentUser()

    if (!commentId) {
        throw new Error('Comment ID is required.')
    }

    const trimmedContent = content?.trim()

    if (!trimmedContent) {
        throw new Error('Comment cannot be empty.')
    }

    const { data, error } = await supabase
        .from('comments')
        .update({ content: trimmedContent })
        .eq('id', commentId)
        .select('id, content')
        .maybeSingle()

    if (error) {
        console.error('Update comment error:', error)
        throw new Error(error.message)
    }

    // Row Level Security returns no row when the user may not edit it.
    if (!data) {
        throw new Error(
            'Comment was not updated. It may have been deleted, or you may not have permission to edit it.'
        )
    }

    return data
}

// Delete a comment
export async function deleteTaskComment(commentId: string): Promise<true> {
    await getCurrentUser()

    if (!commentId) {
        throw new Error('Comment ID is required.')
    }

    const { data, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .select('id')

    if (error) {
        console.error('Delete comment error:', error)
        throw new Error(error.message)
    }

    // Without this check, a delete blocked by Row Level Security would look
    // successful and the comment would reappear on the next refresh.
    if (!data || data.length === 0) {
        throw new Error(
            'Comment was not deleted. It may already be gone, or you may not have permission to delete it.'
        )
    }

    return true
}
