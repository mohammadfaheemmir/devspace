import { describe, expect, it, vi } from 'vitest'
import { fetchAllRows } from './pagination'

describe('fetchAllRows', () => {
    it('keeps fetching until a page comes back short', async () => {
        const all = Array.from({ length: 2500 }, (_, i) => i)
        const fetchPage = vi.fn(async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }))

        const rows = await fetchAllRows(fetchPage)

        expect(rows).toHaveLength(2500)
        expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    })

    it('makes one extra request when the total is an exact multiple of the page size', async () => {
        const all = Array.from({ length: 1000 }, (_, i) => i)
        const fetchPage = vi.fn(async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }))

        expect(await fetchAllRows(fetchPage)).toHaveLength(1000)
        expect(fetchPage).toHaveBeenCalledTimes(2)
    })

    it('throws database errors', async () => {
        await expect(fetchAllRows(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom')
    })
})
