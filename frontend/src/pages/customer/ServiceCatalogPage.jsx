import { useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import { CardSkeletonGrid } from '../../components/Skeleton'
import { formatVND, errorMessage } from '../../utils/format'

/**
 * ServiceCatalogPage: bảng giá / danh mục dịch vụ (chỉ đọc)
 * Dùng cho khách hàng và nhân viên. Khách chỉ thấy dịch vụ đang bật (server tự lọc).
 */
const ServiceCatalogPage = () => {
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Chờ người dùng ngừng gõ 300ms rồi mới gọi API
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axiosClient.get('/services', { params: { search: search.trim() || undefined } })
        setServices(res.data.data.services)
      } catch (err) {
        setError(errorMessage(err, 'Không tải được danh sách dịch vụ.'))
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dịch vụ Pet Spa</h1>
        <p className="text-sm text-gray-500 mt-1">Bảng giá tham khảo. Giá thực tế được tính khi đặt lịch.</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm dịch vụ..."
        aria-label="Tìm dịch vụ"
        className="w-full sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
      />

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <CardSkeletonGrid count={4} columns="grid-cols-1 md:grid-cols-2" />
      ) : services.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          Không tìm thấy dịch vụ nào.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s) => (
            <li key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
              {s.image_url ? (
                <img src={s.image_url} alt={s.name} loading="lazy" className="w-full h-40 object-cover bg-pink-50" />
              ) : (
                <div className="w-full h-24 bg-pink-50 flex items-center justify-center text-4xl" aria-hidden="true">✂️</div>
              )}
              <div className="p-5 flex flex-col flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-gray-900">{s.name}</h2>
                {!s.is_active && (
                  <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Đang ẩn</span>
                )}
              </div>
              {s.description && <p className="mt-2 text-sm text-gray-600 flex-1">{s.description}</p>}
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-lg font-bold text-pink-600">{formatVND(s.price)}</span>
                <span className="text-sm text-gray-500">⏱ {s.duration_minutes} phút</span>
              </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ServiceCatalogPage
