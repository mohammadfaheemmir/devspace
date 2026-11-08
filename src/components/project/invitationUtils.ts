import type { ProjectInvitation } from '../../lib/invitationService'

// An invitation past its expiry date can still be stored as 'pending' (it is
// only marked expired when someone acts on it), so show it as expired.
export function displayStatus(invitation: Pick<ProjectInvitation, 'status' | 'expires_at'>): string {
    if (invitation.status === 'pending' && invitation.expires_at && new Date(invitation.expires_at) <= new Date()) {
        return 'expired'
    }
    return invitation.status
}
