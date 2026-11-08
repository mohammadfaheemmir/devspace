import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuery } from '../test/supabaseMock'
import { makeUser } from '../test/fixtures'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const { createTask, deleteTask, updateTask, updateTaskStatus } = await import('./taskService')

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
})

describe('createTask', () => {
    it('trims input, sets defaults and records the creator', async () => {
        const query = createQuery({ data: { id: 't1' }, error: null })
        vi.mocked(supabase.from).mockReturnValue(query)

        const result = await createTask('project-1', {
            title: '  Write tests  ',
            description: '   ',
            assignee_id: '',
            due_date: '',
        })

        expect(result).toEqual({ id: 't1' })
        expect(supabase.from).toHaveBeenCalledWith('tasks')
        expect(query.insert).toHaveBeenCalledWith({
            project_id: 'project-1',
            title: 'Write tests',
            description: null,
            status: 'todo',
            priority: 'medium',
            created_by: 'user-1',
            assignee_id: null,
            due_date: null,
        })
    })

    it('rejects a blank title without calling the database', async () => {
        await expect(createTask('project-1', { title: '   ' })).rejects.toThrow('Task title is required.')
        expect(supabase.from).not.toHaveBeenCalled()
    })

    it('rejects an unknown priority', async () => {
        await expect(createTask('project-1', { title: 'x', priority: 'urgent' })).rejects.toThrow('Invalid task priority.')
    })
})

describe('updateTaskStatus', () => {
    it('rejects statuses outside todo / in_progress / done', async () => {
        await expect(updateTaskStatus('t1', 'blocked')).rejects.toThrow('Invalid task ID or status.')
        expect(supabase.from).not.toHaveBeenCalled()
    })
})

describe('updateTask', () => {
    it('updates only the editable fields of the given task', async () => {
        const query = createQuery({ data: { id: 't1', title: 'New' }, error: null })
        vi.mocked(supabase.from).mockReturnValue(query)

        await updateTask('t1', {
            title: ' New ',
            description: 'Details',
            priority: 'high',
            assignee_id: 'user-2',
            due_date: '2026-12-01',
            // Fields that must never be sent from the edit form (sent on
            // purpose here, to check the service drops them):
            // @ts-expect-error -- not part of TaskInput
            created_by: 'someone-else',
            project_id: 'other-project',
        })

        expect(query.update).toHaveBeenCalledWith({
            title: 'New',
            description: 'Details',
            priority: 'high',
            assignee_id: 'user-2',
            due_date: '2026-12-01',
        })
        expect(query.eq).toHaveBeenCalledWith('id', 't1')
    })

    it('explains when Row Level Security blocks the update (no row returned)', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: null, error: null }))

        await expect(updateTask('t1', { title: 'New' })).rejects.toThrow(/may not have permission/)
    })

    it('passes database errors through', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: null, error: { message: 'boom' } }))

        await expect(updateTask('t1', { title: 'New' })).rejects.toThrow('boom')
    })
})

describe('deleteTask', () => {
    it('deletes the task by ID', async () => {
        const query = createQuery({ data: [{ id: 't1' }], error: null })
        vi.mocked(supabase.from).mockReturnValue(query)

        await expect(deleteTask('t1')).resolves.toBe(true)
        expect(query.delete).toHaveBeenCalled()
        expect(query.eq).toHaveBeenCalledWith('id', 't1')
    })

    it('explains when nothing was deleted', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: [], error: null }))

        await expect(deleteTask('t1')).rejects.toThrow(/may not have permission/)
    })
})
