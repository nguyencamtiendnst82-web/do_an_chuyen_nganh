import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute: bảo vệ routes theo role
 * @param {string[]} allowedRoles - Danh sách role được phép truy cập
 *
 * Luồng:
 * 1. Đang tải (xác minh token) → hiển thị spinner
 * 2. Chưa đăng nhập → redirect /login
 * 3. Role không phù hợp → redirect tới trang chính của role đó
 * 4. Hợp lệ → render <Outlet />
 */
const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Đang xác thực...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role_name)) {
    // Redirect về trang chính của role hiện tại
    const roleHome = {
      admin: '/admin',
      staff: '/staff',
      customer: '/',
    }
    return <Navigate to={roleHome[user.role_name] || '/'} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
