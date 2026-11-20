import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import { useToast } from './Feedback'
import { errorMessage } from '../utils/format'
import { formatDate, hm } from '../utils/appointment'

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export const REQUEST_STATUS_LABEL = {
  pending: 'Chờ khách phản hồi',
  accepted: 'Khách đã đồng ý',
  declined: 'Khách không đồng ý',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
}

/** Mô tả ngắn một đề xuất */
export const describeRequest = (r) =>
  r.request_type === 'handover'
    ? `Chuyển cho ${r.proposed_employee_name || 'nhân viên khác'} phụ trách`
    : `Dời sang ${hm(r.proposed_start_time)} ${formatDate(String(r.proposed_date).slice(0, 10))}`

/**
 * Nhân viên phụ trách báo bận đột xuất: đề xuất chuyển nhân viên khác hoặc dời lịch.
 * Lịch hẹn chỉ thay đổi sau khi khách đồng ý. Khách từ chối chuyển nhân viên -> đề xuất dời lịch;
 * khách từ chối dời lịch -> hủy lịch (nút Hủy lịch có sẵn) và báo khách.
 */
const ChangeRequestModal = ({ appointment, onClose, onDone }) => {
  const toast = useToast()
  const [employees, setEmployees] = useState([])
  const [history, setHistory] = useState([])
  const [type, setType] = useState('handover')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadHistory = () => axiosClient.get(`/appointments/${appointment.id}/change-requests`)
    .then((res) => setHistory(res.data.data.requests)).catch(() => {})

  useEffect(() => {
    axiosClient.get('/employees').then((res) => {
      const list = res.data.data.employees || res.data.data || []
      setEmployees(list.filter((e) => e.id !== appointment.employee_record_id && e.id !== appointment.employee_id))
    }).catch(() => {})
    loadHistory()
  }, [])

  const pending = history.find((r) => r.status === 'pending')
  const lastDeclinedHandover = history[0]?.status === 'declined' && history[0].request_type === 'handover'
  const lastDeclinedReschedule = history[0]?.status === 'declined' && history[0].request_type === 'reschedule'

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = { request_type: type, reason: reason.trim() || undefined }
      if (type === 'handover') body.employee_id = Number(employeeId)
      else { body.appointment_date = date; body.start_time = time }
      await axiosClient.post(`/appointments/${appointment.id}/change-requests`, body)
      toast.success('Đã gửi đề xuất cho khách hàng.')
      await loadHistory()
      onDone?.()
    } catch (err) {
      setError(errorMessage(err, 'Không gửi được đề xuất.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Báo bận – lịch ${appointment.appointment_code}`} onClose={onClose}>
      <div className="space-y-4">
        {history.length > 0 && (
          <ul className="text-sm space-y-1 bg-gray-50 rounded-lg p-3">
            {history.slice(0, 5).map((r) => (
              <li key={r.id}><span className="font-medium">{describeRequest(r)}</span> – {REQUEST_STATUS_LABEL[r.status]}</li>
            ))}
          </ul>
        )}
        {lastDeclinedHandover && <p className="text-sm text-amber-700">Khách không đồng ý đổi nhân viên. Hãy đề xuất dời lịch.</p>}
        {lastDeclinedReschedule && <p className="text-sm text-red-700">Khách không đồng ý dời lịch. Nếu không còn nhân viên phụ trách được, hãy dùng nút "Hủy lịch" để báo khách.</p>}

        {pending ? (
          <p className="text-sm text-gray-600">Đang chờ khách phản hồi đề xuất mới nhất. Chỉ gửi được đề xuất khác sau khi khách trả lời hoặc đề xuất hết hạn.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={type === 'handover'} onChange={() => setType('handover')} /> Chuyển nhân viên khác</label>
              <label className="flex items-center gap-2"><input type="radio" checked={type === 'reschedule'} onChange={() => setType('reschedule')} /> Dời lịch</label>
            </div>
            {type === 'handover' ? (
              <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={input} aria-label="Nhân viên thay thế">
                <option value="">Chọn nhân viên thay thế...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            ) : (
              <div className="flex gap-2">
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Ngày mới" />
                <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={input} aria-label="Giờ mới" />
              </div>
            )}
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Lý do (hiển thị cho khách)" className={input} />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Đóng</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Đang gửi...' : 'Gửi đề xuất cho khách'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

export default ChangeRequestModal
