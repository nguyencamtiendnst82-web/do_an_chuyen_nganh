import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../contexts/AuthContext'
import { CardSkeletonGrid } from '../../components/Skeleton'
import { formatVND, errorMessage } from '../../utils/format'

/**
 * ServiceCatalogPage: bảng giá / danh mục dịch vụ (chỉ đọc)
 * Dùng cho khách hàng và nhân viên. Khách chỉ thấy dịch vụ đang bật (server tự lọc).
 * - Tìm kiếm + sắp xếp (tên, giá, thời lượng)
 * - Thẻ gọn: ảnh (nếu có), mô tả có "Xem thêm", giá và thời lượng, nút đặt lịch nhỏ gọn
 * - Mở từ trang chủ (#service-<id>): cuộn tới đúng dịch vụ và làm nổi bật
 */
const SORTS = [
  { value: 'name', label: 'Tên A–Z', fn: (a, b) => a.name.localeCompare(b.name, 'vi') },
  { value: 'price_asc', label: 'Giá thấp → cao', fn: (a, b) => Number(a.price) - Number(b.price) },
  { value: 'price_desc', label: 'Giá cao → thấp', fn: (a, b) => Number(b.price) - Number(a.price) },
  { value: 'duration', label: 'Thời lượng ngắn → dài', fn: (a, b) => a.duration_minutes - b.duration_minutes },
]

const LONG_DESCRIPTION = 110

const PawIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <ellipse cx="6.5" cy="10" rx="2" ry="2.6" />
    <ellipse cx="10.5" cy="6.2" rx="2" ry="2.6" />
    <ellipse cx="15" cy="6.2" rx="2" ry="2.6" />
    <ellipse cx="18.5" cy="10" rx="2" ry="2.6" />
    <path d="M12.7 11c-2.6 0-5.2 3.2-5.2 5.6 0 1.7 1.3 2.4 2.7 2.4 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.4 0 2.7-.7 2.7-2.4 0-2.4-2.6-5.6-5.2-5.6z" />
  </svg>
)

const ServiceCard = ({ s, highlighted, canBook }) => {
  const [expanded, setExpanded] = useState(false)
  const long = (s.description || '').length > LONG_DESCRIPTION

  return (
    <li
      id={`service-${s.id}`}
      className={`bg-white rounded-2xl border overflow-hidden flex flex-col scroll-mt-24 transition-shadow duration-500 ${
        highlighted ? 'border-pink-400 ring-4 ring-pink-100 shadow-lg' : 'border-gray-200 hover:shadow-md'
      } ${s.is_active ? '' : 'opacity-70'}`}
    >
      {s.image_url && (
        <div className="aspect-[16/9] bg-pink-50 overflow-hidden">
          <img src={s.image_url} alt={s.name} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3">
          {!s.image_url && (
            <span className="shrink-0 w-10 h-10 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center">
              <PawIcon />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900 leading-snug">{s.name}</h2>
              {!s.is_active && (
                <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Đang ẩn</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
              ⏱ {s.duration_minutes} phút
            </span>
          </div>
        </div>

        {s.description && (
          <div className="mt-3 flex-1">
            <p className={`text-sm text-gray-600 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{s.description}</p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="mt-1 text-xs font-medium text-pink-600 hover:text-pink-700"
              >
                {expanded ? 'Thu gọn' : 'Xem thêm'}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-gray-400">Giá từ</span>
            <span className="text-lg font-bold text-pink-600">{formatVND(s.price)}</span>
          </div>
          {canBook && s.is_active && (
            <Link
              to={`/booking?service=${s.id}`}
              className="shrink-0 border border-pink-200 text-pink-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-colors"
            >
              Đặt lịch
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

const ServiceCatalogPage = () => {
  const { user } = useAuth()
  const { hash } = useLocation()
  const [highlightId, setHighlightId] = useState(null)
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
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

  const sorted = useMemo(() => {
    const fn = SORTS.find((x) => x.value === sort)?.fn
    return fn ? [...services].sort(fn) : services
  }, [services, sort])

  // Đến từ trang chủ (#service-<id>): cuộn tới đúng dịch vụ và làm nổi bật vài giây
  useEffect(() => {
    if (loading) return undefined
    const match = /^#service-(\d+)$/.exec(hash)
    if (!match) return undefined
    const el = document.getElementById(`service-${match[1]}`)
    if (!el) return undefined
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(Number(match[1]))
    const timer = setTimeout(() => setHighlightId(null), 2500)
    return () => clearTimeout(timer)
  }, [hash, loading])

  const canBook = user?.role_name === 'customer'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dịch vụ Pet Spa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bảng giá tham khảo. Giá thực tế được tính khi đặt lịch.
            {!loading && !error && <span className="text-gray-400"> · {services.length} dịch vụ</span>}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm dịch vụ..."
            aria-label="Tìm dịch vụ"
            className="w-full sm:w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sắp xếp dịch vụ"
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            {SORTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <CardSkeletonGrid count={6} columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          Không tìm thấy dịch vụ nào.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {sorted.map((s) => (
            <ServiceCard key={s.id} s={s} highlighted={highlightId === s.id} canBook={canBook} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ServiceCatalogPage
