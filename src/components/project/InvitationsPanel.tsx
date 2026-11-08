import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { displayStatus } from './invitationUtils'
import { getErrorMessage } from '../../lib/errors'
import type { ProjectInvitation } from '../../lib/invitationService'
import { useToast } from '../../context/useToast'
import {
    cancelProjectInvitation,
    createProjectInvitation,
} from '../../lib/invitationService'
import {
    Mail,
    Send,
    Trash2,
} from 'lucide-react'

// Invite people by email and manage pending invitations (owners and admins).
type InvitationsPanelProps = {
    projectId: string
    invitations: ProjectInvitation[]
    onInvitationsChange: Dispatch<SetStateAction<ProjectInvitation[]>>
    onError: (message: string) => void
}

function InvitationsPanel({ projectId, invitations, onInvitationsChange, onError }: InvitationsPanelProps) {
    const toast = useToast()
    const [invitationEmail, setInvitationEmail] = useState('')
    const [invitationSaving, setInvitationSaving] = useState(false)
    const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null)

    // Create a project invitation.
    async function handleCreateInvitation(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            setInvitationSaving(true)
            onError('')

            const newInvitation = await createProjectInvitation(
                projectId,
                invitationEmail
            )

            onInvitationsChange((previous) => [
                newInvitation,
                ...previous,
            ])

            setInvitationEmail('')
            toast.success(`Invitation sent to ${newInvitation.invited_email}.`)
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to create invitation.'))
        } finally {
            setInvitationSaving(false)
        }
    }

    // Cancel a project invitation.
    async function handleCancelInvitation(invitationId: string) {
        try {
            setCancellingInvitationId(invitationId)
            onError('')

            await cancelProjectInvitation(invitationId)
            toast.success('Invitation cancelled.')

            onInvitationsChange((previous) =>
                previous.filter(
                    (invitation) => invitation.id !== invitationId
                )
            )
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to cancel invitation.'))
        } finally {
            setCancellingInvitationId(null)
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-5">
                <Mail className="text-indigo-400" size={22} />

                <h2 className="text-lg font-semibold">
                    Invite Members
                </h2>
            </div>

            <form
                onSubmit={handleCreateInvitation}
                className="flex flex-col sm:flex-row gap-3"
            >
                <input
                    type="email"
                    value={invitationEmail}
                    onChange={(e) =>
                        setInvitationEmail(e.target.value)
                    }
                    placeholder="Enter member's email address"
                    required
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                />

                <button
                    type="submit"
                    disabled={invitationSaving}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-3 rounded-xl font-medium transition"
                >
                    <Send size={17} />
                    {invitationSaving
                        ? 'Sending...'
                        : 'Create Invitation'}
                </button>
            </form>

            <p className="text-xs text-slate-400 mt-3">
                The invited person must sign up or log in using
                this same email address.
            </p>

            <div className="border-t border-slate-800 mt-6 pt-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">
                    Invitations ({invitations.length})
                </h3>

                {invitations.length === 0 ? (
                    <p className="text-sm text-slate-400">
                        No invitations created yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {invitations.map((invitation) => (
                            <div
                                key={invitation.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium break-all">
                                        {invitation.invited_email}
                                    </p>

                                    {/* created_at is nullable; new Date(null) would show 1 Jan 1970. */}
                                    {invitation.created_at && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            Created:{' '}
                                            {new Date(invitation.created_at).toLocaleDateString()}
                                        </p>
                                    )}

                                    <span
                                        className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full capitalize ${displayStatus(invitation) === 'pending'
                                            ? 'bg-yellow-500/10 text-yellow-400'
                                            : displayStatus(invitation) === 'accepted'
                                                ? 'bg-green-500/10 text-green-400'
                                                : 'bg-slate-700 text-slate-300'
                                            }`}
                                    >
                                        {displayStatus(invitation)}
                                    </span>
                                </div>

                                {invitation.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleCancelInvitation(
                                                invitation.id
                                            )
                                        }
                                        disabled={
                                            cancellingInvitationId ===
                                            invitation.id
                                        }
                                        className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 disabled:opacity-50 text-sm"
                                    >
                                        <Trash2 size={16} />
                                        {cancellingInvitationId ===
                                            invitation.id
                                            ? 'Cancelling...'
                                            : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default InvitationsPanel
