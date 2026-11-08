import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, CheckCheck, LoaderCircle } from 'lucide-react'

import { useAuth } from '../context/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import NotificationItem from '../components/notifications/NotificationItem'
import { getNotificationLink } from '../components/notifications/notificationUtils'

// Full notification history with an All / Unread filter.
function Notifications() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [filter, setFilter] = useState('all')

    const {
        notifications,
        unreadCount,
        loading,
        error,
        markingAllRead,
        markAsRead,
        markAllAsRead,
    } = useNotifications(user?.id)

    const visibleNotifications =
        filter === 'unread'
            ? notifications.filter((notification) => !notification.is_read)
            : notifications

    async function handleNotificationClick(notification) {
        const updated = await markAsRead(notification)
        const link = getNotificationLink(notification)

        if (updated && link) {
            navigate(link)
        }
    }

    const tabs = [
        { id: 'all', label: 'All', count: notifications.length },
        { id: 'unread', label: 'Unread', count: unreadCount },
    ]

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-lg border border-slate-700 p-2 transition hover:bg-slate-800"
                        aria-label="Back to dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div>
                        <h1 className="text-2xl font-bold">Notifications</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            {unreadCount === 0
                                ? 'You are all caught up.'
                                : `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`}
                        </p>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Filter notifications">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilter(tab.id)}
                                aria-pressed={filter === tab.id}
                                className={`rounded-md px-4 py-2 text-sm transition ${filter === tab.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>

                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            disabled={markingAllRead}
                            className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                            <CheckCheck size={16} />
                            {markingAllRead ? 'Updating...' : 'Mark all as read'}
                        </button>
                    )}
                </div>

                {error && (
                    <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                    {loading ? (
                        <p className="flex items-center justify-center gap-3 p-10 text-sm text-slate-400">
                            <LoaderCircle size={18} className="animate-spin" />
                            Loading notifications...
                        </p>
                    ) : visibleNotifications.length === 0 ? (
                        <div className="p-10 text-center">
                            <Bell size={32} className="mx-auto text-slate-500" />
                            <p className="mt-3 font-medium text-slate-300">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {filter === 'unread'
                                    ? 'Everything has been read.'
                                    : 'Assignments, comments and invitations will appear here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="[&>button:last-child]:border-b-0">
                            {visibleNotifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onClick={handleNotificationClick}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

export default Notifications
