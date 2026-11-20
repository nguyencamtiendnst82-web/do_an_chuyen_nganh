import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Đề xuất đổi nhân viên / dời lịch cần khách đồng ý (đợt 7a)', () => {
  const prefix = 'test_cr';
  let admin, staff1, staff2, custA, custB;
  let emp1, emp2, petA, aptId;

  const post = (user, body, id = aptId) =>
    request(app).post(`/api/appointments/${id}/change-requests`).set(authHeader(user)).send(body);

  beforeAll(async () => {
    admin = await createUser(app, { role: 'admin', prefix });
    staff1 = await createUser(app, { role: 'staff', prefix });
    staff2 = await createUser(app, { role: 'staff', prefix });
    custA = await createUser(app, { role: 'customer', prefix });
    custB = await createUser(app, { role: 'customer', prefix });
    const mk = async (u) => (await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status) VALUES (?, 'Tắm', 1.0, '2024-01-01', 'active')`, [u.id]))[0].insertId;
    emp1 = await mk(staff1);
    emp2 = await mk(staff2);
    petA = (await pool.query(`INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Bông', 'dog', 'active')`, [custA.id]))[0].insertId;
    aptId = (await pool.query(
      `INSERT INTO appointments (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, '2030-02-10', '09:00:00', '10:00:00', 'confirmed')`,
      [`TCR${Date.now()}`, custA.id, petA, emp1]))[0].insertId;
  });

  afterAll(async () => {
    const [users] = await pool.query(`SELECT id FROM users WHERE email LIKE '${prefix}_%'`);
    const list = users.map((u) => u.id).join(',');
    if (list) {
      await pool.query(`DELETE FROM notifications WHERE user_id IN (${list})`);
      await pool.query(`DELETE FROM appointments WHERE customer_id IN (${list})`);
      await pool.query(`DELETE FROM employees WHERE id IN (?, ?)`, [emp1, emp2]);
      await pool.query(`DELETE FROM pets WHERE customer_id IN (${list})`);
      await pool.query(`DELETE FROM system_logs WHERE user_id IN (${list})`);
      await pool.query(`DELETE FROM users WHERE id IN (${list})`);
    }
  });

  test('R1. Chỉ nhân viên phụ trách được đề xuất: admin/khách 403, nhân viên khác 403', async () => {
    const body = { request_type: 'handover', employee_id: emp2 };
    expect((await post(admin, body)).status).toBe(403);
    expect((await post(custA, body)).status).toBe(403);
    expect((await post(staff2, body)).status).toBe(403);
  });

  test('R2. Dữ liệu sai -> 422; đề xuất hợp lệ -> 201, khách nhận thông báo, lịch chưa đổi', async () => {
    expect((await post(staff1, { request_type: 'khac' })).status).toBe(422);
    expect((await post(staff1, { request_type: 'handover', employee_id: emp1 })).status).toBe(422);

    const ok = await post(staff1, { request_type: 'handover', employee_id: emp2, reason: 'Có việc đột xuất' });
    expect(ok.status).toBe(201);

    const [apt] = await pool.query('SELECT employee_id FROM appointments WHERE id = ?', [aptId]);
    expect(apt[0].employee_id).toBe(emp1);

    const notes = await request(app).get('/api/notifications?limit=50').set(authHeader(custA));
    expect(notes.body.data.notifications.some((n) => n.type === 'change_request')).toBe(true);

    // Đang có đề xuất chờ -> không gửi thêm
    expect((await post(staff1, { request_type: 'handover', employee_id: emp2 })).status).toBe(409);
  });

  test('R3. Khách khác không phản hồi được (404); khách chủ lịch từ chối -> declined, nhân viên được báo', async () => {
    const list = await request(app).get(`/api/appointments/${aptId}/change-requests`).set(authHeader(custA));
    expect(list.status).toBe(200);
    const reqId = list.body.data.requests[0].id;

    const other = await request(app).patch(`/api/appointments/change-requests/${reqId}/respond`).set(authHeader(custB)).send({ accept: false });
    expect(other.status).toBe(404);
    const staffTry = await request(app).patch(`/api/appointments/change-requests/${reqId}/respond`).set(authHeader(staff1)).send({ accept: false });
    expect(staffTry.status).toBe(403);
    const noBool = await request(app).patch(`/api/appointments/change-requests/${reqId}/respond`).set(authHeader(custA)).send({});
    expect(noBool.status).toBe(422);

    const declined = await request(app).patch(`/api/appointments/change-requests/${reqId}/respond`).set(authHeader(custA)).send({ accept: false });
    expect(declined.status).toBe(200);
    expect(declined.body.data.request.status).toBe('declined');

    const again = await request(app).patch(`/api/appointments/change-requests/${reqId}/respond`).set(authHeader(custA)).send({ accept: false });
    expect(again.status).toBe(409);

    const notes = await request(app).get('/api/notifications?limit=50').set(authHeader(staff1));
    expect(notes.body.data.notifications.some((n) => n.type === 'change_request_result')).toBe(true);
  });

  test('R4. Sau khi khách từ chối, nhân viên đề xuất dời lịch được (201)', async () => {
    const res = await post(staff1, { request_type: 'reschedule', appointment_date: '2030-02-11', start_time: '10:00' });
    expect(res.status).toBe(201);
    expect(res.body.data.request.request_type).toBe('reschedule');
  });
});
