import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../lib/notificationService'

// The signed-in user's notifications, kept live with Supabase Realtime.
// Shared by the dashboard bell dropdown and the Notifications page.
export function useNotifications(userId) {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [markingAllRead, setMarkingAllRead] = useState(false)

    useEffect(() => {
        if (!userId) return

        let active = true

        async function loadNotifications() {
            try {
                const data = await getNotifications()

                if (active) {
                    // Merge with anything Realtime delivered while loading.
                    setNotifications((previous) => {
                        const notificationMap = new Map()

                        data.forEach((item) => notificationMap.set(item.id, item))
                        previous.forEach((item) => notificationMap.set(item.id, item))

                        return Array.from(notificationMap.values()).sort(
                            (a, b) => new Date(b.created_at) - new Date(a.created_at)
                        )
                    })
                }
            } catch (err) {
                console.error('Loading notifications failed:', err)

                if (active) {
                    setError(err.message || 'Unable to load notifications.')
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        // A unique channel name per mount avoids reusing a channel that is
        // still closing from a previous mount (e.g. React StrictMode in dev).
        const channel = supabase
            .channel(`user-notifications-${userId}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    if (!active) return

                    if (payload.eventType === 'INSERT') {
                        const newNotification = payload.new

                        setNotifications((previous) =>
                            previous.some((item) => item.id === newNotification.id)
                                ? previous
                                : [newNotification, ...previous]
                        )
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedNotification = payload.new

                        setNotifications((previous) =>
                            previous.map((item) =>
                                item.id === updatedNotification.id
                                    ? { ...item, ...updatedNotification }
                                    : item
                            )
                        )
                    }

                    if (payload.eventType === 'DELETE') {
                        setNotifications((previous) =>
                            previous.filter((item) => item.id !== payload.old.id)
                        )
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Notification Realtime connection failed.')
                }
            })

        loadNotifications()

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [userId])

    const unreadCount = notifications.filter((item) => !item.is_read).length

    // Mark one notification as read. Returns true on success.
    async function markAsRead(notification) {
        if (notification.is_read) return true

        setError('')

        try {
            await markNotificationAsRead(notification.id)

            setNotifications((previous) =>
                previous.map((item) =>
                    item.id === notification.id ? { ...item, is_read: true } : item
                )
            )

            return true
        } catch (err) {
            console.error('Mark notification as read failed:', err)
            setError(err.message || 'Unable to update notification.')
            return false
        }
    }

    // Mark every notification as read.
    async function markAllAsRead() {
        setError('')
        setMarkingAllRead(true)

        try {
            await markAllNotificationsAsRead()

            setNotifications((previous) =>
                previous.map((item) => ({ ...item, is_read: true }))
            )
        } catch (err) {
            console.error('Mark all notifications failed:', err)
            setError(err.message || 'Unable to mark notifications as read.')
        } finally {
            setMarkingAllRead(false)
        }
    }

    return {
        notifications,
        unreadCount,
        loading,
        error,
        markingAllRead,
        markAsRead,
        markAllAsRead,
    }
}
