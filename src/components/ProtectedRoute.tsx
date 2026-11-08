
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function ProtectedRoute() {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                Loading your workspace...
            </div>
        )
    }

    return user ? <Outlet /> : <Navigate to="/login" replace />
}

export default ProtectedRoute
