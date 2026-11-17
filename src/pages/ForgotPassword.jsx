import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark.jsx'
import { supabase } from '../lib/supabase.js'
import { isValidEmail } from '../lib/validation.js'
import { getRecoveryRequestErrorMessage, saveRecoveryState } from '../lib/recovery.js'
import '../styles/auth.css'

function ForgotPassword() {
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitLock.current) return

    const trimmedEmail = email.trim()

    setError('')

    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    submitLock.current = true
    setSubmitting(true)

    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail.toLowerCase(),
        {
          redirectTo: `${window.location.origin}/verify-otp`,
        },
      )

      if (requestError) {
        console.error('[MagPET recovery] OTP request failed', {
          code: requestError.code,
          status: requestError.status,
          message: requestError.message,
        })
        throw requestError
      }

      saveRecoveryState(trimmedEmail.toLowerCase(), { verified: false })
      navigate('/verify-otp', {
        replace: true,
        state: {
          email: trimmedEmail.toLowerCase(),
          message: 'If an account exists with this email address, a verification code will be sent.',
        },
      })
    } catch (resetError) {
      if (!resetError.code) {
        console.error('[MagPET recovery] OTP request failed before an Auth response', {
          name: resetError.name,
          message: resetError.message,
        })
      }
      setError(getRecoveryRequestErrorMessage(resetError))
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="forgot-title" className="auth-card">
      <div className="auth-logo-wrap">
        <BrandMark className="brand-mark--center" />
      </div>
      <p className="eyebrow">ACCOUNT SUPPORT</p>
      <h1 id="forgot-title">Forgot Your Password?</h1>
      <p className="auth-card__intro">
        Enter your email address. If an account exists with this email address, a verification
        code will be sent.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="forgot-email">Email Address</label>
          <input
            autoComplete="email"
            id="forgot-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
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
              Sending code…
            </>
          ) : (
            <>
              Send OTP <ArrowRight aria-hidden="true" size={17} />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        <Link to="/signin">Back to Sign In</Link>
      </p>
    </section>
  )
}

export default ForgotPassword
