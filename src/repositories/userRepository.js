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
  } = userData;
  const [result] = await db.query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash, address, gender, birth_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [role_id, full_name, email, phone, password_hash, address, gender, birth_year]
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
            r.role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
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

export { findByEmail, findByPhone, findByEmailOrPhone, findById, create, update, changePassword, updateStatus, findAll, countAll };
export default { findByEmail, findByPhone, findByEmailOrPhone, findById, create, update, changePassword, updateStatus, findAll, countAll };
