import { useState } from 'react'
import {
    CheckCircle2,
    Clock3,
    Circle,
    Pencil,
    type LucideIcon,
} from 'lucide-react'
import TaskMeta from './TaskMeta'
import { getStatusAccent } from './taskUtils'
import type { ProjectLabel, ProjectMember, Task, TaskStatus } from '../../types/app'
import { TaskLabelList } from './LabelChip'

type Column = { id: TaskStatus; title: string; icon: LucideIcon; color: string }

const COLUMNS: Column[] = [
    { id: 'todo', title: 'To Do', icon: Circle, color: 'text-slate-400' },
    { id: 'in_progress', title: 'In Progress', icon: Clock3, color: 'text-yellow-400' },
    { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-green-400' },
]

type TaskKanbanBoardProps = {
    tasks?: Task[]
    members?: ProjectMember[]
    onStatusChange: (taskId: string, status: string) => void
    onEdit?: (task: Task) => void
    updatingTaskIds?: string[]
    labels?: ProjectLabel[]
    labelIdsByTask?: Record<string, string[]>
}

function TaskKanbanBoard({ tasks = [], members = [], onStatusChange, onEdit, updatingTaskIds = [], labels = [], labelIdsByTask = {} }: TaskKanbanBoardProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
    const columns = COLUMNS

    function handleDrop(status: TaskStatus) {
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
                            // relatedTarget is where the pointer went; ignore moves within the column.
                            const next = event.relatedTarget
                            if (!(next instanceof Node && event.currentTarget.contains(next))) {
                                setDragOverColumn(null)
                            }
                        }}
                        onDrop={(event) => {
                            event.preventDefault()
                            handleDrop(column.id)
                        }}
                        className={`min-h-[300px] rounded-xl border p-4 transition ${dragOverColumn === column.id
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-900/50'
                            }`}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon size={17} className={column.color} />
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{column.title}</h3>
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
                                    className={`rounded-lg border border-l-4 border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-600 ${getStatusAccent(task.status)} ${draggedTaskId === task.id ? 'opacity-40' : ''
                                        } ${updatingTaskIds.includes(task.id) ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                                >
                                    <h4 className={`break-words font-medium ${task.status === 'done' ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-100'}`}>
                                        {task.title}
                                    </h4>
                                    {task.description && (
                                        <p className="mt-1.5 line-clamp-2 break-words text-sm text-slate-400">{task.description}</p>
                                    )}
                                    {(labelIdsByTask[task.id]?.length ?? 0) > 0 && (
                                        <div className="mt-3">
                                            <TaskLabelList labels={labels} labelIds={labelIdsByTask[task.id]} />
                                        </div>
                                    )}
                                    <div className="mt-3">
                                        <TaskMeta task={task} members={members} />
                                    </div>
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
                                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                                    {tasks.length > 0 ? 'Drag a task here' : 'No tasks in this column'}
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
