import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from './ToastContext'
import { useToast } from './useToast'
import TaskFormModal from '../components/project/TaskFormModal'
import { makeTask } from '../test/fixtures'

vi.mock('../lib/attachmentService', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getTaskAttachments: vi.fn(async () => []),
}))

function RaiseError() {
    const toast = useToast()
    return <button type="button" onClick={() => toast.error('Upload failed')}>raise</button>
}

// Regression test: dismissing a notice used to count as a click outside the
// open dialog, closing it and losing unsaved edits.
describe('dismissing a toast while a dialog is open', () => {
    it('keeps the task form open', () => {
        const onClose = vi.fn()
        render(
            <ToastProvider>
                <RaiseError />
                <TaskFormModal projectId="p1" members={[]} task={makeTask({ id: 't1' })} onSaved={vi.fn()} onClose={onClose} onError={vi.fn()} />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('raise'))
        const dismiss = screen.getByRole('button', { name: 'Dismiss notification' })
        fireEvent.mouseDown(dismiss)
        fireEvent.click(dismiss)

        expect(onClose).not.toHaveBeenCalled()
        expect(screen.queryByText('Upload failed')).not.toBeInTheDocument()
    })
})
