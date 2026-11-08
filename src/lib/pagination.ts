// Supabase (PostgREST) returns at most 1,000 rows per request by default, and
// silently drops the rest. Fetch large result sets page by page instead.

export const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

// Calls `fetchPage(from, to)` (inclusive row range, as in Supabase's
// `.range()`) until a page comes back short, and returns every row.
export async function fetchAllRows<T>(
    fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
    pageSize = PAGE_SIZE
): Promise<T[]> {
    const rows: T[] = []

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await fetchPage(from, from + pageSize - 1)

        if (error) throw new Error(error.message)

        const page = data ?? []
        rows.push(...page)

        if (page.length < pageSize) return rows
    }
}
