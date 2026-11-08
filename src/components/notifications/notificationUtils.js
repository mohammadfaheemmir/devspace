// Where clicking a notification should take the user.
// Invitations point at a project the user has not joined yet, so they go
// to the dashboard (where invitations are accepted or declined).
export function getNotificationLink(notification) {
    if (notification.type === 'project_invitation') return '/dashboard'
    if (notification.project_id) return `/projects/${notification.project_id}`
    return null
}

export function formatNotificationDate(date) {
    return new Date(date).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}
