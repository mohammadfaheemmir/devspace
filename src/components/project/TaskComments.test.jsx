import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskComments from './TaskComments'

const myComment = {
    id: 'c1',
    author_id: 'me',
    author_name: 'Me',
    content: 'First draft',
    created_at: '2026-01-01T10:00:00Z',
}

const theirComment = {
    id: 'c2',
    author_id: 'someone-else',
    author_name: 'Grace',
    content: 'Looks good',
    created_at: '2026-01-01T11:00:00Z',
}

// A fake of the object returned by useTaskComments(), with the thread open.
function fakeComments(overrides = {}) {
    return {
        expandedTaskId: 't1',
        commentsByTask: { t1: [myComment, theirComment] },
        drafts: {},
        loadingTaskId: null,
        sendingTaskId: null,
        deletingCommentId: null,
        savingCommentId: null,
        hasLoaded: () => true,
        toggle: vi.fn(),
        setDraft: vi.fn(),
        submit: vi.fn(),
        edit: vi.fn().mockResolvedValue(true),
        remove: vi.fn(),
        ...overrides,
    }
}

function renderThread({ comments = fakeComments(), isProjectAdmin = false } = {}) {
    render(
        <TaskComments
            taskId="t1"
            comments={comments}
            currentUserId="me"
            isProjectAdmin={isProjectAdmin}
        />
    )
    return comments
}

describe('TaskComments', () => {
    it('lets authors edit and delete only their own comments', () => {
        renderThread()

        expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    })

    it('lets admins delete anyone\'s comment but edit only their own', () => {
        renderThread({ isProjectAdmin: true })

        expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
    })

    it('saves an edited comment and leaves edit mode', async () => {
        const user = userEvent.setup()
        const comments = renderThread()

        await user.click(screen.getByRole('button', { name: 'Edit' }))
        const box = screen.getByLabelText('Edit comment')
        expect(box).toHaveValue('First draft')

        await user.clear(box)
        await user.type(box, 'Final version')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(comments.edit).toHaveBeenCalledWith('t1', 'c1', 'Final version')
        await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument())
    })

    it('stays in edit mode when saving fails', async () => {
        const user = userEvent.setup()
        renderThread({ comments: fakeComments({ edit: vi.fn().mockResolvedValue(false) }) })

        await user.click(screen.getByRole('button', { name: 'Edit' }))
        await user.type(screen.getByLabelText('Edit comment'), '!')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(screen.getByLabelText('Edit comment')).toBeInTheDocument()
    })

    it('disables Save until the text actually changes', async () => {
        const user = userEvent.setup()
        renderThread()

        await user.click(screen.getByRole('button', { name: 'Edit' }))

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('cancels editing with Escape without saving', async () => {
        const user = userEvent.setup()
        const comments = renderThread()

        await user.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.keyDown(screen.getByLabelText('Edit comment'), { key: 'Escape' })

        expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument()
        expect(screen.getByText('First draft')).toBeInTheDocument()
        expect(comments.edit).not.toHaveBeenCalled()
    })
})
