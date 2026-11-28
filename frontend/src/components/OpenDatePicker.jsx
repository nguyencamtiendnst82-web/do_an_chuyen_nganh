import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { formatDate } from '../utils/appointment'

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/**
 * OpenDatePicker: chỉ cho chọn những ngày spa đã mở lịch (đã xếp ca).
 * Props: value 'YYYY-MM-DD', onChange(date), onLoaded?(dates), accent
 */
const OpenDatePicker = ({ value, onChange, accent = 'pink' }) => {
  const [info, setInfo] = useState(null) // { dates, to }
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    axiosClient.get('/appointments/open-dates')
      .then((res) => {
        if (!alive) return
        const data = res.data.data
        setInfo(data)
        // Ngày đang chọn chưa mở lịch -> tự chuyển sang ngày mở gần nhất
        if (data.dates.length > 0 && !data.dates.includes(value)) onChange(data.dates[0])
      })
      .catch(() => { if (alive) setError('Không tải được lịch làm việc của spa.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>
  if (!info) return <p className="text-sm text-gray-400">Đang tải lịch spa...</p>
  if (info.dates.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600">
        Spa chưa mở lịch đặt hẹn. Vui lòng quay lại sau hoặc liên hệ spa.
      </div>
    )
  }

  const on = accent === 'blue' ? 'bg-pink-600 border-pink-600 text-white' : 'bg-pink-600 border-pink-600 text-white'
  const off = 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
  const last = info.dates[info.dates.length - 1]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {info.dates.map((d) => {
          const [y, m, day] = d.split('-').map(Number)
          const wd = WEEKDAY[new Date(y, m - 1, day).getDay()]
          return (
            <button key={d} type="button" onClick={() => onChange(d)} aria-pressed={d === value}
              className={`px-3 py-2 rounded-lg border text-sm leading-tight ${d === value ? on : off}`}>
              <span className="block text-xs opacity-80">{wd}</span>
              {String(day).padStart(2, '0')}/{String(m).padStart(2, '0')}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">Spa đã mở lịch đến hết ngày {formatDate(last)}. Các ngày khác chưa có lịch làm việc.</p>
    </div>
  )
}

export default OpenDatePicker
