import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDialogFocus } from './useDialogFocus'

function Dialog({ onClose }) {
    const ref = useRef(null)
    useDialogFocus(ref, true)

    return (
        <div ref={ref} role="dialog" aria-label="Example">
            <button type="button" onClick={onClose}>Close</button>
            <input aria-label="Name" />
            <button type="button">Save</button>
        </div>
    )
}

function Page() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
            <button type="button">Behind the dialog</button>
            {open && <Dialog onClose={() => setOpen(false)} />}
        </>
    )
}

describe('useDialogFocus', () => {
    it('moves focus to the first form field when the dialog opens', async () => {
        const user = userEvent.setup()
        render(<Page />)

        await user.click(screen.getByRole('button', { name: 'Open dialog' }))

        expect(screen.getByLabelText('Name')).toHaveFocus()
    })

    it('keeps Tab and Shift+Tab inside the dialog', async () => {
        const user = userEvent.setup()
        render(<Page />)
        await user.click(screen.getByRole('button', { name: 'Open dialog' }))

        await user.tab() // Name -> Save
        expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()

        await user.tab() // Save -> wraps to Close (not "Behind the dialog")
        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

        await user.tab({ shift: true }) // Close -> wraps back to Save
        expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    })

    it('returns focus to the opening button when the dialog closes', async () => {
        const user = userEvent.setup()
        render(<Page />)
        const opener = screen.getByRole('button', { name: 'Open dialog' })

        await user.click(opener)
        await user.click(screen.getByRole('button', { name: 'Close' }))

        expect(opener).toHaveFocus()
    })
})
