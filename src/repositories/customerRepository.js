import { pool } from '../config/db.js';

const PHONE_DIGITS = `REPLACE(REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '.', ''), '-', ''), '+84', '0')`;
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

/**
 * Tìm khách hàng đang hoạt động theo tên / số điện thoại / email (cho ô chọn khách của nhân viên).
 * - Nhiều từ: mọi từ đều phải khớp (tên có thể gõ thiếu/đảo từ), không phân biệt hoa thường và dấu
 * - Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch ngang; +84 và 0 coi như nhau
 */
const search = async ({ keyword, limit = 10 }) => {
  const conditions = [`r.role_name = 'customer'`, `u.status = 'active'`];
  const params = [];

  const words = (keyword || '').split(/\s+/).filter(Boolean).slice(0, 5);
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    const clauses = ['u.full_name LIKE ?', 'u.email LIKE ?', 'u.phone LIKE ?'];
    params.push(like, like, like);

    const digits = word.replace(/[\s.\-]/g, '').replace(/^\+84/, '0');
    if (/^\d{3,}$/.test(digits)) {
      clauses.push(`${PHONE_DIGITS} LIKE ?`);
      params.push(`%${escapeLike(digits)}%`);
    }
    conditions.push(`(${clauses.join(' OR ')})`);
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.phone, u.email
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY u.full_name ASC
     LIMIT ?`,
    [...params, limit]
  );
  return rows;
};

export { search };
export default { search };
