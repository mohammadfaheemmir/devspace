import { ArrowUpRight, CalendarDays, FolderKanban } from 'lucide-react'

const ROLE_STYLES = {
    owner: 'bg-amber-500/10 text-amber-400',
    admin: 'bg-purple-500/10 text-purple-400',
    member: 'bg-indigo-500/10 text-indigo-400',
}

// Dashboard card for one project: your role, task progress and created date.
// `summary` may be undefined while it loads (or if it failed to load).
function ProjectCard({ project, summary, onOpen }) {
    const role = summary?.role
    const total = summary?.total ?? 0
    const done = summary?.done ?? 0
    const inProgress = summary?.inProgress ?? 0
    const percentDone = total ? Math.round((done / total) * 100) : 0

    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-indigo-500/60 hover:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
            <div className="flex items-center justify-between">
                <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                    <FolderKanban size={22} />
                </div>

                <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs capitalize ${ROLE_STYLES[role] || ROLE_STYLES.member}`}>
                        {role || 'Project'}
                    </span>

                    <ArrowUpRight size={17} className="text-slate-500" />
                </div>
            </div>

            <h4 className="mt-5 text-lg font-semibold break-words">{project.name}</h4>

            <p className="mt-2 min-h-12 text-sm text-slate-400 line-clamp-3">
                {project.description || 'No description provided.'}
            </p>

            {/* Task progress */}
            {summary && (
                <div className="mt-5">
                    {total === 0 ? (
                        <p className="text-xs text-slate-500">No tasks yet</p>
                    ) : (
                        <>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>
                                    {done} of {total} tasks done
                                    {inProgress > 0 && ` · ${inProgress} in progress`}
                                </span>
                                <span className="font-medium text-slate-300">{percentDone}%</span>
                            </div>

                            <div
                                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
                                role="progressbar"
                                aria-valuenow={percentDone}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${project.name} progress`}
                            >
                                <div
                                    className="h-full rounded-full bg-green-500 transition-all"
                                    style={{ width: `${percentDone}%` }}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
                <CalendarDays size={14} />
                Created {new Date(project.created_at).toLocaleDateString()}
            </div>
        </button>
    )
}

export default ProjectCard
