import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeUser } from '../test/fixtures'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const { createProjectInvitation, declineProjectInvitation } = await import('./invitationService')

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
})

describe('declineProjectInvitation', () => {
    it('calls the decline_project_invitation database function', async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null })

        await expect(declineProjectInvitation('inv-1')).resolves.toBe(true)
        expect(supabase.rpc).toHaveBeenCalledWith('decline_project_invitation', { invitation_id: 'inv-1' })
    })

    it('passes database errors through', async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'This invitation is no longer pending.' } })

        await expect(declineProjectInvitation('inv-1')).rejects.toThrow('This invitation is no longer pending.')
    })

    it('requires an invitation ID', async () => {
        // @ts-expect-error -- the ID is left out on purpose
        await expect(declineProjectInvitation()).rejects.toThrow('Invitation ID is required.')
        expect(supabase.rpc).not.toHaveBeenCalled()
    })
})

describe('createProjectInvitation', () => {
    it('rejects invalid email addresses without calling the database', async () => {
        await expect(createProjectInvitation('p1', 'not-an-email')).rejects.toThrow('Please enter a valid email address.')
        expect(supabase.from).not.toHaveBeenCalled()
    })
})
