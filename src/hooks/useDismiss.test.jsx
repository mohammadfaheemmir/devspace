import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useDismiss } from './useDismiss'

function Menu({ isOpen, onClose }) {
    const ref = useRef(null)
    useDismiss(ref, isOpen, onClose)

    return (
        <div>
            <div ref={ref}>
                <button type="button">Inside</button>
            </div>
            <button type="button">Outside</button>
        </div>
    )
}

describe('useDismiss', () => {
    it('closes on Escape', () => {
        const onClose = vi.fn()
        render(<Menu isOpen onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on a click outside, but not inside', () => {
        const onClose = vi.fn()
        render(<Menu isOpen onClose={onClose} />)

        fireEvent.mouseDown(screen.getByText('Inside'))
        expect(onClose).not.toHaveBeenCalled()

        fireEvent.mouseDown(screen.getByText('Outside'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('ignores other keys', () => {
        const onClose = vi.fn()
        render(<Menu isOpen onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Enter' })

        expect(onClose).not.toHaveBeenCalled()
    })

    it('does nothing while closed', () => {
        const onClose = vi.fn()
        render(<Menu isOpen={false} onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.mouseDown(screen.getByText('Outside'))

        expect(onClose).not.toHaveBeenCalled()
    })
})
