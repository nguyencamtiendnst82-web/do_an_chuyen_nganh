import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import UserMenu from '../components/UserMenu'

/**
 * PublicLayout: Header đơn giản với logo và link đăng nhập/đăng ký
 * Dùng cho trang chủ, đăng nhập, đăng ký
 * - Đã đăng nhập: hiện avatar + menu (Hồ sơ, Đăng xuất; thêm "Vào trang quản lý" nếu là admin/staff)
 */
const PublicLayout = () => {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-pink-600 font-bold text-xl">
            <span className="text-2xl">🐾</span>
            <span>Pet Spa</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {user ? (
              <UserMenu />
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          © 2026 Pet Spa System. Hệ thống quản lý dịch vụ Spa thú cưng.
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout