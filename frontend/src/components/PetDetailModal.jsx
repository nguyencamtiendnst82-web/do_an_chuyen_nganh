import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import PetAvatar from './PetAvatar'
import CareRecordCard from './CareRecordCard'
import { formatDate } from '../utils/appointment'
import {
  SPECIES_LABEL, GENDER_LABEL, formatAge, formatBirthMonth, errorMessage,
} from '../utils/format'

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="text-gray-900 text-right break-words min-w-0">{children || <span className="text-gray-400">—</span>}</dd>
  </div>
)

/**
 * PetDetailModal: xem chi tiết hồ sơ thú cưng (CHỈ ĐỌC) cho nhân viên và admin:
 * thông tin thú cưng, chủ nuôi, lưu ý sức khỏe và sổ tay chăm sóc (các lần đã hoàn tất).
 */
const PetDetailModal = ({ petId, onClose }) => {
  const [pet, setPet] = useState(null)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      axiosClient.get(`/pets/${petId}`),
      axiosClient.get(`/pets/${petId}/care-history`, { params: { page: 1, limit: 5 } }),
    ])
      .then(([petRes, careRes]) => {
        if (!alive) return
        setPet(petRes.data.data.pet)
        setRecords(careRes.data.data.records)
        setPagination(careRes.data.data.pagination)
      })
      .catch((err) => { if (alive) setError(errorMessage(err, 'Không tải được hồ sơ thú cưng.')) })
    return () => { alive = false }
  }, [petId])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await axiosClient.get(`/pets/${petId}/care-history`, { params: { page: pagination.page + 1, limit: 5 } })
      setRecords((prev) => [...prev, ...res.data.data.records])
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(errorMessage(err, 'Không tải thêm được sổ tay chăm sóc.'))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Modal title="Hồ sơ thú cưng" onClose={onClose} width="max-w-2xl">
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      {!pet && !error && <div className="h-32 bg-gray-100 rounded-lg animate-pulse" aria-busy="true" />}
      {pet && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <PetAvatar pet={pet} size="w-16 h-16" text="text-3xl" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-gray-900 truncate">{pet.name}</p>
              <p className="text-sm text-gray-500">
                {SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ''}
                {pet.status === 'inactive' ? ' · đã ẩn hồ sơ' : ''}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-gray-100 border-y border-gray-100">
            <Row label="Giới tính">{GENDER_LABEL[pet.gender]}</Row>
            <Row label="Tuổi">
              {pet.age_months != null ? formatAge(pet.age_months) : ''}
              {pet.birth_month ? ` (sinh ${formatBirthMonth(pet.birth_month)})` : ''}
            </Row>
            <Row label="Cân nặng">{pet.weight_kg != null ? `${pet.weight_kg} kg` : ''}</Row>
            <Row label="Chủ nuôi">{pet.owner_name}</Row>
            <Row label="Số điện thoại chủ">{pet.owner_phone}</Row>
          </dl>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Lưu ý sức khỏe / tính cách</p>
            <p className="text-sm text-gray-700 bg-amber-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {pet.special_notes || 'Không có lưu ý.'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-red-700 mb-1">Dị ứng</p>
            <p className="text-sm text-gray-700 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{pet.allergies || 'Không ghi nhận.'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Tiêm phòng / tẩy giun</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{pet.vaccination_notes || 'Chưa có ghi chú.'}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Sổ tay chăm sóc</p>
            {records.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có lần chăm sóc nào hoàn tất.</p>
            ) : (
              <div className="space-y-3">
                {records.map((r) => (
                  <CareRecordCard
                    key={r.id}
                    record={r}
                    title={`${formatDate(r.service_date)}${r.service_names ? ` · ${r.service_names}` : ''}`}
                    subtitle={`Mã lịch hẹn ${r.appointment_code}`}
                  />
                ))}
                {pagination.page < pagination.total_pages && (
                  <button type="button" onClick={loadMore} disabled={loadingMore}
                    className="w-full py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    {loadingMore ? 'Đang tải...' : 'Xem thêm'}
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">Chế độ chỉ xem. Chủ nuôi tự cập nhật hồ sơ thú cưng của mình.</p>
        </div>
      )}
    </Modal>
  )
}

export default PetDetailModal
