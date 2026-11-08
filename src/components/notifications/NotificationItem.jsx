import { Bell, Mail, MessageCircle, RefreshCw, UserPlus } from 'lucide-react'
import { formatNotificationDate } from './notificationUtils'

const TYPE_ICONS = {
    task_assigned: UserPlus,
    task_updated: RefreshCw,
    new_comment: MessageCircle,
    project_invitation: Mail,
}

// One notification row, used by the bell dropdown and the Notifications page.
function NotificationItem({ notification, onClick }) {
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

                    <p className="mt-2 text-xs text-slate-400">
                        {formatNotificationDate(notification.created_at)}
                    </p>
                </div>
            </div>
        </button>
    )
}

export default NotificationItem
