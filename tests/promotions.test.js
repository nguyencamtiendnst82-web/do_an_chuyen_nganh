import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { createUser, authHeader } from './helpers/users.js';

describe('Quản lý khuyến mãi (/api/promotions)', () => {
  const prefix = 'test_promo';
  let admin, staff, customer, promoId;
  const body = { name: 'Khuyến mãi tháng 11', discount_type: 'percent', discount_value: 10, start_date: '2030-11-01', end_date: '2030-11-30' };

  beforeAll(async () => {
    admin = await createUser(app, { role: 'admin', prefix });
    staff = await createUser(app, { role: 'staff', prefix });
    customer = await createUser(app, { role: 'customer', prefix });
  });

  afterAll(async () => {
    if (promoId) await pool.query('DELETE FROM promotions WHERE id = ?', [promoId]);
    await pool.query("DELETE FROM system_logs WHERE entity_name = 'promotions' AND entity_id = ?", [promoId ?? 0]);
    const [users] = await pool.query(`SELECT id FROM users WHERE email LIKE '${prefix}_%'`);
    const ids = users.map((u) => u.id).join(',');
    if (ids) {
      await pool.query(`DELETE FROM system_logs WHERE user_id IN (${ids})`);
      await pool.query(`DELETE FROM users WHERE id IN (${ids})`);
    }
  });

  test('PM1. Chỉ admin: không token 401; staff và khách 403', async () => {
    expect((await request(app).get('/api/promotions')).status).toBe(401);
    expect((await request(app).get('/api/promotions').set(authHeader(staff))).status).toBe(403);
    expect((await request(app).post('/api/promotions').set(authHeader(customer)).send(body)).status).toBe(403);
  });

  test('PM2. Dữ liệu sai -> 422 (giảm % > 100, ngày kết thúc trước ngày bắt đầu, thiếu tên)', async () => {
    const send = (o) => request(app).post('/api/promotions').set(authHeader(admin)).send({ ...body, ...o });
    expect((await send({ discount_value: 150 })).status).toBe(422);
    expect((await send({ end_date: '2030-10-01' })).status).toBe(422);
    expect((await send({ name: '' })).status).toBe(422);
  });

  test('PM3. Admin tạo, sửa, tắt khuyến mãi', async () => {
    const created = await request(app).post('/api/promotions').set(authHeader(admin)).send(body);
    expect(created.status).toBe(201);
    promoId = created.body.data.promotion.id;
    expect(created.body.data.promotion.name).toBe(body.name);

    const upd = await request(app).put(`/api/promotions/${promoId}`).set(authHeader(admin)).send({ ...body, discount_value: 15 });
    expect(upd.status).toBe(200);
    expect(Number(upd.body.data.promotion.discount_value)).toBe(15);

    const off = await request(app).patch(`/api/promotions/${promoId}/active`).set(authHeader(admin)).send({ is_active: false });
    expect(off.status).toBe(200);
    expect(Number(off.body.data.promotion.is_active)).toBe(0);

    const list = await request(app).get('/api/promotions').set(authHeader(admin));
    expect(list.body.data.promotions.some((p) => p.id === promoId)).toBe(true);
  });

  test('PM4. Duyệt giảm giá chỉ dành cho admin', async () => {
    expect((await request(app).patch('/api/invoices/1/discount-approval').set(authHeader(staff)).send({ approve: true })).status).toBe(403);
    expect((await request(app).patch('/api/invoices/99999999/discount-approval').set(authHeader(admin)).send({ approve: true })).status).toBe(404);
    expect((await request(app).patch('/api/invoices/1/discount-approval').set(authHeader(admin)).send({})).status).toBe(422);
  });
});
