import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { createUser, authHeader, uniqueStamp } from './helpers/users.js';

let admin;
let staff;
let customer;

const newService = (extra = {}) => ({
  name: `TEST_${uniqueStamp()}`,
  description: 'Mô tả dịch vụ thử nghiệm',
  price: 150000,
  duration_minutes: 45,
  ...extra,
});

const createService = (user, body) => request(app).post('/api/services').set(authHeader(user)).send(body);

beforeAll(async () => {
  admin = await createUser(app, { role: 'admin', prefix: 'test_sv' });
  staff = await createUser(app, { role: 'staff', prefix: 'test_sv' });
  customer = await createUser(app, { role: 'customer', prefix: 'test_sv' });
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM services WHERE name LIKE 'TEST\\_%'`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_sv\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test dịch vụ:', err.message);
  } finally {
    await pool.end();
  }
});

describe('Dịch vụ: phân quyền', () => {
  test('S1. Không có token → 401', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(401);
  });

  test('S2. Customer và staff không được tạo dịch vụ → 403', async () => {
    expect((await createService(customer, newService())).status).toBe(403);
    expect((await createService(staff, newService())).status).toBe(403);
  });

  test('S3. Customer không được sửa hoặc bật/tắt dịch vụ → 403', async () => {
    const created = await createService(admin, newService());
    const id = created.body.data.service.id;

    const put = await request(app).put(`/api/services/${id}`).set(authHeader(customer)).send({ price: 1 });
    expect(put.status).toBe(403);

    const patch = await request(app).patch(`/api/services/${id}/active`).set(authHeader(staff)).send({ is_active: false });
    expect(patch.status).toBe(403);
  });
});

describe('Dịch vụ: admin quản lý', () => {
  test('S4. Admin tạo dịch vụ hợp lệ → 201, price là number, có ghi log', async () => {
    const body = newService();
    const res = await createService(admin, body);
    expect(res.status).toBe(201);
    expect(res.body.data.service.name).toBe(body.name);
    expect(typeof res.body.data.service.price).toBe('number');
    expect(res.body.data.service.is_active).toBe(true);

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs WHERE action = 'CREATE_SERVICE' AND entity_id = ? AND user_id = ?`,
      [res.body.data.service.id, admin.id]
    );
    expect(rows[0].total).toBe(1);
  });

  test('S5. Dữ liệu sai (giá âm, thời lượng 0, tên quá ngắn) → 422, lỗi theo từng trường', async () => {
    const res = await createService(admin, { name: 'a', price: -5, duration_minutes: 0 });
    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'price', 'duration_minutes']));
  });

  test('S6. Trùng tên dịch vụ → 422 gắn trường name', async () => {
    const body = newService();
    await createService(admin, body);
    const dup = await createService(admin, { ...body, name: body.name.toLowerCase() });
    expect(dup.status).toBe(422);
    expect(dup.body.errors[0].field).toBe('name');
  });

  test('S7. Admin sửa giá → 200, ghi log UPDATE_SERVICE', async () => {
    const created = await createService(admin, newService());
    const id = created.body.data.service.id;

    const res = await request(app).put(`/api/services/${id}`).set(authHeader(admin)).send({ price: 99000 });
    expect(res.status).toBe(200);
    expect(res.body.data.service.price).toBe(99000);

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs WHERE action = 'UPDATE_SERVICE' AND entity_id = ? AND user_id = ?`,
      [id, admin.id]
    );
    expect(rows[0].total).toBe(1);
  });

  test('S8. PUT không có trường nào để cập nhật → 422', async () => {
    const created = await createService(admin, newService());
    const res = await request(app)
      .put(`/api/services/${created.body.data.service.id}`)
      .set(authHeader(admin))
      .send({});
    expect(res.status).toBe(422);
  });

  test('S9. Sửa dịch vụ không tồn tại → 404; ID không phải số → 400', async () => {
    const missing = await request(app).put('/api/services/99999999').set(authHeader(admin)).send({ price: 1000 });
    expect(missing.status).toBe(404);
    const bad = await request(app).get('/api/services/abc').set(authHeader(admin));
    expect(bad.status).toBe(400);
  });
});

describe('Dịch vụ: ẩn / hiện', () => {
  test('S10. Dịch vụ bị ẩn: khách không thấy (danh sách + chi tiết), staff/admin vẫn thấy', async () => {
    const body = newService();
    const created = await createService(admin, body);
    const id = created.body.data.service.id;

    const off = await request(app).patch(`/api/services/${id}/active`).set(authHeader(admin)).send({ is_active: false });
    expect(off.status).toBe(200);
    expect(off.body.data.service.is_active).toBe(false);

    const customerList = await request(app).get('/api/services?limit=1000').set(authHeader(customer));
    expect(customerList.status).toBe(200);
    expect(customerList.body.data.services.some((s) => s.id === id)).toBe(false);
    expect(customerList.body.data.services.every((s) => s.is_active === true)).toBe(true);

    const customerDetail = await request(app).get(`/api/services/${id}`).set(authHeader(customer));
    expect(customerDetail.status).toBe(404);

    const staffDetail = await request(app).get(`/api/services/${id}`).set(authHeader(staff));
    expect(staffDetail.status).toBe(200);

    const adminHidden = await request(app).get('/api/services?is_active=false').set(authHeader(admin));
    expect(adminHidden.body.data.services.some((s) => s.id === id)).toBe(true);
  });

  test('S11. Bật lại dịch vụ → khách thấy lại', async () => {
    const created = await createService(admin, newService());
    const id = created.body.data.service.id;
    await request(app).patch(`/api/services/${id}/active`).set(authHeader(admin)).send({ is_active: false });
    await request(app).patch(`/api/services/${id}/active`).set(authHeader(admin)).send({ is_active: true });

    const res = await request(app).get(`/api/services/${id}`).set(authHeader(customer));
    expect(res.status).toBe(200);
  });

  test('S12. Gửi is_active sai kiểu → 422', async () => {
    const created = await createService(admin, newService());
    const res = await request(app)
      .patch(`/api/services/${created.body.data.service.id}/active`)
      .set(authHeader(admin))
      .send({ is_active: 'yes' });
    expect(res.status).toBe(422);
  });

  test('S13. Tìm kiếm theo tên', async () => {
    const body = newService({ name: `TEST_TimKiem_${uniqueStamp()}` });
    await createService(admin, body);
    const res = await request(app).get(`/api/services?search=${encodeURIComponent('TimKiem')}`).set(authHeader(staff));
    expect(res.status).toBe(200);
    expect(res.body.data.services.some((s) => s.name === body.name)).toBe(true);
  });
});
