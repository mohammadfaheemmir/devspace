import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuery } from '../test/supabaseMock'
import { makeUser, rpcResult } from '../test/fixtures'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const { getProjectSummaries } = await import('./projectService')

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser('me'))
})

describe('getProjectSummaries', () => {
    it('combines the user role with task counts computed in the database', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: [{ project_id: 'p1', role: 'owner' }, { project_id: 'p2', role: 'member' }], error: null }))
        vi.mocked(supabase.rpc).mockResolvedValue(rpcResult({ data: [{ project_id: 'p1', total: 1500, done: 1200, in_progress: 100 }], error: null }))

        const summaries = await getProjectSummaries(['p1', 'p2'])

        // Counts above 1,000 come straight from the database, not from rows.
        expect(summaries.p1).toEqual({ role: 'owner', total: 1500, done: 1200, inProgress: 100 })
        expect(summaries.p2).toEqual({ role: 'member', total: 0, done: 0, inProgress: 0 })
        expect(supabase.rpc).toHaveBeenCalledWith('get_project_task_counts', { p_project_ids: ['p1', 'p2'] })
    })

    it('returns nothing for no projects without calling the database', async () => {
        await expect(getProjectSummaries([])).resolves.toEqual({})
        expect(supabase.rpc).not.toHaveBeenCalled()
    })
})
