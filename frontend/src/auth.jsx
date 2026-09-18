import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // `loading` is true until we've resolved any persisted token on first mount,
  // so guarded routes don't flash the login screen for an authenticated user.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me/')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const res = await api.post('/auth/login/', { username, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  async function register(username, password, email) {
    const res = await api.post('/auth/register/', { username, password, email })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  async function logout() {
    try {
      await api.post('/auth/logout/')
    } catch {
      // Ignore network/401 errors — we're clearing local state regardless.
    }
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
