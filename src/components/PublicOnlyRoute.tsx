import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

// Pages like Login and Signup are only for signed-out visitors.
// Signed-in users are sent straight to their dashboard.
function PublicOnlyRoute() {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                Loading...
            </div>
        )
    }

    return user ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export default PublicOnlyRoute
