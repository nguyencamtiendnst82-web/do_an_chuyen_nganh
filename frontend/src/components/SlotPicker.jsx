import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { errorMessage } from '../utils/format'

const ACCENT = {
  pink: { on: 'bg-pink-600 text-white border-pink-600', off: 'bg-white text-gray-700 border-gray-300 hover:border-pink-400 hover:bg-pink-50' },
  blue: { on: 'bg-blue-600 text-white border-blue-600', off: 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50' },
}

/**
 * SlotPicker: lưới khung giờ còn trống của một ngày.
 * - date 'YYYY-MM-DD', serviceIds [id...] → gọi GET /appointments/availability
 * - employeeId (tuỳ chọn): chỉ xem giờ trống của một nhân viên
 * - value = startTime đang chọn ('HH:MM'); onChange(slot) với slot = { startTime, endTime, availableEmployees }
 * - refreshKey: đổi giá trị này để tải lại (ví dụ sau khi đặt lịch bị trùng)
 */
const SlotPicker = ({ date, serviceIds, employeeId, value, onChange, accent = 'pink', refreshKey = 0 }) => {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const style = ACCENT[accent] || ACCENT.pink
  const idsKey = serviceIds.join(',')

  useEffect(() => {
    if (!date || !idsKey) { setSlots([]); return undefined }
    let cancelled = false
    setLoading(true)
    setError('')
    axiosClient
      .get('/appointments/availability', { params: { date, serviceIds: idsKey, employeeId: employeeId || undefined } })
      .then((res) => { if (!cancelled) setSlots(res.data.data) })
      .catch((err) => { if (!cancelled) { setSlots([]); setError(errorMessage(err, 'Không tải được khung giờ trống.')) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [date, idsKey, employeeId, refreshKey])

  if (!date) return <p className="text-sm text-gray-500">Hãy chọn ngày trước.</p>
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-busy="true" aria-label="Đang tải khung giờ">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-200 animate-pulse" />)}
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>
  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-4 py-3">
        Không còn khung giờ trống trong ngày này. Vui lòng chọn ngày khác.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="listbox" aria-label="Khung giờ trống">
      {slots.map((s) => (
        <button key={s.startTime} type="button" role="option" aria-selected={value === s.startTime}
          onClick={() => onChange(s)}
          className={`px-2 py-2 rounded-lg border text-sm font-medium transition-colors ${value === s.startTime ? style.on : style.off}`}>
          {s.startTime}
          <span className="block text-[11px] font-normal opacity-70">đến {s.endTime}</span>
        </button>
      ))}
    </div>
  )
}

export default SlotPicker
