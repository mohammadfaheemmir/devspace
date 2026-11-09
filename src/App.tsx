
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'

import { lazy, Suspense } from 'react'

// Each page is loaded only when it is first visited, which keeps the
// initial download small.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'))
const Notifications = lazy(() => import('./pages/Notifications'))

import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'

// Remount the project page when the project ID changes, so no state
// from one project carries over into another.
function ProjectDetailsRoute() {
  const { projectId } = useParams()

  // The route pattern always includes an ID, but check rather than assume.
  if (!projectId) return <Navigate to="/dashboard" replace />

  return <ProjectDetails key={projectId} projectId={projectId} />
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-300">
      Loading...
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes (signed-out visitors only) */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/profile" element={<ProfileSettings />} />

            <Route path="/notifications" element={<Notifications />} />

            <Route
              path="/projects/:projectId"
              element={<ProjectDetailsRoute />}
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
