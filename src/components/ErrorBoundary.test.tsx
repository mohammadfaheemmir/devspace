import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('../lib/monitoring', () => ({ reportError: vi.fn() }))

const { reportError } = await import('../lib/monitoring')
const { default: ErrorBoundary } = await import('./ErrorBoundary')

function Broken(): ReactNode {
    throw new Error('Boom')
}

beforeEach(() => {
    vi.clearAllMocks()
    // React logs caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ErrorBoundary', () => {
    it('renders its children when nothing goes wrong', () => {
        render(<ErrorBoundary><p>All good</p></ErrorBoundary>)

        expect(screen.getByText('All good')).toBeInTheDocument()
    })

    it('shows a recovery screen instead of a blank page when a child crashes', () => {
        render(<ErrorBoundary><Broken /></ErrorBoundary>)

        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
        expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    })

    it('reports the crash to error monitoring', () => {
        render(<ErrorBoundary><Broken /></ErrorBoundary>)

        expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Boom' }),
            expect.objectContaining({ componentStack: expect.any(String) })
        )
    })
})
