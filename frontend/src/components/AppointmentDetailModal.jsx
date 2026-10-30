import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import StatusBadge from './StatusBadge'
import PetAvatar from './PetAvatar'
import { useToast } from './Feedback'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, errorMessage, SPECIES_LABEL } from '../utils/format'
import { formatDateLong, hm } from '../utils/appointment'

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-2 text-sm">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="text-gray-900 text-right">{children}</dd>
  </div>
)

/**
 * AppointmentDetailModal: chi tiết một lịch hẹn (dịch vụ, giá lúc đặt, nhân viên, ghi chú).
 * staffMode = true: hiện thêm SĐT khách và ô ghi chú nội bộ (staff_notes) để nhân viên sửa.
 * renderActions(appointment, reload): vùng nút thao tác do trang cha truyền vào.
 */
const AppointmentDetailModal = ({ id, onClose, staffMode = false, renderActions, onChanged }) => {
  const toast = useToast()
  const { user } = useAuth()
  const [apt, setApt] = useState(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const canEditNotes = !apt || user?.role_name === 'admin' || apt.employee_user_id === user?.id

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/appointments/${id}`)
      setApt(res.data.data)
      setNotes(res.data.data.staff_notes || '')
    } catch (err) {
      setError(errorMessage(err, 'Không tải được chi tiết lịch hẹn.'))
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const reload = async () => { await load(); onChanged?.() }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      // Gửi lại đúng trạng thái hiện tại: server chỉ cập nhật ghi chú
      await axiosClient.patch(`/appointments/${apt.id}/status`, { status: apt.status, staff_notes: notes.trim() })
      toast.success('Đã lưu ghi chú nội bộ.')
      await reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Không lưu được ghi chú.'))
    } finally {
      setSavingNotes(false)
    }
  }

  const total = apt ? apt.details.reduce((s, d) => s + d.price_at_booking, 0) : 0

  return (
    <Modal title="Chi tiết lịch hẹn" onClose={onClose}>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {!apt && !error && <div className="space-y-3" aria-busy="true">{[1, 2, 3, 4].map((i) => <div key={i} className="h-5 bg-gray-200 rounded animate-pulse" />)}</div>}
      {apt && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PetAvatar pet={{ name: apt.pet_name, species: apt.pet_species, avatar_url: apt.pet_avatar }} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{apt.pet_name}</p>
              <p className="text-xs text-gray-500">{SPECIES_LABEL[apt.pet_species] || ''}{apt.pet_breed ? ` · ${apt.pet_breed}` : ''}</p>
            </div>
            <StatusBadge status={apt.status} />
          </div>

          <dl className="divide-y divide-gray-100 border-y border-gray-100">
            <Row label="Mã lịch hẹn"><span className="font-mono">{apt.appointment_code}</span></Row>
            <Row label="Ngày">{formatDateLong(apt.appointment_date)}</Row>
            <Row label="Giờ">{hm(apt.start_time)} – {hm(apt.end_time)}</Row>
            <Row label="Nhân viên">{apt.employee_name || <span className="text-gray-400">Chưa phân công</span>}</Row>
            {staffMode && <Row label="Khách hàng">{apt.customer_name}{apt.customer_phone ? ` · ${apt.customer_phone}` : ''}</Row>}
            {apt.status === 'cancelled' && apt.cancellation_reason && <Row label="Lý do hủy">{apt.cancellation_reason}</Row>}
          </dl>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Dịch vụ đã đặt</p>
            <ul className="space-y-1.5">
              {apt.details.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-800">{d.service_name} <span className="text-gray-400">· {d.duration_minutes} phút</span></span>
                  <span className="text-gray-900 shrink-0">{formatVND(d.price_at_booking)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span>Tạm tính</span><span className="text-pink-600">{formatVND(total)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Giá được chốt tại thời điểm đặt lịch.</p>
          </div>

          {apt.customer_notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Ghi chú của khách</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{apt.customer_notes}</p>
            </div>
          )}

          {staffMode && (
            <div>
              <label htmlFor="staff-notes" className="block text-sm font-medium text-gray-700 mb-1">Ghi chú nội bộ (khách không thấy)</label>
              <textarea id="staff-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)}
                readOnly={!canEditNotes} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50" />
              {canEditNotes && <button type="button" onClick={saveNotes} disabled={savingNotes || notes.trim() === (apt.staff_notes || '')}
                className="mt-2 px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">
                {savingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}
              </button>}
            </div>
          )}

          {renderActions && <div className="flex flex-wrap justify-end gap-2 pt-2">{renderActions(apt, reload)}</div>}
        </div>
      )}
    </Modal>
  )
}

export default AppointmentDetailModal
