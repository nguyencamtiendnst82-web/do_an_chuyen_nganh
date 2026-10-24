import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-7xl mb-4">🐾</p>
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Trang không tồn tại</h2>
        <p className="text-gray-500 mb-8">Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
        <Link
          to="/"
          className="bg-pink-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-pink-700 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
