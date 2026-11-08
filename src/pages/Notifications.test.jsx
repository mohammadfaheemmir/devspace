import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../context/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('../hooks/useNotifications', () => ({ useNotifications: vi.fn() }))

const { useNotifications } = await import('../hooks/useNotifications')
const { default: Notifications } = await import('./Notifications')

const notifications = [
    { id: 'n1', type: 'task_assigned', title: 'New task assigned to you', message: 'Fix login', project_id: 'p1', is_read: false, created_at: '2026-01-03T10:00:00Z' },
    { id: 'n2', type: 'project_invitation', title: 'Project invitation', message: 'Join Apollo', project_id: 'p2', is_read: false, created_at: '2026-01-02T10:00:00Z' },
    { id: 'n3', type: 'new_comment', title: 'New comment on your task', message: 'Someone commented', project_id: 'p1', is_read: true, created_at: '2026-01-01T10:00:00Z' },
]

function mockHook(overrides = {}) {
    const hook = {
        notifications,
        unreadCount: 2,
        loading: false,
        error: '',
        markingAllRead: false,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn(),
        ...overrides,
    }
    useNotifications.mockReturnValue(hook)
    return hook
}

function renderPage() {
    render(
        <MemoryRouter initialEntries={['/notifications']}>
            <Routes>
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/dashboard" element={<p>Dashboard page</p>} />
                <Route path="/projects/:projectId" element={<p>Project page</p>} />
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('Notifications page', () => {
    it('lists all notifications with counts', () => {
        mockHook()
        renderPage()

        expect(screen.getByText('2 unread notifications')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'All (3)' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('New task assigned to you')).toBeInTheDocument()
        expect(screen.getByText('New comment on your task')).toBeInTheDocument()
    })

    it('filters to unread notifications', async () => {
        const user = userEvent.setup()
        mockHook()
        renderPage()

        await user.click(screen.getByRole('button', { name: 'Unread (2)' }))

        expect(screen.queryByText('New comment on your task')).not.toBeInTheDocument()
        expect(screen.getByText('New task assigned to you')).toBeInTheDocument()
    })

    it('marks a task notification read and opens its project', async () => {
        const user = userEvent.setup()
        const hook = mockHook()
        renderPage()

        await user.click(screen.getByText('New task assigned to you'))

        expect(hook.markAsRead).toHaveBeenCalledWith(notifications[0])
        await waitFor(() => expect(screen.getByText('Project page')).toBeInTheDocument())
    })

    it('sends invitation notifications to the dashboard, not the project', async () => {
        const user = userEvent.setup()
        mockHook()
        renderPage()

        await user.click(screen.getByText('Project invitation'))

        await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument())
    })

    it('stays on the page if marking as read fails', async () => {
        const user = userEvent.setup()
        mockHook({ markAsRead: vi.fn().mockResolvedValue(false), error: 'Unable to update notification.' })
        renderPage()

        await user.click(screen.getByText('New task assigned to you'))

        expect(screen.getByRole('alert')).toHaveTextContent('Unable to update notification.')
        expect(screen.queryByText('Project page')).not.toBeInTheDocument()
    })

    it('marks everything as read', async () => {
        const user = userEvent.setup()
        const hook = mockHook()
        renderPage()

        await user.click(screen.getByRole('button', { name: /mark all as read/i }))

        expect(hook.markAllAsRead).toHaveBeenCalled()
    })

    it('shows an empty state when everything is read', async () => {
        const user = userEvent.setup()
        mockHook({ notifications: [notifications[2]], unreadCount: 0 })
        renderPage()

        expect(screen.getByText('You are all caught up.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Unread (0)' }))
        expect(screen.getByText('No unread notifications')).toBeInTheDocument()
    })
})
