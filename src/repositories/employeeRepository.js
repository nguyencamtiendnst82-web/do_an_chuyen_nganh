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
 * Tìm employee theo user_id (để lấy thông tin nhân viên)
 */
const findByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM employees WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Cập nhật thông tin nhân viên (specialty, experience_years)
 */
const updateByUserId = async (userId, fields) => {
  const allowedFields = ['specialty', 'experience_years'];
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

export { create, findByUserId, updateByUserId };
export default { create, findByUserId, updateByUserId };
