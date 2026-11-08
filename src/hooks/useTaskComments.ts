import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { Tables } from '../types/database'
import {
    createTaskComment,
    deleteTaskComment,
    getTaskComments,
    updateTaskComment,
    type TaskComment,
} from '../lib/commentService'

type CommentsByTask = Record<string, TaskComment[]>

// What the hook returns; components receive it as a `comments` prop.
export type TaskCommentsApi = {
    expandedTaskId: string | null
    commentsByTask: CommentsByTask
    drafts: Record<string, string>
    loadingTaskId: string | null
    sendingTaskId: string | null
    deletingCommentId: string | null
    savingCommentId: string | null
    hasLoaded: (taskId: string) => boolean
    toggle: (taskId: string) => Promise<void>
    setDraft: (taskId: string, value: string) => void
    submit: (taskId: string) => Promise<void>
    edit: (taskId: string, commentId: string, content: string) => Promise<boolean>
    remove: (taskId: string, commentId: string) => Promise<void>
    forgetTask: (taskId: string) => void
}

// Comment state for every task in a project: which task is expanded,
// loaded comments, unsent drafts, and loading/sending/deleting flags.
// Also keeps loaded comments in sync with Supabase Realtime.
export function useTaskComments(projectId: string | undefined, onError: (message: string) => void): TaskCommentsApi {
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [commentsByTask, setCommentsByTask] = useState<CommentsByTask>({})
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null)
    const [sendingTaskId, setSendingTaskId] = useState<string | null>(null)
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
    const [savingCommentId, setSavingCommentId] = useState<string | null>(null)

    // Real-time subscription for project comments.
    useEffect(() => {
        if (!projectId) return

        let active = true

        // Inserts and updates are filtered by project on the server.
        // Supabase cannot filter DELETE events by column, so deletes are
        // received unfiltered and matched by ID (unknown IDs are ignored).
        const projectFilter = `project_id=eq.${projectId}`

        const handleCommentChange = async (payload: RealtimePostgresChangesPayload<Tables<'comments'>>) => {
            if (
                payload.eventType === 'INSERT' ||
                payload.eventType === 'UPDATE'
            ) {
                const changedComment = payload.new

                if (changedComment.project_id !== projectId) return

                const taskId = changedComment.task_id

                try {
                    const updatedComments = await getTaskComments(taskId)

                    if (!active) return

                    setCommentsByTask((previous) => ({
                        ...previous,
                        [taskId]: updatedComments,
                    }))
                } catch (err) {
                    console.error('Unable to refresh realtime comments:', err)
                }
            }

            if (payload.eventType === 'DELETE') {
                const deletedCommentId = payload.old.id

                if (!deletedCommentId) return

                setCommentsByTask((previous) =>
                    Object.fromEntries(
                        Object.entries(previous).map(([taskId, comments]) => [
                            taskId,
                            comments.filter((comment) => comment.id !== deletedCommentId),
                        ])
                    )
                )
            }
        }

        const channel = supabase
            .channel(`project-comments-${projectId}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments', filter: projectFilter },
                handleCommentChange
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'comments', filter: projectFilter },
                handleCommentChange
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'comments' },
                handleCommentChange
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Realtime comments subscription error:', status)
                }
            })

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [projectId])

    function hasLoaded(taskId: string): boolean {
        return Object.prototype.hasOwnProperty.call(commentsByTask, taskId)
    }

    // Open or close a task's comments section, loading comments on first open.
    async function toggle(taskId: string): Promise<void> {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null)
            return
        }

        setExpandedTaskId(taskId)

        if (hasLoaded(taskId)) return

        try {
            setLoadingTaskId(taskId)
            onError('')

            const data = await getTaskComments(taskId)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: data,
            }))
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to load comments.'))
        } finally {
            setLoadingTaskId(null)
        }
    }

    function setDraft(taskId: string, value: string): void {
        setDrafts((previous) => ({
            ...previous,
            [taskId]: value,
        }))
    }

    // Add a comment to a task.
    async function submit(taskId: string): Promise<void> {
        const content = drafts[taskId]?.trim()

        if (!content) {
            onError('Please enter a comment.')
            return
        }

        if (!projectId) {
            onError('Unable to add comment: the project is not loaded.')
            return
        }

        try {
            setSendingTaskId(taskId)
            onError('')

            const newComment = await createTaskComment(taskId, projectId, content)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: [
                    ...(previous[taskId] || []).filter(
                        (comment) => comment.id !== newComment.id
                    ),
                    newComment,
                ],
            }))

            setDraft(taskId, '')
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to add comment.'))
        } finally {
            setSendingTaskId(null)
        }
    }

    // Edit a comment's text. Returns true on success so the caller can
    // leave edit mode, or false if saving failed (the error is reported).
    async function edit(taskId: string, commentId: string, content: string): Promise<boolean> {
        if (!content?.trim()) {
            onError('Comment cannot be empty.')
            return false
        }

        try {
            setSavingCommentId(commentId)
            onError('')

            const updated = await updateTaskComment(commentId, content)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: (previous[taskId] || []).map((comment) =>
                    comment.id === commentId
                        ? { ...comment, content: updated.content }
                        : comment
                ),
            }))

            return true
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to update comment.'))
            return false
        } finally {
            setSavingCommentId(null)
        }
    }

    // Delete a comment.
    async function remove(taskId: string, commentId: string): Promise<void> {
        try {
            setDeletingCommentId(commentId)
            onError('')

            await deleteTaskComment(commentId)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: (previous[taskId] || []).filter(
                    (comment) => comment.id !== commentId
                ),
            }))
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to delete comment.'))
        } finally {
            setDeletingCommentId(null)
        }
    }

    // Drop everything about a task that was deleted. Memoised (it only uses
    // state setters) so it can be a stable dependency of other effects.
    const forgetTask = useCallback((taskId: string) => {
        setCommentsByTask((previous) => {
            const updated = { ...previous }
            delete updated[taskId]
            return updated
        })

        setExpandedTaskId((previous) => (previous === taskId ? null : previous))
    }, [])

    return {
        expandedTaskId,
        commentsByTask,
        drafts,
        loadingTaskId,
        sendingTaskId,
        deletingCommentId,
        savingCommentId,
        hasLoaded,
        toggle,
        setDraft,
        submit,
        edit,
        remove,
        forgetTask,
    }
}
