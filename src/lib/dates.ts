// Human-friendly dates for feeds: "just now", "5m ago", "Yesterday".

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Short relative time for recent events, falling back to a date for older ones.
export function formatRelativeTime(value: string | number | Date, now: Date = new Date()): string {
    const date = new Date(value)
    const diff = now.getTime() - date.getTime()

    if (Number.isNaN(diff)) return ''
    if (diff < MINUTE) return 'just now'
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
    if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`

    const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY)
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`

    return date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    })
}

// Heading for a group of events on the same calendar day.
export function formatDayHeading(value: string | number | Date, now: Date = new Date()): string {
    const date = new Date(value)
    const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY)

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'

    return date.toLocaleDateString([], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    })
}

// Full timestamp, for tooltips.
export function formatFullDateTime(value: string | number | Date): string {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
