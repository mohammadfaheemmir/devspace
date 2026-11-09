import { useState, type Dispatch, type SetStateAction } from 'react'
import { getErrorMessage } from '../../lib/errors'
import type { ProjectMember } from '../../types/app'
import { useToast } from '../../context/useToast'
import {
    getProjectMembers,
    transferProjectOwnership,
} from '../../lib/projectMemberService'

// Hand project ownership to another member (current owner only).
type OwnershipTransferPanelProps = {
    projectId: string
    members: ProjectMember[]
    currentUserId: string | null
    isProjectOwner: boolean
    onMembersChange: Dispatch<SetStateAction<ProjectMember[]>>
    onError: (message: string) => void
}

function OwnershipTransferPanel({ projectId, members, currentUserId, isProjectOwner, onMembersChange, onError }: OwnershipTransferPanelProps) {
    const toast = useToast()
    const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('')
    const [transferringOwnership, setTransferringOwnership] = useState(false)

    // Transfer project ownership to an existing project member.
    async function handleTransferOwnership() {
        if (!isProjectOwner) {
            onError('Only the project owner can transfer ownership.')
            return
        }

        if (!selectedNewOwnerId) {
            onError('Please select a new owner.')
            return
        }

        const selectedMember = members.find(
            (member) => member.user_id === selectedNewOwnerId
        )

        if (!selectedMember || selectedMember.role === 'owner') {
            onError('Please select a valid project member.')
            return
        }

        const confirmed = window.confirm(
            `Transfer ownership to ${selectedMember.full_name}? You will become an admin.`
        )

        if (!confirmed) return

        try {
            setTransferringOwnership(true)
            onError('')

            await transferProjectOwnership(projectId, selectedNewOwnerId)

            const updatedMembers = await getProjectMembers(projectId)
            onMembersChange(updatedMembers)
            setSelectedNewOwnerId('')
            toast.success(`Ownership transferred to ${selectedMember.full_name}.`)
        } catch (err) {
            console.error('Ownership transfer failed:', err)
            onError(getErrorMessage(err, 'Unable to transfer project ownership.'))
        } finally {
            setTransferringOwnership(false)
        }
    }

    return (
        <section className="mb-6 rounded-2xl border border-amber-500/20 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="mb-4">
                <h3 className="font-semibold text-white">
                    Transfer Project Ownership
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                    Choose an existing project member. After the transfer,
                    they become the owner and your role changes to admin.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <select
                    value={selectedNewOwnerId}
                    onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                    disabled={transferringOwnership}
                    className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                    <option value="">Select a new owner</option>
                    {members
                        .filter((member) => member.user_id !== currentUserId)
                        .map((member) => (
                            <option
                                key={member.user_id}
                                value={member.user_id}
                            >
                                {member.full_name} ({member.role})
                            </option>
                        ))}
                </select>

                <button
                    type="button"
                    onClick={handleTransferOwnership}
                    disabled={transferringOwnership || !selectedNewOwnerId}
                    className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {transferringOwnership ? 'Transferring...' : 'Transfer Ownership'}
                </button>
            </div>

            <p className="mt-3 text-xs text-amber-400">
                This action changes your permissions immediately.
            </p>
        </section>
    )
}

export default OwnershipTransferPanel
