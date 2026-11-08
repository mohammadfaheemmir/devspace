import { describe, expect, it } from 'vitest'
import { getNotificationLink } from './notificationUtils'

describe('getNotificationLink', () => {
    it('sends invitations to the dashboard, where they are accepted', () => {
        expect(getNotificationLink({ type: 'project_invitation', project_id: 'p1' })).toBe('/dashboard')
    })

    it('opens the project for task and comment notifications', () => {
        expect(getNotificationLink({ type: 'task_assigned', project_id: 'p1' })).toBe('/projects/p1')
        expect(getNotificationLink({ type: 'new_comment', project_id: 'p1' })).toBe('/projects/p1')
    })

    it('returns null when there is nowhere to go', () => {
        expect(getNotificationLink({ type: 'task_updated', project_id: null })).toBeNull()
    })
})
