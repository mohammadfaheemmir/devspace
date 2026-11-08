import { useEffect, useRef, useState } from 'react'
import {
    Bell,
    AlertCircle,
    CalendarClock,
    CheckCheck,
} from 'lucide-react'
import { formatDueDate, getLocalDateString } from './taskUtils'
import { useDismiss } from '../../hooks/useDismiss'
import type { Task } from '../../types/app'

type Reminder = {
    id: string
    task: Task
    daysUntilDue: number
    type: 'overdue' | 'upcoming'
}

// Bell button with a dropdown of tasks that are overdue or due within
// three days. Read state is remembered per project in localStorage.
type TaskRemindersProps = {
    projectId: string
    projectName: string
    tasks: Task[]
    tasksLoaded: boolean
}

function TaskReminders({ projectId, projectName, tasks, tasksLoaded }: TaskRemindersProps) {
    const [showNotifications, setShowNotifications] = useState(false)
    const menuRef = useRef(null)

    // Close the dropdown on Escape or a click outside it.
    useDismiss(menuRef, showNotifications, () => setShowNotifications(false))

    const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`task-notifications-read-${projectId}`)
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })

    // Save which reminders were read. Only IDs that still match an existing
    // task and due date are kept, so storage does not grow forever.
    useEffect(() => {
        if (!tasksLoaded) return

        const validIds = new Set(
            tasks
                .filter((task) => task.due_date)
                .map((task) => `${task.id}-${task.due_date}`)
        )

        try {
            localStorage.setItem(
                `task-notifications-read-${projectId}`,
                JSON.stringify(
                    readNotificationIds.filter((id) => validIds.has(id))
                )
            )
        } catch (storageError) {
            console.warn('Unable to save notification read state:', storageError)
        }
    }, [readNotificationIds, projectId, tasks, tasksLoaded])

    // Build reminders from tasks due today, within the next three days, or overdue.
    // These are derived from existing task data, so no database migration is needed.
    const today = getLocalDateString()
    const taskNotifications = tasks
        .filter((task) => task.due_date && task.status !== 'done')
        .map((task): Reminder => {
            const daysUntilDue = Math.round(
                (new Date(`${task.due_date}T12:00:00`).getTime() -
                    new Date(`${today}T12:00:00`).getTime()) /
                86400000
            )

            return {
                id: `${task.id}-${task.due_date}`,
                task,
                daysUntilDue,
                type: daysUntilDue < 0 ? 'overdue' : 'upcoming',
            }
        })
        .filter((notification) => notification.daysUntilDue <= 3)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    const unreadNotificationCount = taskNotifications.filter(
        (notification) => !readNotificationIds.includes(notification.id)
    ).length

    function markNotificationAsRead(notificationId: string) {
        setReadNotificationIds((previous) =>
            previous.includes(notificationId)
                ? previous
                : [...previous, notificationId]
        )
    }

    function markAllNotificationsAsRead() {
        setReadNotificationIds((previous) => [
            ...new Set([
                ...previous,
                ...taskNotifications.map((notification) => notification.id),
            ]),
        ])
    }

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                onClick={() => setShowNotifications((previous) => !previous)}
                aria-label={`Task notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                aria-expanded={showNotifications}
                className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
            >
                <Bell size={20} />
                {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                )}
            </button>

            {showNotifications && (
                // Phones: the bell is the first item in its row, so open to the right
                // across the screen. From sm up the bell sits at the right of the
                // header, so open to the left.
                <div className="absolute left-0 z-50 mt-3 w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl sm:left-auto sm:right-0 sm:w-96">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                        <div>
                            <h3 className="font-semibold text-white">Task reminders</h3>
                            <p className="mt-0.5 text-xs text-slate-400">Due soon and overdue tasks</p>
                        </div>
                        {unreadNotificationCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllNotificationsAsRead}
                                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {taskNotifications.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                                <CheckCheck size={25} className="mx-auto mb-2 text-green-400" />
                                <p className="text-sm font-medium text-slate-200">You're all caught up</p>
                                <p className="mt-1 text-xs text-slate-400">No tasks are due in the next three days.</p>
                            </div>
                        ) : (
                            taskNotifications.map((notification) => {
                                const isRead = readNotificationIds.includes(notification.id)
                                const isOverdue = notification.type === 'overdue'
                                const dueLabel = isOverdue
                                    ? `Overdue by ${Math.abs(notification.daysUntilDue)} ${Math.abs(notification.daysUntilDue) === 1 ? 'day' : 'days'}`
                                    : notification.daysUntilDue === 0
                                        ? 'Due today'
                                        : `Due in ${notification.daysUntilDue} ${notification.daysUntilDue === 1 ? 'day' : 'days'}`

                                return (
                                    <button
                                        type="button"
                                        key={notification.id}
                                        onClick={() => markNotificationAsRead(notification.id)}
                                        className={`flex w-full gap-3 border-b border-slate-800 px-4 py-3 text-left transition hover:bg-slate-800/70 ${isRead ? 'opacity-65' : 'bg-slate-800/30'}`}
                                    >
                                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOverdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {isOverdue ? <AlertCircle size={18} /> : <CalendarClock size={18} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block break-words text-sm font-medium text-slate-100">{notification.task.title}</span>
                                            <span className={`mt-1 block text-xs ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>{dueLabel} · {formatDueDate(notification.task.due_date)}</span>
                                            <span className="mt-1 block text-xs text-slate-400">{projectName}</span>
                                        </span>
                                        {!isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default TaskReminders
