export const formatVND = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0)

export const SPECIES_LABEL = { dog: 'Chó', cat: 'Mèo', other: 'Khác' }
export const GENDER_LABEL = { male: 'Đực', female: 'Cái', unknown: 'Chưa rõ' }
export const SPECIES_ICON = { dog: '🐶', cat: '🐱', other: '🐾' }

/** 18 → "1 năm 6 tháng", 5 → "5 tháng" */
export const formatAge = (months) => {
  if (months === null || months === undefined) return 'Chưa rõ'
  if (months < 12) return `${months} tháng`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? `${years} năm ${rest} tháng` : `${years} năm`
}

/** Lấy thông báo lỗi từ phản hồi của server */
export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback

/** Đổi mảng lỗi 422 { field, message } thành object { field: message } */
export const mapFieldErrors = (err) => {
  const list = err?.response?.data?.errors
  if (err?.response?.status !== 422 || !Array.isArray(list)) return null
  const mapped = {}
  list.forEach(({ field, message }) => { if (field) mapped[field] = message })
  return Object.keys(mapped).length > 0 ? mapped : null
}

/** '2025-03' → '03/2025' */
export const formatBirthMonth = (ym) => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ''
  const [y, m] = ym.split('-')
  return `${m}/${y}`
}

/** Tháng hiện tại dạng 'YYYY-MM' (dùng cho thuộc tính max của ô chọn tháng) */
export const currentYearMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Tuổi (tháng) từ 'YYYY-MM' — chỉ để xem trước trong form; server mới là nơi tính chính thức */
export const ageFromBirthMonth = (ym) => {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) return null
  const [y, m] = ym.split('-').map(Number)
  const now = new Date()
  return Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m))
}

/** Lỗi tải ảnh: ưu tiên thông báo 422 theo trường, nếu không thì thông báo chung */
export const uploadErrorMessage = (err, fallback) => {
  const list = err?.response?.data?.errors
  if (Array.isArray(list) && list[0]?.message) return list[0].message
  return err?.response?.data?.message || fallback
}
