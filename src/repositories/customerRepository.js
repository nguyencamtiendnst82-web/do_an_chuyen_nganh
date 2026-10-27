import { pool } from '../config/db.js';

/** role_id 3 = customer (khớp dữ liệu seed). Tìm khách hàng đang hoạt động theo tên / số điện thoại / email (cho ô chọn khách của nhân viên) */
const search = async ({ keyword, limit = 10 }) => {
  const conditions = ['u.role_id = 3', `u.status = 'active'`];
  const params = [];
  if (keyword) {
    conditions.push('(u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.phone, u.email
     FROM users u
     WHERE ${conditions.join(' AND ')}
     ORDER BY u.full_name ASC
     LIMIT ?`,
    [...params, limit]
  );
  return rows;
};

export { search };
export default { search };
