import { useState } from 'react'
import { BarChart3, ChartColumnIncreasing, ChevronLeft, ChevronRight, FolderTree, LogOut, Menu, PiggyBank, ReceiptText, UserRound, WalletCards, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { supabase } from '../lib/supabase.js'
import BrandMark from './BrandMark.jsx'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', Icon: BarChart3, end: true },
  { to: '/expenses', label: 'Expense Management', Icon: ReceiptText },
  { to: '/categories', label: 'Category Management', Icon: FolderTree },
  { to: '/savings', label: 'Savings Management', Icon: PiggyBank },
  { to: '/reports', label: 'Reports & Analytics', Icon: ChartColumnIncreasing },
  { to: '/budgets', label: 'Budgets', Icon: WalletCards },
]

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/expenses': 'Expense Management',
  '/categories': 'Category Management',
  '/savings': 'Savings Management',
  '/reports': 'Reports & Analytics',
  '/budgets': 'Budgets',
  '/profile': 'Profile Settings',
}

function AppHeader({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse, onToggleMobile, profileName }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const metadataName = user?.user_metadata?.full_name?.trim() || user?.user_metadata?.username?.trim()
  const displayName = profileName || metadataName || user?.email || 'Account'
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'A'

  async function handleSignOut() {
    if (signingOut) return
    setError('')
    setSigningOut(true)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      navigate('/signin', { replace: true })
    } catch (signOutError) {
      setError(signOutError.message || 'Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <aside aria-label="Main navigation" className={`app-sidebar${mobileOpen ? ' app-sidebar--open' : ''}`}>
        <div className="app-sidebar__brand">
          <Link aria-label="MagPET dashboard" className="app-sidebar__brand-link" onClick={onCloseMobile} to="/dashboard">
            <BrandMark to={null} /><span className="app-sidebar__wordmark">MagPET</span>
          </Link>
          <button aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} className="app-sidebar__mobile-close" onClick={onToggleMobile} type="button">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <p className="app-sidebar__caption">Workspace</p>
        <nav className="app-sidebar__nav">
          {navigation.map(({ to, label, Icon, end }) => (
            <NavLink aria-label={label} className="app-sidebar__link" end={end} key={to} onClick={onCloseMobile} title={collapsed ? label : undefined} to={to}>
              <Icon aria-hidden="true" size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="app-sidebar__collapse" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} type="button">
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse sidebar</span></>}
        </button>
      </aside>
      <header className="app-topbar">
        <button aria-label="Open navigation menu" className="app-topbar__menu" onClick={onToggleMobile} type="button"><Menu size={21} /></button>
        <div className="app-topbar__title"><span>MagPET</span><span aria-hidden="true">/</span><strong>{pageTitles[location.pathname] || 'Workspace'}</strong></div>
        <div className="app-topbar__account">
          <span aria-hidden="true" className="app-topbar__avatar">{initials}</span>
          <span className="app-topbar__name" title={displayName}>{displayName}</span>
          <Link aria-label="Profile settings" className="app-topbar__profile" title="Profile settings" to="/profile"><UserRound aria-hidden="true" size={16} /><span>Profile</span></Link>
          <button className="button button--outline button--small app-topbar__signout" disabled={signingOut} onClick={handleSignOut} type="button">
            <LogOut aria-hidden="true" size={15} /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </header>
      {error && <p className="form-message form-message--error app-topbar__error" role="alert">{error}</p>}
    </>
  )
}

export default AppHeader
