import { pool } from '../config/db.js';

/**
 * Sinh mã lịch hẹn APT-YYYYMMDD-XXX (XXX tăng dần theo ngày)
 * Thực hiện trong transaction có khóa dòng
 */
export const generateAppointmentCode = async (dateStr, conn = null) => {
  const db = conn || pool;
  const cleanDate = dateStr.replace(/-/g, ''); // 2026-10-28 -> 20261028
  const prefix = `APT-${cleanDate}-`;

  const [rows] = await db.query(
    `SELECT appointment_code FROM appointments 
     WHERE appointment_code LIKE ? 
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastCode = rows[0].appointment_code;
    const parts = lastCode.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const paddedSeq = String(nextSeq).padStart(3, '0');
  return `${prefix}${paddedSeq}`;
};

/**
 * Tạo bản ghi lịch hẹn
 */
export const create = async (data, conn) => {
  const {
    appointment_code,
    customer_id,
    pet_id,
    employee_id,
    appointment_date,
    start_time,
    end_time,
    status = 'pending',
    customer_notes = null,
    staff_notes = null,
  } = data;

  const [result] = await conn.query(
    `INSERT INTO appointments (
       appointment_code, customer_id, pet_id, employee_id,
       appointment_date, start_time, end_time, status,
       customer_notes, staff_notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appointment_code,
      customer_id,
      pet_id,
      employee_id,
      appointment_date,
      start_time,
      end_time,
      status,
      customer_notes,
      staff_notes,
    ]
  );

  return result.insertId;
};

/**
 * Tạo chi tiết dịch vụ cho lịch hẹn (snapshot giá và thời lượng)
 */
export const createDetails = async (appointmentId, details, conn) => {
  if (!details || details.length === 0) return;

  const values = details.map((d) => [
    appointmentId,
    d.service_id,
    d.price_at_booking,
    d.duration_minutes,
  ]);

  await conn.query(
    `INSERT INTO appointment_details (appointment_id, service_id, price_at_booking, duration_minutes)
     VALUES ?`,
    [values]
  );
};

/**
 * Tìm lịch hẹn theo ID kèm thông tin khách hàng, thú cưng, nhân viên
 */
export const findById = async (id, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT a.*,
            u_c.full_name AS customer_name, u_c.email AS customer_email, u_c.phone AS customer_phone, u_c.avatar_url AS customer_avatar,
            p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed, p.avatar_url AS pet_avatar,
            e.id AS employee_record_id, e.user_id AS employee_user_id, e.specialty AS employee_specialty,
            u_e.full_name AS employee_name, u_e.avatar_url AS employee_avatar
     FROM appointments a
     JOIN users u_c ON a.customer_id = u_c.id
     JOIN pets p ON a.pet_id = p.id
     LEFT JOIN employees e ON a.employee_id = e.id
     LEFT JOIN users u_e ON e.user_id = u_e.id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

/**
 * Lấy chi tiết dịch vụ kèm tên dịch vụ
 */
export const findDetailsByAppointmentId = async (appointmentId, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT ad.id, ad.appointment_id, ad.service_id, ad.price_at_booking, ad.duration_minutes,
            s.name AS service_name, s.image_url AS service_image
     FROM appointment_details ad
     JOIN services s ON ad.service_id = s.id
     WHERE ad.appointment_id = ?`,
    [appointmentId]
  );

  return rows.map((r) => ({
    ...r,
    price_at_booking: Number(r.price_at_booking),
  }));
};

/**
 * Khóa dòng các lịch hẹn của nhân viên trong ngày (chống race condition)
 */
export const lockAndGetEmployeeAppointments = async (employeeId, appointmentDate, excludeAppointmentId = null, conn) => {
  let query = `
    SELECT id, employee_id, appointment_date, start_time, end_time, status
    FROM appointments
    WHERE employee_id = ? AND appointment_date = ? AND status != 'cancelled'
  `;
  const params = [employeeId, appointmentDate];

  if (excludeAppointmentId) {
    query += ' AND id != ?';
    params.push(excludeAppointmentId);
  }

  query += ' FOR UPDATE';

  const [rows] = await conn.query(query, params);
  return rows;
};

/**
 * Khóa dòng các lịch hẹn của thú cưng trong ngày (chống 1 pet bị 2 lịch chồng giờ)
 */
export const lockAndGetPetAppointments = async (petId, appointmentDate, excludeAppointmentId = null, conn) => {
  let query = `
    SELECT id, pet_id, appointment_date, start_time, end_time, status
    FROM appointments
    WHERE pet_id = ? AND appointment_date = ? AND status != 'cancelled'
  `;
  const params = [petId, appointmentDate];

  if (excludeAppointmentId) {
    query += ' AND id != ?';
    params.push(excludeAppointmentId);
  }

  query += ' FOR UPDATE';

  const [rows] = await conn.query(query, params);
  return rows;
};

/**
 * Lấy các ca làm việc của nhân viên trong ngày
 */

export const getEmployeeShiftsOnDate = async (employeeId, workDate, conn = null) => {
  const db = conn || pool;

  const [rows] = await db.query(
    `SELECT es.id AS employee_shift_id, es.employee_id, es.work_date,
            s.id AS shift_id, s.shift_name, s.start_time, s.end_time, s.is_active
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.employee_id = ?
       AND es.work_date = ?
       AND s.is_active = TRUE
       AND es.status <> 'absent'`,
    [employeeId, workDate]
  );

  return rows;
};


/**
 * Lấy tất cả nhân viên có ca làm việc hợp lệ trong ngày (kèm thông tin ca)
 */
export const getActiveEmployeesWithShifts = async (dateStr, employeeId = null, conn = null) => {
  const db = conn || pool;
  let query = `
    SELECT e.id AS employee_id, u.full_name AS employee_name, e.specialty,
           s.id AS shift_id, s.shift_name, s.start_time, s.end_time
    FROM employees e
    JOIN users u ON e.user_id = u.id
    JOIN employee_shifts es ON e.id = es.employee_id
    JOIN shifts s ON es.shift_id = s.id
    WHERE es.work_date = ?
      AND u.status = 'active'
      AND e.status = 'active'
      AND s.is_active = TRUE
      AND es.status <> 'absent'
  `;
  const params = [dateStr];

  if (employeeId) {
    query += ' AND e.id = ?';
    params.push(employeeId);
  }

  query += ' ORDER BY e.id ASC, s.start_time ASC';

  const [rows] = await db.query(query, params);
  return rows;
};

/**
 * Lấy danh sách lịch hẹn hiện có trong ngày của các nhân viên (status != 'cancelled')
 */
export const getAppointmentsOnDate = async (dateStr, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT id, employee_id, appointment_date, start_time, end_time, status
     FROM appointments
     WHERE appointment_date = ? AND status != 'cancelled' AND employee_id IS NOT NULL`,
    [dateStr]
  );
  return rows;
};

/**
 * Đếm số lượng lịch hẹn của nhân viên trong ngày (hỗ trợ thuật toán cân bằng tải khi tự phân công)
 */
export const countAppointmentsForEmployeeOnDate = async (employeeId, appointmentDate, conn = null) => {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM appointments
     WHERE employee_id = ? AND appointment_date = ? AND status != 'cancelled'`,
    [employeeId, appointmentDate]
  );
  return rows[0]?.total || 0;
};

/**
 * Cập nhật thông tin lịch hẹn
 */
export const update = async (id, fields, conn = null) => {
  const db = conn || pool;
  const allowed = [
    'appointment_date',
    'start_time',
    'end_time',
    'employee_id',
    'status',
    'cancellation_reason',
    'customer_notes',
    'staff_notes',
  ];

  const setClauses = [];
  const values = [];

  for (const field of allowed) {
    if (fields[field] !== undefined) {
      setClauses.push(`\`${field}\` = ?`);
      values.push(fields[field]);
    }
  }

  if (setClauses.length === 0) return false;

  values.push(id);
  const [result] = await db.query(
    `UPDATE appointments SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  return result.affectedRows > 0;
};

/**
 * Danh sách lịch hẹn có phân trang, lọc và tìm kiếm
 */
export const findAll = async ({
  customerId,
  employeeId,
  date,
  fromDate,
  toDate,
  status,
  search,
  page = 1,
  limit = 10,
}) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (customerId) {
    conditions.push('a.customer_id = ?');
    params.push(customerId);
  }

  if (employeeId) {
    conditions.push('a.employee_id = ?');
    params.push(employeeId);
  }

  if (date) {
    conditions.push('a.appointment_date = ?');
    params.push(date);
  } else {
    if (fromDate) {
      conditions.push('a.appointment_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('a.appointment_date <= ?');
      params.push(toDate);
    }
  }

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (search) {
    conditions.push(
      '(a.appointment_code LIKE ? OR u_c.full_name LIKE ? OR u_c.phone LIKE ? OR p.name LIKE ?)'
    );
    const likeVal = `%${search}%`;
    params.push(likeVal, likeVal, likeVal, likeVal);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT a.*,
            u_c.full_name AS customer_name, u_c.email AS customer_email, u_c.phone AS customer_phone, u_c.avatar_url AS customer_avatar,
            p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed, p.avatar_url AS pet_avatar,
            e.id AS employee_record_id, e.user_id AS employee_user_id, e.specialty AS employee_specialty,
            u_e.full_name AS employee_name, u_e.avatar_url AS employee_avatar
     FROM appointments a
     JOIN users u_c ON a.customer_id = u_c.id
     JOIN pets p ON a.pet_id = p.id
     LEFT JOIN employees e ON a.employee_id = e.id
     LEFT JOIN users u_e ON e.user_id = u_e.id
     ${whereClause}
     ORDER BY a.appointment_date DESC, a.start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
};

/**
 * Đếm tổng số lịch hẹn theo bộ lọc
 */
export const countAll = async ({
  customerId,
  employeeId,
  date,
  fromDate,
  toDate,
  status,
  search,
}) => {
  const conditions = [];
  const params = [];

  if (customerId) {
    conditions.push('a.customer_id = ?');
    params.push(customerId);
  }

  if (employeeId) {
    conditions.push('a.employee_id = ?');
    params.push(employeeId);
  }

  if (date) {
    conditions.push('a.appointment_date = ?');
    params.push(date);
  } else {
    if (fromDate) {
      conditions.push('a.appointment_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('a.appointment_date <= ?');
      params.push(toDate);
    }
  }

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (search) {
    conditions.push(
      '(a.appointment_code LIKE ? OR u_c.full_name LIKE ? OR u_c.phone LIKE ? OR p.name LIKE ?)'
    );
    const likeVal = `%${search}%`;
    params.push(likeVal, likeVal, likeVal, likeVal);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM appointments a
     JOIN users u_c ON a.customer_id = u_c.id
     JOIN pets p ON a.pet_id = p.id
     LEFT JOIN employees e ON a.employee_id = e.id
     LEFT JOIN users u_e ON e.user_id = u_e.id
     ${whereClause}`,
    params
  );

  return rows[0]?.total || 0;
};

export default {
  generateAppointmentCode,
  create,
  createDetails,
  findById,
  findDetailsByAppointmentId,
  lockAndGetEmployeeAppointments,
  lockAndGetPetAppointments,
  getEmployeeShiftsOnDate,
  getActiveEmployeesWithShifts,
  getAppointmentsOnDate,
  countAppointmentsForEmployeeOnDate,
  update,
  findAll,
  countAll,
};

