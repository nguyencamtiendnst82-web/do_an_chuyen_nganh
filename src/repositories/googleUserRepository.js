import { pool } from '../config/db.js';

/** Truy vấn riêng cho đăng nhập Google (bảng users, cột google_id) */
const findIdByGoogleId = async (googleId) => {
  const [rows] = await pool.query('SELECT id FROM users WHERE google_id = ? LIMIT 1', [googleId]);
  return rows[0]?.id ?? null;
};

const getGoogleId = async (userId) => {
  const [rows] = await pool.query('SELECT google_id FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0]?.google_id ?? null;
};

const link = async (userId, googleId) => {
  const [result] = await pool.query('UPDATE users SET google_id = ? WHERE id = ? AND google_id IS NULL', [googleId, userId]);
  return result.affectedRows > 0;
};

/** Tạo khách hàng mới từ Google: chưa có số điện thoại, mật khẩu là chuỗi ngẫu nhiên không ai biết */
const createCustomer = async ({ roleId, fullName, email, passwordHash, googleId }) => {
  const [result] = await pool.query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash, google_id) VALUES (?, ?, ?, NULL, ?, ?)`,
    [roleId, fullName, email, passwordHash, googleId]
  );
  return result.insertId;
};

export { findIdByGoogleId, getGoogleId, link, createCustomer };
export default { findIdByGoogleId, getGoogleId, link, createCustomer };
