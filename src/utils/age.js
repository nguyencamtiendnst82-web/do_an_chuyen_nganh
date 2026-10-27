/**
 * Tính tuổi (theo tháng) từ "tháng sinh" dạng YYYY-MM so với thời điểm hiện tại.
 * Ví dụ: sinh 2025-03, hôm nay 2026-10 → 19 tháng.
 */
const ageInMonths = (yearMonth, now = new Date()) => {
  if (typeof yearMonth !== 'string' || !/^\d{4}-\d{2}/.test(yearMonth)) return null;
  const [year, month] = yearMonth.split('-').map(Number);
  const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  return Math.max(0, diff);
};

/** Chuỗi YYYY-MM của tháng hiện tại */
const currentYearMonth = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export { ageInMonths, currentYearMonth };
export default { ageInMonths, currentYearMonth };
