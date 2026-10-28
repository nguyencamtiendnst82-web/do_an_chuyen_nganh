import { pool } from '../config/db.js';

/**
 * Repository tầng dữ liệu cho bảng employees
 */

/**
 * Tạo bản ghi employee (phải nằm trong transaction)
 * @param {number} userId - ID của user vừa tạo
 * @param {object} employeeData - { specialty, experience_years, hire_date }
 * @param {object} conn - MySQL connection đang trong transaction
 */
const create = async (userId, employeeData, conn) => {
  const { specialty = null, experience_years = 1.0, hire_date } = employeeData;
  const [result] = await conn.query(
    `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [userId, specialty, experience_years, hire_date]
  );
  return result.insertId;
};

/**
 * Tìm employee theo user_id
 */
const findByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT e.*, u.full_name, u.email, u.phone, u.avatar_url, u.status AS user_status,
            u.gender, u.birth_year, u.address
     FROM employees e
     JOIN users u ON e.user_id = u.id
     WHERE e.user_id = ?
     LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    experience_years: row.experience_years !== null ? Number(row.experience_years) : null,
  };
};

/**
 * Tìm employee theo id (khóa chính bảng employees)
 */
const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT e.*, u.full_name, u.email, u.phone, u.avatar_url, u.status AS user_status,
            u.gender, u.birth_year, u.address
     FROM employees e
     JOIN users u ON e.user_id = u.id
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    experience_years: row.experience_years !== null ? Number(row.experience_years) : null,
  };
};

/**
 * Cập nhật thông tin nhân viên theo user_id
 */
const updateByUserId = async (userId, fields) => {
  const allowedFields = ['specialty', 'experience_years', 'hire_date', 'status'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      setClauses.push(`\`${field}\` = ?`);
      values.push(fields[field]);
    }
  }

  if (setClauses.length === 0) return false;

  values.push(userId);
  const [result] = await pool.query(
    `UPDATE employees SET ${setClauses.join(', ')} WHERE user_id = ?`,
    values
  );
  return result.affectedRows > 0;
};

/**
 * Cập nhật thông tin nhân viên theo employee id
 */
const updateById = async (id, fields) => {
  const allowedFields = ['specialty', 'experience_years', 'hire_date', 'status'];
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
    `UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
  return result.affectedRows > 0;
};

/**
 * Lấy danh sách nhân viên:
 * - Public / Khách: chỉ nhân viên đang hoạt động (users.status='active' AND employees.status='active')
 * - Admin (scope=admin): xem cả người đã nghỉ, có bộ lọc và tìm kiếm
 */
const findAll = async ({ scope = 'public', status, search } = {}) => {
  const conditions = [];
  const params = [];

  if (scope !== 'admin') {
    conditions.push("u.status = 'active'");
    conditions.push("e.status = 'active'");
  } else {
    if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    }
  }

  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR e.specialty LIKE ?)');
    const likeVal = `%${search}%`;
    params.push(likeVal, likeVal, likeVal, likeVal);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT e.id, e.user_id, e.specialty, e.experience_years, e.hire_date, e.status,
            e.created_at, e.updated_at,
            u.full_name, u.email, u.phone, u.avatar_url, u.status AS user_status,
            u.gender, u.birth_year, u.address
     FROM employees e
     JOIN users u ON e.user_id = u.id
     ${whereClause}
     ORDER BY e.status ASC, u.full_name ASC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    experience_years: r.experience_years !== null ? Number(r.experience_years) : null,
  }));
};

export { create, findByUserId, findById, updateByUserId, updateById, findAll };
export default { create, findByUserId, findById, updateByUserId, updateById, findAll };
