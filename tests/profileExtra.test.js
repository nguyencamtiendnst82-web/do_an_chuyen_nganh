import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';

const PASSWORD = 'MatKhauCu123@';
let counter = 0;

const createUserAndLogin = async () => {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const user = {
    full_name: 'Test Ho So',
    email: `test_pf_${stamp}@example.com`,
    phone: `06${stamp.slice(-8)}`,
    password: PASSWORD,
  };
  await request(app).post('/api/auth/register').send(user);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ credential: user.email, password: user.password });
  return { ...user, token: res.body.data.token };
};

const updateMe = (token, body) =>
  request(app).put('/api/auth/me').set('Authorization', `Bearer ${token}`).send(body);

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_pf\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test hồ sơ:', err.message);
  } finally {
    await pool.end();
  }
});

describe('PUT /api/auth/me với giới tính và năm sinh', () => {
  test('F1. Lưu giới tính + năm sinh → 200, trả về đúng dữ liệu', async () => {
    const u = await createUserAndLogin();
    const res = await updateMe(u.token, { full_name: u.full_name, gender: 'female', birth_year: 1998 });
    expect(res.status).toBe(200);
    expect(res.body.data.user.gender).toBe('female');
    expect(res.body.data.user.birth_year).toBe(1998);
  });

  test('F2. GET /me trả lại đúng dữ liệu đã lưu', async () => {
    const u = await createUserAndLogin();
    await updateMe(u.token, { full_name: u.full_name, gender: 'male', birth_year: '1960' });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.birth_year).toBe(1960);
  });

  test('F3. Giới tính không hợp lệ → 422', async () => {
    const u = await createUserAndLogin();
    const res = await updateMe(u.token, { full_name: u.full_name, gender: 'alien' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('gender');
  });

  test('F4. Năm sinh trong tương lai hoặc quá cũ → 422', async () => {
    const u = await createUserAndLogin();
    const future = await updateMe(u.token, { full_name: u.full_name, birth_year: 2999 });
    expect(future.status).toBe(422);
    const old = await updateMe(u.token, { full_name: u.full_name, birth_year: 1800 });
    expect(old.status).toBe(422);
    expect(old.body.errors[0].field).toBe('birth_year');
  });

  test('F5. Không gửi gender/birth_year → giữ nguyên giá trị cũ', async () => {
    const u = await createUserAndLogin();
    await updateMe(u.token, { full_name: u.full_name, gender: 'male', birth_year: 1995 });
    const res = await updateMe(u.token, { full_name: 'Ten Moi Cho Test' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.gender).toBe('male');
    expect(res.body.data.user.birth_year).toBe(1995);
  });

  test('F6. Gửi chuỗi rỗng → xóa giá trị', async () => {
    const u = await createUserAndLogin();
    await updateMe(u.token, { full_name: u.full_name, gender: 'male', birth_year: 1995 });
    const res = await updateMe(u.token, { full_name: u.full_name, gender: '', birth_year: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.gender).toBeNull();
    expect(res.body.data.user.birth_year).toBeNull();
  });
});