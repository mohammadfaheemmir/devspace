import { useState } from 'react'
import { useToast } from '../../context/useToast'
import {
    getProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
} from '../../lib/projectMemberService'
import {
    Users,
    UserRound,
} from 'lucide-react'

// List project members with role changes and removal.
function ProjectMembersPanel({ projectId, members, currentUserId, isProjectOwner, isProjectAdmin, onMembersChange, onError }) {
    const toast = useToast()
    const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState(null)
    const [removingMemberId, setRemovingMemberId] = useState(null)

    // Only the project owner can promote members or demote admins.
    async function handleUpdateMemberRole(member, nextRole) {
        if (!isProjectOwner) {
            onError('Only the project owner can change member roles.')
            return
        }

        if (!member || !['admin', 'member'].includes(nextRole)) {
            onError('Invalid member role change.')
            return
        }

        if (member.role === 'owner' || member.role === nextRole) return

        const action = nextRole === 'admin' ? 'promote' : 'demote'
        const confirmed = window.confirm(
            `Are you sure you want to ${action} ${member.full_name} ${nextRole === 'admin' ? 'to Admin' : 'to Member'}?`
        )
        if (!confirmed) return

        try {
            setUpdatingMemberRoleId(member.user_id)
            onError('')
            await updateProjectMemberRole(projectId, member.user_id, nextRole)
            const updatedMembers = await getProjectMembers(projectId)
            onMembersChange(updatedMembers)
            toast.success(`${member.full_name} is now ${nextRole === 'admin' ? 'an admin' : 'a member'}.`)
        } catch (err) {
            console.error('Member role update failed:', err)
            onError(err.message || 'Unable to update member role.')
        } finally {
            setUpdatingMemberRoleId(null)
        }
    }

    // Remove a member according to the role permissions enforced by Supabase RLS.
    async function handleRemoveMember(member) {
        if (!member || member.role === 'owner' || member.user_id === currentUserId) return

        const canRemove = isProjectOwner
            ? ['admin', 'member'].includes(member.role)
            : isProjectAdmin && member.role === 'member'

        if (!canRemove) {
            onError('You do not have permission to remove this member.')
            return
        }

        const confirmed = window.confirm(`Remove ${member.full_name} from this project?`)
        if (!confirmed) return

        try {
            setRemovingMemberId(member.user_id)
            onError('')
            await removeProjectMember(projectId, member.user_id)
            onMembersChange((previous) => previous.filter((item) => item.user_id !== member.user_id))
            toast.success(`${member.full_name} was removed from the project.`)
        } catch (err) {
            console.error('Remove project member failed:', err)
            onError(err.message || 'Unable to remove this member.')
        } finally {
            setRemovingMemberId(null)
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-4">
                <Users className="text-indigo-400" size={22} />

                <h2 className="text-lg font-semibold">
                    Project Members
                </h2>

                <span className="text-sm text-slate-400">
                    ({members.length})
                </span>
            </div>

            {members.length === 0 ? (
                <p className="text-sm text-slate-400">
                    No project members found.
                </p>
            ) : (
                <div className="flex flex-wrap gap-3">
                    {members.map((member) => (
                        <div
                            key={member.user_id}
                            // Wraps so the role/remove buttons move to a second line on phones.
                            className="flex w-full flex-wrap items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:w-auto"
                        >
                            {member.avatar_url ? (
                                <img
                                    src={member.avatar_url}
                                    alt=""
                                    className="w-9 h-9 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                                    <UserRound size={18} />
                                </div>
                            )}

                            <div className="min-w-0 flex-1 sm:flex-none">
                                <p className="text-sm font-medium break-words">
                                    {member.full_name}
                                </p>

                                <p className="text-xs text-slate-400 capitalize">
                                    {member.role}
                                </p>
                            </div>

                            {isProjectOwner && member.user_id !== currentUserId && member.role !== 'owner' && (
                                <button
                                    type="button"
                                    onClick={() => handleUpdateMemberRole(
                                        member,
                                        member.role === 'admin' ? 'member' : 'admin'
                                    )}
                                    disabled={updatingMemberRoleId === member.user_id}
                                    className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${member.role === 'admin'
                                            ? 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                        }`}
                                >
                                    {updatingMemberRoleId === member.user_id
                                        ? 'Updating...'
                                        : member.role === 'admin'
                                            ? 'Make Member'
                                            : 'Make Admin'}
                                </button>
                            )}

                            {member.user_id !== currentUserId && member.role !== 'owner' && (
                                (isProjectOwner || (isProjectAdmin && member.role === 'member')) && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMember(member)}
                                        disabled={removingMemberId === member.user_id}
                                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {removingMemberId === member.user_id ? 'Removing...' : 'Remove'}
                                    </button>
                                )
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ProjectMembersPanel
