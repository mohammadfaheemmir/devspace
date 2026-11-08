import { Clock3, Pencil } from 'lucide-react'
import TaskComments from './TaskComments'
import {
    formatDueDate,
    getMemberName,
    getPriorityBadgeClasses,
    isTaskOverdue,
} from './taskUtils'
import type { ProjectLabel, ProjectMember, Task } from '../../types/app'
import { TaskLabelList } from './LabelChip'
import type { TaskCommentsApi } from '../../hooks/useTaskComments'

type TaskListItemProps = {
    task: Task
    members: ProjectMember[]
    isUpdating: boolean
    onStatusChange: (taskId: string, status: string) => void
    onAssigneeChange: (taskId: string, assigneeId: string) => void
    comments: TaskCommentsApi
    currentUserId: string | null
    isProjectAdmin: boolean
    onEdit: () => void
    labels?: ProjectLabel[]
    labelIds?: string[]
}

const selectClass =
    'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50'

// One task in the list view: details, status/assignee pickers and comments.
function TaskListItem({
    task,
    members,
    isUpdating,
    onStatusChange,
    onAssigneeChange,
    comments,
    currentUserId,
    isProjectAdmin,
    onEdit,
    labels = [],
    labelIds,
}: TaskListItemProps) {
    const overdue = isTaskOverdue(task)

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="font-semibold break-words">{task.title}</h3>

                    {task.description && (
                        <p className="text-sm text-slate-400 mt-1 break-words">{task.description}</p>
                    )}

                    <div className="mt-3">
                        <TaskLabelList labels={labels} labelIds={labelIds} />
                    </div>

                    <span className={`inline-block mt-3 text-xs px-3 py-1 rounded-full capitalize ${getPriorityBadgeClasses(task.priority)}`}>
                        {task.priority || 'medium'} priority
                    </span>

                    {task.due_date && (
                        <p className={`mt-3 flex items-center gap-2 text-xs ${overdue
                            ? 'text-red-400'
                            : task.status === 'done'
                                ? 'text-green-400'
                                : 'text-slate-400'
                            }`}>
                            <Clock3 size={14} />
                            {overdue
                                ? `Overdue · ${formatDueDate(task.due_date)}`
                                : `Due ${formatDueDate(task.due_date)}`}
                        </p>
                    )}

                    <p className="text-xs text-slate-400 mt-3">
                        Assigned to:{' '}
                        {task.assignee_id ? getMemberName(members, task.assignee_id) : 'Unassigned'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={task.status}
                        disabled={isUpdating}
                        onChange={(event) => onStatusChange(task.id, event.target.value)}
                        aria-label={`Status for ${task.title}`}
                        className={selectClass}
                    >
                        <option value="todo">Todo</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                    </select>

                    <select
                        value={task.assignee_id || ''}
                        disabled={isUpdating}
                        onChange={(event) => onAssigneeChange(task.id, event.target.value)}
                        aria-label={`Assignee for ${task.title}`}
                        className={selectClass}
                    >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                                {member.full_name}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        aria-label={`Edit ${task.title}`}
                    >
                        <Pencil size={15} />
                        Edit
                    </button>

                    {isUpdating && (
                        <span className="text-xs text-slate-400 self-center">Saving...</span>
                    )}
                </div>
            </div>

            <TaskComments
                taskId={task.id}
                comments={comments}
                currentUserId={currentUserId}
                isProjectAdmin={isProjectAdmin}
            />
        </div>
    )
}

export default TaskListItem
