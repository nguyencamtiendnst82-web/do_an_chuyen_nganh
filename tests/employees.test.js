import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Quản lý nhân viên (/api/employees)', () => {
  let adminUser;
  let staffUser;
  let customerUser;
  let employeeId;
  const prefix = 'test_emp';

  beforeAll(async () => {
    adminUser = await createUser(app, { role: 'admin', prefix });
    staffUser = await createUser(app, { role: 'staff', prefix });
    customerUser = await createUser(app, { role: 'customer', prefix });

    // Tạo bản ghi employees cho staffUser
    const [empRes] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Cắt tỉa lông chuyên nghiệp', 3.5, '2025-01-15', 'active')`,
      [staffUser.id]
    );
    employeeId = empRes.insertId;
  });

  afterAll(async () => {
    // Dọn dẹp logs, employee_shifts, employees, users
    await pool.query(
      `DELETE FROM system_logs WHERE user_id IN (?, ?, ?)`,
      [adminUser.id, staffUser.id, customerUser.id]
    );
    await pool.query(`DELETE FROM employees WHERE id = ?`, [employeeId]);
    await pool.query(`DELETE FROM users WHERE email LIKE '${prefix}_%'`);
  });

  test('E1. Khách xem GET /api/employees không thấy email, SĐT, ngày sinh hay địa chỉ', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((e) => e.id === employeeId);
    expect(found).toBeDefined();
    expect(found.full_name).toBeDefined();
    expect(found.specialty).toBe('Cắt tỉa lông chuyên nghiệp');
    expect(found.experience_years).toBe(3.5);

    // Tuyệt đối không để lộ dữ liệu nhạy cảm
    expect(found.email).toBeUndefined();
    expect(found.phone).toBeUndefined();
    expect(found.password_hash).toBeUndefined();
    expect(found.birth_year).toBeUndefined();
    expect(found.address).toBeUndefined();
  });

  test('E2. Khách xem GET /api/employees/:id chỉ thấy thông tin công khai', async () => {
    const res = await request(app).get(`/api/employees/${employeeId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.phone).toBeUndefined();
    expect(res.body.data.id).toBe(employeeId);
  });

  test('E3. Khách / Staff gọi ?scope=admin -> 403', async () => {
    const resGuest = await request(app).get('/api/employees?scope=admin');
    expect(resGuest.status).toBe(403);

    const resStaff = await request(app)
      .get('/api/employees?scope=admin')
      .set(authHeader(staffUser));
    expect(resStaff.status).toBe(403);

    const resCustomer = await request(app)
      .get('/api/employees?scope=admin')
      .set(authHeader(customerUser));
    expect(resCustomer.status).toBe(403);
  });

  test('E4. Admin gọi ?scope=admin xem được đầy đủ cả email, phone, status', async () => {
    const res = await request(app)
      .get('/api/employees?scope=admin')
      .set(authHeader(adminUser));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const found = res.body.data.find((e) => e.id === employeeId);
    expect(found).toBeDefined();
    expect(found.email).toBe(staffUser.email);
    expect(found.phone).toBe(staffUser.phone);
    expect(found.status).toBe('active');
  });

  test('E5. Quyền ghi: không token -> 401, customer/staff sửa nhân viên -> 403', async () => {
    const resNoToken = await request(app)
      .put(`/api/employees/${employeeId}`)
      .send({ specialty: 'Tắm spa' });
    expect(resNoToken.status).toBe(401);

    const resCustomer = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(customerUser))
      .send({ specialty: 'Tắm spa' });
    expect(resCustomer.status).toBe(403);

    const resStaff = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(staffUser))
      .send({ specialty: 'Tắm spa' });
    expect(resStaff.status).toBe(403);
  });

  test('E6. Admin sửa thông tin nhân viên hợp lệ -> 200, ghi nhận thay đổi', async () => {
    const res = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(adminUser))
      .send({
        specialty: 'Chăm sóc da và lông cao cấp',
        experience_years: 4.5,
        hire_date: '2024-05-01',
        status: 'on_leave',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specialty).toBe('Chăm sóc da và lông cao cấp');
    expect(res.body.data.experience_years).toBe(4.5);
    expect(res.body.data.status).toBe('on_leave');

    // Khách gọi lại thì nhân viên on_leave không xuất hiện trong danh sách công khai
    const resPublic = await request(app).get('/api/employees');
    const stillInPublic = resPublic.body.data.find((e) => e.id === employeeId);
    expect(stillInPublic).toBeUndefined();

    // Khôi phục lại active để các test sau dùng
    await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(adminUser))
      .send({ status: 'active' });
  });

  test('E7. Sửa với dữ liệu không hợp lệ (kinh nghiệm âm, ngày tương lai) -> 422', async () => {
    const resNegExp = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(adminUser))
      .send({ experience_years: -2 });
    expect(resNegExp.status).toBe(422);

    const resFutureHire = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(adminUser))
      .send({ hire_date: '2099-01-01' });
    expect(resFutureHire.status).toBe(422);
  });
});

