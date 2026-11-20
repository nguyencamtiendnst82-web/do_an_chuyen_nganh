import { pool } from '../config/db.js';

const SELECT = `
  SELECT r.id, r.appointment_id, r.request_type, r.proposed_employee_id, r.proposed_date, r.proposed_start_time,
         r.reason, r.status, r.created_by, r.expires_at, r.responded_at, r.created_at,
         u.full_name AS proposed_employee_name
  FROM appointment_change_requests r
  LEFT JOIN employees e ON e.id = r.proposed_employee_id
  LEFT JOIN users u ON u.id = e.user_id`;

export const create = async (data) => {
  const [res] = await pool.query(
    `INSERT INTO appointment_change_requests
       (appointment_id, request_type, proposed_employee_id, proposed_date, proposed_start_time, reason, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.appointment_id, data.request_type, data.proposed_employee_id ?? null, data.proposed_date ?? null,
      data.proposed_start_time ?? null, data.reason ?? null, data.created_by, data.expires_at]
  );
  return res.insertId;
};

export const findById = async (id) => {
  const [rows] = await pool.query(`${SELECT} WHERE r.id = ?`, [id]);
  return rows[0] || null;
};

export const findByAppointment = async (appointmentId) => {
  const [rows] = await pool.query(`${SELECT} WHERE r.appointment_id = ? ORDER BY r.id DESC`, [appointmentId]);
  return rows;
};

/** Đánh dấu hết hạn các đề xuất quá hạn của một lịch hẹn */
export const expireOverdue = async (appointmentId) => {
  await pool.query(
    `UPDATE appointment_change_requests SET status = 'expired'
     WHERE appointment_id = ? AND status = 'pending' AND expires_at < NOW()`,
    [appointmentId]
  );
};

/** Chỉ đổi trạng thái khi vẫn đang pending (tránh phản hồi hai lần) */
export const resolveIfPending = async (id, status) => {
  const [res] = await pool.query(
    `UPDATE appointment_change_requests SET status = ?, responded_at = NOW() WHERE id = ? AND status = 'pending'`,
    [status, id]
  );
  return res.affectedRows === 1;
};

export const cancelPendingForAppointment = async (appointmentId) => {
  await pool.query(
    `UPDATE appointment_change_requests SET status = 'cancelled', responded_at = NOW()
     WHERE appointment_id = ? AND status = 'pending'`,
    [appointmentId]
  );
};

export default { create, findById, findByAppointment, expireOverdue, resolveIfPending, cancelPendingForAppointment };
