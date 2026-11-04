import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Kiểm thử phân hệ Hóa đơn & Thanh toán mô phỏng (/api/invoices)', () => {
  let adminUser;
  let staffUser1;
  let staffUser2;
  let customerUserA;
  let customerUserB;

  let employeeId1;
  let employeeId2;
  let petA;
  let serviceId;
  let completedAptId;
  let inProgressAptId;
  let invoiceId;

  const prefix = 'test_inv';

  beforeAll(async () => {
    adminUser = await createUser(app, { role: 'admin', prefix });
    staffUser1 = await createUser(app, { role: 'staff', prefix });
    staffUser2 = await createUser(app, { role: 'staff', prefix });
    customerUserA = await createUser(app, { role: 'customer', prefix });
    customerUserB = await createUser(app, { role: 'customer', prefix });

    // Tạo hồ sơ nhân viên
    const [e1] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Tắm tỉa', 3.0, '2024-01-01', 'active')`,
      [staffUser1.id]
    );
    employeeId1 = e1.insertId;

    const [e2] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Massage', 2.0, '2024-01-01', 'active')`,
      [staffUser2.id]
    );
    employeeId2 = e2.insertId;

    // Tạo thú cưng
    const [pA] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Boss Mèo A', 'cat', 'active')`,
      [customerUserA.id]
    );
    petA = pA.insertId;

    // Tạo dịch vụ 200.000đ
    const [s] = await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active)
       VALUES (?, 200000.00, 60, TRUE)`,
      [`Dịch vụ Test Inv ${Date.now()}`]
    );
    serviceId = s.insertId;

    // Tạo lịch hẹn đã hoàn thành (completed) gán cho staffUser1
    const [aptComp] = await pool.query(
      `INSERT INTO appointments (
         appointment_code, customer_id, pet_id, employee_id,
         appointment_date, start_time, end_time, status
       ) VALUES (?, ?, ?, ?, CURDATE(), '09:00:00', '10:00:00', 'completed')`,
      [`APT-INV-${Date.now()}-1`, customerUserA.id, petA, employeeId1]
    );
    completedAptId = aptComp.insertId;

    await pool.query(
      `INSERT INTO appointment_details (appointment_id, service_id, price_at_booking, duration_minutes)
       VALUES (?, ?, 200000.00, 60)`,
      [completedAptId, serviceId]
    );

    // Tạo lịch hẹn đang diễn ra (in_progress)
    const [aptInProg] = await pool.query(
      `INSERT INTO appointments (
         appointment_code, customer_id, pet_id, employee_id,
         appointment_date, start_time, end_time, status
       ) VALUES (?, ?, ?, ?, CURDATE(), '10:00:00', '11:00:00', 'in_progress')`,
      [`APT-INV-${Date.now()}-2`, customerUserA.id, petA, employeeId1]
    );
    inProgressAptId = aptInProg.insertId;

    await pool.query(
      `INSERT INTO appointment_details (appointment_id, service_id, price_at_booking, duration_minutes)
       VALUES (?, ?, 200000.00, 60)`,
      [inProgressAptId, serviceId]
    );
  });

  afterAll(async () => {
    const [allTestUsers] = await pool.query(`SELECT id FROM users WHERE email LIKE '${prefix}_%'`);
    const userIds = allTestUsers.map((u) => u.id);

    if (userIds.length > 0) {
      await pool.query(
        `DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (${userIds.join(',')}))`
      );
      await pool.query(
        `DELETE FROM invoice_details WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (${userIds.join(',')}))`
      );
      await pool.query(`DELETE FROM invoices WHERE customer_id IN (${userIds.join(',')})`);
      await pool.query(
        `DELETE FROM appointment_details WHERE appointment_id IN (SELECT id FROM appointments WHERE customer_id IN (${userIds.join(',')}))`
      );
      await pool.query(`DELETE FROM appointments WHERE customer_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM employees WHERE user_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM pets WHERE customer_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM system_logs WHERE user_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM users WHERE id IN (${userIds.join(',')})`);
    }

    if (serviceId) {
      await pool.query(`DELETE FROM services WHERE id = ?`, [serviceId]);
    }
  });

  // ==========================================
  // 1. LẬP HÓA ĐƠN
  // ==========================================

  test('I1. Khách hàng tự lập hóa đơn -> 403', async () => {
    const res = await request(app)
      .post(`/api/appointments/${completedAptId}/invoice`)
      .set(authHeader(customerUserA))
      .send({});
    expect(res.status).toBe(403);
  });

  test('I2. Lập hóa đơn cho lịch chưa hoàn tất -> 409', async () => {
    const res = await request(app)
      .post(`/api/appointments/${inProgressAptId}/invoice`)
      .set(authHeader(staffUser1))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/lịch hẹn đã hoàn thành/i);
  });

  test('I3. Nhân viên khác không được phân công lịch -> 403', async () => {
    const res = await request(app)
      .post(`/api/appointments/${completedAptId}/invoice`)
      .set(authHeader(staffUser2))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/phân công cho mình/i);
  });

  test('I4. Nhân viên được phân công lập hóa đơn kèm phụ phí tùy chỉnh -> 201', async () => {
    const res = await request(app)
      .post(`/api/appointments/${completedAptId}/invoice`)
      .set(authHeader(staffUser1))
      .send({
        notes: 'Hóa đơn kèm gỡ rối lông',
        surcharges: [
          {
            item_name: 'Phụ thu gỡ rối lông nặng',
            quantity: 1,
            unit_price: 50000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice).toBeDefined();

    const inv = res.body.data.invoice;
    invoiceId = inv.id;
    expect(inv.appointment_id).toBe(completedAptId);
    expect(inv.customer_id).toBe(customerUserA.id);
    // Subtotal dịch vụ = 200.000, phụ phí = 50.000 -> Total = 250.000
    expect(Number(inv.total_amount)).toBe(250000);
    expect(inv.payment_status).toBe('unpaid');

    // Kiểm tra dòng phụ phí có service_id = null
    const surchargeLine = inv.details.find((d) => d.service_id === null);
    expect(surchargeLine).toBeDefined();
    expect(surchargeLine.item_name).toBe('Phụ thu gỡ rối lông nặng');
    expect(Number(surchargeLine.unit_price)).toBe(50000);
  });

  test('I5. Lập hóa đơn lần 2 cho cùng lịch hẹn -> 409', async () => {
    const res = await request(app)
      .post(`/api/appointments/${completedAptId}/invoice`)
      .set(authHeader(adminUser))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/đã có hóa đơn/i);
  });

  // ==========================================
  // 2. XEM HÓA ĐƠN & PHÂN QUYỀN
  // ==========================================

  test('I6. Khách A xem hóa đơn của mình -> 200; Khách B xem hóa đơn Khách A -> 404', async () => {
    const resA = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set(authHeader(customerUserA));
    expect(resA.status).toBe(200);
    expect(resA.body.data.invoice.id).toBe(invoiceId);

    const resB = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set(authHeader(customerUserB));
    expect(resB.status).toBe(404);
  });

  test('I7. Staff phụ trách xem được; Staff khác không xem được -> 404; Admin xem được -> 200', async () => {
    const resStaff1 = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set(authHeader(staffUser1));
    expect(resStaff1.status).toBe(200);

    const resStaff2 = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set(authHeader(staffUser2));
    expect(resStaff2.status).toBe(404);

    const resAdmin = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set(authHeader(adminUser));
    expect(resAdmin.status).toBe(200);
  });

  // ==========================================
  // 3. THANH TOÁN MÔ PHỎNG & VIETQR
  // ==========================================

  test('I8. Lấy VietQR minh họa khi chưa thanh toán -> 200, có link QR', async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}/vietqr`)
      .set(authHeader(customerUserA));
    expect(res.status).toBe(200);
    expect(res.body.data.qr_url).toMatch(/https:\/\/img\.vietqr\.io\/image\//);
    expect(res.body.data.amount).toBe(250000);
  });

  test('I9. Khách tự gọi thanh toán -> 403', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(customerUserA))
      .send({
        amount: 100000,
        payment_method: 'momo_simulated',
      });
    expect(res.status).toBe(403);
  });

  test('I10. Thanh toán số tiền vượt quá tổng hóa đơn -> 422', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(staffUser1))
      .send({
        amount: 300000, // Cần 250k mà trả 300k
        payment_method: 'cash',
      });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/vượt quá số tiền còn lại/i);
  });

  test('I11. Thanh toán một phần -> 201, payment_status chuyển thành partially_paid', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(staffUser1))
      .send({
        amount: 100000,
        payment_method: 'cash',
        notes: 'Khách cọc trước 100k tiền mặt',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.payment_status).toBe('partially_paid');
    expect(res.body.data.invoice.payments.length).toBe(1);
    expect(Number(res.body.data.invoice.payments[0].amount)).toBe(100000);
  });

  test('I12. Thanh toán nốt số tiền còn lại -> 201, payment_status chuyển thành paid', async () => {
    // Còn lại: 250k - 100k = 150k
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(staffUser1))
      .send({
        amount: 150000,
        payment_method: 'bank_transfer',
        notes: 'Khách chuyển khoản nốt qua VietQR',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.payment_status).toBe('paid');
    expect(res.body.data.invoice.payments.length).toBe(2);
  });

  test('I13. Cố thanh toán thêm khi hóa đơn đã paid -> 409', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(staffUser1))
      .send({
        amount: 50000,
        payment_method: 'cash',
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/đã được thanh toán đầy đủ/i);
  });

  test('I14. Lấy VietQR khi đã thanh toán đủ -> 400', async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}/vietqr`)
      .set(authHeader(customerUserA));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đã được thanh toán đầy đủ/i);
  });
});

