import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import CareRecordCard from '../../components/CareRecordCard'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { errorMessage } from '../../utils/format'
import { formatDate } from '../../utils/appointment'

/**
 * CareBookPage: Sổ tay chăm sóc của khách hàng.
 * Chọn một bé để xem lại từng lần đi spa: tình trạng khi tiếp nhận, quá trình thực hiện,
 * lời khuyên chăm sóc tại nhà và ảnh trước/sau.
 */
const CareBookPage = () => {
  const [pets, setPets] = useState([])
  const [petId, setPetId] = useState(null)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [loadingPets, setLoadingPets] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axiosClient
      .get('/pets', { params: { limit: 100, status: 'active' } })
      .then((res) => {
        const list = res.data.data.pets
        setPets(list)
        if (list.length > 0) setPetId(list[0].id)
      })
      .catch((err) => setError(errorMessage(err, 'Không tải được danh sách thú cưng.')))
      .finally(() => setLoadingPets(false))
  }, [])

  const load = useCallback(async (id, page, append) => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get(`/pets/${id}/care-history`, { params: { page, limit: 5 } })
      const data = res.data.data
      setRecords((prev) => (append ? [...prev, ...data.records] : data.records))
      setPagination(data.pagination)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được sổ tay chăm sóc.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (petId) { setRecords([]); load(petId, 1, false) }
  }, [petId, load])

  const activePet = pets.find((p) => p.id === petId)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sổ tay chăm sóc</h1>
        <p className="text-sm text-gray-500 mt-1">Xem lại những lần bé đi spa: tình trạng, quá trình chăm sóc, lời khuyên và ảnh trước/sau.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loadingPets ? (
        <ListSkeleton rows={2} />
      ) : pets.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          Bạn chưa có thú cưng nào. Hãy thêm hồ sơ thú cưng ở mục “Thú cưng của tôi”.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Chọn thú cưng">
            {pets.map((p) => (
              <button
                key={p.id} type="button" role="tab" aria-selected={p.id === petId} onClick={() => setPetId(p.id)}
                className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-full border text-sm ${
                  p.id === petId ? 'bg-pink-50 border-pink-300 text-pink-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PetAvatar pet={p} size="w-7 h-7" text="text-sm" />
                {p.name}
              </button>
            ))}
          </div>

          {loading && records.length === 0 ? (
            <ListSkeleton rows={3} />
          ) : records.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
              {activePet?.name} chưa có lần chăm sóc nào hoàn tất. Sau mỗi lần đi spa, ghi chú của nhân viên sẽ hiện ở đây.
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((r) => (
                <CareRecordCard
                  key={r.id}
                  record={r}
                  title={`${formatDate(r.service_date)}${r.service_names ? ` · ${r.service_names}` : ''}`}
                  subtitle={`Mã lịch hẹn ${r.appointment_code}`}
                />
              ))}
              {pagination.page < pagination.total_pages && (
                <div className="text-center">
                  <button
                    type="button" disabled={loading} onClick={() => load(petId, pagination.page + 1, true)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loading ? 'Đang tải...' : 'Xem thêm'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CareBookPage
