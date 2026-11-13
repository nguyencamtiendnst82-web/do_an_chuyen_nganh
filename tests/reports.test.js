import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';
import { getVietnamDate } from '../src/utils/businessDate.js';

describe('ĐỢT 5: Báo cáo, Nhật ký, Dashboard', () => {
  let admin, staff, customer;
  const createdUserIds = [];
  const createdInvoiceIds = [];
  const createdAppointmentIds = [];
  const createdPetIds = [];
  const createdShiftIds = [];
  const createdEmpShiftIds = [];
  let employeeId;

  beforeAll(async () => {
    // 1. Tạo 3 người dùng tương ứng 3 roles
    admin = await createUser(app, { role: 'admin', prefix: 'adm_rep' });
    staff = await createUser(app, { role: 'staff', prefix: 'stf_rep' });
    customer = await createUser(app, { role: 'customer', prefix: 'cst_rep' });
    createdUserIds.push(admin.id, staff.id, customer.id);

    // 2. Tạo record employee cho staff
    const [empRes] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Tắm & Cắt tỉa', 2.5, '2025-01-01', 'active')`,
      [staff.id]
    );
    employeeId = empRes.insertId;

    // 3. Tạo thú cưng cho customer
    const [petRes] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, breed, gender)
       VALUES (?, 'Bông Gòn Test', 'dog', 'Poodle', 'male')`,
      [customer.id]
    );
    createdPetIds.push(petRes.insertId);

    // 4. Tạo ca làm việc và gán cho staff hôm nay
    const today = getVietnamDate();
    const [shiftRes] = await pool.query(
      `INSERT INTO shifts (shift_name, start_time, end_time)
       VALUES ('Ca sáng Test', '08:00:00', '12:00:00')`
    );
    createdShiftIds.push(shiftRes.insertId);

    const [esRes] = await pool.query(
      `INSERT INTO employee_shifts (employee_id, shift_id, work_date, status)
       VALUES (?, ?, ?, 'scheduled')`,
      [employeeId, shiftRes.insertId, today]
    );
    createdEmpShiftIds.push(esRes.insertId);

    // 5. Tạo 2 lịch hẹn: 1 completed, 1 confirmed
    const [apt1] = await pool.query(
      `INSERT INTO appointments (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, '09:00:00', '10:00:00', 'completed')`,
      [`APT-TEST-${Date.now()}-1`, customer.id, petRes.insertId, employeeId, today]
    );
    createdAppointmentIds.push(apt1.insertId);

    const [apt2] = await pool.query(
      `INSERT INTO appointments (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, '10:30:00', '11:30:00', 'confirmed')`,
      [`APT-TEST-${Date.now()}-2`, customer.id, petRes.insertId, employeeId, today]
    );
    createdAppointmentIds.push(apt2.insertId);

    // Gán dịch vụ cho lịch 1 (service_id = 1 đã có sẵn trong seed database)
    await pool.query(
      `INSERT INTO appointment_details (appointment_id, service_id, price_at_booking, duration_minutes)
       VALUES (?, 1, 250000.00, 60)`,
      [apt1.insertId]
    );

    // 6. Tạo 2 hóa đơn: 1 paid (300,000đ), 1 unpaid (150,000đ)
    const [inv1] = await pool.query(
      `INSERT INTO invoices (invoice_code, appointment_id, customer_id, created_by, subtotal, total_amount, payment_status, updated_at)
       VALUES (?, ?, ?, ?, 300000.00, 300000.00, 'paid', NOW())`,
      [`INV-TEST-${Date.now()}-1`, apt1.insertId, customer.id, admin.id]
    );
    createdInvoiceIds.push(inv1.insertId);

    const [inv2] = await pool.query(
      `INSERT INTO invoices (invoice_code, appointment_id, customer_id, created_by, subtotal, total_amount, payment_status, updated_at)
       VALUES (?, ?, ?, ?, 150000.00, 150000.00, 'unpaid', NOW())`,
      [`INV-TEST-${Date.now()}-2`, apt2.insertId, customer.id, admin.id]
    );
    createdInvoiceIds.push(inv2.insertId);
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu kiểm thử
    if (createdInvoiceIds.length) {
      await pool.query(`DELETE FROM invoices WHERE id IN (?)`, [createdInvoiceIds]);
    }
    if (createdAppointmentIds.length) {
      await pool.query(`DELETE FROM appointment_details WHERE appointment_id IN (?)`, [createdAppointmentIds]);
      await pool.query(`DELETE FROM appointments WHERE id IN (?)`, [createdAppointmentIds]);
    }
    if (createdEmpShiftIds.length) {
      await pool.query(`DELETE FROM employee_shifts WHERE id IN (?)`, [createdEmpShiftIds]);
    }
    if (createdShiftIds.length) {
      await pool.query(`DELETE FROM shifts WHERE id IN (?)`, [createdShiftIds]);
    }
    if (employeeId) {
      await pool.query(`DELETE FROM employees WHERE id = ?`, [employeeId]);
    }
    if (createdPetIds.length) {
      await pool.query(`DELETE FROM pets WHERE id IN (?)`, [createdPetIds]);
    }
    if (createdUserIds.length) {
      await pool.query(`DELETE FROM users WHERE id IN (?)`, [createdUserIds]);
    }
  });

  /* ------------------- 1. BÁO CÁO DOANH THU ------------------- */
  describe('GET /api/reports/revenue', () => {
    const today = getVietnamDate();

    test('Customer nhận 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: today, to: today })
        .set(authHeader(customer));
      expect(res.status).toBe(403);
    });

    test('Staff nhận 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: today, to: today })
        .set(authHeader(staff));
      expect(res.status).toBe(403);
    });

    test('Tham số ngày sai quy cách: from > to báo lỗi 400', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: '2026-12-31', to: '2026-01-01' })
        .set(authHeader(admin));
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Tham số ngày vượt quá 366 ngày báo lỗi 400', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: '2024-01-01', to: '2026-01-01' })
        .set(authHeader(admin));
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Admin lấy doanh thu thành công (chỉ tính hóa đơn paid)', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: today, to: today, groupBy: 'day' })
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const todayReport = res.body.data.find((r) => r.period === today);
      expect(todayReport).toBeDefined();
      expect(todayReport.total_revenue).toBeGreaterThanOrEqual(300000);
      expect(todayReport.invoice_count).toBeGreaterThanOrEqual(1);
    });

    test('Xuất file CSV doanh thu thành công (UTF-8 có BOM)', async () => {
      const res = await request(app)
        .get('/api/reports/revenue')
        .query({ from: today, to: today, format: 'csv' })
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // Bắt đầu bằng UTF-8 BOM
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain('Số lượng hóa đơn');
    });
  });

  /* ------------------- 2. BÁO CÁO DỊCH VỤ ------------------- */
  describe('GET /api/reports/services', () => {
    test('Admin lấy danh sách dịch vụ bán chạy', async () => {
      const res = await request(app)
        .get('/api/reports/services')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const s1 = res.body.data.find((s) => s.service_id === 1);
      expect(s1).toBeDefined();
      expect(s1.booking_count).toBeGreaterThanOrEqual(1);
    });
  });

  /* ------------------- 3. BÁO CÁO NHÂN VIÊN ------------------- */
  describe('GET /api/reports/employees', () => {
    test('Admin lấy hiệu suất nhân viên', async () => {
      const res = await request(app)
        .get('/api/reports/employees')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const myStaff = res.body.data.find((e) => e.employee_id === employeeId);
      expect(myStaff).toBeDefined();
      expect(myStaff.completed_count).toBeGreaterThanOrEqual(1);
    });
  });

  /* ------------------- 4. BÁO CÁO LỊCH HẸN & KHÁCH HÀNG ------------------- */
  describe('GET /api/reports/appointments & customers', () => {
    const today = getVietnamDate();

    test('Thống kê lịch theo trạng thái và khung giờ cao điểm', async () => {
      const res = await request(app)
        .get('/api/reports/appointments')
        .query({ from: today, to: today })
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.by_status).toBeDefined();
      expect(res.body.data.peak_hours).toBeDefined();
    });

    test('Thống kê khách hàng mới và khách quay lại', async () => {
      const res = await request(app)
        .get('/api/reports/customers')
        .query({ from: today, to: today })
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.total_customers).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.new_customers_by_date)).toBe(true);
    });
  });

  /* ------------------- 5. DASHBOARD ADMIN & STAFF ------------------- */
  describe('DASHBOARDS (/api/dashboard/*)', () => {
    test('GET /api/dashboard/admin: Admin xem số liệu hôm nay, tháng, sự cố, nhân viên ca trực', async () => {
      const res = await request(app)
        .get('/api/dashboard/admin')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revenue_today).toBeGreaterThanOrEqual(300000);
      expect(res.body.data.appointments_today_total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.data.on_duty_employees_today)).toBe(true);
    });

    test('GET /api/dashboard/admin: Staff và Customer bị từ chối 403', async () => {
      const resStaff = await request(app)
        .get('/api/dashboard/admin')
        .set(authHeader(staff));
      expect(resStaff.status).toBe(403);

      const resCust = await request(app)
        .get('/api/dashboard/admin')
        .set(authHeader(customer));
      expect(resCust.status).toBe(403);
    });

    test('GET /api/dashboard/staff: Staff xem lịch hôm nay của tôi, ca làm, số lịch làm trong tháng', async () => {
      const res = await request(app)
        .get('/api/dashboard/staff')
        .set(authHeader(staff));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee_id).toBe(employeeId);
      expect(res.body.data.my_appointments_today.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.my_shift_today).toBeDefined();
      expect(res.body.data.my_shift_today.shift_name).toBe('Ca sáng Test');
    });
  });

  /* ------------------- 6. NHẬT KÝ HỆ THỐNG (/api/logs) ------------------- */
  describe('GET /api/logs', () => {
    test('Khách và nhân viên không có quyền xem logs -> 403', async () => {
      const resCust = await request(app).get('/api/logs').set(authHeader(customer));
      expect(resCust.status).toBe(403);

      const resStaff = await request(app).get('/api/logs').set(authHeader(staff));
      expect(resStaff.status).toBe(403);
    });

    test('Admin xem nhật ký hệ thống, phân trang và không lộ mật khẩu', async () => {
      const res = await request(app)
        .get('/api/logs')
        .query({ page: 1, limit: 10 })
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();

      // Kiểm tra tính bảo mật: không lộ password_hash
      const stringified = JSON.stringify(res.body.data.logs);
      expect(stringified).not.toContain('$2a$');
      expect(stringified).not.toContain('$2b$');
    });
  });
});
