import { pool } from '../config/db.js';

/**
 * Repository tầng dữ liệu cho bảng shifts
 */

const findAll = async ({ includeInactive = true } = {}) => {
  let query = 'SELECT * FROM shifts';
  const params = [];

  if (!includeInactive) {
    query += ' WHERE is_active = TRUE';
  }

  query += ' ORDER BY start_time ASC';

  const [rows] = await pool.query(query, params);
  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
  }));
};

const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM shifts WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return null;
  return {
    ...rows[0],
    is_active: Boolean(rows[0].is_active),
  };
};

const findByName = async (shiftName, excludeId = null) => {
  let query = 'SELECT * FROM shifts WHERE LOWER(shift_name) = LOWER(?)';
  const params = [shiftName.trim()];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  query += ' LIMIT 1';
  const [rows] = await pool.query(query, params);
  return rows[0] || null;
};

const create = async ({ shift_name, start_time, end_time, description = null, is_active = true }) => {
  const [result] = await pool.query(
    `INSERT INTO shifts (shift_name, start_time, end_time, description, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [shift_name.trim(), start_time, end_time, description, is_active ? 1 : 0]
  );
  return result.insertId;
};

const update = async (id, fields) => {
  const allowed = ['shift_name', 'start_time', 'end_time', 'description', 'is_active'];
  const setClauses = [];
  const values = [];

  for (const field of allowed) {
    if (fields[field] !== undefined) {
      setClauses.push(`\`${field}\` = ?`);
      if (field === 'is_active') {
        values.push(fields[field] ? 1 : 0);
      } else if (typeof fields[field] === 'string') {
        values.push(fields[field].trim());
      } else {
        values.push(fields[field]);
      }
    }
  }

  if (setClauses.length === 0) return false;

  values.push(id);
  const [result] = await pool.query(`UPDATE shifts SET ${setClauses.join(', ')} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM shifts WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

const countAssignedEmployees = async (shiftId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM employee_shifts WHERE shift_id = ?',
    [shiftId]
  );
  return rows[0].total;
};

const countActiveFutureAppointments = async (shiftId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM appointments a
     JOIN employee_shifts es ON a.employee_id = es.employee_id AND a.appointment_date = es.work_date
     JOIN shifts s ON es.shift_id = s.id
     WHERE s.id = ?
       AND a.status NOT IN ('cancelled', 'completed')
       AND (a.appointment_date > CURDATE() OR (a.appointment_date = CURDATE() AND a.end_time > CURTIME()))
       AND a.start_time < s.end_time AND a.end_time > s.start_time`,
    [shiftId]
  );
  return rows[0].total;
};

export {
  findAll,
  findById,
  findByName,
  create,
  update,
  deleteById,
  countAssignedEmployees,
  countActiveFutureAppointments,
};

export default {
  findAll,
  findById,
  findByName,
  create,
  update,
  deleteById,
  countAssignedEmployees,
  countActiveFutureAppointments,
};

