import { CalendarClock, Flag, UserRound } from 'lucide-react'
import MemberAvatar from './MemberAvatar'
import { formatDueDate, getPriorityBadgeClasses, isTaskOverdue } from './taskUtils'
import type { ProjectMember, Task } from '../../types/app'

type TaskMetaProps = {
    task: Task
    members: ProjectMember[]
}

// One compact row of task facts: priority, due date and assignee.
function TaskMeta({ task, members }: TaskMetaProps) {
    const overdue = isTaskOverdue(task)
    const assignee = task.assignee_id
        ? members.find((member) => member.user_id === task.assignee_id)
        : null

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 capitalize ${getPriorityBadgeClasses(task.priority)}`}>
                <Flag size={12} />
                {task.priority || 'medium'}
            </span>

            {task.due_date && (
                <span
                    className={`inline-flex items-center gap-1 ${overdue
                        ? 'font-medium text-red-400'
                        : task.status === 'done'
                            ? 'text-green-400'
                            : 'text-slate-400'
                        }`}
                >
                    <CalendarClock size={13} />
                    {overdue ? `Overdue · ${formatDueDate(task.due_date)}` : `Due ${formatDueDate(task.due_date)}`}
                </span>
            )}

            <span className="inline-flex items-center gap-1.5 text-slate-400">
                {task.assignee_id ? (
                    <>
                        <MemberAvatar member={assignee} size="sm" />
                        <span className="text-slate-300">{assignee?.full_name || 'Unknown member'}</span>
                    </>
                ) : (
                    <>
                        <UserRound size={13} />
                        Unassigned
                    </>
                )}
            </span>
        </div>
    )
}

export default TaskMeta
