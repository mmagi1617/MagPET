import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark.jsx'
import { supabase } from '../lib/supabase.js'
import {
  getRecoveryRequestErrorMessage,
  maskEmail,
  readRecoveryState,
  saveRecoveryState,
} from '../lib/recovery.js'
import '../styles/auth.css'

const OTP_LENGTH = 6

function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const submitLock = useRef(false)
  const resendLock = useRef(false)
  const emailFromRoute = location.state?.email || readRecoveryState()?.email || ''
  const [email] = useState(emailFromRoute)
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef([])

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true })
      return
    }

    saveRecoveryState(email, { verified: false })
  }, [email, navigate])

  useEffect(() => {
    if (countdown <= 0) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  function updateOtpAtIndex(index, value) {
    const cleanedValue = value.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = cleanedValue
    setOtp(nextOtp)

    if (cleanedValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleInputChange(index, event) {
    updateOtpAtIndex(index, event.target.value)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    const pasteText = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, OTP_LENGTH)

    if (!pasteText) {
      return
    }

    const nextOtp = Array(OTP_LENGTH).fill('')

    for (let index = 0; index < pasteText.length; index += 1) {
      nextOtp[index] = pasteText[index]
    }

    setOtp(nextOtp)

    const nextIndex = Math.min(pasteText.length, OTP_LENGTH - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLock.current) return
    const code = otp.join('')

    setError('')
    setSuccess('')

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code.')
      return
    }

    submitLock.current = true
    setSubmitting(true)

    try {
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      })

      if (otpError) {
        console.error('[MagPET recovery] OTP verification failed', {
          code: otpError.code,
          message: otpError.message,
        })
        throw otpError
      }

      if (!data.session) {
        throw new Error('The recovery code could not be validated. Please try again.')
      }

      if (data.session.user?.email?.toLowerCase() !== email.toLowerCase()) {
        throw new Error('The recovery session does not match this email. Request a new code.')
      }

      saveRecoveryState(email, { verified: true })
      setSuccess('Code verified. Redirecting to create a new password…')

      window.setTimeout(() => {
        navigate('/reset-password', { replace: true })
      }, 900)
    } catch (otpError) {
      const errorText = otpError.message || ''
      const message = /expired|invalid|otp|token/i.test(errorText)
        ? 'That verification code is invalid or has expired. Request a new code and try again.'
        : errorText || 'We could not verify your recovery code. Please try again.'
      setError(message)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (countdown > 0 || resendLock.current) {
      return
    }

    setError('')
    setSuccess('')
    resendLock.current = true
    setResending(true)

    try {
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/verify-otp`,
      })

      if (resendError) {
        console.error('[MagPET recovery] OTP resend failed', {
          code: resendError.code,
          status: resendError.status,
          message: resendError.message,
        })
        throw resendError
      }

      setOtp(Array(OTP_LENGTH).fill(''))
      setCountdown(60)
      setSuccess('If an account exists with this email address, a new verification code will be sent.')
      inputRefs.current[0]?.focus()
    } catch (otpError) {
      if (!otpError.code) {
        console.error('[MagPET recovery] OTP resend failed before an Auth response', {
          name: otpError.name,
          message: otpError.message,
        })
      }
      setError(getRecoveryRequestErrorMessage(otpError))
    } finally {
      resendLock.current = false
      setResending(false)
    }
  }

  return (
    <section aria-labelledby="verify-title" className="auth-card">
      <div className="auth-logo-wrap">
        <BrandMark className="brand-mark--center" />
      </div>
      <p className="eyebrow">SECURITY CHECK</p>
      <h1 id="verify-title">Verify Your Email</h1>
      <p className="auth-card__intro">
        Enter the verification code sent to your registered email address.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="account-email-box">{maskEmail(email)}</div>

        <div className="otp-input-group" aria-label="One-time password input">
          {otp.map((digit, index) => (
            <input
              // eslint-disable-next-line react/no-array-index-key
              key={`otp-${index}`}
              ref={(node) => {
                inputRefs.current[index] = node
              }}
              aria-label={`Digit ${index + 1}`}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={1}
              onChange={(event) => handleInputChange(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              pattern="[0-9]*"
              value={digit}
            />
          ))}
        </div>

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
              Verifying…
            </>
          ) : (
            <>
              Verify OTP <ArrowRight aria-hidden="true" size={17} />
            </>
          )}
        </button>

        <button
          className="button button--outline auth-submit"
          disabled={countdown > 0 || resending}
          onClick={handleResend}
          type="button"
        >
          {resending ? (
            <>
              <span className="loading-spinner loading-spinner--small" />
              Sending…
            </>
          ) : countdown > 0 ? (
            `Resend OTP (${countdown}s)`
          ) : (
            <>
              <RotateCcw aria-hidden="true" size={16} />
              Resend OTP
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        <Link to="/forgot-password">Back</Link>
      </p>
    </section>
  )
}

export default VerifyOtp
