import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { setGoogleVerifierForTest } from '../src/utils/googleVerifier.js';
import { createUser, authHeader, uniqueStamp, PASSWORD } from './helpers/users.js';

// Giả lập Google: credential dạng "ok|<sub>|<email>|<tên>|<verified>" hoặc "bad"
const fakeGoogle = async (credential) => {
  const [kind, sub, email, name, verified] = credential.split('|');
  if (kind !== 'ok') {
    const err = new Error('Đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
    err.statusCode = 401;
    throw err;
  }
  return { sub, email, name, email_verified: verified !== 'false' };
};

const cred = (sub, email, name = 'Người Dùng Google', verified = true) =>
  `ok|${sub}|${email}|${name}|${verified}|` + 'x'.repeat(20);

const post = (credential) => request(app).post('/api/auth/google').send({ credential });

beforeAll(() => setGoogleVerifierForTest(fakeGoogle));

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_gg\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test Google:', err.message);
  } finally {
    await pool.end();
  }
});

describe('Đăng nhập bằng Google', () => {
  test('G1. Email mới → tạo khách hàng, trả token, chưa có số điện thoại, không lộ password_hash', async () => {
    const stamp = uniqueStamp();
    const res = await post(cred(`sub${stamp}`, `test_gg_${stamp}@gmail.com`, 'Nguyễn Văn Test'));
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(true);
    expect(res.body.data.user.role_name).toBe('customer');
    expect(res.body.data.user.full_name).toBe('Nguyễn Văn Test');
    expect(res.body.data.user.phone).toBeNull();
    expect(res.body.data.user.password_hash).toBeUndefined();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect((me.body.data.user ?? me.body.data).email).toBe(`test_gg_${stamp}@gmail.com`);
  });

  test('G2. Đăng nhập lại cùng tài khoản Google → cùng user, không tạo trùng', async () => {
    const stamp = uniqueStamp();
    const c = cred(`sub${stamp}`, `test_gg_${stamp}@gmail.com`);
    const first = await post(c);
    const second = await post(c);
    expect(second.status).toBe(200);
    expect(second.body.data.is_new).toBe(false);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);

    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE email = ?', [`test_gg_${stamp}@gmail.com`]);
    expect(rows[0].total).toBe(1);
  });

  test('G3. Email đã có tài khoản mật khẩu → gắn Google vào, vẫn đăng nhập mật khẩu được', async () => {
    const existing = await createUser(app, { role: 'customer', prefix: 'test_gg' });
    const res = await post(cred(`sub${uniqueStamp()}`, existing.email));
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(false);
    expect(res.body.data.user.id).toBe(existing.id);

    const pw = await request(app).post('/api/auth/login').send({ credential: existing.email, password: PASSWORD });
    expect(pw.status).toBe(200);
  });

  test('G4. Email có tài khoản nhưng gắn với Google khác → 403', async () => {
    const stamp = uniqueStamp();
    const email = `test_gg_${stamp}@gmail.com`;
    await post(cred(`subA${stamp}`, email));
    const res = await post(cred(`subB${stamp}`, email));
    expect(res.status).toBe(403);
  });

  test('G5. Email Google chưa xác minh → 401 và không tạo tài khoản', async () => {
    const stamp = uniqueStamp();
    const email = `test_gg_${stamp}@gmail.com`;
    const res = await post(cred(`sub${stamp}`, email, 'A', false));
    expect(res.status).toBe(401);
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE email = ?', [email]);
    expect(rows[0].total).toBe(0);
  });

  test('G6. Credential sai / thiếu / quá ngắn → 401 hoặc 422', async () => {
    expect((await post('bad-credential-xxxxxxxxxxxxxxxxx')).status).toBe(401);
    expect((await request(app).post('/api/auth/google').send({})).status).toBe(422);
    expect((await post('abc')).status).toBe(422);
  });

  test('G7. Tài khoản bị khóa không đăng nhập được bằng Google → 403', async () => {
    const existing = await createUser(app, { role: 'customer', prefix: 'test_gg' });
    await pool.query(`UPDATE users SET status = 'locked' WHERE id = ?`, [existing.id]);
    const res = await post(cred(`sub${uniqueStamp()}`, existing.email));
    expect(res.status).toBe(403);
  });

  test('G8. Nhân viên do admin tạo đăng nhập Google được và vẫn giữ vai trò staff (không bị hạ/nâng quyền)', async () => {
    const staff = await createUser(app, { role: 'staff', prefix: 'test_gg' });
    const res = await post(cred(`sub${uniqueStamp()}`, staff.email));
    expect(res.status).toBe(200);
    expect(res.body.data.user.role_name).toBe('staff');
  });

  test('G9. Ghi log đăng ký / đăng nhập Google', async () => {
    const stamp = uniqueStamp();
    const res = await post(cred(`sub${stamp}`, `test_gg_${stamp}@gmail.com`));
    const [rows] = await pool.query(
      `SELECT action FROM system_logs WHERE entity_id = ? AND action = 'USER_GOOGLE_REGISTER'`,
      [res.body.data.user.id]
    );
    expect(rows).toHaveLength(1);
  });
});
