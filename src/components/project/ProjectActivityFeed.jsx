import {
    ClipboardList,
    UserRound,
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
function getActivityIcon(type) {
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

function getActivityColor(type) {
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

// Timeline of recent project activity with a manual refresh button.
function ProjectActivityFeed({ activities, loading, error, onRefresh, currentUserId }) {
    return (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
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
                <div className="relative">
                    <div className="absolute left-[17px] top-5 bottom-5 w-px bg-slate-800" />

                    <div className="space-y-5">
                        {activities.map((item) => (
                            <div
                                key={item.id}
                                className="relative flex gap-4"
                            >
                                <div
                                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getActivityColor(
                                        item.activity_type
                                    )}`}
                                >
                                    {getActivityIcon(
                                        item.activity_type
                                    )}
                                </div>

                                <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 p-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        {item.actor_avatar ? (
                                            <img
                                                src={item.actor_avatar}
                                                alt=""
                                                className="h-6 w-6 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                                                <UserRound size={13} />
                                            </div>
                                        )}

                                        <span className="text-sm font-medium text-slate-200">
                                            {item.actor_name ||
                                                'A team member'}
                                        </span>

                                        {item.actor_id ===
                                            currentUserId && (
                                                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
                                                    You
                                                </span>
                                            )}
                                    </div>

                                    <p className="text-sm leading-6 text-slate-300 break-words">
                                        {item.description}
                                    </p>

                                    {item.task_title && (
                                        <p className="mt-2 text-xs text-indigo-300">
                                            Task: {item.task_title}
                                        </p>
                                    )}

                                    <p className="mt-3 text-xs text-slate-400">
                                        {new Date(
                                            item.created_at
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}

export default ProjectActivityFeed
