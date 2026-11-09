import type { ProjectActivity } from '../../lib/activityService'
import { formatDayHeading, formatFullDateTime, formatRelativeTime } from '../../lib/dates'
import {
    ClipboardList,
    Mail,
    MessageCircle,
    Activity,
    UserPlus,
    UserCheck,
    UserMinus,
    ListTodo,
    RefreshCw,
    LoaderCircle,
} from 'lucide-react'

// Activity icon.
function getActivityIcon(type: string) {
    switch (type) {
        case 'project_created':
            return <ClipboardList size={18} />
        case 'task_created':
            return <ListTodo size={18} />
        case 'task_assigned':
            return <UserPlus size={18} />
        case 'task_unassigned':
            return <UserMinus size={18} />
        case 'task_status_changed':
            return <RefreshCw size={18} />
        case 'comment_added':
            return <MessageCircle size={18} />
        case 'member_invited':
            return <Mail size={18} />
        case 'member_joined':
            return <UserCheck size={18} />
        default:
            return <Activity size={18} />
    }
}

function getActivityColor(type: string) {
    switch (type) {
        case 'project_created':
            return 'bg-indigo-500/15 text-indigo-400'
        case 'task_created':
            return 'bg-blue-500/15 text-blue-400'
        case 'task_assigned':
        case 'member_invited':
            return 'bg-purple-500/15 text-purple-400'
        case 'task_unassigned':
            return 'bg-orange-500/15 text-orange-400'
        case 'task_status_changed':
            return 'bg-cyan-500/15 text-cyan-400'
        case 'comment_added':
            return 'bg-pink-500/15 text-pink-400'
        case 'member_joined':
            return 'bg-green-500/15 text-green-400'
        default:
            return 'bg-slate-700 text-slate-300'
    }
}

type DayGroup = { key: string; heading: string; items: ProjectActivity[] }

// Consecutive activities on the same local calendar day share a heading.
function groupByDay(activities: ProjectActivity[]): DayGroup[] {
    const groups: DayGroup[] = []

    for (const item of activities) {
        const date = new Date(item.created_at)
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const last = groups[groups.length - 1]

        if (last && last.key === key) {
            last.items.push(item)
        } else {
            groups.push({ key, heading: formatDayHeading(date), items: [item] })
        }
    }

    return groups
}

// Timeline of recent project activity with a manual refresh button.
type ProjectActivityFeedProps = {
    activities: ProjectActivity[]
    loading: boolean
    error: string
    onRefresh: () => void
    currentUserId: string | null
}

function ProjectActivityFeed({ activities, loading, error, onRefresh, currentUserId }: ProjectActivityFeedProps) {
    return (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <Activity
                        className="text-indigo-400"
                        size={22}
                    />

                    <div>
                        <h2 className="text-lg font-semibold">
                            Project Activity
                        </h2>

                        <p className="text-xs text-slate-400 mt-1">
                            Stay updated with what's happening in
                            this project.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                    {loading ? (
                        <LoaderCircle
                            size={15}
                            className="animate-spin"
                        />
                    ) : (
                        <RefreshCw size={15} />
                    )}
                    Refresh
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
                    <LoaderCircle
                        size={19}
                        className="animate-spin"
                    />
                    Loading project activity...
                </div>
            ) : activities.length === 0 ? (
                <div className="py-10 text-center">
                    <Activity
                        size={34}
                        className="mx-auto mb-3 text-slate-500"
                    />

                    <h3 className="font-medium text-slate-300">
                        No activity yet
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                        Project updates will appear here as your
                        team works.
                    </p>
                </div>
            ) : (
                // Grouped by day, newest first (the order the service returns).
                <div className="space-y-6">
                    {groupByDay(activities).map((group) => (
                        <div key={group.key}>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {group.heading}
                            </h3>

                            <ol className="relative space-y-4">
                                <div aria-hidden="true" className="absolute bottom-4 left-[17px] top-4 w-px bg-slate-800" />

                                {group.items.map((item) => (
                                    <li key={item.id} className="relative flex gap-3">
                                        <div
                                            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-slate-900 ${getActivityColor(item.activity_type)}`}
                                        >
                                            {getActivityIcon(item.activity_type)}
                                        </div>

                                        <div className="min-w-0 flex-1 pt-1">
                                            <p className="break-words text-sm leading-6 text-slate-300">
                                                {/* "Joined" descriptions already start with the member's name. */}
                                                {item.activity_type !== 'member_joined' && (
                                                    <>
                                                        <span className="font-medium text-white">
                                                            {item.actor_id === currentUserId ? 'You' : item.actor_name || 'A team member'}
                                                        </span>
                                                        <span className="text-slate-500"> · </span>
                                                    </>
                                                )}
                                                {item.description}
                                            </p>

                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                                <time dateTime={item.created_at} title={formatFullDateTime(item.created_at)}>
                                                    {formatRelativeTime(item.created_at)}
                                                </time>

                                                {/* Skip the task tag when the description already names it. */}
                                                {item.task_title && !item.description.includes(item.task_title) && (
                                                    <span className="inline-flex min-w-0 items-center gap-1 text-indigo-300">
                                                        <ListTodo size={12} className="shrink-0" />
                                                        <span className="truncate">{item.task_title}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

export default ProjectActivityFeed
