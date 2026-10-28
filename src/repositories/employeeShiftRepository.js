import { pool } from '../config/db.js';

/**
 * Repository tầng dữ liệu cho bảng employee_shifts
 */

const findById = async (id, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT es.*, 
            s.shift_name, s.start_time, s.end_time, s.description AS shift_description,
            e.user_id, e.specialty,
            u.full_name, u.email, u.phone, u.avatar_url
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     JOIN employees e ON es.employee_id = e.id
     JOIN users u ON e.user_id = u.id
     WHERE es.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const findByRange = async ({ from, to, employeeId = null }) => {
  const conditions = ['es.work_date >= ?', 'es.work_date <= ?'];
  const params = [from, to];

  if (employeeId) {
    conditions.push('es.employee_id = ?');
    params.push(employeeId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT es.id, es.employee_id, es.shift_id, es.work_date, es.status, es.notes, es.created_at,
            s.shift_name, s.start_time, s.end_time, s.description AS shift_description,
            e.user_id, e.specialty,
            u.full_name, u.email, u.phone, u.avatar_url
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     JOIN employees e ON es.employee_id = e.id
     JOIN users u ON e.user_id = u.id
     ${whereClause}
     ORDER BY es.work_date ASC, s.start_time ASC, u.full_name ASC`,
    params
  );

  return rows;
};

const findByEmployeeAndDate = async (employeeId, workDate, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT es.*, s.shift_name, s.start_time, s.end_time
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.employee_id = ? AND es.work_date = ?`,
    [employeeId, workDate]
  );
  return rows;
};

const create = async ({ employee_id, shift_id, work_date, status = 'scheduled', notes = null }, conn = null) => {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO employee_shifts (employee_id, shift_id, work_date, status, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [employee_id, shift_id, work_date, status, notes]
  );
  return result.insertId;
};

const deleteById = async (id, conn = null) => {
  const db = conn || pool;
  const [result] = await db.query('DELETE FROM employee_shifts WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

const countAppointmentsForEmployeeShift = async (employeeShiftId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM appointments a
     JOIN employee_shifts es ON a.employee_id = es.employee_id AND a.appointment_date = es.work_date
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.id = ?
       AND a.status NOT IN ('cancelled', 'completed')
       AND a.start_time < s.end_time AND a.end_time > s.start_time`,
    [employeeShiftId]
  );
  return rows[0].total;
};

export {
  findById,
  findByRange,
  findByEmployeeAndDate,
  create,
  deleteById,
  countAppointmentsForEmployeeShift,
};

export default {
  findById,
  findByRange,
  findByEmployeeAndDate,
  create,
  deleteById,
  countAppointmentsForEmployeeShift,
};

