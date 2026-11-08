// Date helpers for the task calendar. Due dates are plain DATE values
// ('YYYY-MM-DD') with no time zone, so all work here uses local dates and
// date keys, never Date -> ISO string conversions (which shift by time zone).

export type CalendarDay = {
    /** 'YYYY-MM-DD' */
    key: string
    /** Day of the month, 1-31 */
    day: number
    /** False for leading/trailing days from the neighbouring months */
    inMonth: boolean
}

// 'YYYY-MM-DD' for a local date.
export function toDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// The 42 days (6 weeks, Monday first) shown for a month, including the
// end of the previous month and the start of the next to fill the weeks.
export function getMonthGrid(year: number, monthIndex: number): CalendarDay[] {
    const firstOfMonth = new Date(year, monthIndex, 1)
    // getDay(): 0 = Sunday ... 6 = Saturday. Days to step back to Monday:
    const daysBack = (firstOfMonth.getDay() + 6) % 7
    const start = new Date(year, monthIndex, 1 - daysBack)

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
        return {
            key: toDateKey(date),
            day: date.getDate(),
            inMonth: date.getMonth() === monthIndex,
        }
    })
}

// Group tasks by due date; tasks without a due date are left out.
export function groupTasksByDueDate<T extends { due_date: string | null }>(tasks: readonly T[]): Record<string, T[]> {
    const groups: Record<string, T[]> = {}

    for (const task of tasks) {
        if (!task.due_date) continue
        ;(groups[task.due_date] ??= []).push(task)
    }

    return groups
}

// e.g. "November 2026", in the user's language.
export function formatMonthLabel(year: number, monthIndex: number): string {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
        .format(new Date(year, monthIndex, 1))
}

// Short weekday names, Monday first, in the user's language.
export function getWeekdayLabels(): string[] {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
    // 5 Jan 2026 is a Monday.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2026, 0, 5 + index)))
}

// Move a (year, month) pair by a number of months.
export function addMonths(year: number, monthIndex: number, amount: number): { year: number; monthIndex: number } {
    const date = new Date(year, monthIndex + amount, 1)
    return { year: date.getFullYear(), monthIndex: date.getMonth() }
}
