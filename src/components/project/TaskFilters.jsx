import { Search, SlidersHorizontal, X } from 'lucide-react'

const selectClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500'

// Search box plus status / priority / assignee filters and sort order.
function TaskFilters({ filters, onChange, onReset, members, shownCount, totalCount }) {
    function update(field) {
        return (event) => onChange({ ...filters, [field]: event.target.value })
    }

    return (
        <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-slate-300">
                <SlidersHorizontal size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold">Find and organise tasks</h3>
                <span className="ml-auto text-xs text-slate-500">
                    Showing {shownCount} of {totalCount}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="relative block sm:col-span-2 lg:col-span-1">
                    <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="search"
                        value={filters.search}
                        onChange={update('search')}
                        placeholder="Search title or description..."
                        aria-label="Search tasks"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500"
                    />
                </label>

                <select value={filters.status} onChange={update('status')} aria-label="Filter by status" className={selectClass}>
                    <option value="all">All statuses</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                </select>

                <select value={filters.priority} onChange={update('priority')} aria-label="Filter by priority" className={selectClass}>
                    <option value="all">All priorities</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                </select>

                <select value={filters.assignee} onChange={update('assignee')} aria-label="Filter by assignee" className={selectClass}>
                    <option value="all">All assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                            {member.full_name || 'Unnamed member'}
                        </option>
                    ))}
                </select>

                <select value={filters.sort} onChange={update('sort')} aria-label="Sort tasks" className={selectClass}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="due_date">Due date (soonest)</option>
                    <option value="priority">Priority (high to low)</option>
                </select>

                <button
                    type="button"
                    onClick={onReset}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                    <X size={15} />
                    Clear filters
                </button>
            </div>
        </section>
    )
}

export default TaskFilters
