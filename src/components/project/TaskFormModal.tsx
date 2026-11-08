import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { useToast } from '../../context/useToast'
import { createTask, deleteTask, updateTask } from '../../lib/taskService'
import { getLocalDateString } from './taskUtils'
import { useDismiss } from '../../hooks/useDismiss'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { getErrorMessage } from '../../lib/errors'
import type { TaskInput } from '../../lib/taskService'
import type { ProjectLabel, ProjectMember, Task } from '../../types/app'
import { setTaskLabels } from '../../lib/labelService'
import { LABEL_STYLES } from './labelStyles'
import TaskAttachments from './TaskAttachments'
import { removeTaskFiles } from '../../lib/attachmentService'

type TaskForm = {
    title: string
    description: string
    priority: string
    assignee_id: string
    due_date: string
}

type TaskFormModalProps = {
    projectId: string
    members: ProjectMember[]
    /** Edit this task; omit to create a new one. */
    task?: Task | null
    canDelete?: boolean
    onSaved: (task: Task) => void
    onDeleted?: (taskId: string) => void
    onClose: () => void
    onError: (message: string) => void
    /** The project's labels; the Labels section is shown when there are any. */
    labels?: ProjectLabel[]
    /** Label IDs currently on the task (edit mode). */
    initialLabelIds?: string[]
    /** Called with the task's new label IDs after they are saved. */
    onLabelsSaved?: (taskId: string, labelIds: string[]) => void
    /** Used in edit mode to decide who may delete attachments. */
    currentUserId?: string | null
    isProjectAdmin?: boolean
}

const EMPTY_TASK_FORM: TaskForm = {
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
}

const inputClass =
    'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500'

function formFromTask(task: Task): TaskForm {
    return {
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        assignee_id: task.assignee_id || '',
        due_date: task.due_date || '',
    }
}

// Modal form for creating a task, or editing one when `task` is given.
// Create: calls onSaved(newTask). Edit: calls onSaved(updatedTask), and
// onDeleted(taskId) if the user deletes it (only when canDelete is true).
function TaskFormModal({
    projectId,
    members,
    task = null,
    canDelete = false,
    onSaved,
    onDeleted,
    onClose,
    onError,
    labels = [],
    initialLabelIds = [],
    onLabelsSaved,
    currentUserId = null,
    isProjectAdmin = false,
}: TaskFormModalProps) {
    const toast = useToast()
    const isEditing = Boolean(task)

    const [taskForm, setTaskForm] = useState<TaskForm>(() =>
        task ? formFromTask(task) : EMPTY_TASK_FORM
    )
    const [saving, setSaving] = useState(false)
    // Labels as they were when the dialog opened. Only the user's own
    // additions and removals are saved, so a teammate's label change made
    // while this dialog is open is not undone.
    const [openingLabelIds] = useState<string[]>(initialLabelIds)
    const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(initialLabelIds)
    const [deleting, setDeleting] = useState(false)
    const busy = saving || deleting
    const dialogRef = useRef(null)

    // Escape or a click on the backdrop closes the modal (not while busy).
    useDismiss(dialogRef, !busy, onClose)

    // Keep keyboard focus inside the dialog while it is open.
    useDialogFocus(dialogRef, true)

    function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const { name, value } = event.target

        setTaskForm((previous) => ({
            ...previous,
            [name]: value,
        }))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        try {
            setSaving(true)
            onError('')

            const input: TaskInput = taskForm
            const savedTask = task
                ? await updateTask(task.id, input)
                : await createTask(projectId, input)

            onSaved(savedTask)

            // Labels are saved separately. If that fails, the task itself is
            // already saved, so say exactly what did not work.
            const added = selectedLabelIds.filter((id) => !openingLabelIds.includes(id))
            const removed = openingLabelIds.filter((id) => !selectedLabelIds.includes(id))

            if (added.length > 0 || removed.length > 0) {
                try {
                    // Apply just this user's changes on top of the task's current
                    // labels (which may include a teammate's recent changes).
                    const current = initialLabelIds
                    const next = [...current.filter((id) => !removed.includes(id)), ...added.filter((id) => !current.includes(id))]
                    const saved = await setTaskLabels(savedTask.id, projectId, current, next)
                    onLabelsSaved?.(savedTask.id, saved)
                } catch (labelError) {
                    onError(getErrorMessage(labelError, 'The task was saved, but its labels could not be updated.'))
                    onClose()
                    return
                }
            }

            toast.success(isEditing ? 'Task updated.' : 'Task created.')
            onClose()
        } catch (err) {
            onError(getErrorMessage(err, isEditing ? 'Unable to update task.' : 'Unable to create task.'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!task) return

        const confirmed = window.confirm(
            `Delete "${task.title}"? This cannot be undone.`
        )

        if (!confirmed) return

        try {
            setDeleting(true)
            onError('')

            // Supabase cannot delete files when the task's rows cascade away,
            // so remove the task's files first (best effort).
            await removeTaskFiles(projectId, task.id)
            await deleteTask(task.id)

            onDeleted?.(task.id)
            toast.success('Task deleted.')
            onClose()
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to delete task.'))
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-form-title"
                className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id="task-form-title" className="text-xl font-semibold">
                        {isEditing ? 'Edit task' : 'Create a new task'}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="text-slate-400 hover:text-white disabled:opacity-50"
                        aria-label="Close form"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="task-title" className="block text-sm text-slate-300 mb-2">
                            Task title
                        </label>
                        <input
                            id="task-title"
                            type="text"
                            name="title"
                            value={taskForm.title}
                            onChange={handleInputChange}
                            placeholder="e.g. Design the login page"
                            maxLength={200}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="task-description" className="block text-sm text-slate-300 mb-2">
                            Description
                        </label>
                        <textarea
                            id="task-description"
                            name="description"
                            value={taskForm.description}
                            onChange={handleInputChange}
                            placeholder="Describe what needs to be done..."
                            rows={3}
                            maxLength={2000}
                            className={`${inputClass} resize-none`}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="task-priority" className="block text-sm text-slate-300 mb-2">
                                Priority
                            </label>
                            <select
                                id="task-priority"
                                name="priority"
                                value={taskForm.priority}
                                onChange={handleInputChange}
                                className={inputClass}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="task-assignee" className="block text-sm text-slate-300 mb-2">
                                Assign to
                            </label>
                            <select
                                id="task-assignee"
                                name="assignee_id"
                                value={taskForm.assignee_id}
                                onChange={handleInputChange}
                                className={inputClass}
                            >
                                <option value="">Unassigned</option>
                                {members.map((member) => (
                                    <option key={member.user_id} value={member.user_id}>
                                        {member.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {task && (
                        <TaskAttachments
                            projectId={projectId}
                            taskId={task.id}
                            currentUserId={currentUserId}
                            isProjectAdmin={isProjectAdmin}
                            taskCreatedBy={task.created_by}
                            onError={onError}
                        />
                    )}

                    {labels.length > 0 && (
                            <fieldset>
                                <legend className="mb-2 block text-sm text-slate-300">Labels</legend>
                                <div className="flex flex-wrap gap-2">
                                    {labels.map((label) => {
                                        const selected = selectedLabelIds.includes(label.id)
                                        return (
                                            <button
                                                key={label.id}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() =>
                                                    setSelectedLabelIds((current) =>
                                                        selected
                                                            ? current.filter((id) => id !== label.id)
                                                            : [...current, label.id]
                                                    )
                                                }
                                                className={`rounded-full border px-3 py-1 text-xs transition ${selected
                                                    ? `${LABEL_STYLES[label.color].chip} ring-1 ring-white/40`
                                                    : 'border-slate-700 text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {selected ? '✓ ' : ''}{label.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </fieldset>
                        )}

                    <div>
                        <label htmlFor="task-due-date" className="block text-sm text-slate-300 mb-2">
                            Due date (optional)
                        </label>
                        <input
                            id="task-due-date"
                            type="date"
                            name="due_date"
                            value={taskForm.due_date || ''}
                            onChange={handleInputChange}
                            // New tasks cannot be due in the past; existing tasks may
                            // already have a past date, so don't block saving them.
                            min={isEditing ? undefined : getLocalDateString()}
                            className={`${inputClass} text-slate-200`}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                            Choose the date by which this task should be completed.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                        {isEditing && canDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={busy}
                                className="mr-auto flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                                {deleting ? 'Deleting...' : 'Delete task'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={busy}
                            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {saving
                                ? (isEditing ? 'Saving...' : 'Creating...')
                                : (isEditing ? 'Save changes' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TaskFormModal
