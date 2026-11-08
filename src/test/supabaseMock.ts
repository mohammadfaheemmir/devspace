import { vi } from 'vitest'

type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

// A fake Supabase query builder. Every chain method returns the same
// object, and awaiting it (or calling single/maybeSingle) resolves to
// `result`, e.g. { data: [...], error: null }. The vi.fn() methods let
// tests assert which filters and values were used.
//
// Deliberately typed as `any`: it stands in for Supabase's deeply generic
// query builder, and modelling those types in a test fake adds nothing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createQuery(result: QueryResult = { data: null, error: null }): any {
    const query: Record<string, unknown> = {}

    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
        query[method] = vi.fn(() => query)
    }

    query.single = vi.fn(() => Promise.resolve(result))
    query.maybeSingle = vi.fn(() => Promise.resolve(result))
    query.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject)

    return query
}
