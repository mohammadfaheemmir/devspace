import { LoaderCircle, Pencil } from 'lucide-react'
import TaskComments from './TaskComments'
import TaskMeta from './TaskMeta'
import { getStatusAccent } from './taskUtils'
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
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition hover:border-slate-600 focus:border-indigo-500 disabled:opacity-50 sm:w-auto'

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
    const done = task.status === 'done'

    return (
        <div className={`rounded-xl border border-l-4 border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/10 transition hover:border-slate-700 sm:p-5 ${getStatusAccent(task.status)}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <h3 className={`break-words font-semibold ${done ? 'text-slate-400 line-through decoration-slate-600' : ''}`}>
                        {task.title}
                    </h3>

                    {task.description && (
                        <p className="mt-1 line-clamp-3 break-words text-sm text-slate-400">{task.description}</p>
                    )}

                    {labelIds && labelIds.length > 0 && (
                        <div className="mt-3">
                            <TaskLabelList labels={labels} labelIds={labelIds} />
                        </div>
                    )}

                    <div className="mt-3">
                        <TaskMeta task={task} members={members} />
                    </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
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
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500/60 hover:bg-slate-800 hover:text-white"
                        aria-label={`Edit ${task.title}`}
                    >
                        <Pencil size={15} />
                        Edit
                    </button>

                    {isUpdating && (
                        <span role="status" className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                            <LoaderCircle size={13} className="animate-spin" />
                            Saving...
                        </span>
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
