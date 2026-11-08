import { useEffect, useRef, type RefObject } from 'react'

// Call onClose when the user presses Escape or clicks outside `ref`.
// Used for dropdowns (click outside the menu) and modals (click on the
// backdrop, i.e. outside the dialog box).
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
            if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
                onCloseRef.current()
            }
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
