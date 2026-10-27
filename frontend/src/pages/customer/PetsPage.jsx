import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import PetFormModal from '../../components/PetFormModal'
import PetAvatar from '../../components/PetAvatar'
import { CardSkeletonGrid } from '../../components/Skeleton'
import { useToast, useConfirm } from '../../components/Feedback'
import {
  SPECIES_LABEL, GENDER_LABEL, formatAge, formatBirthMonth, errorMessage,
} from '../../utils/format'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới thêm trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'name', label: 'Tên A → Z' },
]

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500'

/**
 * PetsPage: "Thú cưng của tôi" (khách hàng)
 * - Xem, thêm, sửa hồ sơ (kèm ảnh) thú cưng của chính mình; lọc theo loài, sắp xếp
 * - "Xóa" = ẩn hồ sơ (giữ lại lịch sử); có thể xem lại và khôi phục
 */
const PetsPage = () => {
  const toast = useToast()
  const confirm = useConfirm()
  const [pets, setPets] = useState([])
  const [showHidden, setShowHidden] = useState(false)
  const [species, setSpecies] = useState('')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = đóng; {} = thêm mới; pet = sửa
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get('/pets', {
        params: { status: showHidden ? 'inactive' : 'active', species: species || undefined, sort, limit: 100 },
      })
      setPets(res.data.data.pets)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách thú cưng.'))
    } finally {
      setLoading(false)
    }
  }, [showHidden, species, sort])

  useEffect(() => { load() }, [load])

  const handleSaved = (pet, warning) => {
    setEditing(null)
    toast.success(`Đã lưu hồ sơ của ${pet.name}.`)
    if (warning) toast.error(warning)
    load()
  }

  const handleArchive = async (pet) => {
    const ok = await confirm({
      title: `Ẩn hồ sơ của ${pet.name}?`,
      message: 'Lịch sử chăm sóc vẫn được giữ lại và bạn có thể khôi phục hồ sơ bất cứ lúc nào.',
      confirmText: 'Ẩn hồ sơ',
      danger: true,
    })
    if (!ok) return
    setBusyId(pet.id)
    try {
      await axiosClient.delete(`/pets/${pet.id}`)
      toast.success(`Đã ẩn hồ sơ của ${pet.name}.`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể ẩn hồ sơ.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleRestore = async (pet) => {
    setBusyId(pet.id)
    try {
      await axiosClient.put(`/pets/${pet.id}`, { status: 'active' })
      toast.success(`Đã khôi phục hồ sơ của ${pet.name}.`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể khôi phục hồ sơ.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thú cưng của tôi</h1>
          <p className="text-sm text-gray-500 mt-1">Hồ sơ giúp Pet Spa chăm sóc bé phù hợp hơn.</p>
        </div>
        <button type="button" onClick={() => setEditing({})}
          className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
          + Thêm thú cưng
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={species} onChange={(e) => setSpecies(e.target.value)} aria-label="Lọc theo loài" className={selectClass}>
          <option value="">Tất cả loài</option>
          {Object.entries(SPECIES_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp" className={selectClass}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Xem hồ sơ đã ẩn
        </label>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <CardSkeletonGrid count={4} />
      ) : pets.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          {showHidden || species
            ? 'Không có hồ sơ nào phù hợp bộ lọc.'
            : 'Bạn chưa có thú cưng nào. Bấm "Thêm thú cưng" để tạo hồ sơ đầu tiên.'}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pets.map((pet) => (
            <li key={pet.id} className={`bg-white rounded-2xl border border-gray-200 p-5 ${pet.status === 'inactive' ? 'opacity-75' : ''}`}>
              <div className="flex items-start gap-3">
                <PetAvatar pet={pet} />
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{pet.name}</h2>
                  <p className="text-sm text-gray-500">
                    {SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ''}
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-gray-400">Giới tính</dt><dd className="text-gray-700 font-medium">{GENDER_LABEL[pet.gender]}</dd></div>
                <div>
                  <dt className="text-gray-400">Tuổi</dt>
                  <dd className="text-gray-700 font-medium">
                    {formatAge(pet.age_months)}
                    {pet.birth_month && <span className="block text-gray-400 font-normal">sinh {formatBirthMonth(pet.birth_month)}</span>}
                  </dd>
                </div>
                <div><dt className="text-gray-400">Cân nặng</dt><dd className="text-gray-700 font-medium">{pet.weight_kg !== null ? `${pet.weight_kg} kg` : 'Chưa rõ'}</dd></div>
              </dl>

              {pet.special_notes && (
                <p className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{pet.special_notes}</p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                {pet.status === 'inactive' ? (
                  <button type="button" onClick={() => handleRestore(pet)} disabled={busyId === pet.id}
                    className="text-sm text-pink-600 hover:underline disabled:opacity-60">
                    {busyId === pet.id ? 'Đang xử lý...' : 'Khôi phục'}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => setEditing(pet)}
                      className="text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                      Sửa
                    </button>
                    <button type="button" onClick={() => handleArchive(pet)} disabled={busyId === pet.id}
                      className="text-sm text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60">
                      {busyId === pet.id ? 'Đang xử lý...' : 'Ẩn hồ sơ'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PetFormModal pet={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

export default PetsPage
