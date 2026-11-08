import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
    createTaskComment,
    deleteTaskComment,
    getTaskComments,
    updateTaskComment,
} from '../lib/commentService'

// Comment state for every task in a project: which task is expanded,
// loaded comments, unsent drafts, and loading/sending/deleting flags.
// Also keeps loaded comments in sync with Supabase Realtime.
export function useTaskComments(projectId, onError) {
    const [expandedTaskId, setExpandedTaskId] = useState(null)
    const [commentsByTask, setCommentsByTask] = useState({})
    const [drafts, setDrafts] = useState({})
    const [loadingTaskId, setLoadingTaskId] = useState(null)
    const [sendingTaskId, setSendingTaskId] = useState(null)
    const [deletingCommentId, setDeletingCommentId] = useState(null)
    const [savingCommentId, setSavingCommentId] = useState(null)

    // Real-time subscription for project comments.
    useEffect(() => {
        if (!projectId) return

        let active = true

        // Inserts and updates are filtered by project on the server.
        // Supabase cannot filter DELETE events by column, so deletes are
        // received unfiltered and matched by ID (unknown IDs are ignored).
        const projectFilter = `project_id=eq.${projectId}`

        const handleCommentChange = async (payload) => {
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

                setCommentsByTask((previous) => {
                    const updated = { ...previous }

                    Object.keys(updated).forEach((taskId) => {
                        updated[taskId] = updated[taskId].filter(
                            (comment) => comment.id !== deletedCommentId
                        )
                    })

                    return updated
                })
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

    function hasLoaded(taskId) {
        return Object.prototype.hasOwnProperty.call(commentsByTask, taskId)
    }

    // Open or close a task's comments section, loading comments on first open.
    async function toggle(taskId) {
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
            onError(err.message || 'Unable to load comments.')
        } finally {
            setLoadingTaskId(null)
        }
    }

    function setDraft(taskId, value) {
        setDrafts((previous) => ({
            ...previous,
            [taskId]: value,
        }))
    }

    // Add a comment to a task.
    async function submit(taskId) {
        const content = drafts[taskId]?.trim()

        if (!content) {
            onError('Please enter a comment.')
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
            onError(err.message || 'Unable to add comment.')
        } finally {
            setSendingTaskId(null)
        }
    }

    // Edit a comment's text. Returns true on success so the caller can
    // leave edit mode, or false if saving failed (the error is reported).
    async function edit(taskId, commentId, content) {
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
            onError(err.message || 'Unable to update comment.')
            return false
        } finally {
            setSavingCommentId(null)
        }
    }

    // Delete a comment.
    async function remove(taskId, commentId) {
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
            onError(err.message || 'Unable to delete comment.')
        } finally {
            setDeletingCommentId(null)
        }
    }

    // Drop everything about a task that was deleted. Memoised (it only uses
    // state setters) so it can be a stable dependency of other effects.
    const forgetTask = useCallback((taskId) => {
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
