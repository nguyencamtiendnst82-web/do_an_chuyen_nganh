import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * StaffLayout: Sidebar thu gọn được trên mobile cho nhân viên
 */
const StaffLayout = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/staff', label: 'Dashboard', icon: '📊', exact: true },
    { to: '/staff/shifts', label: 'Ca làm của tôi', icon: '⏰' },
    { to: '/staff/pets', label: 'Hồ sơ thú cưng', icon: '🐶' },
    { to: '/staff/services', label: 'Dịch vụ', icon: '✂️' },
    { to: '/profile', label: 'Hồ sơ cá nhân', icon: '👤' },
    { to: '/', label: 'Về trang chủ', icon: '🏠', exact: true },
  ]
  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`${mobile
          ? 'fixed inset-0 z-40 flex'
          : 'hidden md:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen'
        }`}
    >
      {mobile && (
        <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`${mobile ? 'relative z-50 w-64 bg-white min-h-screen flex flex-col' : 'flex flex-col w-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <span className="text-2xl mr-2">🐾</span>
          <span className="font-bold text-gray-800">Pet Spa</span>
          <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Nhân viên</span>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden shrink-0">
             {user?.avatar_url
             ? <img src={user.avatar_url} alt="Ảnh đại diện" className="w-9 h-9 rounded-full object-cover" />
    : user?.full_name?.[0]?.toUpperCase() || 'S'
  }
</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar */}
      {sidebarOpen && <Sidebar mobile />}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-800">🐾 Pet Spa – Nhân viên</span>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default StaffLayout
