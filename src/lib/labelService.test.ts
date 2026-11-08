import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuery } from '../test/supabaseMock'
import { makeUser } from '../test/fixtures'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const {
    createLabel,
    deleteLabel,
    groupLabelIdsByTask,
    setTaskLabels,
} = await import('./labelService')

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
})

describe('createLabel', () => {
    it('trims the name and inserts it with its colour', async () => {
        const query = createQuery({ data: { id: 'l1', name: 'Bug', color: 'red' }, error: null })
        vi.mocked(supabase.from).mockReturnValue(query)

        await createLabel('p1', '  Bug ', 'red')

        expect(supabase.from).toHaveBeenCalledWith('project_labels')
        expect(query.insert).toHaveBeenCalledWith({ project_id: 'p1', name: 'Bug', color: 'red' })
    })

    it('rejects empty names, long names and unknown colours without calling the database', async () => {
        await expect(createLabel('p1', '   ', 'red')).rejects.toThrow('Label name is required.')
        await expect(createLabel('p1', 'x'.repeat(31), 'red')).rejects.toThrow(/at most 30/)
        await expect(createLabel('p1', 'Bug', 'black')).rejects.toThrow('Please choose a label colour.')
        expect(supabase.from).not.toHaveBeenCalled()
    })

    it('explains duplicate names', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: null, error: { code: '23505', message: 'duplicate key' } }))

        await expect(createLabel('p1', 'Bug', 'red')).rejects.toThrow('A label called "Bug" already exists in this project.')
    })
})

describe('deleteLabel', () => {
    it('reports when Row Level Security blocks the delete', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: [], error: null }))

        await expect(deleteLabel('l1')).rejects.toThrow(/may not have permission/)
    })
})

describe('groupLabelIdsByTask', () => {
    it('groups label IDs per task', () => {
        expect(groupLabelIdsByTask([
            { task_id: 't1', label_id: 'a' },
            { task_id: 't2', label_id: 'b' },
            { task_id: 't1', label_id: 'c' },
        ])).toEqual({ t1: ['a', 'c'], t2: ['b'] })
    })
})

describe('setTaskLabels', () => {
    it('only adds new labels and removes dropped ones', async () => {
        const insertQuery = createQuery({ data: null, error: null })
        const deleteQuery = createQuery({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValueOnce(insertQuery).mockReturnValueOnce(deleteQuery)

        const result = await setTaskLabels('t1', 'p1', ['keep', 'drop'], ['keep', 'add'])

        expect(result).toEqual(['keep', 'add'])
        expect(insertQuery.insert).toHaveBeenCalledWith([{ task_id: 't1', label_id: 'add', project_id: 'p1' }])
        expect(deleteQuery.delete).toHaveBeenCalled()
        expect(deleteQuery.eq).toHaveBeenCalledWith('task_id', 't1')
        expect(deleteQuery.in).toHaveBeenCalledWith('label_id', ['drop'])
    })

    it('makes no database calls when nothing changed', async () => {
        await setTaskLabels('t1', 'p1', ['a', 'b'], ['b', 'a'])

        expect(supabase.from).not.toHaveBeenCalled()
    })
})
