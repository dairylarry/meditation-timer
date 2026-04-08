import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as cognitoLogin, logout as cognitoLogout, refreshSession, getCurrentUser } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // authState: 'loading' | 'authenticated' | 'unauthenticated'
  const [authState, setAuthState] = useState('loading')
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      // Fast path: we have an id token already (may still be within 1h expiry).
      // This lets the app render immediately on refresh without waiting on a
      // network round-trip. We refresh in the background to keep tokens fresh.
      const cached = getCurrentUser()
      if (cached) {
        if (!cancelled) {
          setUser(cached)
          setAuthState('authenticated')
        }
      }

      // Always attempt a refresh so an expired id token gets renewed and
      // so we detect invalidated refresh tokens and bounce to login.
      const refreshed = await refreshSession()
      if (cancelled) return

      if (refreshed) {
        setUser(refreshed)
        setAuthState('authenticated')
      } else if (!cached) {
        setAuthState('unauthenticated')
      } else {
        // We had a cached token but refresh failed — treat as signed out.
        setUser(null)
        setAuthState('unauthenticated')
      }
    }

    restore()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username, password) => {
    const user = await cognitoLogin(username, password)
    setUser(user)
    setAuthState('authenticated')
    return user
  }, [])

  const logout = useCallback(async () => {
    await cognitoLogout()
    setUser(null)
    setAuthState('unauthenticated')
  }, [])

  return (
    <AuthContext.Provider value={{ authState, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
