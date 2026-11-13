import { pool } from '../config/db.js';

/**
 * Repository tầng dữ liệu cho bảng users + roles
 * LUÔN dùng prepared statement (placeholder ?)
 */

/**
 * Tìm user theo email (JOIN roles để lấy role_name)
 */
const findByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo số điện thoại
 */
const findByPhone = async (phone) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.phone = ?
     LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo email HOẶC phone (dùng cho đăng nhập linh hoạt)
 */
const findByEmailOrPhone = async (credential) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = ? OR u.phone = ?
     LIMIT 1`,
    [credential, credential]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo ID
 */
const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Tạo user mới
 * @param {object} userData - { role_id, full_name, email, phone, password_hash, address?, gender?, birth_year? }
 * @param {object} conn - connection (nếu đang trong transaction), nếu null thì dùng pool
 */
const create = async (userData, conn = null) => {
  const db = conn || pool;
  const {
    role_id, full_name, email, phone, password_hash,
    address = null, gender = null, birth_year = null,
    email_verified = 0,
  } = userData;
  const [result] = await db.query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash, address, gender, birth_year, email_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [role_id, full_name, email, phone, password_hash, address, gender, birth_year, email_verified ? 1 : 0]
  );
  return result.insertId;
};

/**
 * Cập nhật thông tin hồ sơ user (chỉ các trường được phép)
 * Không cho đổi role_id, email, password_hash
 */
const update = async (id, fields) => {
  // Chỉ cho phép cập nhật các cột này
  const allowedFields = ['full_name', 'phone', 'address', 'avatar_url', 'gender', 'birth_year'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      setClauses.push(`\`${field}\` = ?`);
      values.push(fields[field]);
    }
  }

  if (setClauses.length === 0) return false;

  values.push(id);
  const [result] = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
  return result.affectedRows > 0;
};

/**
 * Cập nhật mật khẩu
 */
const changePassword = async (id, newPasswordHash) => {
  const [result] = await pool.query(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    [newPasswordHash, id]
  );
  return result.affectedRows > 0;
};

/**
 * Cập nhật trạng thái tài khoản
 */
const updateStatus = async (id, status) => {
  const [result] = await pool.query(
    `UPDATE users SET status = ? WHERE id = ?`,
    [status, id]
  );
  return result.affectedRows > 0;
};

/**
 * Lấy danh sách users có phân trang, lọc và tìm kiếm (dành cho Admin)
 * @param {object} filters - { page, limit, role, status, search }
 */
const findAll = async ({ page = 1, limit = 10, role, status, search }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('r.role_name = ?');
    params.push(role);
  }
  if (status) {
    conditions.push('u.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const likeVal = `%${search}%`;
    params.push(likeVal, likeVal, likeVal);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.address, u.gender, u.birth_year, u.avatar_url,
            u.status, u.created_at, u.updated_at,
            r.role_name, r.display_name AS role_display_name,
            e.id AS employee_id, e.specialty, e.experience_years, e.hire_date, e.status AS employee_status
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN employees e ON u.id = e.user_id
     ${whereClause}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows.map((r) => ({
    ...r,
    experience_years: r.experience_years !== null ? Number(r.experience_years) : null,
  }));
};

/**
 * Đếm tổng số users theo filter (để tính total_pages)
 */
const countAll = async ({ role, status, search }) => {
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('r.role_name = ?');
    params.push(role);
  }
  if (status) {
    conditions.push('u.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const likeVal = `%${search}%`;
    params.push(likeVal, likeVal, likeVal);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ${whereClause}`,
    params
  );
  return rows[0].total;
};

const countActiveAdmins = async () => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.role_name = 'admin' AND u.status = 'active'`
  );
  return rows[0].total;
};

/**
 * Lưu mã xác minh email (chỉ lưu băm SHA-256) kèm hạn dùng; mã cũ bị thay thế.
 * Hạn tính ngay trong SQL (NOW() + giờ) để không lệch múi giờ giữa Node và MySQL.
 */
const setEmailVerifyToken = async (userId, tokenHash, ttlHours) => {
  await pool.query(
    `UPDATE users
     SET email_verify_token_hash = ?, email_verify_expires = DATE_ADD(NOW(), INTERVAL ? HOUR)
     WHERE id = ? AND email_verified = 0`,
    [tokenHash, ttlHours, userId]
  );
};

/**
 * Dùng mã xác minh: đánh dấu đã xác minh và xóa mã, trong MỘT câu lệnh nên mã chỉ dùng được một lần.
 * @returns {Promise<number|null>} id user vừa được xác minh, hoặc null nếu mã sai/hết hạn/đã dùng
 */
const consumeEmailVerifyToken = async (tokenHash) => {
  const [rows] = await pool.query(
    `SELECT id FROM users
     WHERE email_verify_token_hash = ? AND email_verify_expires > NOW() AND email_verified = 0
     LIMIT 1`,
    [tokenHash]
  );
  if (rows.length === 0) return null;
  const [result] = await pool.query(
    `UPDATE users
     SET email_verified = 1, email_verify_token_hash = NULL, email_verify_expires = NULL
     WHERE id = ? AND email_verify_token_hash = ? AND email_verify_expires > NOW()`,
    [rows[0].id, tokenHash]
  );
  return result.affectedRows > 0 ? rows[0].id : null;
};

/**
 * Lưu mã đặt lại mật khẩu (chỉ lưu băm SHA-256) kèm hạn dùng; mã cũ bị thay thế.
 * Hạn tính ngay trong SQL (NOW() + phút) để không lệch múi giờ giữa Node và MySQL.
 */
const setPasswordResetToken = async (userId, tokenHash, ttlMinutes) => {
  await pool.query(
    `UPDATE users
     SET password_reset_token_hash = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE)
     WHERE id = ?`,
    [tokenHash, ttlMinutes, userId]
  );
};

/** Tìm tài khoản đang active có mã đặt lại mật khẩu còn hạn (chưa dùng mã) */
const findByPasswordResetToken = async (tokenHash) => {
  const [rows] = await pool.query(
    `SELECT * FROM users
     WHERE password_reset_token_hash = ? AND password_reset_expires > NOW() AND status = 'active'
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

/**
 * Đặt mật khẩu mới bằng mã, trong MỘT câu lệnh nên mã chỉ dùng được một lần:
 * - xóa mã, tăng token_version (mọi JWT cũ mất hiệu lực)
 * - đánh dấu email đã xác minh (người dùng vừa chứng minh đọc được thư gửi tới email đó)
 * @returns {Promise<boolean>} false nếu mã sai/hết hạn/đã dùng
 */
const resetPasswordWithToken = async (tokenHash, newPasswordHash) => {
  const [result] = await pool.query(
    `UPDATE users
     SET password_hash = ?, token_version = token_version + 1, email_verified = 1,
         password_reset_token_hash = NULL, password_reset_expires = NULL
     WHERE password_reset_token_hash = ? AND password_reset_expires > NOW() AND status = 'active'`,
    [newPasswordHash, tokenHash]
  );
  return result.affectedRows > 0;
};

export { findByEmail, findByPhone, findByEmailOrPhone, findById, create, update, changePassword, updateStatus, findAll, countAll, countActiveAdmins, setEmailVerifyToken, consumeEmailVerifyToken, setPasswordResetToken, findByPasswordResetToken, resetPasswordWithToken };
export default { findByEmail, findByPhone, findByEmailOrPhone, findById, create, update, changePassword, updateStatus, findAll, countAll, countActiveAdmins, setEmailVerifyToken, consumeEmailVerifyToken, setPasswordResetToken, findByPasswordResetToken, resetPasswordWithToken };
