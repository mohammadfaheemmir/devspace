import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/attachmentService', async (importOriginal) => ({
    ...(await importOriginal()),
    getTaskAttachments: vi.fn(async () => []),
    removeTaskFiles: vi.fn(async () => {}),
}))
vi.mock('../../lib/taskService', () => ({
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
}))

const { createTask, updateTask, deleteTask } = await import('../../lib/taskService')
const { ToastProvider } = await import('../../context/ToastContext')
const { default: TaskFormModal } = await import('./TaskFormModal')

const members = [
    { user_id: 'u1', full_name: 'Ada' },
    { user_id: 'u2', full_name: 'Grace' },
]

const existingTask = {
    id: 't1',
    title: 'Fix login bug',
    description: 'Users get stuck',
    priority: 'high',
    assignee_id: 'u2',
    due_date: '2026-01-15',
}

function renderModal(props = {}) {
    const handlers = {
        onSaved: vi.fn(),
        onDeleted: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
    }

    render(
        <ToastProvider>
            <TaskFormModal projectId="p1" members={members} {...handlers} {...props} />
        </ToastProvider>
    )

    return handlers
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('TaskFormModal - create mode', () => {
    it('creates a task with the entered values', async () => {
        const user = userEvent.setup()
        createTask.mockResolvedValue({ id: 'new', title: 'Write docs' })
        const { onSaved, onClose } = renderModal()

        await user.type(screen.getByLabelText('Task title'), 'Write docs')
        await user.selectOptions(screen.getByLabelText('Priority'), 'low')
        await user.selectOptions(screen.getByLabelText('Assign to'), 'u1')
        await user.click(screen.getByRole('button', { name: 'Create Task' }))

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'new', title: 'Write docs' }))
        expect(createTask).toHaveBeenCalledWith('p1', {
            title: 'Write docs',
            description: '',
            priority: 'low',
            assignee_id: 'u1',
            due_date: '',
        })
        expect(onClose).toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent('Task created.')
    })

    it('does not allow past due dates for new tasks', () => {
        renderModal()

        expect(screen.getByLabelText('Due date (optional)')).toHaveAttribute('min')
    })

    it('reports errors and stays open', async () => {
        const user = userEvent.setup()
        createTask.mockRejectedValue(new Error('No permission'))
        const { onError, onClose } = renderModal()

        await user.type(screen.getByLabelText('Task title'), 'Write docs')
        await user.click(screen.getByRole('button', { name: 'Create Task' }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('No permission'))
        expect(onClose).not.toHaveBeenCalled()
    })

    it('has no delete button', () => {
        renderModal()

        expect(screen.queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument()
    })

    it('closes on Escape', () => {
        const { onClose } = renderModal()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalled()
    })
})

describe('TaskFormModal - edit mode', () => {
    it('starts with the task values filled in', () => {
        renderModal({ task: existingTask })

        expect(screen.getByRole('heading', { name: 'Edit task' })).toBeInTheDocument()
        expect(screen.getByLabelText('Task title')).toHaveValue('Fix login bug')
        expect(screen.getByLabelText('Description')).toHaveValue('Users get stuck')
        expect(screen.getByLabelText('Priority')).toHaveValue('high')
        expect(screen.getByLabelText('Assign to')).toHaveValue('u2')
        expect(screen.getByLabelText('Due date (optional)')).toHaveValue('2026-01-15')
    })

    it('allows keeping a due date that is already in the past', () => {
        renderModal({ task: existingTask })

        expect(screen.getByLabelText('Due date (optional)')).not.toHaveAttribute('min')
    })

    it('saves changes through updateTask', async () => {
        const user = userEvent.setup()
        updateTask.mockResolvedValue({ ...existingTask, title: 'Fix login bug now' })
        const { onSaved } = renderModal({ task: existingTask })

        await user.type(screen.getByLabelText('Task title'), ' now')
        await user.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(onSaved).toHaveBeenCalled())
        expect(updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Fix login bug now' }))
        expect(createTask).not.toHaveBeenCalled()
    })

    it('hides the delete button from users who cannot delete', () => {
        renderModal({ task: existingTask, canDelete: false })

        expect(screen.queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument()
    })

    it('deletes after confirmation', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        deleteTask.mockResolvedValue(true)
        const { onDeleted, onClose } = renderModal({ task: existingTask, canDelete: true })

        await user.click(screen.getByRole('button', { name: /delete task/i }))

        await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('t1'))
        expect(onClose).toHaveBeenCalled()
    })

    it('does not delete when the confirmation is cancelled', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        const { onDeleted } = renderModal({ task: existingTask, canDelete: true })

        await user.click(screen.getByRole('button', { name: /delete task/i }))

        expect(deleteTask).not.toHaveBeenCalled()
        expect(onDeleted).not.toHaveBeenCalled()
    })
})
