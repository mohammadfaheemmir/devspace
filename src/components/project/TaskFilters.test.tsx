import { describe, expect, it, vi } from 'vitest'
import { makeMember, partial } from '../../test/fixtures'
import { fireEvent, render, screen } from '@testing-library/react'
import TaskFilters from './TaskFilters'
import { DEFAULT_TASK_FILTERS } from './taskUtils'

const members = [
    makeMember({ user_id: 'u1', full_name: 'Ada' }),
    // full_name is null on purpose: the filter must fall back to 'Unnamed member'.
    makeMember({ user_id: 'u2', full_name: partial<string>(null as never) }),
]

function renderFilters(props = {}) {
    const onChange = vi.fn()
    const onReset = vi.fn()

    render(
        <TaskFilters
            filters={DEFAULT_TASK_FILTERS}
            onChange={onChange}
            onReset={onReset}
            members={members}
            shownCount={2}
            totalCount={5}
            {...props}
        />
    )

    return { onChange, onReset }
}

describe('TaskFilters', () => {
    it('shows how many tasks match', () => {
        renderFilters()

        expect(screen.getByText('Showing 2 of 5')).toBeInTheDocument()
    })

    it('reports search text while keeping the other filters', () => {
        const { onChange } = renderFilters()

        fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'login' } })

        expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TASK_FILTERS, search: 'login' })
    })

    it('reports status, priority, assignee and sort changes', () => {
        const { onChange } = renderFilters()

        fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'done' } })
        fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } })
        fireEvent.change(screen.getByLabelText('Filter by assignee'), { target: { value: 'u1' } })
        fireEvent.change(screen.getByLabelText('Sort tasks'), { target: { value: 'due_date' } })

        expect(vi.mocked(onChange).mock.calls.map(([filters]) => filters)).toEqual([
            { ...DEFAULT_TASK_FILTERS, status: 'done' },
            { ...DEFAULT_TASK_FILTERS, priority: 'high' },
            { ...DEFAULT_TASK_FILTERS, assignee: 'u1' },
            { ...DEFAULT_TASK_FILTERS, sort: 'due_date' },
        ])
    })

    it('lists members, with a fallback for missing names', () => {
        renderFilters()

        expect(screen.getByRole('option', { name: 'Ada' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Unnamed member' })).toBeInTheDocument()
    })

    it('clears filters', () => {
        const { onReset } = renderFilters()

        fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

        expect(onReset).toHaveBeenCalled()
    })
})
