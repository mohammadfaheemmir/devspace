import { afterEach, describe, expect, it, vi } from 'vitest'

// The DSN is read when the module loads, so each test imports a fresh copy.
async function loadMonitoring(dsn: string) {
    vi.resetModules()
    vi.stubEnv('VITE_SENTRY_DSN', dsn)

    const sentry = { init: vi.fn(), captureException: vi.fn(), setUser: vi.fn() }
    vi.doMock('./sentryClient', () => sentry)

    const monitoring = await import('./monitoring')
    return { monitoring, sentry }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('./sentryClient')
})

describe('monitoring without a DSN', () => {
    it('stays off and never loads Sentry', async () => {
        const { monitoring, sentry } = await loadMonitoring('')

        monitoring.initMonitoring()
        monitoring.reportError(new Error('x'))
        monitoring.setMonitoringUser('u1')
        await flush()

        expect(monitoring.isMonitoringEnabled()).toBe(false)
        expect(sentry.init).not.toHaveBeenCalled()
        expect(sentry.captureException).not.toHaveBeenCalled()
    })
})

describe('monitoring with a DSN', () => {
    const DSN = 'https://public@o1.ingest.sentry.io/1'

    it('initialises Sentry without personal data or tracing', async () => {
        const { monitoring, sentry } = await loadMonitoring(DSN)

        monitoring.initMonitoring()
        await flush()

        expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
            dsn: DSN,
            tracesSampleRate: 0,
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpHeaders: false,
                httpBodies: [],
                urlQueryParams: false,
                databaseQueryData: false,
                stackFrameVariables: false,
            },
        }))
        // The old option name is ignored by Sentry 11 and must not be relied on.
        expect(vi.mocked(sentry.init).mock.calls[0]?.[0]).not.toHaveProperty('sendDefaultPii')
    })

    it('reports errors and tags the user by ID only', async () => {
        const { monitoring, sentry } = await loadMonitoring(DSN)
        const error = new Error('Boom')

        monitoring.initMonitoring()
        monitoring.reportError(error, { where: 'test' })
        monitoring.setMonitoringUser('user-1')
        monitoring.setMonitoringUser(null)
        await flush()

        expect(sentry.captureException).toHaveBeenCalledWith(error, { extra: { where: 'test' } })
        expect(sentry.setUser).toHaveBeenNthCalledWith(1, { id: 'user-1' })
        expect(sentry.setUser).toHaveBeenNthCalledWith(2, null)
    })
})
