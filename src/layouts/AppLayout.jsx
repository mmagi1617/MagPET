import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { supabase } from '../lib/supabase.js'
import AppHeader from '../components/AppHeader.jsx'
import '../styles/app-layout.css'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      if (!user?.id) return
      const { data, error } = await supabase.from('profiles').select('full_name,username').eq('id', user.id).maybeSingle()
      if (active && !error) setProfileName(data?.full_name?.trim() || data?.username?.trim() || '')
    }
    loadProfile()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <div className={`app-layout${collapsed ? ' app-layout--collapsed' : ''}${mobileOpen ? ' app-layout--mobile-open' : ''}`}>
      <AppHeader
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        profileName={profileName}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <button aria-label="Close navigation menu" className="app-layout__overlay" onClick={() => setMobileOpen(false)} type="button" />
      <main className="app-layout__main"><Outlet context={{ profileName, setProfileName }} /></main>
    </div>
  )
}

export default AppLayout
