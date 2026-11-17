import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function SessionLoading() {
  return (
    <div aria-live="polite" className="route-status">
      <span className="loading-spinner" />
      <p>Checking your session…</p>
    </div>
  )
}

function ProtectedRoute() {
  const { authError, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <SessionLoading />
  }

  if (authError && !user) {
    return (
      <div className="route-status" role="alert">
        <p>MagPET couldn’t verify your session. Check your connection and try again.</p>
        <Link className="text-link" to="/signin">
          Go to Sign In
        </Link>
      </div>
    )
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/signin" />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { loading, user } = useAuth()

  if (loading) {
    return <SessionLoading />
  }

  if (user) {
    return <Navigate replace to="/dashboard" />
  }

  return <Outlet />
}

export default ProtectedRoute
