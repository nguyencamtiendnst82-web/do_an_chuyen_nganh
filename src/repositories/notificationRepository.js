import { pool } from '../config/db.js';

/** Thêm nhiều thông báo một lượt: rows = [{ user_id, type, payload }] */
export const insertMany = async (rows) => {
  if (!rows.length) return;
  const values = rows.map((r) => [r.user_id, r.type, JSON.stringify(r.payload)]);
  await pool.query('INSERT INTO notifications (user_id, type, payload) VALUES ?', [values]);
};

/** ID các quản trị viên đang hoạt động */
export const findActiveAdminIds = async () => {
  // Khi chạy test (NODE_ENV=test) chỉ báo cho admin do chính bộ test tạo (email test_...),
  // để các lần chạy `npm test` không đổ thông báo rác vào tài khoản admin thật trong DB dev.
  const onlyTestAdmins = process.env.NODE_ENV === 'test' ? `AND u.email LIKE 'test\\_%'` : '';
  const [rows] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
     WHERE r.role_name = 'admin' AND u.status = 'active' ${onlyTestAdmins}`
  );
  return rows.map((r) => r.id);
};

export const findByUser = async (userId, { unreadOnly = false, page = 1, limit = 15 } = {}) => {
  const [rows] = await pool.query(
    `SELECT notification_id AS id, type, payload, is_read, created_at
     FROM notifications
     WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}
     ORDER BY created_at DESC, notification_id DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, (page - 1) * limit]
  );
  return rows;
};

export const countByUser = async (userId, unreadOnly = false) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}`,
    [userId]
  );
  return rows[0].total;
};

/** Chỉ đánh dấu được thông báo của chính mình; trả về true nếu có dòng thuộc user này */
export const markRead = async (id, userId) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [id, userId]);
  const [rows] = await pool.query('SELECT 1 FROM notifications WHERE notification_id = ? AND user_id = ? LIMIT 1', [id, userId]);
  return rows.length > 0;
};

export const markAllRead = async (userId) => {
  const [result] = await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  return result.affectedRows;
};

export default { insertMany, findActiveAdminIds, findByUser, countByUser, markRead, markAllRead };
