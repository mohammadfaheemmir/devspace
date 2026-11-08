import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAuth, makeUser } from '../test/fixtures'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../context/useAuth', () => ({ useAuth: vi.fn() }))

const { useAuth } = await import('../context/useAuth')
const { default: ProtectedRoute } = await import('./ProtectedRoute')
const { default: PublicOnlyRoute } = await import('./PublicOnlyRoute')

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<PublicOnlyRoute />}>
                    <Route path="/login" element={<p>Login page</p>} />
                </Route>
                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<p>Dashboard page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('ProtectedRoute', () => {
    it('shows the page to signed-in users', () => {
        vi.mocked(useAuth).mockReturnValue(makeAuth({ user: makeUser('u1') }))
        renderAt('/dashboard')

        expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    })

    it('sends signed-out visitors to the login page', () => {
        vi.mocked(useAuth).mockReturnValue(makeAuth())
        renderAt('/dashboard')

        expect(screen.getByText('Login page')).toBeInTheDocument()
    })

    it('waits while the session is loading', () => {
        vi.mocked(useAuth).mockReturnValue(makeAuth({ loading: true }))
        renderAt('/dashboard')

        expect(screen.getByText('Loading your workspace...')).toBeInTheDocument()
        expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    })
})

describe('PublicOnlyRoute', () => {
    it('shows the login page to signed-out visitors', () => {
        vi.mocked(useAuth).mockReturnValue(makeAuth())
        renderAt('/login')

        expect(screen.getByText('Login page')).toBeInTheDocument()
    })

    it('sends signed-in users to the dashboard', () => {
        vi.mocked(useAuth).mockReturnValue(makeAuth({ user: makeUser('u1') }))
        renderAt('/login')

        expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    })
})
