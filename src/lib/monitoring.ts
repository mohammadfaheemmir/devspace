// Error monitoring with Sentry.
//
// Switched off unless VITE_SENTRY_DSN is set. When it is off, the Sentry SDK
// is never downloaded, so it adds nothing to the page. When it is on, Sentry
// is loaded in the background and reports:
//   - uncaught errors and unhandled promise rejections (automatically),
//   - React render crashes (via ErrorBoundary -> reportError).
// No personal data is sent: no IP address, cookies or emails, only the
// signed-in user's ID so related errors can be grouped.

const dsn = import.meta.env.VITE_SENTRY_DSN

type SentryClient = typeof import('./sentryClient')

let sentryPromise: Promise<SentryClient | null> | null = null

export function isMonitoringEnabled(): boolean {
    return Boolean(dsn)
}

export function initMonitoring(): void {
    if (!dsn || sentryPromise) return

    sentryPromise = import('./sentryClient')
        .then((Sentry) => {
            Sentry.init({
                dsn,
                environment: import.meta.env.MODE,
                // Sentry 11 replaced `sendDefaultPii` with `dataCollection`, whose
                // defaults collect user info, cookies, headers, bodies and query
                // params. Turn all of it off; only the user ID set below is sent.
                dataCollection: {
                    userInfo: false, // includes inferring the IP address
                    cookies: false,
                    httpHeaders: false,
                    httpBodies: [],
                    urlQueryParams: false,
                    databaseQueryData: false,
                    stackFrameVariables: false,
                },
                // Errors only; no performance tracing (keeps within the free plan).
                tracesSampleRate: 0,
            })
            return Sentry
        })
        .catch((error) => {
            // Monitoring must never break the app.
            console.warn('Error monitoring could not start:', error)
            return null
        })
}

// Report an error that the app caught itself (e.g. in the error boundary).
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
    if (!sentryPromise) return

    sentryPromise.then((Sentry) => {
        Sentry?.captureException(error, { extra: context })
    })
}

// Attach the signed-in user's ID (never their email) to future reports.
export function setMonitoringUser(userId: string | null): void {
    if (!sentryPromise) return

    sentryPromise.then((Sentry) => {
        Sentry?.setUser(userId ? { id: userId } : null)
    })
}
