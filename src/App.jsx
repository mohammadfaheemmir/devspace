
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'

import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ProjectDetails from './pages/ProjectDetails'
import ProfileSettings from './pages/ProfileSettings'

import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'

// Remount the project page when the project ID changes, so no state
// from one project carries over into another.
function ProjectDetailsRoute() {
  const { projectId } = useParams()
  return <ProjectDetails key={projectId} />
}

function App() {
  return (
    <BrowserRouter>
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

          <Route
            path="/projects/:projectId"
            element={<ProjectDetailsRoute />}
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
