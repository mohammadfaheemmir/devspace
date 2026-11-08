// Date-only helpers avoid timezone shifts when parsing Supabase DATE values.
export function getLocalDateString() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function formatDueDate(dateValue) {
    if (!dateValue) return ''
    const [year, month, day] = String(dateValue).split('-').map(Number)
    if (!year || !month || !day) return String(dateValue)
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(year, month - 1, day))
}

export function isTaskOverdue(task) {
    return Boolean(
        task.due_date &&
        task.status !== 'done' &&
        task.due_date < getLocalDateString()
    )
}

// Shared priority badge colours so list and board views look the same.
export function getPriorityBadgeClasses(priority) {
    if (priority === 'high') return 'bg-red-500/10 text-red-400'
    if (priority === 'low') return 'bg-green-500/10 text-green-400'
    return 'bg-yellow-500/10 text-yellow-400'
}
