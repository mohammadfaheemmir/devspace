import { Bell, Mail, MessageCircle, RefreshCw, UserPlus, type LucideIcon } from 'lucide-react'
import type { Notification, NotificationType } from '../../types/app'
import { formatFullDateTime, formatRelativeTime } from '../../lib/dates'

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
    task_assigned: UserPlus,
    task_updated: RefreshCw,
    new_comment: MessageCircle,
    project_invitation: Mail,
}

// One notification row, used by the bell dropdown and the Notifications page.
type NotificationItemProps = {
    notification: Notification
    onClick: (notification: Notification) => void
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const Icon = TYPE_ICONS[notification.type] || Bell

    return (
        <button
            type="button"
            onClick={() => onClick(notification)}
            className={`w-full border-b border-slate-800 p-4 text-left transition hover:bg-slate-800/70 ${!notification.is_read ? 'bg-indigo-500/5' : ''
                }`}
        >
            <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                    <Icon size={17} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-200">
                            {notification.title}
                        </p>

                        {!notification.is_read && (
                            <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400"
                                aria-label="Unread"
                            />
                        )}
                    </div>

                    {notification.message && (
                        <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                            {notification.message}
                        </p>
                    )}

                    <time
                        dateTime={notification.created_at}
                        title={formatFullDateTime(notification.created_at)}
                        className="mt-2 block text-xs text-slate-400"
                    >
                        {formatRelativeTime(notification.created_at)}
                    </time>
                </div>
            </div>
        </button>
    )
}

export default NotificationItem
