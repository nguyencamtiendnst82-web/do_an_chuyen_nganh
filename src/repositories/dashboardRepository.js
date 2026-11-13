import { pool } from '../config/db.js';
import { getVietnamDate } from '../utils/businessDate.js';

/**
 * Lấy số liệu tổng quan cho Admin Dashboard:
 * - Doanh thu hôm nay
 * - Doanh thu tháng này
 * - Lịch hôm nay theo từng trạng thái
 * - Sự cố đang mở (open / investigating)
 * - Nhân viên đang trong ca làm việc hôm nay
 */
export const getAdminDashboardData = async () => {
  const today = getVietnamDate();
  const firstDayOfMonth = today.slice(0, 7) + '-01';

  // Doanh thu hôm nay
  const [revToday] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue_today
     FROM invoices
     WHERE payment_status = 'paid' AND DATE(updated_at) = ?`,
    [today]
  );

  // Doanh thu tháng này
  const [revMonth] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue_month
     FROM invoices
     WHERE payment_status = 'paid' AND DATE(updated_at) >= ? AND DATE(updated_at) <= ?`,
    [firstDayOfMonth, today]
  );

  // Lịch hôm nay theo trạng thái
  const [aptToday] = await pool.query(
    `SELECT status, COUNT(*) AS count
     FROM appointments
     WHERE appointment_date = ?
     GROUP BY status`,
    [today]
  );

  // Tổng số lịch hôm nay
  const totalAppointmentsToday = aptToday.reduce((acc, r) => acc + Number(r.count), 0);

  // Sự cố đang mở (open, investigating)
  const [incidents] = await pool.query(
    `SELECT COUNT(*) AS open_incidents
     FROM incidents
     WHERE status IN ('open', 'investigating')`
  );

  // Nhân viên đang làm hôm nay (có phân ca trong employee_shifts hôm nay với status scheduled/completed)
  const [shiftsToday] = await pool.query(
    `SELECT 
       es.employee_id,
       u.full_name AS employee_name,
       s.shift_name,
       s.start_time,
       s.end_time,
       es.status
     FROM employee_shifts es
     JOIN employees e ON es.employee_id = e.id
     JOIN users u ON e.user_id = u.id
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.work_date = ?`,
    [today]
  );

  // Thống kê tổng số người dùng
  const [userCount] = await pool.query(`SELECT COUNT(*) AS total_users FROM users`);

  return {
    revenue_today: Number(revToday[0]?.revenue_today || 0),
    revenue_month: Number(revMonth[0]?.revenue_month || 0),
    appointments_today_total: totalAppointmentsToday,
    appointments_today_by_status: aptToday.map((r) => ({ status: r.status, count: Number(r.count) })),
    open_incidents: Number(incidents[0]?.open_incidents || 0),
    on_duty_employees_today: shiftsToday,
    total_users: Number(userCount[0]?.total_users || 0),
  };
};

/**
 * Lấy số liệu cho Staff Dashboard:
 * - Lịch hôm nay của tôi
 * - Ca làm việc hôm nay của tôi
 * - Số lịch đã hoàn tất trong tháng này của tôi
 */
export const getStaffDashboardData = async (userId) => {
  const today = getVietnamDate();
  const firstDayOfMonth = today.slice(0, 7) + '-01';

  // Lấy employee_id từ user_id
  const [empRows] = await pool.query(`SELECT id FROM employees WHERE user_id = ?`, [userId]);
  const employeeId = empRows[0]?.id || null;

  if (!employeeId) {
    return {
      employee_id: null,
      my_appointments_today: [],
      my_shift_today: null,
      completed_this_month: 0,
    };
  }

  // Lịch hôm nay của nhân viên
  const [apts] = await pool.query(
    `SELECT 
       a.id,
       a.appointment_code,
       a.appointment_date,
       a.start_time,
       a.end_time,
       a.status,
       p.name AS pet_name,
       p.species,
       u.full_name AS customer_name,
       u.phone AS customer_phone
     FROM appointments a
     JOIN pets p ON a.pet_id = p.id
     JOIN users u ON a.customer_id = u.id
     WHERE a.employee_id = ? AND a.appointment_date = ?
     ORDER BY a.start_time ASC`,
    [employeeId, today]
  );

  // Ca của tôi hôm nay
  const [shiftRows] = await pool.query(
    `SELECT 
       s.id AS shift_id,
       s.shift_name,
       s.start_time,
       s.end_time,
       es.status,
       es.notes
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.employee_id = ? AND es.work_date = ?
     LIMIT 1`,
    [employeeId, today]
  );

  // Số lịch hoàn tất trong tháng của tôi
  const [compRows] = await pool.query(
    `SELECT COUNT(*) AS completed_count
     FROM appointments
     WHERE employee_id = ? 
       AND status = 'completed'
       AND appointment_date >= ? 
       AND appointment_date <= ?`,
    [employeeId, firstDayOfMonth, today]
  );

  return {
    employee_id: employeeId,
    my_appointments_today: apts,
    my_shift_today: shiftRows[0] || null,
    completed_this_month: Number(compRows[0]?.completed_count || 0),
  };
};

export default {
  getAdminDashboardData,
  getStaffDashboardData,
};
