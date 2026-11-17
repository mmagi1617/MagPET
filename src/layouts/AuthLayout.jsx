import { Link, Outlet } from 'react-router-dom'
import BrandMark from '../components/BrandMark.jsx'

function AuthLayout() {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <BrandMark />
        <Link className="back-home-link" to="/">
          Back to home
        </Link>
      </header>
      <main className="auth-main">
        <Outlet />
      </main>
      <footer className="auth-footer">
        Secure sign-in powered by Supabase
      </footer>
    </div>
  )
}

export default AuthLayout
