import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput.jsx'
import { supabase } from '../lib/supabase.js'
import { isValidEmail } from '../lib/validation.js'
import '../styles/auth.css'

function Signin() {
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLock.current) {
      return
    }

    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }
    if (!isValidEmail(email.trim())) {
      setError('Enter a valid email address.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })

      if (signInError) {
        throw signInError
      }
      if (!data.session) {
        throw new Error('Sign in did not create an active session. Please try again.')
      }

      navigate('/dashboard', { replace: true })
    } catch (signInError) {
      setError(signInError.message || 'Unable to sign in. Please try again.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="signin-title" className="auth-card">
      <p className="eyebrow">WELCOME BACK</p>
      <h1 id="signin-title">Sign in to MagPET</h1>
      <p className="auth-card__intro">
        Use your account email and password to continue.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="signin-email">Email Address</label>
          <input
            autoComplete="email"
            id="signin-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>
        <PasswordInput
          autoComplete="current-password"
          id="signin-password"
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          value={password}
        />
        <div className="forgot-row">
          <Link className="text-link" to="/forgot-password">
            Forgot Password?
          </Link>
        </div>
        {error && (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--primary auth-submit"
          disabled={submitting}
          type="submit"
        >
          {submitting ? (
            <>
              <span className="loading-spinner loading-spinner--small" />
              Signing in…
            </>
          ) : (
            <>
              Sign In <ArrowRight aria-hidden="true" size={17} />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        Don’t have an account? <Link to="/signup">Sign Up</Link>
      </p>
    </section>
  )
}

export default Signin
