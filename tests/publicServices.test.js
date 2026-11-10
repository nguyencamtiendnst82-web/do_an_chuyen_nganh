import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

describe('GET /api/services/public (trang chủ, không cần đăng nhập)', () => {
  const name = `Dịch vụ Test Public ${Date.now()}`;
  const hidden = `Dịch vụ Test Ẩn ${Date.now()}`;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active) VALUES (?, 99000, 45, TRUE), (?, 50000, 30, FALSE)`,
      [name, hidden]
    );
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM services WHERE name IN (?, ?)', [name, hidden]);
    } finally {
      await pool.end();
    }
  });

  test('P1. Không cần token; chỉ trả dịch vụ đang bật và đúng các trường hiển thị', async () => {
    const res = await request(app).get('/api/services/public');
    expect(res.status).toBe(200);
    const list = res.body.data.services;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeLessThanOrEqual(8);
    expect(list.some((s) => s.name === hidden)).toBe(false);
    for (const s of list) {
      expect(Object.keys(s).sort()).toEqual(['description', 'duration_minutes', 'id', 'image_url', 'name', 'price']);
    }
  });

  test('P2. Đường dẫn /public không bị hiểu nhầm là ID dịch vụ; /api/services vẫn cần đăng nhập', async () => {
    expect((await request(app).get('/api/services')).status).toBe(401);
    expect((await request(app).get('/api/services/public')).status).toBe(200);
  });
});
