import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * HomePage: Trang chủ công khai
 * - Banner giới thiệu Pet Spa
 * - Danh sách dịch vụ nổi bật
 */
const HomePage = () => {
  const { user } = useAuth()

  const services = [
    { icon: '🛁', title: 'Tắm sấy vệ sinh', desc: 'Làm sạch lông và da, khử mùi, dưỡng lông' },
    { icon: '✂️', title: 'Cắt tỉa tạo kiểu', desc: 'Cắt lông theo yêu cầu, tạo kiểu dáng đẹp' },
    { icon: '💅', title: 'Chăm sóc móng', desc: 'Cắt móng, mài nhẵn, vệ sinh tai mắt' },
    { icon: '💆', title: 'Massage thư giãn', desc: 'Giúp thú cưng thư giãn, tăng tuần hoàn máu' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-pink-50 to-purple-50 py-20 px-4">
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Link
                to="/profile"
                className="bg-pink-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-pink-700 transition-colors"
              >
                Xem hồ sơ của tôi
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-pink-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-pink-700 transition-colors"
                >
                  Đăng ký ngay
                </Link>
                <Link
                  to="/login"
                  className="bg-white text-pink-600 border border-pink-200 px-8 py-3 rounded-xl font-medium hover:bg-pink-50 transition-colors"
                >
                  Đăng nhập
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Dịch vụ nổi bật</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                <span className="text-4xl mb-3 block">{icon}</span>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage