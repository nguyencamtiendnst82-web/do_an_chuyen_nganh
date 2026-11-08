import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import UserMenu from '../components/UserMenu'
import NotificationBell from '../components/NotificationBell'
import EmailVerificationNotice from '../components/EmailVerificationNotice'

/**
 * CustomerLayout: khung giao diện cho khách hàng đã đăng nhập
 * - 4 mục chính + "Khám phá" (Dịch vụ, Đội ngũ) xổ xuống để thanh menu gọn
 * - "Đặt lịch" là nút nổi bật vì đây là hành động chính của khách
 * - "Hồ sơ cá nhân" và "Đăng xuất" nằm trong menu avatar (UserMenu)
 */
const MAIN_LINKS = [
  { to: '/', label: 'Trang chủ', exact: true },
  { to: '/pets', label: 'Thú cưng của tôi' },
  { to: '/appointments', label: 'Lịch hẹn của tôi' },
  { to: '/care-book', label: 'Sổ tay chăm sóc' },
]

const EXPLORE_LINKS = [
  { to: '/services', label: 'Dịch vụ', hint: 'Bảng giá và thời lượng' },
  { to: '/employees', label: 'Đội ngũ', hint: 'Gặp các kỹ thuật viên' },
]

const desktopLinkClass = ({ isActive }) =>
  `relative h-16 flex items-center text-sm font-medium transition-colors border-b-2 ${
    isActive
      ? 'text-pink-600 border-pink-600'
      : 'text-gray-600 border-transparent hover:text-gray-900'
  }`

const mobileLinkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
  }`

const ExploreMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { pathname } = useLocation()
  const active = EXPLORE_LINKS.some((l) => pathname.startsWith(l.to))

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`h-16 flex items-center gap-1 text-sm font-medium border-b-2 transition-colors ${
          active ? 'text-pink-600 border-pink-600' : 'text-gray-600 border-transparent hover:text-gray-900'
        }`}
      >
        Khám phá
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-14 w-60 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 z-50">
          {EXPLORE_LINKS.map(({ to, label, hint }) => (
            <NavLink
              key={to}
              to={to}
              role="menuitem"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 ${isActive ? 'bg-pink-50' : 'hover:bg-gray-50'}`
              }
            >
              <span className="block text-sm font-medium text-gray-900">{label}</span>
              <span className="block text-xs text-gray-500">{hint}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const CustomerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setMobileMenuOpen(false) }, [pathname])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-pink-600 font-bold text-xl shrink-0">
            <span className="text-2xl">🐾</span>
            <span className="hidden sm:block">Pet Spa</span>
          </Link>

          {/* Menu trên máy tính */}
          <nav className="hidden md:flex items-center gap-7 flex-1" aria-label="Menu chính">
            {MAIN_LINKS.map(({ to, label, exact }) => (
              <NavLink key={to} to={to} end={exact} className={desktopLinkClass}>
                {label}
              </NavLink>
            ))}
            <ExploreMenu />
          </nav>

          {/* Hành động + tài khoản */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/booking"
              className="hidden sm:inline-flex items-center bg-pink-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
            >
              Đặt lịch
            </Link>

            <NotificationBell />
            <UserMenu />

            <button
              type="button"
              className="md:hidden p-2 text-gray-500 hover:text-gray-900"
              onClick={() => setMobileMenuOpen((p) => !p)}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Menu trên điện thoại: đầy đủ mọi mục */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1" aria-label="Menu chính">
            <Link
              to="/booking"
              className="block text-center bg-pink-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-pink-700 mb-2"
            >
              Đặt lịch
            </Link>
            {[...MAIN_LINKS, ...EXPLORE_LINKS].map(({ to, label, exact }) => (
              <NavLink key={to} to={to} end={exact} className={mobileLinkClass}>
                {label}
              </NavLink>
            ))}
            <NavLink to="/profile" className={mobileLinkClass}>Hồ sơ cá nhân</NavLink>
          </nav>
        )}
      </header>

      {/* Nhắc xác minh email (chỉ hiện với tài khoản chưa xác minh) */}
      <EmailVerificationNotice />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default CustomerLayout
