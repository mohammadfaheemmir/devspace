import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from './ToastContext'
import { useToast } from './useToast'

function Buttons() {
    const toast = useToast()

    return (
        <>
            <button type="button" onClick={() => toast.success('Saved!')}>success</button>
            <button type="button" onClick={() => toast.error('It failed')}>error</button>
            <button type="button" onClick={() => toast.error('')}>empty</button>
        </>
    )
}

function renderWithToasts() {
    return render(
        <ToastProvider>
            <Buttons />
        </ToastProvider>
    )
}

describe('ToastProvider', () => {
    it('shows success toasts as status and error toasts as alerts', () => {
        renderWithToasts()

        fireEvent.click(screen.getByText('success'))
        fireEvent.click(screen.getByText('error'))

        expect(screen.getByRole('status')).toHaveTextContent('Saved!')
        expect(screen.getByRole('alert')).toHaveTextContent('It failed')
    })

    it('ignores empty messages', () => {
        renderWithToasts()

        fireEvent.click(screen.getByText('empty'))

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('hides success toasts after 4 seconds and errors after 6', () => {
        vi.useFakeTimers()
        renderWithToasts()

        fireEvent.click(screen.getByText('success'))
        fireEvent.click(screen.getByText('error'))

        act(() => vi.advanceTimersByTime(4000))
        expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
        expect(screen.getByText('It failed')).toBeInTheDocument()

        act(() => vi.advanceTimersByTime(2000))
        expect(screen.queryByText('It failed')).not.toBeInTheDocument()
    })

    it('can be dismissed by hand', () => {
        renderWithToasts()

        fireEvent.click(screen.getByText('success'))
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))

        expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
    })

    it('keeps at most four toasts on screen', () => {
        renderWithToasts()

        for (let i = 0; i < 6; i++) {
            fireEvent.click(screen.getByText('success'))
        }

        expect(screen.getAllByRole('status')).toHaveLength(4)
    })

    it('throws a helpful error when used outside the provider', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        expect(() => render(<Buttons />)).toThrow('useToast must be used inside <ToastProvider>.')
    })
})
