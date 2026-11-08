import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthError, Session } from '@supabase/supabase-js'
import { makeUser, partial } from '../test/fixtures'

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')

type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>

beforeEach(() => {
    vi.clearAllMocks()
})

describe('getCurrentUser', () => {
    it('returns the user from the stored session', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue(partial<SessionResult>({
            data: { session: partial<Session>({ user: makeUser() }) },
            error: null,
        }))

        await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1' })
    })

    it('asks the user to log in when there is no session', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue(partial<SessionResult>({ data: { session: null }, error: null }))

        await expect(getCurrentUser()).rejects.toThrow('Please log in to continue.')
    })

    it('reports authentication errors', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue(partial<SessionResult>({
            data: { session: null },
            error: partial<AuthError>({ message: 'token expired' }),
        }))

        await expect(getCurrentUser()).rejects.toThrow('Authentication error: token expired')
    })
})
