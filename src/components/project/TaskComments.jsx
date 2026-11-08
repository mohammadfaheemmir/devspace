import { useState } from 'react'
import { MessageCircle, Pencil, Send, Trash2, UserRound } from 'lucide-react'

// Toggleable comment thread for one task, driven by useTaskComments().
function TaskComments({ taskId, comments, currentUserId, isProjectAdmin }) {
    const taskComments = comments.commentsByTask[taskId] || []
    const isOpen = comments.expandedTaskId === taskId
    const draft = comments.drafts[taskId] || ''
    const isSending = comments.sendingTaskId === taskId

    // Which comment is being edited, and its unsaved text.
    const [editingCommentId, setEditingCommentId] = useState(null)
    const [editDraft, setEditDraft] = useState('')

    function handleSubmit(event) {
        event.preventDefault()
        comments.submit(taskId)
    }

    function startEditing(comment) {
        setEditingCommentId(comment.id)
        setEditDraft(comment.content)
    }

    function cancelEditing() {
        setEditingCommentId(null)
        setEditDraft('')
    }

    async function saveEdit(commentId) {
        const saved = await comments.edit(taskId, commentId, editDraft)
        if (saved) cancelEditing()
    }

    // Escape cancels editing; Ctrl/Cmd + Enter saves.
    function handleEditKeyDown(event, commentId) {
        if (event.key === 'Escape') {
            event.stopPropagation()
            cancelEditing()
        }

        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            saveEdit(commentId)
        }
    }

    return (
        <div className="mt-5 border-t border-slate-800 pt-4">
            <button
                type="button"
                onClick={() => comments.toggle(taskId)}
                aria-expanded={isOpen}
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
            >
                <MessageCircle size={17} />

                {isOpen ? 'Hide comments' : 'View comments'}

                {comments.hasLoaded(taskId) && (
                    <span className="text-slate-400">({taskComments.length})</span>
                )}
            </button>

            {isOpen && (
                <div className="mt-5 space-y-5">
                    {comments.loadingTaskId === taskId ? (
                        <p className="text-sm text-slate-400">Loading comments...</p>
                    ) : (
                        <>
                            {taskComments.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    No comments yet. Start the discussion.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {taskComments.map((comment) => (
                                        <div key={comment.id} className="flex items-start gap-3">
                                            {comment.author_avatar ? (
                                                <img
                                                    src={comment.author_avatar}
                                                    alt=""
                                                    className="w-9 h-9 rounded-full object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                                                    <UserRound size={17} />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-sm font-medium">{comment.author_name}</p>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(comment.created_at).toLocaleString()}
                                                    </span>
                                                </div>

                                                {editingCommentId === comment.id ? (
                                                    <div className="mt-2 space-y-2">
                                                        <textarea
                                                            value={editDraft}
                                                            onChange={(event) => setEditDraft(event.target.value)}
                                                            onKeyDown={(event) => handleEditKeyDown(event, comment.id)}
                                                            aria-label="Edit comment"
                                                            rows={3}
                                                            maxLength={2000}
                                                            autoFocus
                                                            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => saveEdit(comment.id)}
                                                                disabled={
                                                                    comments.savingCommentId === comment.id ||
                                                                    !editDraft.trim() ||
                                                                    editDraft.trim() === comment.content
                                                                }
                                                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {comments.savingCommentId === comment.id ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditing}
                                                                disabled={comments.savingCommentId === comment.id}
                                                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap break-words">
                                                        {comment.content}
                                                    </p>
                                                )}

                                                {editingCommentId !== comment.id && (
                                                    <div className="mt-3 flex items-center gap-4">
                                                        {/* Only the author edits; admins may also delete. */}
                                                        {comment.author_id === currentUserId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditing(comment)}
                                                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
                                                            >
                                                                <Pencil size={13} />
                                                                Edit
                                                            </button>
                                                        )}

                                                        {(comment.author_id === currentUserId || isProjectAdmin) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => comments.remove(taskId, comment.id)}
                                                                disabled={comments.deletingCommentId === comment.id}
                                                                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                                            >
                                                                <Trash2 size={13} />
                                                                {comments.deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                                <textarea
                                    value={draft}
                                    onChange={(event) => comments.setDraft(taskId, event.target.value)}
                                    placeholder="Write a comment..."
                                    aria-label="Write a comment"
                                    rows={2}
                                    maxLength={2000}
                                    required
                                    className="flex-1 min-w-0 resize-none bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                                />

                                <button
                                    type="submit"
                                    disabled={isSending || !draft.trim()}
                                    className="flex items-center justify-center gap-2 self-end sm:self-stretch bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-medium transition"
                                >
                                    <Send size={16} />
                                    {isSending ? 'Posting...' : 'Post'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default TaskComments
