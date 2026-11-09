import { useState, type Dispatch, type SetStateAction } from 'react'
import { getErrorMessage } from '../../lib/errors'
import type { ProjectMember } from '../../types/app'
import { useToast } from '../../context/useToast'
import {
    getProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
} from '../../lib/projectMemberService'
import { Users } from 'lucide-react'
import MemberAvatar from './MemberAvatar'
import { ROLE_BADGE } from './roleStyles'

// List project members with role changes and removal.
type ProjectMembersPanelProps = {
    projectId: string
    members: ProjectMember[]
    currentUserId: string | null
    isProjectOwner: boolean
    isProjectAdmin: boolean
    onMembersChange: Dispatch<SetStateAction<ProjectMember[]>>
    onError: (message: string) => void
}

function ProjectMembersPanel({ projectId, members, currentUserId, isProjectOwner, isProjectAdmin, onMembersChange, onError }: ProjectMembersPanelProps) {
    const toast = useToast()
    const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState<string | null>(null)
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

    // Only the project owner can promote members or demote admins.
    async function handleUpdateMemberRole(member: ProjectMember, nextRole: 'admin' | 'member') {
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
            onError(getErrorMessage(err, 'Unable to update member role.'))
        } finally {
            setUpdatingMemberRoleId(null)
        }
    }

    // Remove a member according to the role permissions enforced by Supabase RLS.
    async function handleRemoveMember(member: ProjectMember) {
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
            onError(getErrorMessage(err, 'Unable to remove this member.'))
        } finally {
            setRemovingMemberId(null)
        }
    }

    return (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
                <Users className="text-indigo-400" size={22} />

                <h2 className="text-lg font-semibold">
                    Project Members
                </h2>

                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                    {members.length}
                </span>
            </div>

            {members.length === 0 ? (
                <p className="text-sm text-slate-400">
                    No project members found.
                </p>
            ) : (
                <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                    {members.map((member) => (
                        <li
                            key={member.user_id}
                            // Wraps so the role/remove buttons move to a second line on phones.
                            className="flex flex-wrap items-center gap-3 px-4 py-3"
                        >
                            <MemberAvatar member={member} />

                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span className="break-words">{member.full_name}</span>
                                    {member.user_id === currentUserId && (
                                        <span className="rounded-full bg-slate-800 px-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                                            You
                                        </span>
                                    )}
                                </p>

                                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs capitalize ${ROLE_BADGE[member.role] ?? ROLE_BADGE.member}`}>
                                    {member.role}
                                </span>
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
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default ProjectMembersPanel
