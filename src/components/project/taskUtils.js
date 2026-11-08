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

export const DEFAULT_TASK_FILTERS = {
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
    sort: 'newest',
}

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 }

// Apply search, filters and sorting without changing the source list.
export function filterAndSortTasks(tasks, filters) {
    const search = filters.search.trim().toLowerCase()

    return tasks
        .filter((task) => {
            const title = String(task.title || '').toLowerCase()
            const description = String(task.description || '').toLowerCase()
            const matchesSearch =
                !search ||
                title.includes(search) ||
                description.includes(search)
            const matchesStatus =
                filters.status === 'all' || task.status === filters.status
            const matchesPriority =
                filters.priority === 'all' || task.priority === filters.priority
            const matchesAssignee =
                filters.assignee === 'all' ||
                (filters.assignee === 'unassigned'
                    ? !task.assignee_id
                    : task.assignee_id === filters.assignee)

            return (
                matchesSearch &&
                matchesStatus &&
                matchesPriority &&
                matchesAssignee
            )
        })
        .sort((a, b) => {
            if (filters.sort === 'oldest' || filters.sort === 'newest') {
                const difference =
                    new Date(a.created_at || 0).getTime() -
                    new Date(b.created_at || 0).getTime()
                return filters.sort === 'oldest' ? difference : -difference
            }

            if (filters.sort === 'due_date') {
                if (!a.due_date && !b.due_date) return 0
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            }

            return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
        })
}

// Look up a member's display name by user ID.
export function getMemberName(members, userId) {
    const member = members.find((item) => item.user_id === userId)
    return member?.full_name || 'Unknown member'
}
