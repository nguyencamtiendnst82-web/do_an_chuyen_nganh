import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';

const OLD_PASSWORD = 'MatKhauCu123@';
const NEW_PASSWORD = 'MatKhauMoi456#';
let counter = 0;

const createUserAndLogin = async () => {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const user = {
    full_name: 'Test Token',
    email: `test_tk_${stamp}@example.com`,
    phone: `07${stamp.slice(-8)}`,
    password: OLD_PASSWORD,
  };
  await request(app).post('/api/auth/register').send(user);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ credential: user.email, password: user.password });
  return { ...user, token: res.body.data.token };
};

const getMe = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_tk\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test token:', err.message);
  } finally {
    await pool.end();
  }
});

describe('Vô hiệu hóa token cũ sau khi đổi mật khẩu', () => {
  test('T1. Trước khi đổi mật khẩu, token dùng được', async () => {
    const u = await createUserAndLogin();
    expect((await getMe(u.token)).status).toBe(200);
  });

  test('T2. Sau khi đổi mật khẩu, token cũ bị từ chối (401)', async () => {
    const u = await createUserAndLogin();

    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ old_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
    expect(change.status).toBe(200);

    expect((await getMe(u.token)).status).toBe(401);
  });

  test('T3. Đăng nhập lại bằng mật khẩu mới → token mới dùng được', async () => {
    const u = await createUserAndLogin();
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ old_password: OLD_PASSWORD, new_password: NEW_PASSWORD });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ credential: u.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect((await getMe(login.body.data.token)).status).toBe(200);
  });

  test('T4. Token của thiết bị khác (đăng nhập trước đó) cũng bị vô hiệu hóa', async () => {
    const u = await createUserAndLogin();
    const other = await request(app)
      .post('/api/auth/login')
      .send({ credential: u.email, password: OLD_PASSWORD });
    const otherToken = other.body.data.token;

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ old_password: OLD_PASSWORD, new_password: NEW_PASSWORD });

    expect((await getMe(otherToken)).status).toBe(401);
  });

  test('T5. Đổi mật khẩu thất bại (sai mật khẩu cũ) KHÔNG làm mất hiệu lực token', async () => {
    const u = await createUserAndLogin();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ old_password: 'SaiRoi123@', new_password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect((await getMe(u.token)).status).toBe(200);
  });
});
