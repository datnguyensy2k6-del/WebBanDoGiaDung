import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { clearAuthToken, getAuthToken, setAuthToken } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return () => { active = false }
    }

    api.get('/auth/me')
      .then((response) => {
        if (!active) return
        if (!response?.success || !response.data) throw new Error('Invalid profile response.')
        setUser(response.data)
      })
      .catch((error) => {
        if (!active) return
        if (error?.status === 401) clearAuthToken()
        setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  const establishSession = useCallback(async (authResponse) => {
    if (!authResponse?.success || typeof authResponse.token !== 'string' || !authResponse.token) {
      throw new Error('Phản hồi xác thực từ máy chủ không hợp lệ. Vui lòng thử lại.')
    }

    setAuthToken(authResponse.token)
    try {
      const profileResponse = await api.get('/auth/me')
      if (!profileResponse?.success || !profileResponse.data) {
        throw new Error('Không thể tải thông tin tài khoản. Vui lòng đăng nhập lại.')
      }
      setUser(profileResponse.data)
      return profileResponse.data
    } catch (error) {
      if (error?.status === 401) clearAuthToken()
      setUser(null)
      throw error
    }
  }, [])

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const response = await api.post('/auth/login', credentials)
      return await establishSession(response)
    } finally {
      setLoading(false)
    }
  }, [establishSession])

  const register = useCallback(async (account) => {
    setLoading(true)
    try {
      const response = await api.post('/auth/register', account)
      return await establishSession(response)
    } finally {
      setLoading(false)
    }
  }, [establishSession])

  const logout = useCallback(() => {
    clearAuthToken()
    setUser(null)
  }, [])

  const updateCurrentUser = useCallback((profile) => {
    if (profile && profile.userId === user?.userId) {
      setUser((current) => current ? { ...current, ...profile } : profile)
    }
  }, [user?.userId])

  const value = useMemo(() => ({ user, loading, login, register, logout, updateCurrentUser }), [user, loading, login, register, logout, updateCurrentUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used within AuthProvider.')
  return auth
}
