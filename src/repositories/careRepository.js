import { pool } from '../config/db.js';

/** Chuyển trạng thái lịch hẹn có điều kiện (compare-and-set): chỉ đổi nếu đang đúng trạng thái `from` */
export const transitionStatus = async (appointmentId, from, to, conn = null) => {
  const db = conn || pool;
  const [result] = await db.query(
    'UPDATE appointments SET status = ? WHERE id = ? AND status = ?',
    [to, appointmentId, from]
  );
  return result.affectedRows > 0;
};

/** Hồ sơ chăm sóc của một lịch hẹn (kèm tên nhân viên thực hiện) */
export const findByAppointmentId = async (appointmentId, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT c.id, c.pet_id, c.appointment_id, c.employee_id, c.service_date,
            c.initial_health_notes, c.treatment_notes, c.recommendations,
            c.photo_before_url, c.photo_after_url, c.created_at,
            u.full_name AS employee_name
     FROM pet_care_history c
     JOIN employees e ON c.employee_id = e.id
     JOIN users u ON e.user_id = u.id
     WHERE c.appointment_id = ?
     LIMIT 1`,
    [appointmentId]
  );
  return rows[0] || null;
};

/** Ghi nhận lúc tiếp nhận (tạo mới hoặc cập nhật nếu đã có; không xóa ảnh cũ khi không gửi ảnh mới) */
export const saveCheckIn = async (conn, data) => {
  await conn.query(
    `INSERT INTO pet_care_history
       (pet_id, appointment_id, employee_id, service_date, initial_health_notes, photo_before_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       employee_id = VALUES(employee_id),
       initial_health_notes = VALUES(initial_health_notes),
       photo_before_url = COALESCE(VALUES(photo_before_url), photo_before_url)`,
    [
      data.pet_id,
      data.appointment_id,
      data.employee_id,
      data.service_date,
      data.initial_health_notes ?? null,
      data.photo_before_url ?? null,
    ]
  );
};

/** Ghi nhận lúc hoàn tất (tạo mới nếu lịch này chưa có hồ sơ tiếp nhận) */
export const saveCompletion = async (conn, data) => {
  await conn.query(
    `INSERT INTO pet_care_history
       (pet_id, appointment_id, employee_id, service_date, treatment_notes, recommendations, photo_after_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       employee_id = VALUES(employee_id),
       treatment_notes = VALUES(treatment_notes),
       recommendations = VALUES(recommendations),
       photo_after_url = COALESCE(VALUES(photo_after_url), photo_after_url)`,
    [
      data.pet_id,
      data.appointment_id,
      data.employee_id,
      data.service_date,
      data.treatment_notes ?? null,
      data.recommendations ?? null,
      data.photo_after_url ?? null,
    ]
  );
};

/** Lịch sử chăm sóc của một thú cưng (mới nhất trước). onlyCompleted: chỉ các lịch đã hoàn tất (dành cho khách) */
export const listByPet = async (petId, { page = 1, limit = 10, onlyCompleted = false } = {}) => {
  const offset = (page - 1) * limit;
  const statusClause = onlyCompleted ? "AND a.status = 'completed'" : '';

  const [rows] = await pool.query(
    `SELECT c.id, c.appointment_id, c.service_date,
            c.initial_health_notes, c.treatment_notes, c.recommendations,
            c.photo_before_url, c.photo_after_url,
            a.appointment_code, a.status AS appointment_status,
            u.full_name AS employee_name,
            (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ')
               FROM appointment_details ad
               JOIN services s ON s.id = ad.service_id
              WHERE ad.appointment_id = c.appointment_id) AS service_names
     FROM pet_care_history c
     JOIN appointments a ON a.id = c.appointment_id
     JOIN employees e ON e.id = c.employee_id
     JOIN users u ON u.id = e.user_id
     WHERE c.pet_id = ? ${statusClause}
     ORDER BY c.service_date DESC, c.id DESC
     LIMIT ? OFFSET ?`,
    [petId, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM pet_care_history c
     JOIN appointments a ON a.id = c.appointment_id
     WHERE c.pet_id = ? ${statusClause}`,
    [petId]
  );

  return { rows, total: countRows[0]?.total || 0 };
};

export default {
  transitionStatus,
  findByAppointmentId,
  saveCheckIn,
  saveCompletion,
  listByPet,
};
