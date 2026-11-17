import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return
      }

      setSession(nextSession)
      setAuthError('')
      setLoading(false)
    })

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        if (error) {
          setAuthError(error.message)
        } else {
          setSession(data.session)
        }
        setLoading(false)
      })
      .catch((error) => {
        if (active) {
          setAuthError(error.message || 'Unable to check the current session.')
          setLoading(false)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      authError,
      loading,
      session,
      user: session?.user ?? null,
    }),
    [authError, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
