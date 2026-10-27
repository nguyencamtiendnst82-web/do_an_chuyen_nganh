import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import GoogleLoginButton from '../../components/GoogleLoginButton'

/**
 * LoginPage: Đăng nhập bằng email hoặc số điện thoại
 * - Hiển thị lỗi từ server (401 sai thông tin, 403 bị khóa)
 * - Redirect theo role sau khi đăng nhập thành công
 */
const LoginPage = () => {
  const { login, loginWithToken, user } = useAuth()
  const navigate = useNavigate()

  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Nếu đã đăng nhập → redirect về trang chính của role
  if (user) {
    const roleHome = { admin: '/admin', staff: '/staff', customer: '/' }
    navigate(roleHome[user.role_name] || '/', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!credential.trim()) {
      setError('Vui lòng nhập email hoặc số điện thoại.')
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.')
      return
    }

    setLoading(true)
    try {
      const { user: loggedUser } = await login(credential.trim(), password)
      const roleHome = { admin: '/admin', staff: '/staff', customer: '/' }
      navigate(roleHome[loggedUser.role_name] || '/', { replace: true })
    } catch (err) {
      // Hiển thị lỗi từ server (đã được interceptor bỏ qua redirect cho /auth/login)
      const msg = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }
  const handleGoogleSuccess = ({ token, user: googleUser }) => {
    loginWithToken(token, googleUser)
    const roleHome = { admin: '/admin', staff: '/staff', customer: '/' }
    navigate(roleHome[googleUser.role_name] || '/', { replace: true })
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <span className="text-4xl">🐾</span>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Đăng nhập</h1>
            <p className="mt-1 text-sm text-gray-500">Chào mừng trở lại Pet Spa!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Credential */}
            <div>
              <label htmlFor="credential" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email hoặc Số điện thoại
              </label>
              <input
                id="credential"
                type="text"
                autoComplete="username"
                placeholder="email@example.com hoặc 09xxxxxxxx"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

                    {/* Đăng nhập bằng Google */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">hoặc</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={setError} />
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-pink-600 font-medium hover:text-pink-700">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
