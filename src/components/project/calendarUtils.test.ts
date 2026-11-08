import { describe, expect, it } from 'vitest'
import { addMonths, getMonthGrid, groupTasksByDueDate, toDateKey } from './calendarUtils'

describe('toDateKey', () => {
    it('formats a local date as YYYY-MM-DD with zero padding', () => {
        expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
        // Late in the day must not roll over to the next date.
        expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
    })
})

describe('getMonthGrid', () => {
    it('always returns 6 full weeks starting on a Monday', () => {
        const grid = getMonthGrid(2026, 10) // November 2026

        expect(grid).toHaveLength(42)
        // 1 Nov 2026 is a Sunday, so the grid starts on Monday 26 Oct.
        expect(grid[0]).toEqual({ key: '2026-10-26', day: 26, inMonth: false })
        expect(grid[6]).toEqual({ key: '2026-11-01', day: 1, inMonth: true })
    })

    it('marks exactly the days of the month as in-month', () => {
        const inMonth = getMonthGrid(2026, 1).filter((day) => day.inMonth) // Feb 2026

        expect(inMonth).toHaveLength(28)
        expect(inMonth[0]?.key).toBe('2026-02-01')
        expect(inMonth[27]?.key).toBe('2026-02-28')
    })

    it('handles leap years', () => {
        expect(getMonthGrid(2028, 1).filter((day) => day.inMonth)).toHaveLength(29)
    })

    it('starts on the 1st when the month begins on a Monday', () => {
        // 1 June 2026 is a Monday.
        expect(getMonthGrid(2026, 5)[0]).toEqual({ key: '2026-06-01', day: 1, inMonth: true })
    })
})

describe('groupTasksByDueDate', () => {
    it('groups tasks by due date and skips tasks without one', () => {
        const tasks = [
            { id: 'a', due_date: '2026-11-10' },
            { id: 'b', due_date: null },
            { id: 'c', due_date: '2026-11-10' },
            { id: 'd', due_date: '2026-11-12' },
        ]

        const groups = groupTasksByDueDate(tasks)

        expect(Object.keys(groups).sort()).toEqual(['2026-11-10', '2026-11-12'])
        expect(groups['2026-11-10']?.map((task) => task.id)).toEqual(['a', 'c'])
    })
})

describe('addMonths', () => {
    it('moves across year boundaries', () => {
        expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 })
        expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
    })
})
