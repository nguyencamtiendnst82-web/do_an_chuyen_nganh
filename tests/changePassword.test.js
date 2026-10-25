import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';

const OLD_PASSWORD = 'MatKhauCu123@';
let counter = 0;

// Tạo tài khoản test mới và đăng nhập, trả về token + thông tin
const createUserAndLogin = async () => {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const user = {
    full_name: 'Test Doi Mat Khau',
    email: `test_pw_${stamp}@example.com`,
    phone: `08${stamp.slice(-8)}`,
    password: OLD_PASSWORD,
  };
  await request(app).post('/api/auth/register').send(user);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ credential: user.email, password: user.password });
  return { ...user, token: res.body.data.token, id: res.body.data.user.id };
};

const changePassword = (token, body) =>
  request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_pw\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test đổi mật khẩu:', err.message);
  } finally {
    await pool.end();
  }
});

describe('POST /api/auth/change-password', () => {
  test('P1. Đổi mật khẩu thành công → 200, đăng nhập được bằng mật khẩu mới, mật khẩu cũ hết hiệu lực', async () => {
    const u = await createUserAndLogin();
    const NEW_PASSWORD = 'MatKhauMoi456#';

    const res = await changePassword(u.token, { old_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const okLogin = await request(app)
      .post('/api/auth/login')
      .send({ credential: u.email, password: NEW_PASSWORD });
    expect(okLogin.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ credential: u.email, password: OLD_PASSWORD });
    expect(oldLogin.status).toBe(401);
  });

  test('P2. Sai mật khẩu hiện tại → 400 và ghi nhật ký CHANGE_PASSWORD_FAILED', async () => {
    const u = await createUserAndLogin();

    const res = await changePassword(u.token, { old_password: 'SaiRoi123@', new_password: 'MatKhauMoi456#' });
    expect(res.status).toBe(400);

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs WHERE user_id = ? AND action = 'CHANGE_PASSWORD_FAILED'`,
      [u.id]
    );
    expect(rows[0].total).toBeGreaterThanOrEqual(1);
  });

  test('P3. Mật khẩu mới trùng mật khẩu cũ → 422, lỗi gắn đúng trường new_password', async () => {
    const u = await createUserAndLogin();

    const res = await changePassword(u.token, { old_password: OLD_PASSWORD, new_password: OLD_PASSWORD });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('new_password');
  });

  test('P4. Mật khẩu mới yếu (chỉ có chữ) → 422', async () => {
    const u = await createUserAndLogin();

    const res = await changePassword(u.token, { old_password: OLD_PASSWORD, new_password: 'chicochuthoi' });
    expect(res.status).toBe(422);
  });

  test('P5. Mật khẩu mới chứa số điện thoại → 422', async () => {
    const u = await createUserAndLogin();

    const res = await changePassword(u.token, {
      old_password: OLD_PASSWORD,
      new_password: `Abc${u.phone}xyz`,
    });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('new_password');
  });

  test('P6. Mật khẩu mới chứa phần tên của email → 422', async () => {
    const u = await createUserAndLogin();
    const emailLocal = u.email.split('@')[0];

    const res = await changePassword(u.token, {
      old_password: OLD_PASSWORD,
      new_password: `${emailLocal}Aa1`,
    });
    expect(res.status).toBe(422);
  });

  test('P7. Mật khẩu mới dài quá 72 byte → 422', async () => {
    const u = await createUserAndLogin();

    const res = await changePassword(u.token, {
      old_password: OLD_PASSWORD,
      new_password: `Aa1${'x'.repeat(80)}`,
    });
    expect(res.status).toBe(422);
  });

  test('P8. Không có token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ old_password: OLD_PASSWORD, new_password: 'MatKhauMoi456#' });
    expect(res.status).toBe(401);
  });
});

describe('Giới hạn số lần đổi mật khẩu sai', () => {
  beforeAll(() => { process.env.FORCE_RATE_LIMIT = 'true'; });
  afterAll(() => { delete process.env.FORCE_RATE_LIMIT; });

  test('P9. Sai mật khẩu hiện tại quá 5 lần → lần thứ 6 nhận 429', async () => {
    const u = await createUserAndLogin();

    for (let i = 0; i < 5; i += 1) {
      const res = await changePassword(u.token, { old_password: 'SaiRoi123@', new_password: 'MatKhauMoi456#' });
      expect(res.status).toBe(400);
    }

    const blocked = await changePassword(u.token, { old_password: 'SaiRoi123@', new_password: 'MatKhauMoi456#' });
    expect(blocked.status).toBe(429);
  });
});