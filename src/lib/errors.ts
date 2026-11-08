// `catch (err)` can receive anything (not only Error objects), so read the
// message safely and fall back to a friendly default.
export function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message
    return fallback
}
