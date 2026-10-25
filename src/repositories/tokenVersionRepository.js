import { pool } from '../config/db.js';

/**
 * Quản lý "phiên bản token" của từng tài khoản.
 * JWT mang theo số phiên bản lúc được cấp; nếu số này khác số hiện tại trong DB
 * (do đã đổi mật khẩu) thì token bị từ chối.
 */
const get = async (userId) => {
  const [rows] = await pool.query('SELECT token_version FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? Number(rows[0].token_version) : 0;
};

const bump = async (userId) => {
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
};

export { get, bump };
export default { get, bump };
