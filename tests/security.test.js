import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

describe('ĐỢT 6: Kiểm tra bảo mật ứng dụng', () => {
  afterAll(async () => {
    await pool.end();
  });
  test('1. HTTP Headers có chứa các headers bảo vệ từ Helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    // Helmet headers
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('2. CORS: Từ chối origin lạ khi gọi có header Origin không hợp lệ', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-website.com');
    // Khi CORS từ chối, middleware trả về lỗi hoặc không gửi Access-Control-Allow-Origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('3. Giới hạn kích thước payload JSON (chống DoS > 2MB)', async () => {
    // Tạo chuỗi giả lập lớn hơn 2.5MB
    const bigString = 'a'.repeat(2.5 * 1024 * 1024);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ bigData: bigString });
    // PayloadTooLargeError -> 413
    expect(res.status).toBe(413);
  });

  test('4. Xử lý lỗi production: không để lộ stack trace ra ngoài', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/api/duong-dan-khong-ton-tai-nao-do');
    expect(res.status).toBe(404);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.errors).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});
