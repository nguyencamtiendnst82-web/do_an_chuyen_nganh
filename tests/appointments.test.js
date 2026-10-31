import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Kiểm thử phân hệ Đặt lịch & Phân công nhân viên (/api/appointments)', () => {
  let adminUser;
  let staffUser1;
  let staffUser2;
  let customerUserA;
  let customerUserB;
  let noPhoneCustomer;

  let employeeId1;
  let employeeId2;
  let petA1;
  let petA2;
  let petB;
  let serviceBathId;
  let serviceHaircutId;
  let shiftMorningId;
  let shiftAfternoonId;

  const prefix = 'test_apt';

    // Ngày theo giờ địa phương (khớp với server), không dùng toISOString (giờ UTC)
  const dateOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const yesterdayStr = dateOffset(-1);
  const tomorrowStr = dateOffset(1);
  const dayAfterTomorrowStr = dateOffset(2);
  let otherShifts = []; // ca của nhân viên có sẵn, được tạm đánh dấu nghỉ

  beforeAll(async () => {
    adminUser = await createUser(app, { role: 'admin', prefix });
    staffUser1 = await createUser(app, { role: 'staff', prefix });
    staffUser2 = await createUser(app, { role: 'staff', prefix });
    customerUserA = await createUser(app, { role: 'customer', prefix });
    customerUserB = await createUser(app, { role: 'customer', prefix });
    noPhoneCustomer = await createUser(app, { role: 'customer', prefix });

    // Cập nhật noPhoneCustomer.phone = NULL để mô phỏng user đăng nhập Google chưa có SĐT
    await pool.query(`UPDATE users SET phone = NULL WHERE id = ?`, [noPhoneCustomer.id]);

    // Tạo hồ sơ employees cho 2 staff
    const [e1] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Tắm & Vệ sinh', 3.0, '2024-01-01', 'active')`,
      [staffUser1.id]
    );
    employeeId1 = e1.insertId;

    const [e2] = await pool.query(
      `INSERT INTO employees (user_id, specialty, experience_years, hire_date, status)
       VALUES (?, 'Cắt tỉa lông', 2.0, '2024-06-01', 'active')`,
      [staffUser2.id]
    );
    employeeId2 = e2.insertId;

    // Tạo thú cưng
    const [pA1] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Miu Miu A1', 'cat', 'active')`,
      [customerUserA.id]
    );
    petA1 = pA1.insertId;

    const [pA2] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Gâu Gâu A2', 'dog', 'active')`,
      [customerUserA.id]
    );
    petA2 = pA2.insertId;

    const [pB] = await pool.query(
      `INSERT INTO pets (customer_id, name, species, status) VALUES (?, 'Cún Con B', 'dog', 'active')`,
      [customerUserB.id]
    );
    petB = pB.insertId;

    // Tạo dịch vụ:
    // 1. Tắm sấy (60 phút, 150.000đ)
    // 2. Cắt tỉa tạo kiểu (60 phút, 250.000đ)
    const [s1] = await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active)
       VALUES (?, 150000.00, 60, TRUE)`,
      [`Tắm sấy ${Date.now()}`]
    );
    serviceBathId = s1.insertId;

    const [s2] = await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active)
       VALUES (?, 250000.00, 60, TRUE)`,
      [`Cắt tỉa ${Date.now()}`]
    );
    serviceHaircutId = s2.insertId;

    // Tạo 2 ca mẫu: Ca sáng 08:00 - 12:00, Ca chiều 13:00 - 17:00
    const [sh1] = await pool.query(
      `INSERT INTO shifts (shift_name, start_time, end_time, is_active)
       VALUES (?, '08:00:00', '12:00:00', TRUE)`,
      [`Ca Sáng ${Date.now()}`]
    );
    shiftMorningId = sh1.insertId;

    const [sh2] = await pool.query(
      `INSERT INTO shifts (shift_name, start_time, end_time, is_active)
       VALUES (?, '13:00:00', '17:00:00', TRUE)`,
      [`Ca Chiều ${Date.now()}`]
    );
    shiftAfternoonId = sh2.insertId;

    // Phân ca cho ngày mai:
    // Staff 1 trực Ca Sáng (08:00 - 12:00)
    // Staff 2 trực Ca Sáng (08:00 - 12:00) và Ca Chiều (13:00 - 17:00)
    await pool.query(
      `INSERT INTO employee_shifts (employee_id, shift_id, work_date, status)
       VALUES (?, ?, ?, 'scheduled'), (?, ?, ?, 'scheduled'), (?, ?, ?, 'scheduled')`,
      [
        employeeId1,
        shiftMorningId,
        tomorrowStr,
        employeeId2,
        shiftMorningId,
        tomorrowStr,
        employeeId2,
        shiftAfternoonId,
        tomorrowStr,
      ]
    );

    // Ngày kia: nhân viên 2 trực cả 2 ca (cho A11, A12, A14)
    await pool.query(
      `INSERT INTO employee_shifts (employee_id, shift_id, work_date, status)
       VALUES (?, ?, ?, 'scheduled'), (?, ?, ?, 'scheduled')`,
      [employeeId2, shiftMorningId, dayAfterTomorrowStr, employeeId2, shiftAfternoonId, dayAfterTomorrowStr]
    );

    // Cô lập test: nhân viên có sẵn trong DB tạm nghỉ ngày mai, để A8 và A9 chỉ còn 2 nhân viên test
    const [others] = await pool.query(
      `SELECT id, status FROM employee_shifts
       WHERE work_date = ? AND employee_id NOT IN (?, ?)`,
      [tomorrowStr, employeeId1, employeeId2]
    );
    otherShifts = others;
    await pool.query(
      `UPDATE employee_shifts SET status = 'absent'
       WHERE work_date = ? AND employee_id NOT IN (?, ?)`,
      [tomorrowStr, employeeId1, employeeId2]
    );
  });

  afterAll(async () => {
    for (const s of otherShifts) {
      await pool.query('UPDATE employee_shifts SET status = ? WHERE id = ?', [s.status, s.id]);
    }
    // Dọn dẹp appointment_details, appointments, employee_shifts, shifts, services, pets, employees, system_logs, users
    const [allTestUsers] = await pool.query(
      `SELECT id FROM users WHERE email LIKE '${prefix}_%'`
    );
    const userIds = allTestUsers.map((u) => u.id);

    if (userIds.length > 0) {
      await pool.query(`DELETE FROM appointment_details WHERE appointment_id IN (SELECT id FROM appointments WHERE customer_id IN (${userIds.join(',')}))`);
      await pool.query(`DELETE FROM appointments WHERE customer_id IN (${userIds.join(',')}) OR employee_id IN (?, ?)`, [employeeId1, employeeId2]);
      await pool.query(`DELETE FROM employee_shifts WHERE employee_id IN (?, ?)`, [employeeId1, employeeId2]);
      await pool.query(`DELETE FROM employees WHERE id IN (?, ?)`, [employeeId1, employeeId2]);
      await pool.query(`DELETE FROM pets WHERE customer_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM system_logs WHERE user_id IN (${userIds.join(',')})`);
      await pool.query(`DELETE FROM users WHERE id IN (${userIds.join(',')})`);
    }

    if (serviceBathId || serviceHaircutId) {
      await pool.query(`DELETE FROM services WHERE id IN (?, ?)`, [serviceBathId, serviceHaircutId]);
    }
    if (shiftMorningId || shiftAfternoonId) {
      await pool.query(`DELETE FROM shifts WHERE id IN (?, ?)`, [shiftMorningId, shiftAfternoonId]);
    }
  });

  // ==========================================
  // 1. VALIDATION CƠ BẢN VÀ ĐIỀU KIỆN TIÊN QUYẾT
  // ==========================================

  test('A1. Khách hàng chưa có số điện thoại (login Google) đặt lịch -> 422', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(noPhoneCustomer))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '08:30',
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/cập nhật số điện thoại trong Hồ sơ/i);
  });

  test('A2. Đặt lịch ở ngày quá khứ -> 422; đặt lịch quá 60 ngày tới -> 422', async () => {
    const resPast = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: yesterdayStr,
        startTime: '09:00',
      });
    expect(resPast.status).toBe(422);
    expect(resPast.body.message).toMatch(/quá khứ/i);

    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 70);
    const farFutureStr = farFuture.toISOString().slice(0, 10);

    const resFar = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: farFutureStr,
        startTime: '09:00',
      });
    expect(resFar.status).toBe(422);
    expect(resFar.body.message).toMatch(/60 ngày/i);
  });

  // ==========================================
  // 2. TÍNH TOÁN GIỜ, TRỌN CA VÀ GIÁ SNAPSHOT
  // ==========================================

  test('A3. Đặt lịch ngoài ca làm việc hoặc bắc qua 2 ca -> 409', async () => {
    // Staff 1 chỉ trực ca sáng 08:00 - 12:00. Đặt lúc 13:00 -> ngoài ca
    const resOut = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '13:00',
        employeeId: employeeId1,
      });
    expect(resOut.status).toBe(409);
    expect(resOut.body.message).toMatch(/nằm trọn trong một ca làm việc/i);

    // Dịch vụ 60 phút nhưng bắt đầu lúc 11:30 (kết thúc 12:30 vượt qua 12:00 của ca sáng) -> 409
    const resCross = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '11:30',
        employeeId: employeeId1,
      });
    expect(resCross.status).toBe(409);
    expect(resCross.body.message).toMatch(/nằm trọn trong một ca làm việc/i);
  });

  test('A4. Đặt lịch hợp lệ: end_time tự tính từ dịch vụ, giá snapshot đúng', async () => {
    // Đặt dịch vụ Tắm (60p - 150k) + Cắt tỉa (60p - 250k) = tổng 120 phút. Start 08:30 -> End 10:30
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId, serviceHaircutId],
        appointmentDate: tomorrowStr,
        startTime: '08:30',
        employeeId: employeeId1,
        customerNotes: 'Bé hơi nhát nước',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appointment_code).toMatch(/^APT-\d{8}-\d{3}$/);
    expect(res.body.data.start_time.slice(0, 5)).toBe('08:30');
    expect(res.body.data.end_time.slice(0, 5)).toBe('10:30');
    expect(res.body.data.status).toBe('pending');

    // Kiểm tra chi tiết giá snapshot
    expect(res.body.data.details.length).toBe(2);
    const bathDetail = res.body.data.details.find((d) => d.service_id === serviceBathId);
    expect(bathDetail.price_at_booking).toBe(150000);
    expect(bathDetail.duration_minutes).toBe(60);

    // Admin đổi giá dịch vụ Tắm thành 500.000đ sau đó
    await pool.query(`UPDATE services SET price = 500000.00 WHERE id = ?`, [serviceBathId]);

    // Giá trong lịch hẹn đã đặt vẫn giữ nguyên 150.000đ (snapshot không đổi)
    const resGet = await request(app)
      .get(`/api/appointments/${res.body.data.id}`)
      .set(authHeader(customerUserA));
    const bathDetailAfter = resGet.body.data.details.find((d) => d.service_id === serviceBathId);
    expect(bathDetailAfter.price_at_booking).toBe(150000);

    // Khôi phục giá dịch vụ
    await pool.query(`UPDATE services SET price = 150000.00 WHERE id = ?`, [serviceBathId]);
  });

  // ==========================================
  // 3. CHỐNG TRÙNG LỊCH NHÂN VIÊN & THÚ CƯNG
  // ==========================================

  test('A5. Trùng lịch theo nhân viên -> 409', async () => {
    // Staff 1 đã có lịch 08:30 - 10:30 (từ test A4).
    // Khách B cố đặt Staff 1 lúc 09:00 - 10:00 (chồng giờ) -> 409
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '09:00',
        employeeId: employeeId1,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Nhân viên đã có lịch hẹn trùng/i);
  });

  test('A6. Cách nhau đúng thời gian đệm (15 phút) -> KHÔNG bị trùng', async () => {
    // Staff 1 đã có lịch 08:30 - 10:30. Đệm 15 phút -> nhận lịch tiếp từ 10:45.
    // Đặt từ 10:45 - 11:45 -> thành công
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '10:45',
        employeeId: employeeId1,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.start_time.slice(0, 5)).toBe('10:45');
    expect(res.body.data.end_time.slice(0, 5)).toBe('11:45');
  });

  test('A7. Trùng lịch theo thú cưng -> 409', async () => {
    // petA1 đã có lịch hẹn 08:30 - 10:30 với Staff 1.
    // Khách A cố đặt lịch khác cho petA1 với Staff 2 lúc 09:00 - 10:00 -> 409
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA1,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '09:00',
        employeeId: employeeId2,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Thú cưng.*đã có lịch hẹn khác trùng/i);
  });

  // ==========================================
  // 4. TỰ PHÂN CÔNG (CÂN BẰNG TẢI) & KHUNG GIỜ KÍN
  // ==========================================

  test('A8. Tự phân công cân bằng tải: chọn người có ít lịch hơn', async () => {
    // Ngày mai: Staff 1 đã có 2 lịch hẹn, Staff 2 chưa có lịch nào.
    // Khách A đặt cho petA2 lúc 08:00 - 09:00 không chọn nhân viên.
    // Hệ thống phải tự phân công cho Staff 2 (người ít lịch nhất)
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA2,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '08:00',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.employee_id).toBe(employeeId2);
  });

  test('A9. Khung giờ kín: tất cả nhân viên đều bận -> 409', async () => {
    // Staff 1 có lịch 08:30 - 10:30.
    // Giờ đặt Staff 2 một lịch từ 09:15 - 10:15 (sau lịch 08:00 - 09:00 + đệm 15 phút) để lấp kín khung giờ cho cả 2 nhân viên
    const resFill = await request(app)
      .post('/api/appointments')
      .set(authHeader(adminUser))
      .send({
        customerId: customerUserB.id,
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '09:15',
        employeeId: employeeId2,
      });
    expect(resFill.status).toBe(201);

    // Giờ khách A thử đặt tự phân công lúc 09:30 (cả staff 1 và 2 đều đang bận) -> 409
    const resFull = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA2,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '09:30',
      });

    expect(resFull.status).toBe(409);
    expect(resFull.body.message).toMatch(/Khung giờ đã kín/i);
  });

  // ==========================================
  // 5. CHỐNG ĐUA (RACE CONDITION) VỚI SELECT ... FOR UPDATE
  // ==========================================

  test('A10. Đua hai request song song đặt cùng giờ cùng nhân viên -> đúng 1 thành công, 1 nhận 409', async () => {
    // Khung giờ 14:00 - 15:00 ngày mai trên Staff 2 (trống)
    const req1 = request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA2,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '14:00',
        employeeId: employeeId2,
      });

    const req2 = request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: tomorrowStr,
        startTime: '14:00',
        employeeId: employeeId2,
      });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    expect(statuses).toEqual([201, 409]);
  });

  // ==========================================
  // 6. ĐỔI LỊCH (RESCHEDULE) & BẢO VỆ TỰ TRÙNG
  // ==========================================

  test('A11. Đổi lịch không bị coi là tự trùng với chính mình', async () => {
    // Đặt một lịch hẹn mới vào ngày kia
    const createRes = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA2,
        serviceIds: [serviceBathId],
        appointmentDate: dayAfterTomorrowStr,
        startTime: '10:00',
        employeeId: employeeId2,
      });
    const aptId = createRes.body.data.id;

    // Đổi giờ sang 10:30 cùng ngày cùng nhân viên -> thành công
    const resReschedule = await request(app)
      .patch(`/api/appointments/${aptId}/reschedule`)
      .set(authHeader(customerUserA))
      .send({
        appointmentDate: dayAfterTomorrowStr,
        startTime: '10:30',
        employeeId: employeeId2,
      });

    expect(resReschedule.status).toBe(200);
    expect(resReschedule.body.data.start_time.slice(0, 5)).toBe('10:30');
  });

  // ==========================================
  // 7. QUY TẮC HỦY LỊCH & BẢO MẬT KHÁCH HÀNG
  // ==========================================

  test('A12. Khách hủy thiếu lý do -> 422; hủy lịch người khác -> 404', async () => {
    // Lấy một lịch hẹn của khách B
    const createB = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: dayAfterTomorrowStr,
        startTime: '14:00',
        employeeId: employeeId2,
      });
    const aptBId = createB.body.data.id;

    // Khách A cố truy cập hoặc hủy lịch của khách B -> 404
    const resAViewB = await request(app)
      .get(`/api/appointments/${aptBId}`)
      .set(authHeader(customerUserA));
    expect(resAViewB.status).toBe(404);

    const resACancelB = await request(app)
      .patch(`/api/appointments/${aptBId}/cancel`)
      .set(authHeader(customerUserA))
      .send({ cancellationReason: 'Lý do hợp lệ nhưng không phải chủ' });
    expect(resACancelB.status).toBe(404);

    // Khách B hủy nhưng lý do rỗng -> 422
    const resBNoReason = await request(app)
      .patch(`/api/appointments/${aptBId}/cancel`)
      .set(authHeader(customerUserB))
      .send({ cancellationReason: '' });
    expect(resBNoReason.status).toBe(422);

    // Khách B hủy có lý do đầy đủ -> 200
    const resBSuccess = await request(app)
      .patch(`/api/appointments/${aptBId}/cancel`)
      .set(authHeader(customerUserB))
      .send({ cancellationReason: 'Bận đột xuất vào giờ này' });
    expect(resBSuccess.status).toBe(200);
    expect(resBSuccess.body.data.status).toBe('cancelled');
  });

  // ==========================================
  // 8. AVAILABILITY & QUY TRÌNH TRẠNG THÁI
  // ==========================================

  test('A13. GET /api/appointments/availability trả về khung giờ trống hợp lệ', async () => {
    const res = await request(app)
      .get(`/api/appointments/availability?date=${tomorrowStr}&serviceIds=${serviceBathId}`)
      .set(authHeader(customerUserA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const firstSlot = res.body.data[0];
      expect(firstSlot.startTime).toBeDefined();
      expect(firstSlot.endTime).toBeDefined();
      expect(Array.isArray(firstSlot.availableEmployees)).toBe(true);
      // Chỉ trả thông tin công khai (id, name), không có email/SĐT
      expect(firstSlot.availableEmployees[0].id).toBeDefined();
      expect(firstSlot.availableEmployees[0].name).toBeDefined();
      expect(firstSlot.availableEmployees[0].email).toBeUndefined();
      expect(firstSlot.availableEmployees[0].phone).toBeUndefined();
    }
  });

  test('A14. Chuyển trạng thái: Staff/Admin xác nhận -> 200; nhảy cóc trạng thái -> 422', async () => {
    // Tạo 1 lịch hẹn mới
    const createRes = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserA))
      .send({
        petId: petA2,
        serviceIds: [serviceBathId],
        appointmentDate: dayAfterTomorrowStr,
        startTime: '15:00',
        employeeId: employeeId2,
      });
    const aptId = createRes.body.data.id;

    // Khách cố xác nhận lịch -> 403 (chỉ staff/admin)
    const resCustConfirm = await request(app)
      .patch(`/api/appointments/${aptId}/confirm`)
      .set(authHeader(customerUserA));
    expect(resCustConfirm.status).toBe(403);

    // Staff 1 KHÔNG được thao tác lịch của Staff 2 -> 403
    const resOtherStaff = await request(app)
      .patch(`/api/appointments/${aptId}/confirm`)
      .set(authHeader(staffUser1));
    expect(resOtherStaff.status).toBe(403);

    // Staff 2 (người được phân công) xác nhận -> 200 (pending -> confirmed)
    const resStaffConfirm = await request(app)
      .patch(`/api/appointments/${aptId}/confirm`)
      .set(authHeader(staffUser2));
    expect(resStaffConfirm.status).toBe(200);
    expect(resStaffConfirm.body.data.status).toBe('confirmed');

    // Cố nhảy cóc từ confirmed sang completed -> 422
    const resJump = await request(app)
      .patch(`/api/appointments/${aptId}/status`)
      .set(authHeader(staffUser2))
      .send({ status: 'completed' });
    expect(resJump.status).toBe(422);

    // Chuyển đúng trình tự: confirmed -> checked_in -> in_progress -> completed
    // (tiếp nhận và hoàn tất đi qua chức năng riêng, không đổi thẳng bằng /status)
    const resCheckIn = await request(app)
      .patch(`/api/appointments/${aptId}/check-in`)
      .set(authHeader(staffUser2))
      .send({ initialHealthNotes: 'Bé khỏe, lông hơi rối' });
    expect(resCheckIn.status).toBe(200);
    expect(resCheckIn.body.data.appointment.status).toBe('checked_in');

    const resInProgress = await request(app)
      .patch(`/api/appointments/${aptId}/start`)
      .set(authHeader(staffUser2));
    expect(resInProgress.status).toBe(200);
    expect(resInProgress.body.data.appointment.status).toBe('in_progress');

    // Hoàn tất thiếu ghi chú -> 422
    const resNoNotes = await request(app)
      .patch(`/api/appointments/${aptId}/complete`)
      .set(authHeader(staffUser2))
      .send({});
    expect(resNoNotes.status).toBe(422);

    const resCompleted = await request(app)
      .patch(`/api/appointments/${aptId}/complete`)
      .set(authHeader(staffUser2))
      .send({ treatmentNotes: 'Bé hợp tác, tắm sấy xong', recommendations: 'Chải lông mỗi ngày' });
    expect(resCompleted.status).toBe(200);
    expect(resCompleted.body.data.appointment.status).toBe('completed');
  });

  // ==========================================
  // 9. THỜI GIAN ĐỆM GIỮA HAI LƯỢT PHỤC VỤ
  // ==========================================

  test('A15. Thời gian đệm: lịch kề sát bị 409, cách đủ đệm thì được', async () => {
    // Staff 2 ngày kia đã có lịch 15:00 - 16:00 (từ A14, đã hoàn tất).
    // Đặt 14:00 - 15:00 (kề sát, không có đệm) -> 409
    const resTooClose = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: dayAfterTomorrowStr,
        startTime: '14:00',
        employeeId: employeeId2,
      });
    expect(resTooClose.status).toBe(409);
    expect(resTooClose.body.message).toMatch(/Nhân viên đã có lịch hẹn trùng/i);

    // Đặt 13:45 - 14:45 (cách lịch 15:00 đúng 15 phút) -> 201
    const resEnough = await request(app)
      .post('/api/appointments')
      .set(authHeader(customerUserB))
      .send({
        petId: petB,
        serviceIds: [serviceBathId],
        appointmentDate: dayAfterTomorrowStr,
        startTime: '13:45',
        employeeId: employeeId2,
      });
    expect(resEnough.status).toBe(201);
  });
});

