import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from '@/store'
import { AuthContext } from './auth-context'

function readSignedInUser() {
  try {
    const { user, profile } = store.auth.me()
    return { user, profile, loading: false }
  } catch {
    return { user: null, profile: null, loading: false }
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(readSignedInUser)

  const refresh = useCallback(() => setState(readSignedInUser()), [])

  useEffect(() => {
    const handleSessionChange = () => {
      setState(readSignedInUser())
    }

    window.addEventListener('ugs:session-changed', handleSessionChange)
    window.addEventListener('storage', handleSessionChange)
    return () => {
      window.removeEventListener('ugs:session-changed', handleSessionChange)
      window.removeEventListener('storage', handleSessionChange)
    }
  }, [])

  const login = useCallback(async ({ username, password, role }) => {
    const res = await store.auth.login({ username, password, role })
    setState({ user: res.user, profile: res.profile, loading: false })
    return res
  }, [])

  const logout = useCallback(() => {
    store.auth.logout()
    setState({ user: null, profile: null, loading: false })
  }, [])

  const value = useMemo(
    () => ({ ...state, login, logout, refresh, setUser: (user, profile) => setState((s) => ({ ...s, user, profile: profile ?? s.profile })) }),
    [state, login, logout, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
