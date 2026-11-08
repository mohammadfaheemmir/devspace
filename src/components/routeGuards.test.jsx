import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../context/useAuth', () => ({ useAuth: vi.fn() }))

const { useAuth } = await import('../context/useAuth')
const { default: ProtectedRoute } = await import('./ProtectedRoute')
const { default: PublicOnlyRoute } = await import('./PublicOnlyRoute')

function renderAt(path) {
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
        useAuth.mockReturnValue({ user: { id: 'u1' }, loading: false })
        renderAt('/dashboard')

        expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    })

    it('sends signed-out visitors to the login page', () => {
        useAuth.mockReturnValue({ user: null, loading: false })
        renderAt('/dashboard')

        expect(screen.getByText('Login page')).toBeInTheDocument()
    })

    it('waits while the session is loading', () => {
        useAuth.mockReturnValue({ user: null, loading: true })
        renderAt('/dashboard')

        expect(screen.getByText('Loading your workspace...')).toBeInTheDocument()
        expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    })
})

describe('PublicOnlyRoute', () => {
    it('shows the login page to signed-out visitors', () => {
        useAuth.mockReturnValue({ user: null, loading: false })
        renderAt('/login')

        expect(screen.getByText('Login page')).toBeInTheDocument()
    })

    it('sends signed-in users to the dashboard', () => {
        useAuth.mockReturnValue({ user: { id: 'u1' }, loading: false })
        renderAt('/login')

        expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    })
})
