import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import PetFormModal from '../../components/PetFormModal'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Feedback'
import {
  SPECIES_LABEL, GENDER_LABEL, formatAge, formatBirthMonth, errorMessage,
} from '../../utils/format'

const PAGE_SIZE = 10

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới thêm trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'name', label: 'Tên A → Z' },
]

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * PetsManagePage: tra cứu hồ sơ thú cưng của mọi khách hàng (nhân viên + admin)
 * - Tìm theo tên thú cưng, tên chủ hoặc số điện thoại chủ; lọc theo loài, trạng thái; sắp xếp
 * - Thêm thú cưng HỘ khách (chọn khách bằng ô tìm kiếm) và sửa hồ sơ khi tiếp nhận
 * - Bảng trên máy tính, dạng thẻ trên điện thoại
 */
const PetsManagePage = () => {
  const toast = useToast()
  const [pets, setPets] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [species, setSpecies] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = đóng; {} = thêm hộ khách; pet = sửa

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get('/pets', {
        params: { search: search.trim() || undefined, status, species: species || undefined, sort, page, limit: PAGE_SIZE },
      })
      setPets(res.data.data.pets)
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách thú cưng.'))
    } finally {
      setLoading(false)
    }
  }, [search, status, species, sort, page])

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [load])

  const handleSaved = (pet, warning) => {
    const wasNew = !editing?.id
    setEditing(null)
    toast.success(wasNew ? `Đã thêm thú cưng ${pet.name} cho ${pet.owner_name}.` : `Đã cập nhật hồ sơ của ${pet.name}.`)
    if (warning) toast.error(warning)
    load()
  }

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1) }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hồ sơ thú cưng</h1>
          <p className="text-sm text-gray-500 mt-1">Tra cứu thú cưng của tất cả khách hàng.</p>
        </div>
        <button type="button" onClick={() => setEditing({})}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Thêm thú cưng cho khách
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="search" value={search} aria-label="Tìm thú cưng"
          onChange={resetPage(setSearch)}
          placeholder="Tên thú cưng, tên chủ hoặc số điện thoại..."
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={species} aria-label="Lọc theo loài" onChange={resetPage(setSpecies)} className={selectClass}>
          <option value="">Tất cả loài</option>
          {Object.entries(SPECIES_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={status} aria-label="Lọc theo trạng thái" onChange={resetPage(setStatus)} className={selectClass}>
          <option value="active">Đang dùng</option>
          <option value="inactive">Đã ẩn</option>
          <option value="all">Tất cả</option>
        </select>
        <select value={sort} aria-label="Sắp xếp" onChange={resetPage(setSort)} className={selectClass}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : pets.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          Không tìm thấy thú cưng nào.
        </div>
      ) : (
        <>
          {/* Máy tính: bảng */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Thú cưng</th>
                  <th className="px-4 py-3 font-medium">Chủ nuôi</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Tuổi / Cân nặng</th>
                  <th className="px-4 py-3 font-medium">Lưu ý</th>
                  <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pets.map((p) => (
                  <tr key={p.id} className={p.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PetAvatar pet={p} size="w-10 h-10" text="text-lg" />
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {SPECIES_LABEL[p.species]}{p.breed ? ` · ${p.breed}` : ''} · {GENDER_LABEL[p.gender]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{p.owner_name}</p>
                      <p className="text-xs text-gray-500">{p.owner_phone}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatAge(p.age_months)}{p.birth_month ? ` (sinh ${formatBirthMonth(p.birth_month)})` : ''}
                      <p className="text-xs text-gray-500">{p.weight_kg !== null ? `${p.weight_kg} kg` : 'chưa rõ cân nặng'}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-600 line-clamp-2">{p.special_notes || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setEditing(p)} className="text-blue-700 hover:underline">Sửa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ */}
          <ul className="md:hidden space-y-3">
            {pets.map((p) => (
              <li key={p.id} className={`bg-white rounded-2xl border border-gray-200 p-4 ${p.status === 'inactive' ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  <PetAvatar pet={p} size="w-12 h-12" text="text-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{SPECIES_LABEL[p.species]}{p.breed ? ` · ${p.breed}` : ''} · {GENDER_LABEL[p.gender]}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(p)} className="text-sm text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">Sửa</button>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-gray-400">Chủ nuôi</dt><dd className="text-gray-700 font-medium">{p.owner_name}<span className="block font-normal text-gray-500">{p.owner_phone}</span></dd></div>
                  <div><dt className="text-gray-400">Tuổi · Cân nặng</dt><dd className="text-gray-700 font-medium">{formatAge(p.age_months)}<span className="block font-normal text-gray-500">{p.weight_kg !== null ? `${p.weight_kg} kg` : 'chưa rõ'}</span></dd></div>
                </dl>
                {p.special_notes && <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 line-clamp-3">{p.special_notes}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>Tổng: {pagination.total} hồ sơ</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Trước</button>
          <span>Trang {pagination.page} / {Math.max(1, pagination.total_pages)}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.total_pages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Sau</button>
        </div>
      </div>

      {editing && (
        <PetFormModal pet={editing.id ? editing : null} needsOwner onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

export default PetsManagePage
