import { useEffect, useRef, type RefObject } from 'react'

// Call onClose when the user presses Escape or clicks outside `ref`.
// Used for dropdowns (click outside the menu) and modals (click on the
// backdrop, i.e. outside the dialog box).
//
// Clicks inside an element marked with data-dismiss-ignore (the toast
// notices) never count as "outside": dismissing a notice must not close an
// open dialog and lose its unsaved changes.
export function useDismiss(
    ref: RefObject<HTMLElement | null>,
    isOpen: boolean,
    onClose: () => void
): void {
    // Keep the latest callback without re-registering listeners each render.
    const onCloseRef = useRef(onClose)

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        if (!isOpen) return

        function handlePointerDown(event: MouseEvent | TouchEvent) {
            const target = event.target
            if (!ref.current || !(target instanceof Node)) return
            if (ref.current.contains(target)) return
            if (target instanceof Element && target.closest('[data-dismiss-ignore]')) return
            onCloseRef.current()
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCloseRef.current()
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [ref, isOpen])
}
