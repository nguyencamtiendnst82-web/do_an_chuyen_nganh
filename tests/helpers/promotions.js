import { pool } from '../../src/config/db.js';

/**
 * Tạm tắt các khuyến mãi đang bật trong DB để test hóa đơn cho kết quả ổn định
 * (khuyến mãi thật trong DB phát triển sẽ tự áp vào hóa đơn test). Trả về danh sách id để bật lại.
 */
export const suspendActivePromotions = async () => {
  const [rows] = await pool.query('SELECT id FROM promotions WHERE is_active = TRUE');
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) await pool.query('UPDATE promotions SET is_active = FALSE WHERE id IN (?)', [ids]);
  return ids;
};

export const restorePromotions = async (ids = []) => {
  if (ids.length > 0) await pool.query('UPDATE promotions SET is_active = TRUE WHERE id IN (?)', [ids]);
};
