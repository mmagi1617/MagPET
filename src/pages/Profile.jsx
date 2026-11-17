import { useEffect, useState } from 'react'
import { CalendarDays, KeyRound, Mail, UserRound } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput.jsx'
import { useAuth } from '../context/useAuth.js'
import { fetchOwnProfile, updateOwnPassword, updateOwnProfile } from '../lib/profile.js'
import '../styles/auth.css'
import '../styles/profile.css'

function formatAccountDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function Profile() {
  const { user } = useAuth()
  const { setProfileName = () => {} } = useOutletContext()
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchOwnProfile(user.id)
        if (!active) return
        setProfile(data)
        setFullName(data.full_name || '')
        setUsername(data.username || '')
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load your profile.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadProfile()
    return () => { active = false }
  }, [user.id])

  async function handleProfileSave(event) {
    event.preventDefault()
    if (savingProfile || !profile) return
    setSavingProfile(true)
    setProfileMessage('')
    setProfileError('')
    try {
      const updated = await updateOwnProfile(user.id, { fullName, username })
      setProfile(updated)
      setFullName(updated.full_name || '')
      setUsername(updated.username || '')
      setProfileName(updated.full_name || updated.username || '')
      setProfileMessage('Your profile has been updated.')
    } catch (error) {
      setProfileError(error.message || 'Unable to update your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    if (savingPassword) return
    setSavingPassword(true)
    setPasswordMessage('')
    setPasswordError('')
    try {
      await updateOwnPassword(newPassword, confirmPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Your password has been changed.')
    } catch (error) {
      setPasswordError(error.message || 'Unable to change your password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="app-shell profile-shell">
      <main className="expense-page profile-page">
        <section className="expense-page__intro profile-intro"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>Profile Management</h1><p>Manage your personal details and account security.</p></div></section>
        {loadError && <p className="form-message form-message--error expense-page__alert" role="alert">{loadError}</p>}
        {loading ? <div className="expense-panel profile-loading"><span className="loading-spinner" />Loading your profile…</div> : profile && <>
          <section aria-label="Account information" className="profile-account-card">
            <div className="profile-account-card__heading"><span className="profile-icon"><UserRound size={20} /></span><div><p className="eyebrow">YOUR ACCOUNT</p><h2>Account information</h2></div></div>
            <div className="profile-account-grid">
              <div><span>Full name</span><strong>{profile.full_name || 'Not set'}</strong></div>
              <div><span>Username</span><strong>@{profile.username}</strong></div>
              <div><span><Mail size={14} /> Email address</span><strong>{user.email || '—'}</strong></div>
              <div><span><CalendarDays size={14} /> Account created</span><strong>{formatAccountDate(profile.created_at || user.created_at)}</strong></div>
            </div>
          </section>

          <section aria-labelledby="edit-profile-title" className="expense-panel profile-panel">
            <div className="profile-panel__heading"><span className="profile-icon"><UserRound size={19} /></span><div><p className="eyebrow">PERSONAL DETAILS</p><h2 id="edit-profile-title">Edit profile</h2></div></div>
            <form className="profile-form" onSubmit={handleProfileSave}>
              <label><span>Full name</span><input autoComplete="name" maxLength={100} onChange={(event) => setFullName(event.target.value)} required value={fullName} /></label>
              <label><span>Username</span><input autoComplete="username" maxLength={20} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_]{3,20}" required value={username} /><small>3–20 letters, numbers, or underscores. Usernames are case-insensitively unique.</small></label>
              <label><span>Email address</span><input autoComplete="email" readOnly value={user.email || ''} /></label>
              {profileError && <p className="form-message form-message--error" role="alert">{profileError}</p>}
              {profileMessage && <p className="form-message form-message--success" role="status">{profileMessage}</p>}
              <button className="button button--primary" disabled={savingProfile} type="submit">{savingProfile ? 'Saving…' : 'Save profile'}</button>
            </form>
          </section>

          <section aria-labelledby="change-password-title" className="expense-panel profile-panel">
            <div className="profile-panel__heading"><span className="profile-icon profile-icon--security"><KeyRound size={19} /></span><div><p className="eyebrow">ACCOUNT SECURITY</p><h2 id="change-password-title">Change password</h2></div></div>
            <form className="profile-form profile-form--password" onSubmit={handlePasswordChange}>
              <PasswordInput autoComplete="new-password" id="profile-new-password" label="New password" minLength={8} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" value={newPassword} />
              <PasswordInput autoComplete="new-password" id="profile-confirm-password" label="Confirm new password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the password again" value={confirmPassword} />
              <p className="profile-password-note">Your password is managed by Supabase Authentication and is never stored in your profile.</p>
              {passwordError && <p className="form-message form-message--error" role="alert">{passwordError}</p>}
              {passwordMessage && <p className="form-message form-message--success" role="status">{passwordMessage}</p>}
              <button className="button button--primary" disabled={savingPassword} type="submit">{savingPassword ? 'Updating…' : 'Change password'}</button>
            </form>
          </section>
        </>}
      </main>
    </div>
  )
}

export default Profile
