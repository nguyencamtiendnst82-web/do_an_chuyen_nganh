import { useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import { useToast } from './Feedback'
import { errorMessage, mapFieldErrors } from '../utils/format'
import { formatDate, hm } from '../utils/appointment'

/** CancelModal: hủy lịch hẹn, bắt buộc nhập lý do (3–500 ký tự). Dùng cho cả khách và nhân viên. */
const CancelModal = ({ appointment, onClose, onDone }) => {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const text = reason.trim()
    if (text.length < 3) { setError('Vui lòng nhập lý do hủy (ít nhất 3 ký tự).'); return }
    setSaving(true)
    setError('')
    try {
      await axiosClient.patch(`/appointments/${appointment.id}/cancel`, { cancellationReason: text })
      toast.success(`Đã hủy lịch ${appointment.appointment_code}.`)
      onDone()
    } catch (err) {
      const fields = mapFieldErrors(err)
      setError(fields?.cancellation_reason || errorMessage(err, 'Không thể hủy lịch hẹn.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Hủy lịch hẹn" onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Lịch <strong>{appointment.appointment_code}</strong> của <strong>{appointment.pet_name}</strong> lúc{' '}
          {hm(appointment.start_time)} ngày {formatDate(appointment.appointment_date)}.
        </p>
        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-1">Lý do hủy</label>
          <textarea id="cancel-reason" rows={3} maxLength={500} value={reason} autoFocus
            onChange={(e) => { setReason(e.target.value); setError('') }}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            placeholder="Ví dụ: Bận đột xuất, đổi sang ngày khác..." />
          {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Giữ lịch</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
            {saving ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default CancelModal
