import { useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { Tables } from '../types/database'
import type { Notification } from '../types/app'
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../lib/notificationService'

// The signed-in user's notifications, kept live with Supabase Realtime.
// Shared by the dashboard bell dropdown and the Notifications page.
export type NotificationsApi = {
    notifications: Notification[]
    unreadCount: number
    loading: boolean
    error: string
    markingAllRead: boolean
    markAsRead: (notification: Notification) => Promise<boolean>
    markAllAsRead: () => Promise<void>
}

const byNewestFirst = (a: Notification, b: Notification) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function useNotifications(userId: string | null | undefined): NotificationsApi {
    const [notifications, setNotifications] = useState<Notification[]>([])
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
                        const notificationMap = new Map<string, Notification>()

                        data.forEach((item) => notificationMap.set(item.id, item))
                        previous.forEach((item) => notificationMap.set(item.id, item))

                        return Array.from(notificationMap.values()).sort(byNewestFirst)
                    })
                }
            } catch (err) {
                console.error('Loading notifications failed:', err)

                if (active) {
                    setError(getErrorMessage(err, 'Unable to load notifications.'))
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
                (payload: RealtimePostgresChangesPayload<Tables<'notifications'>>) => {
                    if (!active) return

                    if (payload.eventType === 'INSERT') {
                        // The CHECK constraint on `type` guarantees a known type.
                        const newNotification = payload.new as Notification

                        setNotifications((previous) =>
                            previous.some((item) => item.id === newNotification.id)
                                ? previous
                                : [newNotification, ...previous]
                        )
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedNotification = payload.new as Notification

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
    async function markAsRead(notification: Notification): Promise<boolean> {
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
            setError(getErrorMessage(err, 'Unable to update notification.'))
            return false
        }
    }

    // Mark every notification as read.
    async function markAllAsRead(): Promise<void> {
        setError('')
        setMarkingAllRead(true)

        try {
            await markAllNotificationsAsRead()

            setNotifications((previous) =>
                previous.map((item) => ({ ...item, is_read: true }))
            )
        } catch (err) {
            console.error('Mark all notifications failed:', err)
            setError(getErrorMessage(err, 'Unable to mark notifications as read.'))
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
