import { describe, expect, it } from 'vitest'
import { formatDayHeading, formatRelativeTime } from './dates'

const now = new Date(2026, 10, 9, 15, 0, 0) // 9 Nov 2026, 15:00 local

describe('formatRelativeTime', () => {
    it('shows minutes and hours for recent events', () => {
        expect(formatRelativeTime(new Date(2026, 10, 9, 14, 59, 30), now)).toBe('just now')
        expect(formatRelativeTime(new Date(2026, 10, 9, 14, 55), now)).toBe('5m ago')
        expect(formatRelativeTime(new Date(2026, 10, 9, 12, 0), now)).toBe('3h ago')
    })

    it('uses calendar days for older events', () => {
        expect(formatRelativeTime(new Date(2026, 10, 8, 9, 0), now)).toBe('Yesterday')
        expect(formatRelativeTime(new Date(2026, 10, 5, 9, 0), now)).toBe('4d ago')
    })

    it('falls back to a date after a week', () => {
        expect(formatRelativeTime(new Date(2026, 9, 1), now)).not.toMatch(/ago/)
    })

    it('returns an empty string for an invalid date', () => {
        expect(formatRelativeTime('not a date', now)).toBe('')
    })
})

describe('formatDayHeading', () => {
    it('names today and yesterday', () => {
        expect(formatDayHeading(new Date(2026, 10, 9, 1, 0), now)).toBe('Today')
        expect(formatDayHeading(new Date(2026, 10, 8, 23, 0), now)).toBe('Yesterday')
    })

    it('uses the date for older days', () => {
        expect(formatDayHeading(new Date(2026, 10, 2), now)).not.toMatch(/Today|Yesterday/)
    })
})
