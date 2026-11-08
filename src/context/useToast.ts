import { createContext, useContext } from 'react'

export type ToastApi = {
    success: (message: string) => void
    error: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

// Show short pop-up notices: toast.success('Saved'), toast.error('Failed').
export function useToast(): ToastApi {
    const context = useContext(ToastContext)

    if (!context) {
        throw new Error('useToast must be used inside <ToastProvider>.')
    }

    return context
}
