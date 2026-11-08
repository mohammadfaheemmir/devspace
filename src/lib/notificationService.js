import { supabase } from './supabase'
import { getCurrentUser } from './auth'

// Fetch notifications for the logged-in user
export async function getNotifications() {
    const user = await getCurrentUser()

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(error.message)
    }

    return data || []
}

// Get unread notification count
export async function getUnreadNotificationCount() {
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
export async function markNotificationAsRead(notificationId) {
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
export async function markAllNotificationsAsRead() {
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
