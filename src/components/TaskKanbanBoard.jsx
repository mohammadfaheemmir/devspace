import { useState } from 'react'
import { Circle, Clock3, CheckCircle2 } from 'lucide-react'

const columns = [
    {
        id: 'todo',
        title: 'To Do',
        icon: Circle,
        color: 'text-slate-400',
        border: 'border-slate-700',
    },
    {
        id: 'in_progress',
        title: 'In Progress',
        icon: Clock3,
        color: 'text-yellow-400',
        border: 'border-yellow-500/30',
    },
    {
        id: 'done',
        title: 'Done',
        icon: CheckCircle2,
        color: 'text-green-400',
        border: 'border-green-500/30',
    },
]

function TaskKanbanBoard({
    tasks,
    members,
    onStatusChange,
    updatingTaskId,
}) {
    const [draggedTaskId, setDraggedTaskId] = useState(null)
    const [dragOverColumn, setDragOverColumn] = useState(null)

    function getMemberName(userId) {
        const member = members.find(
            (item) => item.user_id === userId
        )

        return member?.full_name || 'Unknown member'
    }

    function handleDrop(status) {
        if (!draggedTaskId) return

        const task = tasks.find(
            (item) => item.id === draggedTaskId
        )

        if (task && task.status !== status) {
            onStatusChange(task.id, status)
        }

        setDraggedTaskId(null)
        setDragOverColumn(null)
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((column) => {
                const Icon = column.icon

                const columnTasks = tasks.filter(
                    (task) => task.status === column.id
                )

                return (
                    <div
                        key={column.id}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverColumn(column.id)
                        }}
                        onDragLeave={() => {
                            setDragOverColumn(null)
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            handleDrop(column.id)
                        }}
                        className={`min-h-[300px] rounded-xl border p-4 transition ${dragOverColumn === column.id
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-slate-800 bg-slate-900'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Icon
                                    size={19}
                                    className={column.color}
                                />

                                <h3 className="font-semibold">
                                    {column.title}
                                </h3>
                            </div>

                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {columnTasks.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {columnTasks.map((task) => (
                                <div
                                    key={task.id}
                                    draggable={updatingTaskId !== task.id}
                                    onDragStart={() => {
                                        setDraggedTaskId(task.id)
                                    }}
                                    onDragEnd={() => {
                                        setDraggedTaskId(null)
                                        setDragOverColumn(null)
                                    }}
                                    className={`rounded-lg border border-slate-700 bg-slate-950 p-4 cursor-grab active:cursor-grabbing transition hover:border-indigo-500 ${draggedTaskId === task.id
                                            ? 'opacity-40'
                                            : ''
                                        }`}
                                >
                                    <h4 className="font-medium text-slate-100 break-words">
                                        {task.title}
                                    </h4>

                                    {task.description && (
                                        <p className="mt-2 text-sm text-slate-400 break-words">
                                            {task.description}
                                        </p>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs capitalize ${task.priority === 'high'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : task.priority === 'medium'
                                                        ? 'bg-yellow-500/10 text-yellow-400'
                                                        : 'bg-green-500/10 text-green-400'
                                                }`}
                                        >
                                            {task.priority || 'medium'} priority
                                        </span>
                                    </div>

                                    <p className="mt-3 text-xs text-slate-400">
                                        Assigned to:{' '}
                                        {task.assignee_id
                                            ? getMemberName(task.assignee_id)
                                            : 'Unassigned'}
                                    </p>

                                    <select
                                        value={task.status}
                                        disabled={updatingTaskId === task.id}
                                        onChange={(e) =>
                                            onStatusChange(
                                                task.id,
                                                e.target.value
                                            )
                                        }
                                        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 disabled:opacity-50"
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">
                                            In Progress
                                        </option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                            ))}

                            {columnTasks.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                                    Drop tasks here
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default TaskKanbanBoard