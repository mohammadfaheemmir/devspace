import { vi } from 'vitest'

// A fake Supabase query builder. Every chain method returns the same
// object, and awaiting it (or calling single/maybeSingle) resolves to
// `result`, e.g. { data: [...], error: null }. The vi.fn() methods let
// tests assert which filters and values were used.
export function createQuery(result = { data: null, error: null }) {
    const query = {}

    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
        query[method] = vi.fn(() => query)
    }

    query.single = vi.fn(() => Promise.resolve(result))
    query.maybeSingle = vi.fn(() => Promise.resolve(result))
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)

    return query
}
