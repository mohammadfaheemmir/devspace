import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { ToastContext, type ToastApi } from './useToast'

type ToastType = 'success' | 'error'
type Toast = { id: number; type: ToastType; message: string }

const DURATION_MS: Record<ToastType, number> = { success: 4000, error: 6000 }
const MAX_TOASTS = 4

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const nextId = useRef(0)

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
    }, [])

    const show = useCallback((type: ToastType, message: string) => {
        if (!message) return

        const id = ++nextId.current

        setToasts((current) => [...current, { id, type, message }].slice(-MAX_TOASTS))
        setTimeout(() => dismiss(id), DURATION_MS[type])
    }, [dismiss])

    // Stable object so components can safely list it as a dependency.
    const api = useMemo<ToastApi>(() => ({
        success: (message) => show('success', message),
        error: (message) => show('error', message),
    }), [show])

    return (
        <ToastContext.Provider value={api}>
            {children}

            <div
                aria-live="polite"
                className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
            >
                {toasts.map((toast) => {
                    const isError = toast.type === 'error'
                    const Icon = isError ? AlertCircle : CheckCircle2

                    return (
                        <div
                            key={toast.id}
                            role={isError ? 'alert' : 'status'}
                            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-slate-900 p-4 text-sm shadow-2xl ${isError
                                ? 'border-red-500/40 text-red-200'
                                : 'border-green-500/40 text-green-200'
                                }`}
                        >
                            <Icon size={18} className={`mt-0.5 shrink-0 ${isError ? 'text-red-400' : 'text-green-400'}`} />
                            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
                            <button
                                type="button"
                                onClick={() => dismiss(toast.id)}
                                aria-label="Dismiss notification"
                                className="shrink-0 text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}
