import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { Tables } from '../types/database'
import type { Notification } from '../types/app'
import {
    NOTIFICATIONS_PAGE_SIZE,
    getNotifications,
    getUnreadNotificationCount,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../lib/notificationService'

// The signed-in user's notifications, kept live with Supabase Realtime.
// Shared by the dashboard bell dropdown and the Notifications page.
//
// Notifications load one page at a time (newest first). The unread count
// comes from the database, so it stays correct even for notifications that
// have not been loaded.
export type NotificationsApi = {
    notifications: Notification[]
    unreadCount: number
    loading: boolean
    error: string
    markingAllRead: boolean
    hasMore: boolean
    loadingMore: boolean
    loadMore: () => Promise<void>
    markAsRead: (notification: Notification) => Promise<boolean>
    markAllAsRead: () => Promise<void>
}

const byNewestFirst = (a: Notification, b: Notification) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function useNotifications(userId: string | null | undefined): NotificationsApi {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState('')
    const [markingAllRead, setMarkingAllRead] = useState(false)

    const refreshUnreadCount = useCallback(async () => {
        try {
            setUnreadCount(await getUnreadNotificationCount())
        } catch (err) {
            console.error('Loading unread count failed:', err)
        }
    }, [])

    useEffect(() => {
        if (!userId) return

        let active = true

        async function loadFirstPage() {
            try {
                const [page, count] = await Promise.all([
                    getNotifications(),
                    getUnreadNotificationCount(),
                ])

                if (!active) return

                // Merge with anything Realtime delivered while loading.
                setNotifications((previous) => {
                    const notificationMap = new Map<string, Notification>()
                    page.forEach((item) => notificationMap.set(item.id, item))
                    previous.forEach((item) => notificationMap.set(item.id, item))
                    return Array.from(notificationMap.values()).sort(byNewestFirst)
                })
                setUnreadCount(count)
                setHasMore(page.length === NOTIFICATIONS_PAGE_SIZE)
            } catch (err) {
                console.error('Loading notifications failed:', err)
                if (active) setError(getErrorMessage(err, 'Unable to load notifications.'))
            } finally {
                if (active) setLoading(false)
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
                        if (!newNotification.is_read) setUnreadCount((count) => count + 1)
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
                        // Read state may have changed (e.g. in another tab).
                        refreshUnreadCount()
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Notification Realtime connection failed.')
                }
            })

        loadFirstPage()

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [userId, refreshUnreadCount])

    // Load the next page of older notifications.
    async function loadMore(): Promise<void> {
        const oldest = notifications[notifications.length - 1]
        if (!oldest || loadingMore) return

        setLoadingMore(true)
        setError('')

        try {
            const page = await getNotifications({ before: oldest.created_at })
            setNotifications((previous) => {
                const known = new Set(previous.map((item) => item.id))
                return [...previous, ...page.filter((item) => !known.has(item.id))]
            })
            setHasMore(page.length === NOTIFICATIONS_PAGE_SIZE)
        } catch (err) {
            setError(getErrorMessage(err, 'Unable to load older notifications.'))
        } finally {
            setLoadingMore(false)
        }
    }

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
            setUnreadCount((count) => Math.max(0, count - 1))

            return true
        } catch (err) {
            console.error('Mark notification as read failed:', err)
            setError(getErrorMessage(err, 'Unable to update notification.'))
            return false
        }
    }

    // Mark every notification as read (including ones not loaded yet).
    async function markAllAsRead(): Promise<void> {
        setError('')
        setMarkingAllRead(true)

        try {
            await markAllNotificationsAsRead()

            setNotifications((previous) =>
                previous.map((item) => ({ ...item, is_read: true }))
            )
            setUnreadCount(0)
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
        hasMore,
        loadingMore,
        loadMore,
        markAsRead,
        markAllAsRead,
    }
}
