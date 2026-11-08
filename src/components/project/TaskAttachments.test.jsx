import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'

vi.mock('../../lib/supabase', () => {
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) }
    return { supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() } }
})
vi.mock('../../lib/attachmentService', async (importOriginal) => ({
    ...(await importOriginal()),
    getTaskAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getAttachmentDownloadUrl: vi.fn(),
}))

const { getTaskAttachments, uploadAttachment, deleteAttachment } = await import('../../lib/attachmentService')
const { ToastProvider } = await import('../../context/ToastContext')
const { default: TaskAttachments } = await import('./TaskAttachments')

const mine = { id: 'a1', task_id: 't1', project_id: 'p1', uploaded_by: 'me', file_name: 'spec.pdf', storage_path: 'p1/t1/x-spec.pdf', size_bytes: 2048, mime_type: 'application/pdf', created_at: '' }
const theirs = { ...mine, id: 'a2', uploaded_by: 'someone-else', file_name: 'photo.png', storage_path: 'p1/t1/y-photo.png', mime_type: 'image/png' }

function renderSection(props = {}) {
    const onError = vi.fn()
    const result = render(
        <ToastProvider>
            <TaskAttachments projectId="p1" taskId="t1" currentUserId="me" isProjectAdmin={false} onError={onError} {...props} />
        </ToastProvider>
    )
    return { onError, ...result }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('TaskAttachments', () => {
    it('lists files with sizes and offers delete only on your own files', async () => {
        getTaskAttachments.mockResolvedValue([mine, theirs])
        renderSection()

        expect(await screen.findByText('spec.pdf')).toBeInTheDocument()
        expect(screen.getAllByText('2 KB')).toHaveLength(2)
        expect(screen.getByRole('button', { name: 'Download photo.png' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delete spec.pdf' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete photo.png' })).not.toBeInTheDocument()
    })

    it('lets admins delete anyone\'s files', async () => {
        getTaskAttachments.mockResolvedValue([theirs])
        renderSection({ isProjectAdmin: true })

        expect(await screen.findByRole('button', { name: 'Delete photo.png' })).toBeInTheDocument()
    })

    it('uploads valid files and reports invalid ones without uploading them', async () => {
        const user = userEvent.setup({ applyAccept: false })
        getTaskAttachments.mockResolvedValue([])
        uploadAttachment.mockResolvedValue(mine)
        const { onError } = renderSection()
        await screen.findByText(/No files yet/)

        const good = new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' })
        const bad = new File(['<html>'], 'page.html', { type: 'text/html' })
        await user.upload(screen.getByLabelText('Choose files to attach'), [good, bad])

        await waitFor(() => expect(screen.getByText('spec.pdf')).toBeInTheDocument())
        expect(uploadAttachment).toHaveBeenCalledTimes(1)
        expect(uploadAttachment).toHaveBeenCalledWith('p1', 't1', good)
        expect(onError).toHaveBeenCalledWith(expect.stringMatching(/page.html.*not a supported file type/))
    })

    it('deletes after confirmation', async () => {
        const user = userEvent.setup()
        getTaskAttachments.mockResolvedValue([mine])
        deleteAttachment.mockResolvedValue(true)
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        renderSection()

        await user.click(await screen.findByRole('button', { name: 'Delete spec.pdf' }))

        await waitFor(() => expect(screen.queryByText('spec.pdf')).not.toBeInTheDocument())
        expect(deleteAttachment).toHaveBeenCalledWith(mine)
    })

    it('has no detectable accessibility violations', async () => {
        getTaskAttachments.mockResolvedValue([mine])
        const { container } = renderSection()
        await screen.findByText('spec.pdf')

        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
})
