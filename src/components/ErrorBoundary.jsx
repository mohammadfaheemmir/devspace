import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { reportError } from '../lib/monitoring'

// Catches crashes while rendering, so the user sees a message with a reload
// button instead of a blank page, and reports the crash to error monitoring.
class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        console.error('App crashed:', error)
        reportError(error, { componentStack: info?.componentStack })
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        return (
            <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
                <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
                    <AlertTriangle size={36} className="mx-auto text-amber-400" />
                    <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        An unexpected error occurred. Reloading the page usually fixes it.
                        If it keeps happening, please let us know.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-indigo-500"
                    >
                        <RefreshCw size={16} />
                        Reload page
                    </button>
                </div>
            </div>
        )
    }
}

export default ErrorBoundary
