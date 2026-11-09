import type { Notification } from '../../types/app'

// Where clicking a notification should take the user.
// Invitations point at a project the user has not joined yet, so they go
// to the dashboard (where invitations are accepted or declined).
export function getNotificationLink(notification: Pick<Notification, 'type' | 'project_id'>): string | null {
    if (notification.type === 'project_invitation') return '/dashboard'
    if (notification.project_id) return `/projects/${notification.project_id}`
    return null
}
