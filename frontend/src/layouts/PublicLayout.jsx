import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import UserMenu from '../components/UserMenu'
import NotificationBell from '../components/NotificationBell'

/**
 * PublicLayout: Header đơn giản với logo và link đăng nhập/đăng ký
 * Dùng cho trang chủ, đăng nhập, đăng ký
 * - Đã đăng nhập: hiện avatar + menu (Hồ sơ, Đăng xuất; thêm "Vào trang quản lý" nếu là admin/staff)
 */
const PublicLayout = () => {
  const { user } = useAuth()
  const managePath = user?.role_name === 'admin' ? '/admin' : user?.role_name === 'staff' ? '/staff' : null

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
            <Link
              to="/employees"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Đội ngũ
            </Link>
            {user ? (
              <>
                {managePath && (
                  <Link
                    to={managePath}
                    className="text-sm font-medium bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
                  >
                    Trang quản lý
                  </Link>
                )}
                <NotificationBell />
                <UserMenu />
              </>
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
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 grid gap-6 sm:grid-cols-2 text-sm">
          <div>
            <div className="flex items-center gap-2 font-bold text-pink-600">
              <span className="text-xl">🐾</span>
              <span>Pet Spa</span>
            </div>
            <p className="mt-2 text-gray-500">Chăm sóc thú cưng chuyên nghiệp, tận tâm và an toàn.</p>
          </div>
          <div className="sm:text-right text-gray-600 space-y-1">
            <p><span className="font-medium text-gray-800">Địa chỉ:</span> 538 Tôn Đức Thắng, P. Hòa Khánh, Đà Nẵng</p>
            <p><span className="font-medium text-gray-800">Điện thoại:</span> 0338 919 227</p>
          </div>
        </div>
        <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
          © 2026 Pet Spa System. Hệ thống quản lý dịch vụ Spa thú cưng.
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout