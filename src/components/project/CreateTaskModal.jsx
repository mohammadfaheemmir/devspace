import { useRef, useState } from 'react'
import { useToast } from '../../context/useToast'
import { X } from 'lucide-react'
import { createTask } from '../../lib/taskService'
import { getLocalDateString } from './taskUtils'
import { useDismiss } from '../../hooks/useDismiss'

const EMPTY_TASK_FORM = {
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
}

const inputClass =
    'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500'

// Modal form for creating a task. Calls onCreated(task) and closes on success.
function CreateTaskModal({ projectId, members, onCreated, onClose, onError }) {
    const toast = useToast()
    const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM)
    const [saving, setSaving] = useState(false)
    const dialogRef = useRef(null)

    // Escape or a click on the backdrop closes the modal (not while saving).
    useDismiss(dialogRef, !saving, onClose)

    function handleInputChange(event) {
        const { name, value } = event.target

        setTaskForm((previous) => ({
            ...previous,
            [name]: value,
        }))
    }

    async function handleCreateTask(event) {
        event.preventDefault()

        try {
            setSaving(true)
            onError('')

            const newTask = await createTask(projectId, taskForm)

            onCreated(newTask)
            toast.success('Task created.')
            onClose()
        } catch (err) {
            onError(err.message || 'Unable to create task.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-task-title"
                className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id="create-task-title" className="text-xl font-semibold">
                        Create a new task
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white"
                        aria-label="Close form"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-4">
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
                            className={`${inputClass} resize-none`}
                        />
                    </div>

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
                            min={getLocalDateString()}
                            className={`${inputClass} text-slate-200`}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            Choose the date by which this task should be completed.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {saving ? 'Creating...' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateTaskModal
