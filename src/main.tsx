import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { initMonitoring } from './lib/monitoring'
import './index.css'

// Starts Sentry only if VITE_SENTRY_DSN is configured.
initMonitoring()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
