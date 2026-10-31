import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import PhotoPicker from './PhotoPicker'
import { useToast } from './Feedback'
import { errorMessage, mapFieldErrors } from '../utils/format'
import { formatDate, hm } from '../utils/appointment'

const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * CareStepModal: form tiếp nhận (mode="checkin") hoặc hoàn tất (mode="complete") một lịch hẹn.
 * - Tiếp nhận: tình trạng ban đầu (ve rận, trầy xước, nấm...) + ảnh trước khi làm (không bắt buộc).
 * - Hoàn tất: ghi chú quá trình thực hiện (bắt buộc) + lời khuyên + ảnh sau khi làm.
 * Bên dưới có vài lần chăm sóc gần nhất của bé để nhân viên tham khảo.
 */
const CareStepModal = ({ appointment, mode, onClose, onDone }) => {
  const toast = useToast()
  const isCheckIn = mode === 'checkin'
  const [notes, setNotes] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    axiosClient
      .get(`/pets/${appointment.pet_id}/care-history`, { params: { limit: 3 } })
      .then((res) => setHistory(res.data.data.records.filter((r) => r.appointment_id !== appointment.id)))
      .catch(() => {})
  }, [appointment.pet_id, appointment.id])

  const submit = async (e) => {
    e.preventDefault()
    if (!isCheckIn && notes.trim().length < 3) {
      setFieldErrors({ treatment_notes: 'Vui lòng nhập ghi chú quá trình thực hiện (ít nhất 3 ký tự).' })
      return
    }
    setSaving(true)
    setError('')
    setFieldErrors({})
    try {
      const fd = new FormData()
      if (isCheckIn) {
        if (notes.trim()) fd.append('initialHealthNotes', notes.trim())
        if (photo) fd.append('photo_before', photo)
      } else {
        fd.append('treatmentNotes', notes.trim())
        if (recommendations.trim()) fd.append('recommendations', recommendations.trim())
        if (photo) fd.append('photo_after', photo)
      }
      await axiosClient.patch(`/appointments/${appointment.id}/${isCheckIn ? 'check-in' : 'complete'}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(
        isCheckIn
          ? `Đã tiếp nhận ${appointment.pet_name}.`
          : `Đã hoàn tất lịch ${appointment.appointment_code}.`
      )
      onDone()
    } catch (err) {
      const fields = mapFieldErrors(err)
      if (fields) setFieldErrors(fields)
      else setError(errorMessage(err, 'Không thể lưu. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const photoError = fieldErrors.photo_before || fieldErrors.photo_after || fieldErrors.photo
  const notesError = fieldErrors.initial_health_notes || fieldErrors.treatment_notes

  return (
    <Modal title={isCheckIn ? 'Tiếp nhận thú cưng' : 'Hoàn tất lịch hẹn'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          <strong>{appointment.pet_name}</strong> · {appointment.customer_name} · {hm(appointment.start_time)} ngày{' '}
          {formatDate(appointment.appointment_date)}
        </p>

        <div>
          <label htmlFor="care-notes" className="block text-sm font-medium text-gray-700 mb-1">
            {isCheckIn ? 'Tình trạng khi tiếp nhận' : 'Quá trình thực hiện'}
            {!isCheckIn && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            id="care-notes" rows={3} maxLength={2000} value={notes} autoFocus
            onChange={(e) => { setNotes(e.target.value); setFieldErrors({}) }}
            placeholder={isCheckIn ? 'Ví dụ: có ve ở tai, da hơi đỏ, tính khí nhút nhát...' : 'Ví dụ: bé hợp tác, đã tắm sấy và gỡ rối lông...'}
            className={`${inputClass} ${notesError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {notesError && <p className="mt-1 text-xs text-red-600" role="alert">{notesError}</p>}
        </div>

        {!isCheckIn && (
          <div>
            <label htmlFor="care-reco" className="block text-sm font-medium text-gray-700 mb-1">Lời khuyên chăm sóc tại nhà</label>
            <textarea
              id="care-reco" rows={2} maxLength={2000} value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Ví dụ: chải lông mỗi ngày, hạn chế tắm trong 1 tuần..."
              className={`${inputClass} border-gray-300`}
            />
          </div>
        )}

        <div>
          <PhotoPicker
            label={isCheckIn ? 'Ảnh trước khi làm (không bắt buộc)' : 'Ảnh sau khi làm (không bắt buộc)'}
            currentUrl={null} file={photo} onFile={setPhoto} removed={false} onRemove={() => {}}
            fallback="📷" shape="square"
          />
          {photoError && <p className="mt-1 text-xs text-red-600" role="alert">{photoError}</p>}
        </div>

        {history.length > 0 && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Những lần chăm sóc gần đây</p>
            <ul className="space-y-1.5">
              {history.map((r) => (
                <li key={r.id} className="text-sm text-gray-700">
                  <span className="font-medium">{formatDate(r.service_date)}</span>
                  {r.service_names ? ` · ${r.service_names}` : ''}
                  {(r.treatment_notes || r.initial_health_notes) && (
                    <span className="block text-xs text-gray-500 line-clamp-2">{r.treatment_notes || r.initial_health_notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Đóng</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Đang lưu...' : isCheckIn ? 'Tiếp nhận' : 'Hoàn tất'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default CareStepModal
