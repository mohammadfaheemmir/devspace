import { ArrowUpRight, CalendarDays, FolderKanban } from 'lucide-react'
import type { Project, ProjectRole } from '../../types/app'
import type { ProjectSummary } from '../../lib/projectService'

const ROLE_STYLES: Record<ProjectRole, string> = {
    owner: 'bg-amber-500/10 text-amber-400',
    admin: 'bg-purple-500/10 text-purple-400',
    member: 'bg-indigo-500/10 text-indigo-400',
}

// Dashboard card for one project: your role, task progress and created date.
// `summary` may be undefined while it loads (or if it failed to load).
type ProjectCardProps = {
    project: Project
    summary: ProjectSummary | undefined
    onOpen: () => void
}

function ProjectCard({ project, summary, onOpen }: ProjectCardProps) {
    const role = summary?.role
    const total = summary?.total ?? 0
    const done = summary?.done ?? 0
    const inProgress = summary?.inProgress ?? 0
    const percentDone = total ? Math.round((done / total) * 100) : 0

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex h-full w-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-left shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
            <div className="flex items-center justify-between">
                <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                    <FolderKanban size={22} />
                </div>

                <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs capitalize ${role ? ROLE_STYLES[role] : ROLE_STYLES.member}`}>
                        {role || 'Project'}
                    </span>

                    <ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-indigo-300" />
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
                        <p className="text-xs text-slate-400">No tasks yet</p>
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
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all"
                                    style={{ width: `${percentDone}%` }}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* created_at is nullable; new Date(null) would show 1 Jan 1970. */}
            {project.created_at && (
                <div className="mt-auto pt-5">
                    <div className="flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
                        <CalendarDays size={14} />
                        Created {new Date(project.created_at).toLocaleDateString()}
                    </div>
                </div>
            )}
        </button>
    )
}

export default ProjectCard
