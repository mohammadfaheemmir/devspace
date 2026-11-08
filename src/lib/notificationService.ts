import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Notification } from '../types/app'

export const NOTIFICATIONS_PAGE_SIZE = 50

// Fetch the logged-in user's notifications, newest first, one page at a
// time. Pass the oldest loaded notification's created_at as `before` to get
// the next (older) page. Notifications are never deleted, so loading them
// all at once would grow without limit.
export async function getNotifications(
    { before, limit = NOTIFICATIONS_PAGE_SIZE }: { before?: string; limit?: number } = {}
): Promise<Notification[]> {
    const user = await getCurrentUser()

    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (before) query = query.lt('created_at', before)

    const { data, error } = await query

    if (error) {
        throw new Error(error.message)
    }

    // The CHECK constraint on `type` guarantees a known notification type.
    return (data || []) as Notification[]
}

// Get unread notification count
export async function getUnreadNotificationCount(): Promise<number> {
    const user = await getCurrentUser()

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) {
        throw new Error(error.message)
    }

    return count || 0
}

// Mark a notification as read
export async function markNotificationAsRead(notificationId: string): Promise<true> {
    await getCurrentUser()

    if (!notificationId) {
        throw new Error('Notification ID is required.')
    }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

    if (error) {
        throw new Error(error.message)
    }

    return true
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(): Promise<true> {
    const user = await getCurrentUser()

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) {
        throw new Error(error.message)
    }

    return true
}
