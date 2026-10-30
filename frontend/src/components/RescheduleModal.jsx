import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import SlotPicker from './SlotPicker'
import { useToast } from './Feedback'
import { errorMessage } from '../utils/format'
import { todayStr, addDays, formatDate, hm } from '../utils/appointment'

/**
 * RescheduleModal: đổi ngày/giờ lịch hẹn. Cần appointment.details (lấy từ GET /appointments/:id)
 * để biết dịch vụ nào → tính khung giờ trống. Nhân viên cũ được giữ nếu còn rảnh, nếu không
 * thì chọn người rảnh đầu tiên trong khung giờ đó.
 */
const RescheduleModal = ({ appointment, onClose, onDone, accent = 'pink' }) => {
  const toast = useToast()
  const [date, setDate] = useState(appointment.appointment_date.slice(0, 10))
  const [slot, setSlot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const serviceIds = (appointment.details || []).map((d) => d.service_id)
  useEffect(() => { setSlot(null) }, [date])

  const submit = async () => {
    if (!slot) { setError('Vui lòng chọn khung giờ mới.'); return }
    const keep = slot.availableEmployees.find((e) => e.id === appointment.employee_id)
    const employeeId = (keep || slot.availableEmployees[0]).id
    setSaving(true)
    setError('')
    try {
      await axiosClient.patch(`/appointments/${appointment.id}/reschedule`, {
        appointmentDate: date,
        startTime: slot.startTime,
        employeeId,
      })
      toast.success('Đã đổi lịch hẹn.')
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'Không thể đổi lịch hẹn.'))
      if (err?.response?.status === 409) { setSlot(null); setRefreshKey((k) => k + 1) }
    } finally {
      setSaving(false)
    }
  }

  const btn = accent === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-pink-600 hover:bg-pink-700'

  return (
    <Modal title="Đổi lịch hẹn" onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Lịch hiện tại của <strong>{appointment.pet_name}</strong>: {hm(appointment.start_time)} ngày {formatDate(appointment.appointment_date)}.
        </p>
        <div>
          <label htmlFor="rs-date" className="block text-sm font-medium text-gray-700 mb-1">Ngày mới</label>
          <input id="rs-date" type="date" value={date} min={todayStr()} max={addDays(todayStr(), 60)}
            onChange={(e) => { setDate(e.target.value); setError('') }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Giờ mới</p>
          <SlotPicker date={date} serviceIds={serviceIds} value={slot?.startTime} onChange={(s) => { setSlot(s); setError('') }}
            accent={accent} refreshKey={refreshKey} />
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Đóng</button>
          <button type="button" onClick={submit} disabled={saving || !slot}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 ${btn}`}>
            {saving ? 'Đang lưu...' : 'Xác nhận đổi'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default RescheduleModal
