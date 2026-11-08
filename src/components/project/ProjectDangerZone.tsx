import { useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import type { Project } from '../../types/app'
import { useNavigate } from 'react-router-dom'
import { leaveProject } from '../../lib/projectMemberService'
import { deleteProject } from '../../lib/projectService'
import { removeProjectFiles } from '../../lib/attachmentService'
import {
    Trash2,
} from 'lucide-react'

// Leave the project (members/admins) or delete it (owner).
type ProjectDangerZoneProps = {
    project: Project
    projectId: string
    isProjectOwner: boolean
    onError: (message: string) => void
}

function ProjectDangerZone({ project, projectId, isProjectOwner, onError }: ProjectDangerZoneProps) {
    const [leavingProject, setLeavingProject] = useState(false)
    const [deletingProject, setDeletingProject] = useState(false)
    const navigate = useNavigate()

    // Only the project owner can delete the entire project.
    async function handleDeleteProject() {
        if (!isProjectOwner) {
            onError('Only the project owner can delete this project.')
            return
        }

        const projectName = project?.name || 'this project'
        const confirmed = window.confirm(
            `Permanently delete "${projectName}"? This will delete all tasks, members, invitations, notifications, and project activity. This action cannot be undone.`
        )
        if (!confirmed) return

        try {
            setDeletingProject(true)
            onError('')
            // Supabase cannot delete files when the project's rows cascade
            // away, so remove its attachment files first (best effort).
            await removeProjectFiles(projectId)
            await deleteProject(projectId)
            navigate('/dashboard', {
                replace: true,
                state: { message: `Project "${projectName}" was deleted.` },
            })
        } catch (err) {
            console.error('Project deletion failed:', err)
            onError(getErrorMessage(err, 'Unable to delete this project.'))
        } finally {
            setDeletingProject(false)
        }
    }

    // A member or admin can leave. The database policy prevents the owner from leaving.
    async function handleLeaveProject() {
        if (isProjectOwner) {
            onError('Transfer project ownership before leaving this project.')
            return
        }

        const confirmed = window.confirm('Are you sure you want to leave this project? You will lose access to its workspace.')
        if (!confirmed) return

        try {
            setLeavingProject(true)
            onError('')
            await leaveProject(projectId)
            navigate('/dashboard', {
                replace: true,
                state: { message: `You left "${project?.name || 'the project'}".` },
            })
        } catch (err) {
            console.error('Leave project failed:', err)
            onError(getErrorMessage(err, 'Unable to leave this project.'))
        } finally {
            setLeavingProject(false)
        }
    }

    return (
        <>
            {/* Leave project - available to admins and members, not the owner. */}
            {!isProjectOwner && (
                <div className="mb-8 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="font-semibold text-white">Leave Project</h3>
                        <p className="mt-1 text-sm text-slate-400">Leave this workspace and lose access to its tasks and project activity.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLeaveProject}
                        disabled={leavingProject}
                        className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {leavingProject ? 'Leaving...' : 'Leave Project'}
                    </button>
                </div>
            )}

            {isProjectOwner && (
                <p className="mb-8 text-sm text-slate-400">To leave this project, transfer ownership first.</p>
            )}

            {/* Delete project - current owner only. Database RLS enforces this too. */}
            {isProjectOwner && (
                <section className="mb-8 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="font-semibold text-red-200">Delete Project</h3>
                        <p className="mt-1 text-sm text-slate-400">
                            Permanently delete this project and all its related data. This cannot be undone.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDeleteProject}
                        disabled={deletingProject}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                        {deletingProject ? 'Deleting...' : 'Delete Project'}
                    </button>
                </section>
            )}
        </>
    )
}

export default ProjectDangerZone
