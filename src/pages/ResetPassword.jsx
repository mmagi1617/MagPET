import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { supabase } from '../lib/supabase.js'
import { clearRecoveryState, readRecoveryState } from '../lib/recovery.js'
import '../styles/auth.css'

function ResetPassword() {
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function verifyRecoveryAccess() {
      const recoveryState = readRecoveryState()
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (sessionError) {
        clearRecoveryState()
        navigate('/forgot-password', { replace: true })
        return
      }

      const activeSession = data.session
      let sessionEmail = activeSession?.user?.email?.toLowerCase() ?? ''
      let hasLiveUser = Boolean(activeSession)

      if (activeSession) {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (!isMounted) return
        if (userError) {
          console.error('[MagPET recovery] Recovery session check failed', {
            code: userError.code,
            message: userError.message,
          })
          hasLiveUser = false
        } else {
          sessionEmail = userData.user?.email?.toLowerCase() ?? ''
          hasLiveUser = Boolean(userData.user)
        }
      }

      const isVerified = Boolean(
        hasLiveUser && recoveryState?.verified && recoveryState.email && sessionEmail === recoveryState.email,
      )

      if (!isVerified) {
        clearRecoveryState()
        navigate('/forgot-password', { replace: true })
        return
      }

      setEmail(sessionEmail)
      setCheckingAccess(false)
    }

    verifyRecoveryAccess()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const strength = useMemo(() => {
    if (newPassword.length >= 12) {
      return { label: 'Strong', tone: 'strong' }
    }

    if (newPassword.length >= 8) {
      return { label: 'Good', tone: 'good' }
    }

    if (newPassword.length > 0) {
      return { label: 'Weak', tone: 'weak' }
    }

    return { label: '', tone: 'empty' }
  }, [newPassword])

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitLock.current) return

    setError('')
    setSuccess('')

    if (!newPassword || !confirmPassword) {
      setError('Please complete both password fields.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please try again.')
      return
    }

    submitLock.current = true
    setSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        console.error('[MagPET recovery] Password update failed', {
          code: updateError.code,
          message: updateError.message,
        })
        throw updateError
      }

      await supabase.auth.signOut()
      clearRecoveryState()
      setSuccess('Password updated successfully. Redirecting to sign in…')

      window.setTimeout(() => {
        navigate('/signin', { replace: true })
      }, 1500)
    } catch (updateError) {
      const errorText = updateError.message || ''
      const message = /session|token|expired|jwt/i.test(errorText)
        ? 'Your password recovery session has expired. Request a new verification code.'
        : errorText || 'We could not update your password. Please try again.'
      setError(message)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  if (checkingAccess) {
    return (
      <section aria-live="polite" className="auth-card route-status">
        <span className="loading-spinner" />
        <p>Verifying your recovery session…</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="reset-title" className="auth-card">
      <div className="auth-logo-wrap">
        <BrandMark className="brand-mark--center" />
      </div>
      <p className="eyebrow">SECURE ACCESS</p>
      <h1 id="reset-title">Create New Password</h1>
      <p className="auth-card__intro">
        Your email has been verified. Please create a new password for your MagPET account.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="account-email-box">{email}</div>

        <PasswordInput
          autoComplete="new-password"
          id="new-password"
          label="New Password"
          minLength={8}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Enter a new password"
          value={newPassword}
        />
        <PasswordInput
          autoComplete="new-password"
          id="confirm-new-password"
          label="Confirm New Password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm your new password"
          value={confirmPassword}
        />

        {newPassword && (
          <div className="password-strength" aria-live="polite">
            <span>Password strength:</span>
            <strong className={`password-strength--${strength.tone}`}>{strength.label}</strong>
          </div>
        )}

        {error && (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="form-message form-message--success" role="status">
            {success}
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
              Updating password…
            </>
          ) : (
            <>
              Update Password <ArrowRight aria-hidden="true" size={17} />
            </>
          )}
        </button>
      </form>
    </section>
  )
}

export default ResetPassword
