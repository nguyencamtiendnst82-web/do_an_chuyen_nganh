/**
 * Tiện ích ngày theo GIỜ ĐỊA PHƯƠNG, chuỗi YYYY-MM-DD.
 * Tránh `new Date().toISOString().slice(0, 10)`: hàm đó trả ngày theo UTC nên với giờ Việt Nam (UTC+7)
 * từ 00:00 đến 07:00 sáng sẽ ra "hôm qua" (sai ngày "Hôm nay", sai tuần hiện tại...).
 */
const pad = (n) => String(n).padStart(2, '0')

/** Ngày hôm nay (giờ máy người dùng) dạng YYYY-MM-DD */
export const localYmd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Ngày theo múi giờ nghiệp vụ Việt Nam dạng YYYY-MM-DD */
export const vietnamYmd = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

const parts = (ymd) => ymd.split('-').map(Number)

/** Cộng/trừ số ngày vào YYYY-MM-DD (không phụ thuộc múi giờ) */
export const addDays = (ymd, days) => {
  const [y, m, d] = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Thứ trong tuần của YYYY-MM-DD: 0 = Chủ nhật ... 6 = Thứ bảy */
export const weekdayOf = (ymd) => {
  const [y, m, d] = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Ngày Thứ hai của tuần chứa ngày đã cho (mặc định: hôm nay) */
export const getMonday = (ymd = localYmd()) => {
  const dow = weekdayOf(ymd)
  return addDays(ymd, dow === 0 ? -6 : 1 - dow)
}

/** YYYY-MM-DD → DD/MM/YYYY */
export const formatDateVN = (ymd) => {
  if (!ymd) return ''
  const [y, m, d] = ymd.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
