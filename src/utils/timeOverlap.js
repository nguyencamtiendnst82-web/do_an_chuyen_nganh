/**
 * Chuẩn hóa chuỗi thời gian HH:MM hoặc HH:MM:SS về phút tính từ 00:00
 * @param {string} timeStr - "HH:MM" hoặc "HH:MM:SS"
 * @returns {number} Số phút tính từ 00:00
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

/**
 * Đổi số phút tính từ 00:00 thành chuỗi HH:MM:00
 * @param {number} totalMinutes
 * @returns {string} "HH:MM:00"
 */
export const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

/**
 * Đổi số phút tính từ 00:00 thành chuỗi HH:MM
 * @param {number} totalMinutes
 * @returns {string} "HH:MM"
 */
export const minutesToTimeHM = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Kiểm tra 2 khoảng thời gian [start, end) có chồng giờ (overlap) hay không.
 * Quy ước khoảng nửa mở [start, end): Kề nhau (aEnd === bStart hoặc bEnd === aStart) KHÔNG tính là trùng.
 *
 * @param {string|number} aStart - Giờ bắt đầu A ("HH:MM" hoặc phút)
 * @param {string|number} aEnd - Giờ kết thúc A ("HH:MM" hoặc phút)
 * @param {string|number} bStart - Giờ bắt đầu B ("HH:MM" hoặc phút)
 * @param {string|number} bEnd - Giờ kết thúc B ("HH:MM" hoặc phút)
 * @returns {boolean} true nếu có trùng giờ, false nếu không
 */
export const hasOverlap = (aStart, aEnd, bStart, bEnd) => {
  const a1 = typeof aStart === 'number' ? aStart : timeToMinutes(aStart);
  const a2 = typeof aEnd === 'number' ? aEnd : timeToMinutes(aEnd);
  const b1 = typeof bStart === 'number' ? bStart : timeToMinutes(bStart);
  const b2 = typeof bEnd === 'number' ? bEnd : timeToMinutes(bEnd);

  // max(aStart, bStart) < min(aEnd, bEnd)
  return Math.max(a1, b1) < Math.min(a2, b2);
};

/**
 * Kiểm tra xem khoảng thời gian hẹn [aptStart, aptEnd] có nằm TRỌN vẹn trong ca làm việc [shiftStart, shiftEnd] hay không.
 * @param {string} aptStart
 * @param {string} aptEnd
 * @param {string} shiftStart
 * @param {string} shiftEnd
 * @returns {boolean}
 */
export const isFullyInsideShift = (aptStart, aptEnd, shiftStart, shiftEnd) => {
  const a1 = timeToMinutes(aptStart);
  const a2 = timeToMinutes(aptEnd);
  const s1 = timeToMinutes(shiftStart);
  const s2 = timeToMinutes(shiftEnd);

  return a1 >= s1 && a2 <= s2;
};

export default {
  timeToMinutes,
  minutesToTime,
  minutesToTimeHM,
  hasOverlap,
  isFullyInsideShift,
};

