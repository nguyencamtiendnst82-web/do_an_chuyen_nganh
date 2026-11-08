import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Thông báo gắn với sự kiện thật (/api/notifications)', () => {
  const prefix = 'test_nt';
  let admin, staff, custA, custB;
  let empId, petA, serviceId;
  let seq = 0;

  const insertAppointment = async (status, { withService = false } = {}) => {
    seq += 1;
    const [r] = await pool.query(
      `INSERT INTO appointments
         (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, '2030-02-10', '09:00:00', '10:00:00', ?)`,
      [`NT${Date.now()}${seq}`, custA.id, petA, empId, status]
    );
    if (withService) {
      await pool.query(
        `INSERT INTO appointment_details (appointment_id, service_id, price_at_booking, duration_minutes)
         VALUES (?, ?, 200000.00, 60)`,
        [r.insertId, serviceId]
      );
    }
    return r.insertId;
  };

  const notesOf = async (user, type) => {
    const res = await request(app).get('/api/notifications?limit=50').set(authHeader(user));
    expect(res.status).toBe(200);
    return res.body.data.notifications.filter((n) => n.type === type);
  };

  beforeAll(async () => {
    admin = await createUser(app, { role: 'admin', prefix });
    staff = await createUser(app, { role: 'staff', prefix });
    custA = await createUser(app, { role: 'customer', prefix });
    custB = await createUser(app, { role: 'customer', prefix });

    const [e] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Tắm', 2.0, '2024-01-01', 'active')`,
      [staff.id]
    );
    empId = e.insertId;
    const [p] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Bông', 'dog', 'active')`,
      [custA.id]
    );
    petA = p.insertId;
    const [s] = await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active) VALUES (?, 200000.00, 60, TRUE)`,
      [`Dịch vụ Test NT ${Date.now()}`]
    );
    serviceId = s.insertId;
  });

  afterAll(async () => {
    try {
      const [users] = await pool.query(`SELECT id FROM users WHERE email LIKE '${prefix}\\_%'`);
      const ids = users.map((u) => u.id);
      if (ids.length) {
        const list = ids.join(',');
        await pool.query(`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (${list}))`);
        await pool.query(`DELETE FROM invoice_details WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (${list}))`);
        await pool.query(`DELETE FROM invoices WHERE customer_id IN (${list})`);
        await pool.query(`DELETE FROM incidents WHERE reported_by IN (${list})`);
        await pool.query(`DELETE FROM appointments WHERE customer_id IN (${list})`);
        await pool.query(`DELETE FROM employees WHERE id = ?`, [empId]);
        await pool.query(`DELETE FROM pets WHERE customer_id IN (${list})`);
        await pool.query(`DELETE FROM services WHERE id = ?`, [serviceId]);
        await pool.query(`DELETE FROM system_logs WHERE user_id IN (${list})`);
        await pool.query(`DELETE FROM users WHERE id IN (${list})`);
      }
    } catch (err) {
      console.warn('[Cleanup] Không dọn được dữ liệu test thông báo:', err.message);
    } finally {
      await pool.end();
    }
  });

  test('N1. Chưa đăng nhập -> 401', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).get('/api/notifications/unread-count')).status).toBe(401);
  });

  test('N2. Nhân viên xác nhận lịch -> KHÁCH nhận thông báo, người xác nhận thì không', async () => {
    const id = await insertAppointment('pending');
    const res = await request(app).patch(`/api/appointments/${id}/confirm`).set(authHeader(staff));
    expect(res.status).toBe(200);

    const got = await notesOf(custA, 'appointment_confirmed');
    expect(got.some((n) => n.payload.appointment_id === id)).toBe(true);
    expect(got[0].is_read).toBe(false);
    expect(await notesOf(staff, 'appointment_confirmed')).toHaveLength(0);
  });

  test('N2b. Tiếp nhận và bắt đầu làm -> khách nhận thông báo từng bước', async () => {
    const id = await insertAppointment('confirmed');
    expect((await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff)).send({})).status).toBe(200);
    expect((await notesOf(custA, 'appointment_checked_in')).some((n) => n.payload.appointment_id === id)).toBe(true);

    expect((await request(app).patch(`/api/appointments/${id}/start`).set(authHeader(staff))).status).toBe(200);
    expect((await notesOf(custA, 'appointment_started')).some((n) => n.payload.appointment_id === id)).toBe(true);
  });

  test('N3. Hoàn tất lịch -> khách nhận thông báo "completed" trỏ tới sổ tay', async () => {
    const id = await insertAppointment('in_progress', { withService: true });
    const res = await request(app)
      .patch(`/api/appointments/${id}/complete`)
      .set(authHeader(staff))
      .send({ treatmentNotes: 'Bé hợp tác, đã tắm sấy xong' });
    expect(res.status).toBe(200);

    const got = (await notesOf(custA, 'appointment_completed')).find((n) => n.payload.appointment_id === id);
    expect(got).toBeDefined();
    expect(got.payload.link).toBe('care-book');
  });

  test('N4. Lập hóa đơn rồi thanh toán -> khách nhận new_invoice và payment_received', async () => {
    const id = await insertAppointment('completed', { withService: true });
    const inv = await request(app).post(`/api/appointments/${id}/invoice`).set(authHeader(staff)).send({});
    expect(inv.status).toBe(201);
    const invoiceId = inv.body.data.invoice.id;

    const created = await notesOf(custA, 'new_invoice');
    expect(created.some((n) => n.payload.invoice_id === invoiceId)).toBe(true);

    const pay = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeader(staff))
      .send({ amount: 200000, payment_method: 'momo_simulated' });
    expect(pay.status).toBe(201);
    const paid = await notesOf(custA, 'payment_received');
    expect(paid.some((n) => n.payload.invoice_id === invoiceId && n.payload.title === 'Thanh toán hoàn tất')).toBe(true);

    // Khách khác không thấy thông báo của khách A
    const other = await notesOf(custB, 'new_invoice');
    expect(other.some((n) => n.payload.invoice_id === invoiceId)).toBe(false);
  });

  test('N5. Khách hủy lịch -> admin và nhân viên phụ trách nhận thông báo; khách hủy thì không tự nhận', async () => {
    const id = await insertAppointment('pending');
    const res = await request(app)
      .patch(`/api/appointments/${id}/cancel`)
      .set(authHeader(custA))
      .send({ cancellationReason: 'Bận việc đột xuất nên hủy lịch' });
    expect(res.status).toBe(200);

    for (const user of [admin, staff]) {
      const got = await notesOf(user, 'appointment_cancelled');
      expect(got.some((n) => n.payload.appointment_id === id)).toBe(true);
    }
    const mine = await notesOf(custA, 'appointment_cancelled');
    expect(mine.some((n) => n.payload.appointment_id === id)).toBe(false);
  });

  test('N6. Báo sự cố -> admin nhận; admin xử lý xong -> người báo nhận', async () => {
    const created = await request(app).post('/api/incidents').set(authHeader(staff)).send({
      petId: petA,
      title: 'Bé bị trầy da khi tắm',
      incidentType: 'injury',
      severity: 'high',
      description: 'Bé giật mình làm trầy nhẹ ở chân trước trong lúc tắm.',
    });
    expect(created.status).toBe(201);
    const incidentId = created.body.data.incident.id;

    const toAdmin = await notesOf(admin, 'incident_reported');
    expect(toAdmin.some((n) => n.payload.incident_id === incidentId)).toBe(true);

    const upd = await request(app)
      .patch(`/api/incidents/${incidentId}`)
      .set(authHeader(admin))
      .send({ status: 'resolved', resolution: 'Đã sát trùng và báo chủ nuôi' });
    expect(upd.status).toBe(200);

    const toStaff = await notesOf(staff, 'incident_resolved');
    expect(toStaff.some((n) => n.payload.incident_id === incidentId)).toBe(true);
  });

  test('N7. Đánh dấu đã đọc: của mình được, của người khác -> 404; đọc tất cả đưa số chưa đọc về 0', async () => {
    const list = await request(app).get('/api/notifications?unread=1').set(authHeader(custA));
    expect(list.body.data.unread_count).toBeGreaterThan(0);
    const first = list.body.data.notifications[0];

    expect((await request(app).patch(`/api/notifications/${first.id}/read`).set(authHeader(custB))).status).toBe(404);

    const ok = await request(app).patch(`/api/notifications/${first.id}/read`).set(authHeader(custA));
    expect(ok.status).toBe(200);
    expect(ok.body.data.unread_count).toBe(list.body.data.unread_count - 1);

    expect((await request(app).patch('/api/notifications/abc/read').set(authHeader(custA))).status).toBe(400);

    const all = await request(app).patch('/api/notifications/read-all').set(authHeader(custA));
    expect(all.status).toBe(200);
    const count = await request(app).get('/api/notifications/unread-count').set(authHeader(custA));
    expect(count.body.data.unread_count).toBe(0);
  });
});
