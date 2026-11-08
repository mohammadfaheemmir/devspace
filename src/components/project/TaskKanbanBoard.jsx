import { useState } from 'react'
import {
    CheckCircle2,
    Clock3,
    Circle,
    Pencil,
} from 'lucide-react'
import {
    formatDueDate,
    getPriorityBadgeClasses,
    isTaskOverdue,
} from './taskUtils'

function TaskKanbanBoard({ tasks = [], members = [], onStatusChange, onEdit, updatingTaskIds = [] }) {
    const [draggedTaskId, setDraggedTaskId] = useState(null)
    const [dragOverColumn, setDragOverColumn] = useState(null)

    const columns = [
        { id: 'todo', title: 'To Do', icon: Circle, color: 'text-slate-400' },
        { id: 'in_progress', title: 'In Progress', icon: Clock3, color: 'text-yellow-400' },
        { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-green-400' },
    ]

    function getMemberName(userId) {
        const member = members.find((item) => item.user_id === userId)
        return member?.full_name || 'Unknown member'
    }

    function handleDrop(status) {
        if (!draggedTaskId) return
        const task = tasks.find((item) => item.id === draggedTaskId)
        if (task && task.status !== status) onStatusChange(task.id, status)
        setDraggedTaskId(null)
        setDragOverColumn(null)
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {columns.map((column) => {
                const Icon = column.icon
                const columnTasks = tasks.filter((task) => task.status === column.id)

                return (
                    <section
                        key={column.id}
                        onDragOver={(event) => {
                            event.preventDefault()
                            setDragOverColumn(column.id)
                        }}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                                setDragOverColumn(null)
                            }
                        }}
                        onDrop={(event) => {
                            event.preventDefault()
                            handleDrop(column.id)
                        }}
                        className={`min-h-[300px] rounded-xl border p-4 transition ${dragOverColumn === column.id
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-900'
                            }`}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon size={19} className={column.color} />
                                <h3 className="font-semibold">{column.title}</h3>
                            </div>
                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {columnTasks.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {columnTasks.map((task) => (
                                <article
                                    key={task.id}
                                    draggable={!updatingTaskIds.includes(task.id)}
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move'
                                        event.dataTransfer.setData('text/plain', task.id)
                                        setDraggedTaskId(task.id)
                                    }}
                                    onDragEnd={() => {
                                        setDraggedTaskId(null)
                                        setDragOverColumn(null)
                                    }}
                                    className={`rounded-lg border border-slate-700 bg-slate-950 p-4 transition hover:border-indigo-500 ${draggedTaskId === task.id ? 'opacity-40' : ''
                                        } ${updatingTaskIds.includes(task.id) ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                                >
                                    <h4 className="break-words font-medium text-slate-100">{task.title}</h4>
                                    {task.description && (
                                        <p className="mt-2 break-words text-sm text-slate-400">{task.description}</p>
                                    )}
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${getPriorityBadgeClasses(task.priority)}`}>
                                            {task.priority || 'medium'} priority
                                        </span>
                                    </div>
                                    {task.due_date && (
                                        <p className={`mt-3 flex items-center gap-2 text-xs ${isTaskOverdue(task)
                                            ? 'text-red-400'
                                            : task.status === 'done'
                                                ? 'text-green-400'
                                                : 'text-slate-400'
                                            }`}>
                                            <Clock3 size={14} />
                                            {isTaskOverdue(task)
                                                ? `Overdue · ${formatDueDate(task.due_date)}`
                                                : `Due ${formatDueDate(task.due_date)}`}
                                        </p>
                                    )}
                                    <p className="mt-3 text-xs text-slate-400">
                                        Assigned to: {task.assignee_id ? getMemberName(task.assignee_id) : 'Unassigned'}
                                    </p>
                                    <select
                                        value={task.status}
                                        disabled={updatingTaskIds.includes(task.id)}
                                        onChange={(event) => onStatusChange(task.id, event.target.value)}
                                        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 disabled:opacity-50"
                                        aria-label={`Change status for ${task.title}`}
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="done">Done</option>
                                    </select>
                                    {onEdit && (
                                        <button
                                            type="button"
                                            onClick={() => onEdit(task)}
                                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
                                            aria-label={`Edit ${task.title}`}
                                        >
                                            <Pencil size={13} />
                                            Edit
                                        </button>
                                    )}
                                </article>
                            ))}
                            {columnTasks.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                                    No tasks in this column
                                </div>
                            )}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}

export default TaskKanbanBoard
