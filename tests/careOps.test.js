import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

// Ảnh PNG 1x1 hợp lệ
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const CARE_DIR = path.join(process.cwd(), 'uploads', 'care');
const filesIn = () => (fs.existsSync(CARE_DIR) ? fs.readdirSync(CARE_DIR).length : 0);
const fileOf = (url) => path.join(CARE_DIR, path.basename(url));

describe('Vận hành tại quầy: tiếp nhận, chăm sóc, sổ tay, sự cố (đợt 4A)', () => {
  const prefix = 'test_c4a';
  const DATE = '2030-01-15';
  let seq = 0;

  let admin, staff1, staff2, custA, custB;
  let emp1, emp2, petA, petB;

  const insertAppointment = async ({ customerId = custA.id, petId = petA, employeeId = emp1, status = 'confirmed' } = {}) => {
    seq += 1;
    const code = `T4A${Date.now()}${seq}`;
    const [r] = await pool.query(
      `INSERT INTO appointments
         (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, '09:00:00', '10:00:00', ?)`,
      [code, customerId, petId, employeeId, DATE, status]
    );
    return r.insertId;
  };

  const statusOf = async (id) => {
    const [rows] = await pool.query('SELECT status FROM appointments WHERE id = ?', [id]);
    return rows[0]?.status;
  };

  beforeAll(async () => {
    admin = await createUser(app, { role: 'admin', prefix });
    staff1 = await createUser(app, { role: 'staff', prefix });
    staff2 = await createUser(app, { role: 'staff', prefix });
    custA = await createUser(app, { role: 'customer', prefix });
    custB = await createUser(app, { role: 'customer', prefix });

    const [e1] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Tắm', 2.0, '2024-01-01', 'active')`,
      [staff1.id]
    );
    emp1 = e1.insertId;
    const [e2] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Cắt tỉa', 2.0, '2024-01-01', 'active')`,
      [staff2.id]
    );
    emp2 = e2.insertId;

    const [pA] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Bông', 'dog', 'active')`,
      [custA.id]
    );
    petA = pA.insertId;
    const [pB] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Mướp', 'cat', 'active')`,
      [custB.id]
    );
    petB = pB.insertId;
  });

  afterAll(async () => {
    const [photos] = await pool.query(
      `SELECT photo_before_url, photo_after_url FROM pet_care_history WHERE pet_id IN (?, ?)`,
      [petA, petB]
    );
    for (const p of photos) {
      for (const url of [p.photo_before_url, p.photo_after_url]) {
        if (url) fs.rmSync(fileOf(url), { force: true });
      }
    }

    const [users] = await pool.query(`SELECT id FROM users WHERE email LIKE '${prefix}_%'`);
    const ids = users.map((u) => u.id);
    if (ids.length > 0) {
      const list = ids.join(',');
      await pool.query(`DELETE FROM incidents WHERE reported_by IN (${list})`);
      await pool.query(`DELETE FROM appointments WHERE customer_id IN (${list}) OR employee_id IN (?, ?)`, [emp1, emp2]);
      await pool.query(`DELETE FROM employees WHERE id IN (?, ?)`, [emp1, emp2]);
      await pool.query(`DELETE FROM pets WHERE customer_id IN (${list})`);
      await pool.query(`DELETE FROM system_logs WHERE user_id IN (${list})`);
      await pool.query(`DELETE FROM users WHERE id IN (${list})`);
    }
  });

  // ============ Tiếp nhận / bắt đầu / hoàn tất ============

  test('C1. Không token -> 401; khách hàng tiếp nhận -> 403', async () => {
    const id = await insertAppointment();
    const noToken = await request(app).patch(`/api/appointments/${id}/check-in`);
    expect(noToken.status).toBe(401);

    const cust = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(custA));
    expect(cust.status).toBe(403);
    expect(await statusOf(id)).toBe('confirmed');
  });

  test('C2. Nhân viên không tiếp nhận được lịch của nhân viên khác -> 403; admin thì được', async () => {
    const id = await insertAppointment({ employeeId: emp1 });
    const other = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff2));
    expect(other.status).toBe(403);
    expect(await statusOf(id)).toBe('confirmed');

    const byAdmin = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(admin));
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.appointment.status).toBe('checked_in');
  });

  test('C3. Tiếp nhận lịch chưa xác nhận (pending) -> 409', async () => {
    const id = await insertAppointment({ status: 'pending' });
    const res = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1));
    expect(res.status).toBe(409);
    expect(await statusOf(id)).toBe('pending');
  });

  test('C4. Tiếp nhận có ghi chú và ảnh trước -> 200, lưu hồ sơ chăm sóc và file ảnh', async () => {
    const id = await insertAppointment();
    const res = await request(app)
      .patch(`/api/appointments/${id}/check-in`)
      .set(authHeader(staff1))
      .field('initialHealthNotes', 'Có ve ở tai trái, da hơi đỏ')
      .attach('photo_before', PNG, { filename: 'truoc.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('checked_in');
    const record = res.body.data.care_record;
    expect(record.initial_health_notes).toBe('Có ve ở tai trái, da hơi đỏ');
    expect(record.photo_before_url).toMatch(/^\/api\/care-photos\/[0-9a-f-]+\.png$/);
    expect(fs.existsSync(fileOf(record.photo_before_url))).toBe(true);
    expect(record.employee_id).toBe(emp1);
  });

  test('C5. Tiếp nhận lần hai -> 409', async () => {
    const id = await insertAppointment();
    const first = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1));
    expect(first.status).toBe(200);
    const second = await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1));
    expect(second.status).toBe(409);
  });

  test('C6. File giả làm ảnh -> 422, lịch giữ nguyên trạng thái và không để lại file rác', async () => {
    const id = await insertAppointment();
    const before = filesIn();
    const res = await request(app)
      .patch(`/api/appointments/${id}/check-in`)
      .set(authHeader(staff1))
      .attach('photo_before', Buffer.from('day khong phai anh'), { filename: 'gia.png', contentType: 'image/png' });

    expect(res.status).toBe(422);
    expect(await statusOf(id)).toBe('confirmed');
    expect(filesIn()).toBe(before);
  });

  test('C7. Bắt đầu: chỉ khi đã tiếp nhận (confirmed -> 409, checked_in -> 200)', async () => {
    const id = await insertAppointment();
    const early = await request(app).patch(`/api/appointments/${id}/start`).set(authHeader(staff1));
    expect(early.status).toBe(409);

    await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1));
    const ok = await request(app).patch(`/api/appointments/${id}/start`).set(authHeader(staff1));
    expect(ok.status).toBe(200);
    expect(ok.body.data.appointment.status).toBe('in_progress');
  });

  test('C8. Hoàn tất: thiếu ghi chú -> 422; đủ ghi chú + ảnh sau -> 200', async () => {
    const id = await insertAppointment();
    await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1));
    await request(app).patch(`/api/appointments/${id}/start`).set(authHeader(staff1));

    const noNotes = await request(app).patch(`/api/appointments/${id}/complete`).set(authHeader(staff1)).send({});
    expect(noNotes.status).toBe(422);
    expect(await statusOf(id)).toBe('in_progress');

    const ok = await request(app)
      .patch(`/api/appointments/${id}/complete`)
      .set(authHeader(staff1))
      .field('treatmentNotes', 'Bé hợp tác, đã tắm sấy và gỡ rối lông')
      .field('recommendations', 'Chải lông mỗi ngày, tránh tắm trong 1 tuần')
      .attach('photo_after', PNG, { filename: 'sau.png', contentType: 'image/png' });

    expect(ok.status).toBe(200);
    expect(ok.body.data.appointment.status).toBe('completed');
    const record = ok.body.data.care_record;
    expect(record.treatment_notes).toMatch(/gỡ rối lông/);
    expect(record.recommendations).toMatch(/Chải lông/);
    expect(fs.existsSync(fileOf(record.photo_after_url))).toBe(true);
  });

  test('C9. Không đổi thẳng sang checked_in/completed bằng /status; vẫn lưu được ghi chú nội bộ', async () => {
    const id = await insertAppointment();
    const jump = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set(authHeader(staff1))
      .send({ status: 'checked_in' });
    expect(jump.status).toBe(422);
    expect(await statusOf(id)).toBe('confirmed');

    const notes = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set(authHeader(staff1))
      .send({ status: 'confirmed', staff_notes: 'Khách đến sớm 10 phút' });
    expect(notes.status).toBe(200);
  });

  // ============ Sổ tay chăm sóc ============

  test('C10. Sổ tay: khách xem thú của mình (chỉ lần đã hoàn tất), người khác 404, staff xem tất cả', async () => {
    const done = await insertAppointment({ petId: petA });
    await request(app).patch(`/api/appointments/${done}/check-in`).set(authHeader(staff1)).send({ initialHealthNotes: 'Bình thường' });
    await request(app).patch(`/api/appointments/${done}/start`).set(authHeader(staff1));
    await request(app)
      .patch(`/api/appointments/${done}/complete`)
      .set(authHeader(staff1))
      .send({ treatmentNotes: 'Đã tắm sấy xong cho bé', recommendations: 'Chải lông' });

    // Một lần khác mới tiếp nhận, chưa xong
    const doing = await insertAppointment({ petId: petA });
    await request(app).patch(`/api/appointments/${doing}/check-in`).set(authHeader(staff1)).send({ initialHealthNotes: 'Đang làm' });

    const owner = await request(app).get(`/api/pets/${petA}/care-history`).set(authHeader(custA));
    expect(owner.status).toBe(200);
    expect(owner.body.data.pet.id).toBe(petA);
    expect(owner.body.data.records.every((r) => r.appointment_status === 'completed')).toBe(true);
    expect(owner.body.data.records.some((r) => r.appointment_id === done)).toBe(true);
    expect(owner.body.data.records.some((r) => r.appointment_id === doing)).toBe(false);

    const stranger = await request(app).get(`/api/pets/${petA}/care-history`).set(authHeader(custB));
    expect(stranger.status).toBe(404);

    const staffView = await request(app).get(`/api/pets/${petA}/care-history`).set(authHeader(staff2));
    expect(staffView.status).toBe(200);
    expect(staffView.body.data.records.some((r) => r.appointment_id === doing)).toBe(true);

    const noToken = await request(app).get(`/api/pets/${petA}/care-history`);
    expect(noToken.status).toBe(401);
  });

  test('C11. Chi tiết lịch hẹn: hồ sơ chăm sóc chỉ hiện cho khách khi đã hoàn tất', async () => {
    const id = await insertAppointment({ petId: petA });
    await request(app).patch(`/api/appointments/${id}/check-in`).set(authHeader(staff1)).send({ initialHealthNotes: 'Ổn' });

    const custMid = await request(app).get(`/api/appointments/${id}`).set(authHeader(custA));
    expect(custMid.status).toBe(200);
    expect(custMid.body.data.care_record).toBeNull();

    const staffMid = await request(app).get(`/api/appointments/${id}`).set(authHeader(staff1));
    expect(staffMid.body.data.care_record.initial_health_notes).toBe('Ổn');

    await request(app).patch(`/api/appointments/${id}/start`).set(authHeader(staff1));
    await request(app).patch(`/api/appointments/${id}/complete`).set(authHeader(staff1)).send({ treatmentNotes: 'Xong rồi nhé' });

    const custEnd = await request(app).get(`/api/appointments/${id}`).set(authHeader(custA));
    expect(custEnd.body.data.care_record.treatment_notes).toBe('Xong rồi nhé');
  });

  // ============ Sự cố ============

  let incidentId;

  test('C12. Tạo sự cố: khách 403; dữ liệu sai 422; hợp lệ 201', async () => {
    const aptOfStaff1 = await insertAppointment({ petId: petA, employeeId: emp1 });
    const body = {
      petId: petA,
      appointmentId: aptOfStaff1,
      title: 'Bé bị trầy da khi tắm',
      incidentType: 'injury',
      severity: 'high',
      description: 'Bé giật mình làm trầy nhẹ ở chân trước trong lúc tắm.',
    };

    const asCustomer = await request(app).post('/api/incidents').set(authHeader(custA)).send(body);
    expect(asCustomer.status).toBe(403);

    const badType = await request(app).post('/api/incidents').set(authHeader(staff1)).send({ ...body, incidentType: 'khong-co' });
    expect(badType.status).toBe(422);

    const shortDesc = await request(app).post('/api/incidents').set(authHeader(staff1)).send({ ...body, description: 'ngắn' });
    expect(shortDesc.status).toBe(422);

    const noPet = await request(app).post('/api/incidents').set(authHeader(staff1)).send({ ...body, petId: 99999999 });
    expect(noPet.status).toBe(422);

    const wrongPet = await request(app).post('/api/incidents').set(authHeader(staff1)).send({ ...body, petId: petB });
    expect(wrongPet.status).toBe(422);

    // Nhân viên 2 không gắn sự cố vào lịch của nhân viên 1
    const notOwner = await request(app).post('/api/incidents').set(authHeader(staff2)).send(body);
    expect(notOwner.status).toBe(403);

    const ok = await request(app).post('/api/incidents').set(authHeader(staff1)).send(body);
    expect(ok.status).toBe(201);
    expect(ok.body.data.incident.status).toBe('open');
    expect(ok.body.data.incident.severity).toBe('high');
    expect(ok.body.data.incident.reporter_name).toBeTruthy();
    incidentId = ok.body.data.incident.id;
  });

  test('C13. Danh sách sự cố: nhân viên chỉ thấy của mình, admin thấy tất cả; xem của người khác -> 404', async () => {
    const mine = await request(app).get('/api/incidents').set(authHeader(staff1));
    expect(mine.status).toBe(200);
    expect(mine.body.data.incidents.some((i) => i.id === incidentId)).toBe(true);

    const other = await request(app).get('/api/incidents').set(authHeader(staff2));
    expect(other.body.data.incidents.some((i) => i.id === incidentId)).toBe(false);

    const all = await request(app).get('/api/incidents?status=open').set(authHeader(admin));
    expect(all.body.data.incidents.some((i) => i.id === incidentId)).toBe(true);

    const peek = await request(app).get(`/api/incidents/${incidentId}`).set(authHeader(staff2));
    expect(peek.status).toBe(404);

    const asCustomer = await request(app).get('/api/incidents').set(authHeader(custA));
    expect(asCustomer.status).toBe(403);
  });

  test('C14. Admin xử lý sự cố: cần biện pháp khắc phục; resolved_at do server đặt; mở lại thì xóa', async () => {
    const byStaff = await request(app).patch(`/api/incidents/${incidentId}`).set(authHeader(staff1)).send({ status: 'investigating' });
    expect(byStaff.status).toBe(403);

    const noResolution = await request(app).patch(`/api/incidents/${incidentId}`).set(authHeader(admin)).send({ status: 'resolved' });
    expect(noResolution.status).toBe(422);

    const investigating = await request(app).patch(`/api/incidents/${incidentId}`).set(authHeader(admin)).send({ status: 'investigating' });
    expect(investigating.status).toBe(200);
    expect(investigating.body.data.incident.resolved_at).toBeNull();

    const resolved = await request(app)
      .patch(`/api/incidents/${incidentId}`)
      .set(authHeader(admin))
      .send({ status: 'resolved', resolution: 'Đã sát trùng vết trầy và báo chủ nuôi.' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.incident.status).toBe('resolved');
    expect(resolved.body.data.incident.resolved_at).not.toBeNull();

    const reopened = await request(app).patch(`/api/incidents/${incidentId}`).set(authHeader(admin)).send({ status: 'open' });
    expect(reopened.body.data.incident.resolved_at).toBeNull();

    const missing = await request(app).patch('/api/incidents/99999999').set(authHeader(admin)).send({ status: 'open' });
    expect(missing.status).toBe(404);
  });

  test('C15. Ghi nhật ký hệ thống cho tiếp nhận và sự cố', async () => {
    const [checkInLogs] = await pool.query(
      `SELECT id FROM system_logs WHERE action = 'CHECK_IN_APPOINTMENT' AND user_id IN (?, ?)`,
      [staff1.id, admin.id]
    );
    expect(checkInLogs.length).toBeGreaterThan(0);

    const [incidentLogs] = await pool.query(
      `SELECT action FROM system_logs WHERE entity_name = 'incidents' AND entity_id = ?`,
      [incidentId]
    );
    const actions = incidentLogs.map((l) => l.action);
    expect(actions).toContain('CREATE_INCIDENT');
    expect(actions).toContain('UPDATE_INCIDENT');
  });
});
