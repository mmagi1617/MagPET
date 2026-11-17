import { useLayoutEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute.jsx'
import AuthLayout from './layouts/AuthLayout.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Expenses from './pages/Expenses.jsx'
import Categories from './pages/Categories.jsx'
import Savings from './pages/Savings.jsx'
import Reports from './pages/Reports.jsx'
import Budgets from './pages/Budgets.jsx'
import Profile from './pages/Profile.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import HomePage from './pages/HomePage.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Signin from './pages/Signin.jsx'
import Signup from './pages/Signup.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'

function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">PAGE NOT FOUND</p>
      <h1>That page isn’t here.</h1>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </main>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function App() {
  return (
    <>
      <ScrollToTop />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route element={<HomePage />} path="/" />
      </Route>
      <Route element={<AuthLayout />}>
        <Route element={<GuestRoute />}>
          <Route element={<Signup />} path="/signup" />
          <Route element={<Signin />} path="/signin" />
          <Route element={<ForgotPassword />} path="/forgot-password" />
          <Route element={<VerifyOtp />} path="/verify-otp" />
        </Route>
        <Route element={<ResetPassword />} path="/reset-password" />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<Dashboard />} path="/dashboard" />
          <Route element={<Expenses />} path="/expenses" />
          <Route element={<Categories />} path="/categories" />
          <Route element={<Savings />} path="/savings" />
          <Route element={<Reports />} path="/reports" />
          <Route element={<Budgets />} path="/budgets" />
          <Route element={<Profile />} path="/profile" />
        </Route>
      </Route>
      <Route element={<NotFound />} path="*" />
    </Routes>
    </>
  )
}

export default App
