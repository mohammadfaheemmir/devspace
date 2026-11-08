import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('getCurrentUser', () => {
    it('returns the user from the stored session', async () => {
        supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
        })

        await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1' })
    })

    it('asks the user to log in when there is no session', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

        await expect(getCurrentUser()).rejects.toThrow('Please log in to continue.')
    })

    it('reports authentication errors', async () => {
        supabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: { message: 'token expired' },
        })

        await expect(getCurrentUser()).rejects.toThrow('Authentication error: token expired')
    })
})
