const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

describe('API Health & Error Handling Tests', () => {
  afterAll(async () => {
    // Đóng pool sau khi kết thúc bộ kiểm thử
    await pool.end();
  });

  describe('Luồng chính: GET /api/health', () => {
    it('phải trả về đúng định dạng response chuẩn GEMINI.md', async () => {
      const res = await request(app).get('/api/health');

      // Có thể là 200 (nếu DB đang chạy) hoặc 503 (nếu DB chưa bật ở môi trường test)
      expect([200, 503]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('success');
      expect(typeof res.body.success).toBe('boolean');
      expect(res.body).toHaveProperty('message');

      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('status', 'healthy');
        expect(res.body.data).toHaveProperty('database', 'connected');
      } else {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('Luồng lỗi: GET /api/duong-dan-khong-ton-tai (404 Not Found)', () => {
    it('phải trả về mã lỗi 404 và định dạng response chuẩn { success: false, message }', async () => {
      const res = await request(app).get('/api/duong-dan-khong-ton-tai');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/không tồn tại/i);
    });
  });
});

