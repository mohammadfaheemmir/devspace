import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import TaskCalendar from './TaskCalendar'

// Fix "today" to Tuesday 10 November 2026 (only Date is faked).
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10, 12))
})
afterEach(() => {
    vi.useRealTimers()
})

function task(overrides) {
    return {
        id: overrides.id,
        title: overrides.title ?? overrides.id,
        description: null,
        status: 'todo',
        priority: 'medium',
        assignee_id: null,
        due_date: null,
        created_at: '2026-11-01T00:00:00Z',
        ...overrides,
    }
}

const longDate = (y, m, d) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m, d))

// jsdom applies no CSS, so both the grid and the phone list are present.
// Day groups (role="group") only exist in the grid.
function dayCell(y, m, d) {
    return screen.getByRole('group', { name: new RegExp(`^${longDate(y, m, d)},`) })
}

describe('TaskCalendar', () => {
    it('shows the current month and places tasks on their due dates', () => {
        render(
            <TaskCalendar
                tasks={[
                    task({ id: 'a', title: 'Write report', due_date: '2026-11-12' }),
                    task({ id: 'b', title: 'Review PR', due_date: '2026-11-12' }),
                ]}
                onEdit={vi.fn()}
            />
        )

        const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(2026, 10, 1))
        expect(screen.getByRole('heading', { name: monthLabel })).toBeInTheDocument()

        const cell = dayCell(2026, 10, 12)
        expect(cell).toHaveAccessibleName(`${longDate(2026, 10, 12)}, 2 tasks`)
        expect(within(cell).getByRole('button', { name: /Write report/ })).toBeInTheDocument()
        expect(within(cell).getByRole('button', { name: /Review PR/ })).toBeInTheDocument()
    })

    it('marks today', () => {
        render(<TaskCalendar tasks={[]} onEdit={vi.fn()} />)

        expect(within(dayCell(2026, 10, 10)).getByText('10')).toHaveAttribute('aria-current', 'date')
    })

    it('opens a task for editing when clicked', () => {
        const onEdit = vi.fn()
        const report = task({ id: 'a', title: 'Write report', due_date: '2026-11-12' })
        render(<TaskCalendar tasks={[report]} onEdit={onEdit} />)

        fireEvent.click(within(dayCell(2026, 10, 12)).getByRole('button', { name: /Write report/ }))

        expect(onEdit).toHaveBeenCalledWith(report)
    })

    it('labels overdue and done tasks for screen readers', () => {
        render(
            <TaskCalendar
                tasks={[
                    task({ id: 'late', title: 'Late task', due_date: '2026-11-05' }),
                    task({ id: 'finished', title: 'Finished task', due_date: '2026-11-05', status: 'done' }),
                ]}
                onEdit={vi.fn()}
            />
        )

        const cell = dayCell(2026, 10, 5)
        expect(within(cell).getByRole('button', { name: /Late task.*overdue/ })).toBeInTheDocument()
        expect(within(cell).getByRole('button', { name: /Finished task.*done/ })).toBeInTheDocument()
    })

    it('collapses busy days into "+N more" and expands them', () => {
        const busy = ['one', 'two', 'three', 'four', 'five'].map((id) => task({ id, due_date: '2026-11-20' }))
        render(<TaskCalendar tasks={busy} onEdit={vi.fn()} />)

        const cell = dayCell(2026, 10, 20)
        expect(within(cell).getAllByRole('button', { name: /due/ })).toHaveLength(3)

        fireEvent.click(within(cell).getByRole('button', { name: '+2 more' }))

        expect(within(cell).getAllByRole('button', { name: /due/ })).toHaveLength(5)
    })

    it('moves between months and back to today', () => {
        render(<TaskCalendar tasks={[]} onEdit={vi.fn()} />)
        const label = (y, m) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1))

        fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
        expect(screen.getByRole('heading', { name: label(2027, 0) })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Today' }))
        expect(screen.getByRole('heading', { name: label(2026, 10) })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
        expect(screen.getByRole('heading', { name: label(2026, 9) })).toBeInTheDocument()
    })

    it('says how many tasks have no due date', () => {
        render(<TaskCalendar tasks={[task({ id: 'x' }), task({ id: 'y' })]} onEdit={vi.fn()} />)

        expect(screen.getByText('2 tasks have no due date and are not shown.')).toBeInTheDocument()
    })

    it('has no detectable accessibility violations', async () => {
        const { container } = render(
            <TaskCalendar tasks={[task({ id: 'a', title: 'Write report', due_date: '2026-11-12' })]} onEdit={vi.fn()} />
        )

        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
})
