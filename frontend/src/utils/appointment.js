/** Tiện ích cho phân hệ lịch hẹn (ngày dạng 'YYYY-MM-DD', giờ dạng 'HH:MM' hoặc 'HH:MM:SS') */

export const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã tiếp nhận',
  in_progress: 'Đang phục vụ',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
}

export const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  checked_in: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

/** Trạng thái kế tiếp trong quy trình + nhãn nút bấm cho nhân viên */
export const NEXT_ACTION = {
  pending: { status: 'confirmed', label: 'Xác nhận' },
  confirmed: { status: 'checked_in', label: 'Tiếp nhận' },
  checked_in: { status: 'in_progress', label: 'Bắt đầu làm' },
  in_progress: { status: 'completed', label: 'Hoàn tất' },
}

export const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress']

const pad = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' theo giờ địa phương (không dùng toISOString vì bị lệch múi giờ) */
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayStr = () => ymd(new Date())

export const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return ymd(new Date(y, m - 1, d + days))
}

/** '2026-11-05' → '05/11/2026' */
export const formatDate = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return ''
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** '2026-11-05' → 'Thứ Năm, 05/11/2026' */
export const formatDateLong = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return ''
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const weekday = new Date(y, m - 1, d).toLocaleDateString('vi-VN', { weekday: 'long' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${pad(d)}/${pad(m)}/${y}`
}

/** '09:30:00' → '09:30' */
export const hm = (t) => (t ? String(t).slice(0, 5) : '')

/** Số giờ từ bây giờ đến giờ hẹn (âm nếu đã qua) */
export const hoursUntil = (dateStr, time) => {
  if (!dateStr || !time) return 0
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const [hh, mm] = hm(time).split(':').map(Number)
  return (new Date(y, m - 1, d, hh, mm).getTime() - Date.now()) / 3600000
}

/** Khách chỉ được hủy/đổi khi lịch còn pending/confirmed và còn ≥ 2 giờ nữa */
export const customerCanChange = (apt) =>
  ['pending', 'confirmed'].includes(apt.status) && hoursUntil(apt.appointment_date, apt.start_time) >= 2

export const sumDuration = (services) => services.reduce((s, x) => s + (Number(x.duration_minutes) || 0), 0)
export const sumPrice = (services) => services.reduce((s, x) => s + (Number(x.price) || 0), 0)
