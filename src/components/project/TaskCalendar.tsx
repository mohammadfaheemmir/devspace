import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task, TaskStatus } from '../../types/app'
import { formatDueDate, getLocalDateString, isTaskOverdue } from './taskUtils'
import {
    addMonths,
    formatMonthLabel,
    getMonthGrid,
    getWeekdayLabels,
    groupTasksByDueDate,
} from './calendarUtils'

// How many tasks a day cell shows before collapsing the rest into "+N more".
const MAX_VISIBLE_PER_DAY = 3

const STATUS_STYLES: Record<TaskStatus, string> = {
    todo: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
    in_progress: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
    done: 'border-green-500/30 bg-green-500/10 text-green-300 line-through decoration-green-500/60',
}
const OVERDUE_STYLE = 'border-red-500/50 bg-red-500/15 text-red-200'

function chipClasses(task: Task): string {
    return isTaskOverdue(task) ? OVERDUE_STYLE : STATUS_STYLES[task.status]
}

function chipLabel(task: Task): string {
    const parts = [task.title, `due ${formatDueDate(task.due_date)}`]
    if (isTaskOverdue(task)) parts.push('overdue')
    else if (task.status === 'done') parts.push('done')
    return parts.join(', ')
}

type TaskCalendarProps = {
    tasks: Task[]
    onEdit: (task: Task) => void
}

// Month calendar of task due dates. A grid on larger screens; on phones
// (where seven columns are too cramped) a list of the month's due dates.
function TaskCalendar({ tasks, onEdit }: TaskCalendarProps) {
    const today = getLocalDateString()
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const now = new Date()
        return { year: now.getFullYear(), monthIndex: now.getMonth() }
    })
    const [expandedDays, setExpandedDays] = useState<string[]>([])

    const { year, monthIndex } = visibleMonth
    const grid = getMonthGrid(year, monthIndex)
    const tasksByDate = groupTasksByDueDate(tasks)
    const monthLabel = formatMonthLabel(year, monthIndex)
    const weekdays = getWeekdayLabels()
    const undatedCount = tasks.filter((task) => !task.due_date).length

    const daysWithTasksThisMonth = grid.filter(
        (day) => day.inMonth && (tasksByDate[day.key]?.length ?? 0) > 0
    )

    function goToMonth(amount: number) {
        setVisibleMonth((current) => addMonths(current.year, current.monthIndex, amount))
        setExpandedDays([])
    }

    function goToToday() {
        const now = new Date()
        setVisibleMonth({ year: now.getFullYear(), monthIndex: now.getMonth() })
        setExpandedDays([])
    }

    function formatLongDate(key: string): string {
        const [y, m, d] = key.split('-').map(Number)
        return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
            .format(new Date(y ?? 0, (m ?? 1) - 1, d ?? 1))
    }

    // A plain render function, not a nested component: a component defined
    // inside another is recreated on every render, which remounts the
    // buttons and loses keyboard focus.
    function renderChip(task: Task) {
        return (
            <button
                key={task.id}
                type="button"
                onClick={() => onEdit(task)}
                aria-label={chipLabel(task)}
                title={task.title}
                className={`block w-full truncate rounded-md border px-2 py-1 text-left text-xs transition hover:brightness-125 ${chipClasses(task)}`}
            >
                {task.title}
            </button>
        )
    }

    return (
        <section aria-label={`Task calendar, ${monthLabel}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-black/20 sm:p-5">
            {/* Month navigation */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold" aria-live="polite">
                    <CalendarDays size={19} className="text-indigo-400" />
                    {monthLabel}
                </h3>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        aria-label="Previous month"
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        <ChevronLeft size={17} />
                    </button>
                    <button
                        type="button"
                        onClick={goToToday}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        aria-label="Next month"
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        <ChevronRight size={17} />
                    </button>
                </div>
            </div>

            {/* Grid: larger screens */}
            <div className="hidden sm:block">
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800">
                    {weekdays.map((weekday) => (
                        <div key={weekday} className="bg-slate-900 px-2 py-2 text-center text-xs font-medium text-slate-400">
                            {weekday}
                        </div>
                    ))}

                    {grid.map((day) => {
                        const dayTasks = tasksByDate[day.key] ?? []
                        const expanded = expandedDays.includes(day.key)
                        const visibleTasks = expanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_PER_DAY)
                        const hiddenCount = dayTasks.length - visibleTasks.length
                        const isToday = day.key === today

                        return (
                            <div
                                key={day.key}
                                role="group"
                                aria-label={`${formatLongDate(day.key)}, ${dayTasks.length} ${dayTasks.length === 1 ? 'task' : 'tasks'}`}
                                className={`min-h-28 space-y-1 p-1.5 ${isToday ? 'bg-indigo-950/40' : day.inMonth ? 'bg-slate-950' : 'bg-slate-950/60'}`}
                            >
                                <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday
                                        ? 'bg-indigo-600 font-semibold text-white'
                                        : day.inMonth ? 'text-slate-300' : 'text-slate-500'
                                        }`}
                                    aria-current={isToday ? 'date' : undefined}
                                >
                                    {day.day}
                                </span>

                                {visibleTasks.map(renderChip)}

                                {hiddenCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandedDays((current) => [...current, day.key])}
                                        className="w-full rounded px-1 text-left text-xs font-medium text-indigo-300 hover:text-indigo-200"
                                    >
                                        +{hiddenCount} more
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Agenda list: phones */}
            <div className="sm:hidden">
                {daysWithTasksThisMonth.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                        No tasks due in {monthLabel}.
                    </p>
                ) : (
                    <ul className="space-y-4">
                        {daysWithTasksThisMonth.map((day) => (
                            <li key={day.key}>
                                <h4 className={`mb-2 text-sm font-medium ${day.key === today ? 'text-indigo-300' : 'text-slate-300'}`}>
                                    {formatLongDate(day.key)}
                                    {day.key === today && ' · Today'}
                                </h4>
                                <div className="space-y-1.5">
                                    {(tasksByDate[day.key] ?? []).map(renderChip)}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Legend and undated tasks */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-500/70" />To do</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-yellow-500/60" />In progress</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500/60" />Done</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/70" />Overdue</span>
                {undatedCount > 0 && (
                    <span className="sm:ml-auto">
                        {undatedCount} {undatedCount === 1 ? 'task has' : 'tasks have'} no due date and {undatedCount === 1 ? 'is' : 'are'} not shown.
                    </span>
                )}
            </div>
        </section>
    )
}

export default TaskCalendar
