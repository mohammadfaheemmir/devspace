import { useEffect } from 'react'

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

// Keyboard focus handling for a modal dialog:
// - on open, focus moves into the dialog (first form field, else the first
//   focusable element);
// - Tab / Shift+Tab stay inside the dialog;
// - on close, focus returns to whatever was focused before (usually the
//   button that opened it).
export function useDialogFocus(ref, isOpen) {
    useEffect(() => {
        if (!isOpen || !ref.current) return

        const dialog = ref.current
        const previouslyFocused = document.activeElement

        const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)]
        const firstField = dialog.querySelector('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])')
        ;(firstField || focusables()[0] || dialog).focus()

        function handleKeyDown(event) {
            if (event.key !== 'Tab') return

            const items = focusables()
            if (items.length === 0) {
                event.preventDefault()
                return
            }

            const first = items[0]
            const last = items[items.length - 1]

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            } else if (!dialog.contains(document.activeElement)) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)

            if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
                previouslyFocused.focus()
            }
        }
    }, [ref, isOpen])
}
