import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuery } from '../test/supabaseMock'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const { deleteTaskComment, updateTaskComment } = await import('./commentService')

beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'user-1' })
})

describe('updateTaskComment', () => {
    it('updates only the trimmed content of the comment', async () => {
        const query = createQuery({ data: { id: 'c1', content: 'Fixed typo' }, error: null })
        supabase.from.mockReturnValue(query)

        await expect(updateTaskComment('c1', '  Fixed typo  ')).resolves.toEqual({ id: 'c1', content: 'Fixed typo' })
        expect(supabase.from).toHaveBeenCalledWith('comments')
        expect(query.update).toHaveBeenCalledWith({ content: 'Fixed typo' })
        expect(query.eq).toHaveBeenCalledWith('id', 'c1')
    })

    it('rejects empty comments without calling the database', async () => {
        await expect(updateTaskComment('c1', '   ')).rejects.toThrow('Comment cannot be empty.')
        expect(supabase.from).not.toHaveBeenCalled()
    })

    it('explains when Row Level Security blocks the edit', async () => {
        supabase.from.mockReturnValue(createQuery({ data: null, error: null }))

        await expect(updateTaskComment('c1', 'Hi')).rejects.toThrow(/may not have permission/)
    })
})

describe('deleteTaskComment', () => {
    it('deletes the comment by ID', async () => {
        const query = createQuery({ data: [{ id: 'c1' }], error: null })
        supabase.from.mockReturnValue(query)

        await expect(deleteTaskComment('c1')).resolves.toBe(true)
        expect(query.delete).toHaveBeenCalled()
        expect(query.eq).toHaveBeenCalledWith('id', 'c1')
    })

    it('reports a blocked delete instead of pretending it worked', async () => {
        supabase.from.mockReturnValue(createQuery({ data: [], error: null }))

        await expect(deleteTaskComment('c1')).rejects.toThrow(/may not have permission/)
    })
})
