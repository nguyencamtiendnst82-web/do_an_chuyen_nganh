import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axiosClient from '../api/axiosClient'
import { formatVND } from '../utils/format'

/**
 * HomePage: Trang chủ
 * - Banner + nút hành động theo vai trò người xem
 * - Dịch vụ nổi bật lấy từ DB (giá, thời lượng thật), bấm vào là đặt lịch với dịch vụ đó
 * - "Vì sao chọn Pet Spa" và lời kêu gọi đặt lịch (đội ngũ có trang riêng ở menu)
 */

// Dự phòng khi chưa tải được dịch vụ từ máy chủ (không có giá / liên kết riêng)
const FALLBACK_SERVICES = [
  { id: null, name: 'Tắm sấy vệ sinh', description: 'Làm sạch lông và da, khử mùi, dưỡng lông' },
  { id: null, name: 'Cắt tỉa tạo kiểu', description: 'Cắt lông theo yêu cầu, tạo kiểu dáng đẹp' },
  { id: null, name: 'Chăm sóc móng', description: 'Cắt móng, mài nhẵn, vệ sinh tai mắt' },
  { id: null, name: 'Massage thư giãn', description: 'Giúp thú cưng thư giãn, tăng tuần hoàn máu' },
]

const WHY_US = [
  {
    title: 'Đội ngũ tận tâm, được đào tạo bài bản',
    desc: 'Kỹ thuật viên giàu kinh nghiệm, luôn nhẹ nhàng và kiên nhẫn với từng bé.',
    path: 'M5 13l4 4L19 7',
  },
  {
    title: 'Minh bạch từng bước chăm sóc',
    desc: 'Nhận thông báo khi bé được tiếp nhận, bắt đầu và hoàn tất; xem ảnh và lời khuyên trong sổ tay chăm sóc.',
    path: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0',
  },
  {
    title: 'Đặt lịch dễ, không lo trùng giờ',
    desc: 'Chọn dịch vụ, ngày giờ còn trống và nhân viên mong muốn chỉ trong vài bước.',
    path: 'M8 7V3m8 4V3M5 11h14M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  },
]

const PawIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <ellipse cx="6.5" cy="10" rx="2" ry="2.6" />
    <ellipse cx="10.5" cy="6.2" rx="2" ry="2.6" />
    <ellipse cx="15" cy="6.2" rx="2" ry="2.6" />
    <ellipse cx="18.5" cy="10" rx="2" ry="2.6" />
    <path d="M12.7 11c-2.6 0-5.2 3.2-5.2 5.6 0 1.7 1.3 2.4 2.7 2.4 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.4 0 2.7-.7 2.7-2.4 0-2.4-2.6-5.6-5.2-5.6z" />
  </svg>
)

/**
 * Thẻ dịch vụ: có ảnh → ảnh đầu thẻ; không có ảnh → KHÔNG chiếm chỗ bằng khung trống,
 * thay bằng huy hiệu nhỏ + thời lượng ở hàng đầu để thẻ gọn và đều nhau.
 */
// Bấm thẻ → tới đúng phần mô tả của dịch vụ đó trong trang dịch vụ (cuộn tới và làm nổi bật)
const serviceHref = (role, id) => {
  if (role === 'staff') return `/staff/services#service-${id}`
  if (role === 'admin') return '/admin/services'
  return `/services#service-${id}`
}

const ServiceCard = ({ service, role }) => {
  const { id, name, description, price, duration_minutes: minutes, image_url: image } = service
  const hasPrice = price !== undefined
  const content = (
    <>
      {image && (
        <div className="h-36 overflow-hidden bg-pink-50">
          <img src={image} alt={name} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        {!image && (
          <div className="flex items-center justify-between mb-3">
            <span className="w-10 h-10 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center">
              <PawIcon />
            </span>
            {minutes ? (
              <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">{minutes} phút</span>
            ) : null}
          </div>
        )}
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.75rem]">{name}</h3>
        <p className="mt-1.5 text-sm text-gray-500 line-clamp-3">{description}</p>

        {hasPrice && (
          <div className="mt-auto pt-4">
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-gray-400">Giá từ</span>
                <span className="font-bold text-pink-600">{formatVND(price)}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 group-hover:gap-2 transition-all">
                {image && minutes ? <span className="text-gray-400 font-normal mr-1">{minutes} phút</span> : null}
                Xem chi tiết <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )

  const base = 'group bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col text-left h-full'
  if (!id) return <div className={base}>{content}</div>
  return (
    <Link
      to={serviceHref(role, id)}
      className={`${base} hover:-translate-y-1 hover:shadow-lg hover:border-pink-200 transition focus:outline-none focus:ring-2 focus:ring-pink-500`}
    >
      {content}
    </Link>
  )
}

const HomePage = () => {
  const { user } = useAuth()
  const role = user?.role_name

  const [services, setServices] = useState(null) // null = đang tải

  useEffect(() => {
    let cancelled = false
    axiosClient.get('/services/public')
      .then((res) => { if (!cancelled) setServices(res.data.data.services) })
      .catch(() => { if (!cancelled) setServices([]) })
    return () => { cancelled = true }
  }, [])

  const shownServices = services && services.length > 0 ? services.slice(0, 4) : FALLBACK_SERVICES

  const allServices = {
    customer: { to: '/services', label: 'Xem tất cả dịch vụ →' },
    staff: { to: '/staff/services', label: 'Xem tất cả dịch vụ →' },
    admin: { to: '/admin/services', label: 'Xem tất cả dịch vụ →' },
  }[role] || { to: '/register', label: 'Đăng ký để đặt lịch →' }

  const primaryBtn = 'px-8 py-3 rounded-xl font-medium transition-colors'

  const heroActions = () => {
    if (role === 'customer') {
      return (
        <>
          <Link to="/booking" className={`${primaryBtn} bg-pink-600 text-white hover:bg-pink-700`}>Đặt lịch ngay</Link>
          <Link to="/appointments" className={`${primaryBtn} bg-white text-pink-600 border border-pink-200 hover:bg-pink-50`}>Lịch hẹn của tôi</Link>
        </>
      )
    }
    if (role === 'staff' || role === 'admin') {
      return (
        <Link to={role === 'admin' ? '/admin' : '/staff'} className={`${primaryBtn} bg-pink-600 text-white hover:bg-pink-700`}>
          Vào trang quản lý
        </Link>
      )
    }
    return (
      <>
        <Link to="/register" className={`${primaryBtn} bg-pink-600 text-white hover:bg-pink-700`}>Đăng ký ngay</Link>
        <Link to="/login" className={`${primaryBtn} bg-white text-pink-600 border border-pink-200 hover:bg-pink-50`}>Đăng nhập</Link>
      </>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-pink-50 to-purple-50 py-14 sm:py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-pink-600 mb-3">🐾 Chuyên nghiệp · Tận tâm · An toàn</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Dịch vụ Spa<br />
            <span className="text-pink-600">Thú cưng</span> cao cấp
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Chúng tôi mang đến trải nghiệm chăm sóc thú cưng chuyên nghiệp, tận tâm và an toàn.
            Thú cưng của bạn xứng đáng được yêu thương nhất!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">{heroActions()}</div>
        </div>
      </section>

      {/* Dịch vụ nổi bật */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Dịch vụ nổi bật</h2>
          <p className="text-sm text-gray-500 text-center mt-2 mb-10">Bấm vào dịch vụ để xem mô tả chi tiết</p>

          {services === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-busy="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-white border border-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
              {shownServices.map((s) => <ServiceCard key={s.id ?? s.name} service={s} role={role} />)}
            </div>
          )}

          <div className="text-center mt-8">
            <Link to={allServices.to} className="text-sm font-medium text-pink-600 hover:text-pink-700">
              {allServices.label}
            </Link>
          </div>
        </div>
      </section>

      {/* Vì sao chọn Pet Spa */}
      <section className="py-16 px-4 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Vì sao chọn Pet Spa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHY_US.map(({ title, desc, path }) => (
              <div key={title} className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-pink-50 text-pink-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lời kêu gọi */}
      {(role === 'customer' || !user) && (
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-12 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-bold">Sẵn sàng cho bé một ngày làm đẹp?</h2>
            <p className="mt-2 text-pink-50">Đặt lịch chỉ mất vài phút, hệ thống tự tìm giờ trống phù hợp.</p>
            <Link
              to={role === 'customer' ? '/booking' : '/register'}
              className="inline-block mt-6 bg-white text-pink-600 font-medium px-8 py-3 rounded-xl hover:bg-pink-50 transition-colors"
            >
              {role === 'customer' ? 'Đặt lịch ngay' : 'Đăng ký và đặt lịch'}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

export default HomePage
