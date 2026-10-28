import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Quản lý ca làm việc và phân ca (/api/shifts, /api/employee-shifts)', () => {
  let adminUser;
  let staffUser1;
  let staffUser2;
  let customerUser;
  let employeeId1;
  let employeeId2;
  let shiftMorningId;
  let shiftAfternoonId;
  let shiftOverlapId;
  let shiftEveningId;
  let petId;
  const prefix = 'test_shf';

  // Lấy ngày mai và ngày kia ở định dạng YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().slice(0, 10);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  beforeAll(async () => {
    adminUser = await createUser(app, { role: 'admin', prefix });
    staffUser1 = await createUser(app, { role: 'staff', prefix });
    staffUser2 = await createUser(app, { role: 'staff', prefix });
    customerUser = await createUser(app, { role: 'customer', prefix });

    // Tạo hồ sơ employees
    const [emp1] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Chăm sóc toàn diện', 2.0, '2025-01-01', 'active')`,
      [staffUser1.id]
    );
    employeeId1 = emp1.insertId;

    const [emp2] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Massage trị liệu', 1.5, '2025-02-01', 'active')`,
      [staffUser2.id]
    );
    employeeId2 = emp2.insertId;

    // Tạo một pet cho customerUser để dùng cho test lịch hẹn
    const [petRes] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status)
       VALUES (?, 'Cún Test Ca', 'dog', 'active')`,
      [customerUser.id]
    );
    petId = petRes.insertId;
  });

  afterAll(async () => {
    // Dọn dẹp appointments, employee_shifts, shifts, pets, employees, users, system_logs
    await pool.query(
      `DELETE FROM appointments WHERE customer_id = ? OR employee_id IN (?, ?)`,
      [customerUser.id, employeeId1, employeeId2]
    );
    await pool.query(
      `DELETE FROM employee_shifts WHERE employee_id IN (?, ?)`,
      [employeeId1, employeeId2]
    );
    if (shiftMorningId || shiftAfternoonId || shiftOverlapId || shiftEveningId) {
      const shiftIds = [shiftMorningId, shiftAfternoonId, shiftOverlapId, shiftEveningId].filter(Boolean);
      if (shiftIds.length > 0) {
        await pool.query(`DELETE FROM shifts WHERE id IN (${shiftIds.join(',')})`);
      }
    }
    await pool.query(`DELETE FROM pets WHERE id = ?`, [petId]);
    await pool.query(`DELETE FROM employees WHERE id IN (?, ?)`, [employeeId1, employeeId2]);
    await pool.query(
      `DELETE FROM system_logs WHERE user_id IN (?, ?, ?, ?)`,
      [adminUser.id, staffUser1.id, staffUser2.id, customerUser.id]
    );
    await pool.query(`DELETE FROM users WHERE email LIKE '${prefix}_%'`);
  });

  // ==========================================
  // PHẦN 1: CA LÀM MẪU (/api/shifts)
  // ==========================================

  test('S1. Chưa đăng nhập xem GET /api/shifts -> 401', async () => {
    const res = await request(app).get('/api/shifts');
    expect(res.status).toBe(401);
  });

  test('S2. Customer hoặc Staff tạo ca làm việc -> 403', async () => {
    const resCust = await request(app)
      .post('/api/shifts')
      .set(authHeader(customerUser))
      .send({ shift_name: 'Ca Trưa Thử', start_time: '11:00', end_time: '13:00' });
    expect(resCust.status).toBe(403);

    const resStaff = await request(app)
      .post('/api/shifts')
      .set(authHeader(staffUser1))
      .send({ shift_name: 'Ca Trưa Thử', start_time: '11:00', end_time: '13:00' });
    expect(resStaff.status).toBe(403);
  });

  test('S3. Admin tạo ca mẫu hợp lệ -> 201', async () => {
    // Tạo Ca sáng (08:00 - 12:00)
    const res1 = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Sáng ${Date.now()}`,
        start_time: '08:00',
        end_time: '12:00',
        description: 'Ca làm việc buổi sáng',
      });
    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    shiftMorningId = res1.body.data.id;

    // Tạo Ca chiều (13:00 - 17:00)
    const res2 = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Chiều ${Date.now()}`,
        start_time: '13:00',
        end_time: '17:00',
        description: 'Ca làm việc buổi chiều',
      });
    expect(res2.status).toBe(201);
    shiftAfternoonId = res2.body.data.id;

    // Tạo Ca chồng giờ với ca sáng (10:00 - 14:00)
    const res3 = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Chồng Giờ ${Date.now()}`,
        start_time: '10:00',
        end_time: '14:00',
      });
    expect(res3.status).toBe(201);
    shiftOverlapId = res3.body.data.id;

    // Tạo Ca tối (18:00 - 21:00)
    const res4 = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Tối ${Date.now()}`,
        start_time: '18:00',
        end_time: '21:00',
      });
    expect(res4.status).toBe(201);
    shiftEveningId = res4.body.data.id;
  });

  test('S4. Giờ kết thúc <= giờ bắt đầu hoặc không phải bội số 5 phút -> 422', async () => {
    // Giờ kết thúc trước giờ bắt đầu
    const resEndBeforeStart = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Lỗi Giờ ${Date.now()}`,
        start_time: '14:00',
        end_time: '10:00',
      });
    expect(resEndBeforeStart.status).toBe(422);

    // Không phải bội số của 5 phút (10:03)
    const resNot5Min = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({
        shift_name: `Ca Lỗi Phút ${Date.now()}`,
        start_time: '10:03',
        end_time: '12:00',
      });
    expect(resNot5Min.status).toBe(422);
  });

  test('S5. Tạo ca trùng tên -> 422', async () => {
    const shiftName = `Ca Trùng Tên ${Date.now()}`;
    await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({ shift_name: shiftName, start_time: '08:00', end_time: '10:00' });

    const resDup = await request(app)
      .post('/api/shifts')
      .set(authHeader(adminUser))
      .send({ shift_name: shiftName, start_time: '10:00', end_time: '12:00' });
    expect(resDup.status).toBe(422);
    expect(resDup.body.errors).toBeDefined();
  });

  // ==========================================
  // PHẦN 2: PHÂN CA LÀM VIỆC (/api/employee-shifts)
  // ==========================================

  test('P1. Phân ca vào ngày quá khứ -> bị từ chối / skipped với lý do phù hợp', async () => {
    const res = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftMorningId],
        from: yesterdayStr,
        to: yesterdayStr,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.skipped.length).toBe(1);
    expect(res.body.data.skipped[0].reason).toMatch(/quá khứ/i);
  });

  test('P2. Phân ca hàng loạt hợp lệ -> 201, created: 2, skipped: []', async () => {
    const res = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftMorningId],
        from: tomorrowStr,
        to: dayAfterTomorrowStr,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.skipped).toEqual([]);
  });

  test('P3. Chạy lần 2 cùng dữ liệu -> tất cả skipped vì UNIQUE', async () => {
    const res = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftMorningId],
        from: tomorrowStr,
        to: dayAfterTomorrowStr,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.skipped.length).toBe(2);
    expect(res.body.data.skipped[0].reason).toMatch(/Đã được phân ca này/i);
  });

  test('P4. Phân ca bị chồng giờ -> skipped với lý do "Trùng giờ với ca khác trong ngày"', async () => {
    // shiftOverlapId (10:00 - 14:00) chồng giờ với shiftMorningId (08:00 - 12:00) đã có ở ngày mai
    const res = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftOverlapId],
        from: tomorrowStr,
        to: tomorrowStr,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.skipped.length).toBe(1);
    expect(res.body.data.skipped[0].reason).toMatch(/Trùng giờ/i);
  });

  test('P5. Thêm ca thứ 2 không chồng giờ -> thành công; thêm ca thứ 3 -> skipped "tối đa 2 ca"', async () => {
    // Phân ca chiều (13:00 - 17:00) vào ngày mai (ca thứ 2 không trùng giờ) -> OK
    const res2nd = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftAfternoonId],
        from: tomorrowStr,
        to: tomorrowStr,
      });
    expect(res2nd.status).toBe(201);
    expect(res2nd.body.data.created).toBe(1);

    // Phân ca thứ 3 (Ca tối 18:00 - 21:00) vào ngày mai -> Đã đạt tối đa 2 ca
    const res3rd = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftEveningId],
        from: tomorrowStr,
        to: tomorrowStr,
      });
    expect(res3rd.status).toBe(201);
    expect(res3rd.body.data.created).toBe(0);
    expect(res3rd.body.data.skipped.length).toBe(1);
    expect(res3rd.body.data.skipped[0].reason).toMatch(/tối đa 2 ca/i);
  });

  test('P6. Khoảng ngày > 62 ngày -> 422', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 70);
    const futureStr = futureDate.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/employee-shifts/bulk')
      .set(authHeader(adminUser))
      .send({
        employee_id: employeeId1,
        shift_ids: [shiftMorningId],
        from: tomorrowStr,
        to: futureStr,
      });
    expect(res.status).toBe(422);
  });

  test('P7. Staff xem /me chỉ thấy ca của mình dù truyền employee_id người khác', async () => {
    // Staff 1 xem ca của mình
    const res = await request(app)
      .get(`/api/employee-shifts/me?employee_id=${employeeId2}`)
      .set(authHeader(staffUser1));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employee_id).toBe(employeeId1);
    // Các bản ghi trả về đều là của employeeId1
    for (const record of res.body.data.records) {
      expect(record.employee_id).toBe(employeeId1);
    }
  });

  test('P8. Không xóa cứng ca đã được phân công -> 409', async () => {
    // shiftMorningId đang được phân cho employeeId1
    const resDel = await request(app)
      .delete(`/api/shifts/${shiftMorningId}`)
      .set(authHeader(adminUser));
    expect(resDel.status).toBe(409);
    expect(resDel.body.message).toMatch(/đã có .* lượt phân ca/i);
  });

  test('P9. Ẩn ca đang dùng -> thành công nếu chưa có lịch hẹn', async () => {
    const resHide = await request(app)
      .put(`/api/shifts/${shiftMorningId}`)
      .set(authHeader(adminUser))
      .send({ is_active: false });
    expect(resHide.status).toBe(200);
    expect(resHide.body.data.is_active).toBe(false);

    // Bật lại
    await request(app)
      .put(`/api/shifts/${shiftMorningId}`)
      .set(authHeader(adminUser))
      .send({ is_active: true });
  });

  test('P10. Xóa phân ca có lịch hẹn -> 409; xóa khi không có lịch hẹn -> 200', async () => {
    // Lấy ID một bản ghi phân ca của employeeId1 ở ngày mai (Ca Sáng 08:00 - 12:00)
    const [empShifts] = await pool.query(
      `SELECT id FROM employee_shifts WHERE employee_id = ? AND shift_id = ? AND work_date = ? LIMIT 1`,
      [employeeId1, shiftMorningId, tomorrowStr]
    );
    expect(empShifts.length).toBe(1);
    const empShiftId = empShifts[0].id;

    // Giả lập 1 lịch hẹn của nhân viên 1 vào ngày mai lúc 09:00 - 10:00 (nằm trong Ca Sáng)
    const aptCode = `APT-${Date.now()}`;
    const [aptRes] = await pool.query(
      `INSERT INTO appointments (appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, '09:00:00', '10:00:00', 'confirmed')`,
      [aptCode, customerUser.id, petId, employeeId1, tomorrowStr]
    );
    const appointmentId = aptRes.insertId;

    // Cố gắng xóa phân ca -> phải bị 409 vì có lịch hẹn
    const resDelConflict = await request(app)
      .delete(`/api/employee-shifts/${empShiftId}`)
      .set(authHeader(adminUser));
    expect(resDelConflict.status).toBe(409);
    expect(resDelConflict.body.message).toMatch(/lịch hẹn trong ca làm việc này/i);

    // Xóa lịch hẹn thử nghiệm
    await pool.query(`DELETE FROM appointments WHERE id = ?`, [appointmentId]);

    // Xóa lại phân ca -> thành công 200
    const resDelSuccess = await request(app)
      .delete(`/api/employee-shifts/${empShiftId}`)
      .set(authHeader(adminUser));
    expect(resDelSuccess.status).toBe(200);
  });

  // ==========================================
  // PHẦN 3: BỔ SUNG KIỂM TRA BẢO MẬT & PHẠM VI NGÀY
  // ==========================================

  test('P11. Staff gọi GET /api/employee-shifts/me không tham số -> 200 và có mảng records', async () => {
    const res = await request(app)
      .get('/api/employee-shifts/me')
      .set(authHeader(staffUser1));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.records)).toBe(true);
    expect(res.body.data.employee_id).toBe(employeeId1);
  });

  test('P12. Admin gọi GET /api/employee-shifts với khoảng ngày > 62 ngày -> 422', async () => {
    const res = await request(app)
      .get('/api/employee-shifts?from=2026-01-01&to=2026-12-31')
      .set(authHeader(adminUser));

    expect(res.status).toBe(422);
  });

  test('P13. Khách gọi GET /api/employees -> mỗi phần tử KHÔNG có user_id, email, phone, birth_year, address', async () => {
    const res = await request(app).get('/api/employees');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    for (const emp of res.body.data) {
      expect(emp.user_id).toBeUndefined();
      expect(emp.email).toBeUndefined();
      expect(emp.phone).toBeUndefined();
      expect(emp.birth_year).toBeUndefined();
      expect(emp.address).toBeUndefined();
    }
  });
});

