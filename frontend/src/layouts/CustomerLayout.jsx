import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import UserMenu from '../components/UserMenu'

/**
 * CustomerLayout: Layout cho khách hàng đã đăng nhập
 * - Header với avatar và menu người dùng (dùng chung UserMenu, có nút Đăng xuất)
 * - Navigation bar responsive
 */
const CustomerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const navLinks = [
    { to: '/', label: 'Trang chủ', exact: true },
    { to: '/pets', label: 'Thú cưng của tôi' },
    { to: '/booking', label: 'Đặt lịch' },
    { to: '/appointments', label: 'Lịch hẹn của tôi' },
    { to: '/services', label: 'Dịch vụ' },
    { to: '/employees', label: 'Đội ngũ' },
    { to: '/profile', label: 'Hồ sơ của tôi' },
  ]
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-pink-600 font-bold text-xl">
            <span className="text-2xl">🐾</span>
            <span className="hidden sm:block">Pet Spa</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? 'text-pink-600' : 'text-gray-600 hover:text-gray-900'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Menu người dùng */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 text-gray-500 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Mở menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>

            <UserMenu />
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-2">
            {navLinks.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `text-sm font-medium py-1 ${isActive ? 'text-pink-600' : 'text-gray-600'}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default CustomerLayout