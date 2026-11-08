// Automated accessibility checks with axe-core on the main screens.
// Colour contrast cannot be computed in jsdom (no layout/CSS), so that rule is
// off here; contrast was checked separately against the WCAG formula.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { makeMember, makeTask } from './fixtures'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'

vi.mock('../context/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'me' },
        login: vi.fn(),
        signup: vi.fn(),
    }),
}))
vi.mock('../hooks/useNotifications', () => ({ useNotifications: vi.fn() }))
vi.mock('../lib/attachmentService', async (importOriginal) => ({
    ...(await importOriginal()),
    getTaskAttachments: vi.fn(async () => []),
    removeTaskFiles: vi.fn(async () => {}),
}))
vi.mock('../lib/taskService', () => ({ createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn() }))

const { useNotifications } = await import('../hooks/useNotifications')
const { ToastProvider } = await import('../context/ToastContext')
const { default: Login } = await import('../pages/Login')
const { default: Signup } = await import('../pages/Signup')
const { default: Notifications } = await import('../pages/Notifications')
const { default: TaskFormModal } = await import('../components/project/TaskFormModal')
const { default: TaskFilters } = await import('../components/project/TaskFilters')
const { default: TaskComments } = await import('../components/project/TaskComments')
const { DEFAULT_TASK_FILTERS } = await import('../components/project/taskUtils')

async function expectNoViolations(ui: ReactElement) {
    const { container } = render(
        <MemoryRouter>
            <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
    )

    const results = await axe.run(container, {
        rules: {
            'color-contrast': { enabled: false }, // needs real CSS layout
            region: { enabled: false }, // components are rendered outside page landmarks
        },
    })

    const summary = results.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`
    )
    expect(summary).toEqual([])
}

const members = [
    makeMember({ user_id: 'me', full_name: 'Me', role: 'owner' }),
    makeMember({ user_id: 'u2', full_name: 'Grace', role: 'member' }),
]

beforeEach(() => {
    vi.mocked(useNotifications).mockReturnValue({
        notifications: [
            { user_id: 'me', actor_id: null, task_id: null, id: 'n1', type: 'task_assigned', title: 'New task assigned to you', message: 'Fix login', project_id: 'p1', is_read: false, created_at: '2026-01-01T10:00:00Z' },
        ],
        unreadCount: 1,
        loading: false,
        error: '',
        markingAllRead: false,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
    })
})

// axe accepts a placeholder as a field's name, so it does not catch labels
// that are not linked to their inputs. getByLabelText only succeeds through a
// real <label htmlFor> (or aria-label) link, so check the forms directly.
describe('form labels are linked to their fields', () => {
    it.each([
        ['Login', () => <Login />, ['Email address', 'Password']],
        ['Signup', () => <Signup />, ['Full name', 'Email address', 'Password']],
    ])('%s', (_name, ui, labels) => {
        const { getByLabelText } = render(<MemoryRouter>{ui()}</MemoryRouter>)

        for (const label of labels) {
            expect(getByLabelText(label)).toBeInTheDocument()
        }
    })
})

describe('accessibility (axe-core)', () => {
    it('Login page', async () => {
        await expectNoViolations(<Login />)
    })

    it('Signup page', async () => {
        await expectNoViolations(<Signup />)
    })

    it('Notifications page', async () => {
        await expectNoViolations(<Notifications />)
    })

    it('Create task dialog', async () => {
        await expectNoViolations(
            <TaskFormModal projectId="p1" members={members} onSaved={vi.fn()} onClose={vi.fn()} onError={vi.fn()} />
        )
    })

    it('Edit task dialog', async () => {
        await expectNoViolations(
            <TaskFormModal
                projectId="p1"
                members={members}
                task={makeTask({ id: 't1', title: 'Fix bug', priority: 'high', due_date: '2026-01-01' })}
                canDelete
                onSaved={vi.fn()}
                onDeleted={vi.fn()}
                onClose={vi.fn()}
                onError={vi.fn()}
            />
        )
    })

    it('Task filters', async () => {
        await expectNoViolations(
            <TaskFilters filters={DEFAULT_TASK_FILTERS} onChange={vi.fn()} onReset={vi.fn()} members={members} shownCount={1} totalCount={1} />
        )
    })

    it('Comment thread', async () => {
        await expectNoViolations(
            <TaskComments
                taskId="t1"
                currentUserId="me"
                isProjectAdmin={false}
                comments={{
                    expandedTaskId: 't1',
                    commentsByTask: { t1: [{ id: 'c1', task_id: 't1', project_id: 'p1', author_id: 'me', author_name: 'Me', author_avatar: null, content: 'Hi', created_at: '2026-01-01T10:00:00Z' }] },
                    drafts: {},
                    loadingTaskId: null,
                    sendingTaskId: null,
                    deletingCommentId: null,
                    savingCommentId: null,
                    hasLoaded: () => true,
                    toggle: vi.fn(),
                    setDraft: vi.fn(),
                    submit: vi.fn(),
                    edit: vi.fn(),
                    remove: vi.fn(),
                    forgetTask: vi.fn(),
                }}
            />
        )
    })
})
