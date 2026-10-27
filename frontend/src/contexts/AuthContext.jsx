import { createContext, useContext, useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'

const AuthContext = createContext(null)

/**
 * AuthProvider: cung cấp user, token, login, logout cho toàn cây component
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  // loading = true trong lúc xác minh token ban đầu (tránh ProtectedRoute flash)
  const [loading, setLoading] = useState(true)

  // Khi app mount: đọc token từ localStorage, xác minh với backend
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token')
      if (!savedToken) {
        setLoading(false)
        return
      }

      try {
        // Xác minh token còn hạn và tài khoản còn active
        const res = await axiosClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
        setToken(savedToken)
        setUser(res.data.data.user)
      } catch {
        // Token hết hạn hoặc bị khóa → xóa
        localStorage.removeItem('token')
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  /**
   * Đăng nhập: POST /api/auth/login → lưu token → set user
   * @param {string} credential - Email hoặc số điện thoại
   * @param {string} password
   * @returns {{ user, token }} - Để caller redirect theo role
   */
  const login = async (credential, password) => {
    const res = await axiosClient.post('/auth/login', { credential, password })
    const { token: newToken, user: newUser } = res.data.data
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
    return { user: newUser, token: newToken }
  }
    /**
   * Lưu phiên đăng nhập khi server đã trả sẵn token + user (đăng nhập bằng Google)
   */
  const loginWithToken = (newToken, newUser) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
    return { user: newUser, token: newToken }
  }

  /**
   * Đăng xuất: POST /api/auth/logout → xóa localStorage → clear state
   */
  const logout = async () => {
    try {
      await axiosClient.post('/auth/logout')
    } catch {
      // Bỏ qua lỗi (token hết hạn cũng vẫn logout được)
    } finally {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    }
  }

  return (
         <AuthContext.Provider value={{ user, setUser, token, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook tiện lợi để sử dụng AuthContext
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return ctx
}

export default AuthContext
