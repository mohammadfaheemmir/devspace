import { describe, expect, it } from 'vitest'
import { displayStatus } from './invitationUtils'

describe('displayStatus', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    const future = new Date(Date.now() + 86_400_000).toISOString()

    it('shows pending invitations past their expiry as expired', () => {
        expect(displayStatus({ status: 'pending', expires_at: past })).toBe('expired')
    })

    it('keeps the stored status otherwise', () => {
        expect(displayStatus({ status: 'pending', expires_at: future })).toBe('pending')
        expect(displayStatus({ status: 'accepted', expires_at: past })).toBe('accepted')
        expect(displayStatus({ status: 'pending', expires_at: null })).toBe('pending')
    })
})
