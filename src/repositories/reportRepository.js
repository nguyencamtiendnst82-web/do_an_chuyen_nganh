import { pool } from '../config/db.js';

/**
 * 1. Báo cáo doanh thu theo kỳ (chỉ hóa đơn paid)
 * @param {string} from - 'YYYY-MM-DD'
 * @param {string} to - 'YYYY-MM-DD'
 * @param {'day'|'month'} groupBy - Gom nhóm theo ngày hoặc tháng
 */
export const getRevenueReport = async (from, to, groupBy = 'day') => {
  const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

  const sql = `
    SELECT 
      DATE_FORMAT(updated_at, ?) AS period,
      COUNT(id) AS invoice_count,
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(ROUND(AVG(total_amount), 0), 0) AS avg_per_invoice
    FROM invoices
    WHERE payment_status = 'paid'
      AND DATE(updated_at) >= ?
      AND DATE(updated_at) <= ?
    GROUP BY DATE_FORMAT(updated_at, ?)
    ORDER BY period ASC
  `;

  const [rows] = await pool.query(sql, [dateFormat, from, to, dateFormat]);
  return rows.map((r) => ({
    period: r.period,
    invoice_count: Number(r.invoice_count),
    total_revenue: Number(r.total_revenue),
    avg_per_invoice: Number(r.avg_per_invoice),
  }));
};

/**
 * 2. Dịch vụ bán chạy (số lượt đặt, doanh thu mang lại)
 * Dựa trên appointment_details của các lịch hẹn completed hoặc invoice_details
 */
export const getServicesReport = async (from, to) => {
  let dateFilter = '';
  const params = [];
  if (from && to) {
    dateFilter = 'AND a.appointment_date >= ? AND a.appointment_date <= ?';
    params.push(from, to);
  }

  const sql = `
    SELECT 
      s.id AS service_id,
      s.name AS service_name,
      COUNT(ad.id) AS booking_count,
      COALESCE(SUM(ad.price_at_booking), 0) AS total_revenue
    FROM services s
    JOIN appointment_details ad ON s.id = ad.service_id
    JOIN appointments a ON ad.appointment_id = a.id
    WHERE a.status = 'completed'
      ${dateFilter}
    GROUP BY s.id, s.name
    ORDER BY booking_count DESC, total_revenue DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    service_id: r.service_id,
    service_name: r.service_name,
    booking_count: Number(r.booking_count),
    total_revenue: Number(r.total_revenue),
  }));
};

/**
 * 3. Hiệu suất nhân viên: số lịch hoàn tất, doanh thu phụ trách, tỉ lệ hủy
 */
export const getEmployeesReport = async (from, to) => {
  let dateFilter = '';
  const params = [];
  if (from && to) {
    dateFilter = 'AND a.appointment_date >= ? AND a.appointment_date <= ?';
    params.push(from, to);
  }

  const sql = `
    SELECT 
      e.id AS employee_id,
      u.full_name AS employee_name,
      u.phone,
      COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_count,
      COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_count,
      COUNT(a.id) AS total_assigned,
      COALESCE(SUM(CASE WHEN a.status = 'completed' THEN inv.total_amount ELSE 0 END), 0) AS total_revenue
    FROM employees e
    JOIN users u ON e.user_id = u.id
    LEFT JOIN appointments a ON a.employee_id = e.id ${dateFilter}
    LEFT JOIN invoices inv ON inv.appointment_id = a.id AND inv.payment_status = 'paid'
    GROUP BY e.id, u.full_name, u.phone
    ORDER BY completed_count DESC, total_revenue DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows.map((r) => {
    const total = Number(r.total_assigned);
    const cancelled = Number(r.cancelled_count);
    const cancelRate = total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0;
    return {
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      phone: r.phone,
      completed_count: Number(r.completed_count),
      cancelled_count: cancelled,
      total_assigned: total,
      cancel_rate: cancelRate,
      total_revenue: Number(r.total_revenue),
    };
  });
};

/**
 * 4. Thống kê lịch theo trạng thái và khung giờ cao điểm
 */
export const getAppointmentsReport = async (from, to) => {
  let dateFilter = '';
  const params = [];
  if (from && to) {
    dateFilter = 'WHERE appointment_date >= ? AND appointment_date <= ?';
    params.push(from, to);
  }

  // Thống kê theo trạng thái
  const statusSql = `
    SELECT status, COUNT(*) AS count
    FROM appointments
    ${dateFilter}
    GROUP BY status
  `;
  const [statusRows] = await pool.query(statusSql, params);

  // Thống kê khung giờ cao điểm (theo giờ bắt đầu 08:00, 09:00...)
  const peakHoursSql = `
    SELECT 
      HOUR(start_time) AS hour_slot,
      COUNT(*) AS appointment_count
    FROM appointments
    ${dateFilter}
    GROUP BY HOUR(start_time)
    ORDER BY hour_slot ASC
  `;
  const [peakRows] = await pool.query(peakHoursSql, params);

  return {
    by_status: statusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    peak_hours: peakRows.map((r) => ({
      hour_slot: `${String(r.hour_slot).padStart(2, '0')}:00`,
      appointment_count: Number(r.appointment_count),
    })),
  };
};

/**
 * 5. Thống kê khách hàng: khách mới theo kỳ, khách quay lại
 */
export const getCustomersReport = async (from, to) => {
  // Khách mới tạo tài khoản trong kỳ
  const newCustSql = `
    SELECT 
      DATE(u.created_at) AS date,
      COUNT(*) AS new_count
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.role_name = 'customer'
      AND DATE(u.created_at) >= ? AND DATE(u.created_at) <= ?
    GROUP BY DATE(u.created_at)
    ORDER BY date ASC
  `;
  const [newCustRows] = await pool.query(newCustSql, [from, to]);

  // Khách quay lại: Có từ 2 lịch hẹn trở lên trong toàn hệ thống, và có ít nhất 1 lịch trong kỳ
  const returningCustSql = `
    SELECT COUNT(DISTINCT a.customer_id) AS returning_count
    FROM appointments a
    WHERE a.appointment_date >= ? AND a.appointment_date <= ?
      AND a.customer_id IN (
        SELECT customer_id
        FROM appointments
        GROUP BY customer_id
        HAVING COUNT(id) >= 2
      )
  `;
  const [retRows] = await pool.query(returningCustSql, [from, to]);

  // Tổng số khách hàng hiện tại
  const [totalRows] = await pool.query(`
    SELECT COUNT(*) AS total_customers
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.role_name = 'customer'
  `);

  return {
    total_customers: Number(totalRows[0]?.total_customers || 0),
    returning_customers: Number(retRows[0]?.returning_count || 0),
    new_customers_by_date: newCustRows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      new_count: Number(r.new_count),
    })),
  };
};

export default {
  getRevenueReport,
  getServicesReport,
  getEmployeesReport,
  getAppointmentsReport,
  getCustomersReport,
};
