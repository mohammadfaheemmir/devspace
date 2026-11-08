import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'

vi.mock('../../lib/labelService', async (importOriginal) => ({
    ...(await importOriginal()),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    setTaskLabels: vi.fn(),
}))
vi.mock('../../lib/taskService', () => ({ createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn() }))

const { createLabel, deleteLabel, setTaskLabels } = await import('../../lib/labelService')
const { updateTask } = await import('../../lib/taskService')
const { ToastProvider } = await import('../../context/ToastContext')
const { default: LabelManager } = await import('./LabelManager')
const { default: TaskFormModal } = await import('./TaskFormModal')
const { default: TaskFilters } = await import('./TaskFilters')
const { DEFAULT_TASK_FILTERS } = await import('./taskUtils')

const bug = { id: 'l-bug', project_id: 'p1', name: 'Bug', color: 'red', created_at: '2026-11-09T00:00:00Z' }
const design = { id: 'l-design', project_id: 'p1', name: 'Design', color: 'purple', created_at: '2026-11-09T00:00:00Z' }

const withToasts = (ui) => render(<ToastProvider>{ui}</ToastProvider>)

beforeEach(() => {
    vi.clearAllMocks()
})

describe('LabelManager', () => {
    it('creates a label with the chosen colour and adds it in name order', async () => {
        const user = userEvent.setup()
        const onLabelsChange = vi.fn()
        const feature = { ...bug, id: 'l-feature', name: 'Feature', color: 'teal' }
        createLabel.mockResolvedValue(feature)
        withToasts(<LabelManager projectId="p1" labels={[bug, design]} onLabelsChange={onLabelsChange} onError={vi.fn()} />)

        await user.type(screen.getByLabelText('New label'), 'Feature')
        await user.click(screen.getByRole('radio', { name: 'teal' }))
        await user.click(screen.getByRole('button', { name: 'Add label' }))

        expect(createLabel).toHaveBeenCalledWith('p1', 'Feature', 'teal')
        await waitFor(() => expect(onLabelsChange).toHaveBeenCalledWith([bug, design, feature]))
    })

    it('deletes a label only after confirmation', async () => {
        const user = userEvent.setup()
        const onLabelsChange = vi.fn()
        const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
        deleteLabel.mockResolvedValue(true)
        withToasts(<LabelManager projectId="p1" labels={[bug, design]} onLabelsChange={onLabelsChange} onError={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Delete label Bug' }))
        expect(deleteLabel).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Delete label Bug' }))
        await waitFor(() => expect(onLabelsChange).toHaveBeenCalledWith([design]))
        expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('reports errors such as duplicate names', async () => {
        const user = userEvent.setup()
        const onError = vi.fn()
        createLabel.mockRejectedValue(new Error('A label called "Bug" already exists in this project.'))
        withToasts(<LabelManager projectId="p1" labels={[bug]} onLabelsChange={vi.fn()} onError={onError} />)

        await user.type(screen.getByLabelText('New label'), 'bug')
        await user.click(screen.getByRole('button', { name: 'Add label' }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('A label called "Bug" already exists in this project.'))
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = withToasts(<LabelManager projectId="p1" labels={[bug]} onLabelsChange={vi.fn()} onError={vi.fn()} />)

        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
})

describe('TaskFormModal labels', () => {
    const task = { id: 't1', title: 'Fix crash', description: null, priority: 'high', status: 'todo', assignee_id: null, due_date: null }

    function renderForm(extra = {}) {
        const handlers = { onSaved: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onLabelsSaved: vi.fn() }
        withToasts(
            <TaskFormModal projectId="p1" members={[]} task={task} labels={[bug, design]} initialLabelIds={['l-bug']} {...handlers} {...extra} />
        )
        return handlers
    }

    it('shows the current labels as selected and saves only the change', async () => {
        const user = userEvent.setup()
        updateTask.mockResolvedValue(task)
        setTaskLabels.mockResolvedValue(['l-bug', 'l-design'])
        const { onLabelsSaved } = renderForm()

        expect(screen.getByRole('button', { name: /Bug/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: /Design/ })).toHaveAttribute('aria-pressed', 'false')

        await user.click(screen.getByRole('button', { name: /Design/ }))
        await user.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(setTaskLabels).toHaveBeenCalledWith('t1', 'p1', ['l-bug'], ['l-bug', 'l-design']))
        expect(onLabelsSaved).toHaveBeenCalledWith('t1', ['l-bug', 'l-design'])
    })

    it('does not touch labels when they did not change', async () => {
        const user = userEvent.setup()
        updateTask.mockResolvedValue(task)
        renderForm()

        await user.type(screen.getByLabelText('Task title'), '!')
        await user.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(updateTask).toHaveBeenCalled())
        expect(setTaskLabels).not.toHaveBeenCalled()
    })

    it('says the task was saved when only the labels failed', async () => {
        const user = userEvent.setup()
        updateTask.mockResolvedValue(task)
        setTaskLabels.mockRejectedValue(new Error(''))
        const { onSaved, onError } = renderForm()

        await user.click(screen.getByRole('button', { name: /Design/ }))
        await user.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('The task was saved, but its labels could not be updated.'))
        expect(onSaved).toHaveBeenCalled()
    })

    it('hides the Labels section when the project has no labels', () => {
        renderForm({ labels: [], initialLabelIds: [] })

        expect(screen.queryByRole('group', { name: 'Labels' })).not.toBeInTheDocument()
    })
})

describe('TaskFilters label filter', () => {
    const props = { filters: DEFAULT_TASK_FILTERS, onChange: vi.fn(), onReset: vi.fn(), members: [], shownCount: 1, totalCount: 1 }

    it('offers a label filter only when the project has labels', () => {
        const { rerender } = render(<TaskFilters {...props} />)
        expect(screen.queryByLabelText('Filter by label')).not.toBeInTheDocument()

        rerender(<TaskFilters {...props} labels={[bug, design]} />)
        expect(screen.getByRole('option', { name: 'Design' })).toBeInTheDocument()
    })
})
