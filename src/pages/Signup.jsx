import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput.jsx'
import { useAuth } from '../context/useAuth.js'
import { supabase } from '../lib/supabase.js'
import { isValidEmail, isValidUsername, normalizeUsername } from '../lib/validation.js'
import '../styles/auth.css'

function isUsernameUniqueViolation(error) {
  const errorText = [
    error?.message,
    error?.details,
    error?.hint,
    error?.constraint,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    errorText.includes('profiles_username_ci_unique_idx') ||
    errorText.includes('username is already taken') ||
    (error?.code === '23505' && errorText.includes('username'))
  )
}

function Signup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const submitLock = useRef(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLock.current) {
      return
    }

    setError('')
    setSuccess('')

    const trimmedFullName = fullName.trim()
    const trimmedUsername = normalizeUsername(username)
    const trimmedEmail = email.trim()

    if (!trimmedFullName || !trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setError('Please complete every field.')
      return
    }

    if (!isValidUsername(trimmedUsername)) {
      setError('Username must be 3-20 characters long and use letters, numbers, or underscores only.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    submitLock.current = true
    setSubmitting(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail.toLowerCase(),
        password,
        options: {
          data: {
            full_name: trimmedFullName,
            username: trimmedUsername,
          },
        },
      })

      if (signUpError) {
        if (isUsernameUniqueViolation(signUpError)) {
          throw new Error('This username is already taken. Please choose another username.')
        }

        throw signUpError
      }

      if (data.user?.identities?.length === 0) {
        setSuccess(
          'If this address can be registered, you’ll receive an email with the next steps.',
        )
      } else if (data.session || user) {
        navigate('/dashboard', { replace: true })
      } else {
        setSuccess(
          `Account request received. Check ${trimmedEmail} for a verification email before signing in.`,
        )
      }
    } catch (signUpError) {
      const message = signUpError.message || 'We could not create your account. Please try again.'
      setError(message)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="signup-title" className="auth-card">
      <p className="eyebrow">YOUR MONEY, YOUR WAY</p>
      <h1 id="signup-title">Create your account</h1>
      <p className="auth-card__intro">
        Start with a secure MagPET account. Your expense tools are coming soon.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="full-name">Full Name</label>
          <input
            autoComplete="name"
            id="full-name"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
            value={fullName}
          />
        </div>
        <div className="form-field">
          <label htmlFor="username">Username</label>
          <input
            autoComplete="username"
            id="username"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            required
            value={username}
          />
        </div>
        <div className="form-field">
          <label htmlFor="signup-email">Email Address</label>
          <input
            autoComplete="email"
            id="signup-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>
        <PasswordInput
          autoComplete="new-password"
          id="signup-password"
          label="Password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          value={password}
        />
        <PasswordInput
          autoComplete="new-password"
          id="confirm-password"
          label="Confirm Password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Enter your password again"
          value={confirmPassword}
        />
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
              Creating account…
            </>
          ) : (
            <>
              Create Account <ArrowRight aria-hidden="true" size={17} />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/signin">Sign In</Link>
      </p>
    </section>
  )
}

export default Signup
