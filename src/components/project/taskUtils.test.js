import { describe, expect, it, vi } from 'vitest'
import {
    DEFAULT_TASK_FILTERS,
    filterAndSortTasks,
    formatDueDate,
    getLocalDateString,
    getMemberName,
    getPriorityBadgeClasses,
    isTaskOverdue,
} from './taskUtils'

function task(overrides) {
    return {
        id: overrides.id,
        title: '',
        description: null,
        status: 'todo',
        priority: 'medium',
        assignee_id: null,
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

describe('getLocalDateString', () => {
    it('returns the local date as YYYY-MM-DD with zero padding', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 0, 5, 23, 30)) // 5 Jan 2026, 23:30 local

        expect(getLocalDateString()).toBe('2026-01-05')
    })
})

describe('formatDueDate', () => {
    it('returns an empty string for empty values', () => {
        expect(formatDueDate(null)).toBe('')
        expect(formatDueDate('')).toBe('')
    })

    it('formats a DATE value without shifting the day across time zones', () => {
        const expected = new Intl.DateTimeFormat(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(new Date(2026, 2, 1))

        expect(formatDueDate('2026-03-01')).toBe(expected)
    })

    it('returns unparseable values unchanged', () => {
        expect(formatDueDate('soon')).toBe('soon')
    })
})

describe('isTaskOverdue', () => {
    it('is true only for unfinished tasks with a due date before today', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 5, 15, 12)) // 15 Jun 2026

        expect(isTaskOverdue({ due_date: '2026-06-14', status: 'todo' })).toBe(true)
        expect(isTaskOverdue({ due_date: '2026-06-14', status: 'in_progress' })).toBe(true)
        expect(isTaskOverdue({ due_date: '2026-06-15', status: 'todo' })).toBe(false) // due today
        expect(isTaskOverdue({ due_date: '2026-06-14', status: 'done' })).toBe(false)
        expect(isTaskOverdue({ due_date: null, status: 'todo' })).toBe(false)
    })
})

describe('getPriorityBadgeClasses', () => {
    it('uses red for high, green for low and yellow otherwise', () => {
        expect(getPriorityBadgeClasses('high')).toContain('red')
        expect(getPriorityBadgeClasses('low')).toContain('green')
        expect(getPriorityBadgeClasses('medium')).toContain('yellow')
        expect(getPriorityBadgeClasses(null)).toContain('yellow')
    })
})

describe('getMemberName', () => {
    const members = [{ user_id: 'u1', full_name: 'Ada Lovelace' }]

    it('finds a member by user ID', () => {
        expect(getMemberName(members, 'u1')).toBe('Ada Lovelace')
    })

    it('falls back for unknown users', () => {
        expect(getMemberName(members, 'nobody')).toBe('Unknown member')
    })
})

describe('filterAndSortTasks', () => {
    const tasks = [
        task({ id: 'a', title: 'Design login page', priority: 'high', status: 'todo', assignee_id: 'u1', due_date: '2026-03-10', created_at: '2026-01-01T00:00:00Z' }),
        task({ id: 'b', title: 'Write API docs', description: 'Cover the login endpoint', priority: 'low', status: 'done', created_at: '2026-01-03T00:00:00Z' }),
        task({ id: 'c', title: 'Fix bug', priority: 'medium', status: 'in_progress', assignee_id: 'u2', due_date: '2026-02-01', created_at: '2026-01-02T00:00:00Z' }),
    ]

    const ids = (list) => list.map((item) => item.id)
    const run = (overrides) => ids(filterAndSortTasks(tasks, { ...DEFAULT_TASK_FILTERS, ...overrides }))

    it('returns all tasks, newest first, with the default filters', () => {
        expect(run({})).toEqual(['b', 'c', 'a'])
    })

    it('does not modify the original array', () => {
        const before = ids(tasks)
        filterAndSortTasks(tasks, { ...DEFAULT_TASK_FILTERS, sort: 'oldest' })
        expect(ids(tasks)).toEqual(before)
    })

    it('searches title and description, ignoring case and surrounding spaces', () => {
        expect(run({ search: '  LOGIN ' })).toEqual(['b', 'a'])
    })

    it('filters by status, priority and assignee', () => {
        expect(run({ status: 'done' })).toEqual(['b'])
        expect(run({ priority: 'high' })).toEqual(['a'])
        expect(run({ assignee: 'u2' })).toEqual(['c'])
        expect(run({ assignee: 'unassigned' })).toEqual(['b'])
    })

    it('combines filters', () => {
        expect(run({ search: 'login', status: 'todo' })).toEqual(['a'])
    })

    it('sorts oldest first', () => {
        expect(run({ sort: 'oldest' })).toEqual(['a', 'c', 'b'])
    })

    it('sorts by due date with undated tasks last', () => {
        expect(run({ sort: 'due_date' })).toEqual(['c', 'a', 'b'])
    })

    it('sorts by priority, high to low', () => {
        expect(run({ sort: 'priority' })).toEqual(['a', 'c', 'b'])
    })
})
