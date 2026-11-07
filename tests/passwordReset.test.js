import request from 'supertest';
import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { setMailerForTest } from '../src/utils/mailer.js';
import { authHeader, createUser, uniqueStamp, PASSWORD } from './helpers/users.js';

const NEW_PASSWORD = 'MatKhauMoi456!';

// Bắt thư "gửi đi" thay vì gửi thật; key = email người nhận
const sentMails = new Map();
const mailsFor = (email) => sentMails.get(email) || [];
const lastTokenFor = (email) => {
  const last = mailsFor(email).at(-1);
  return last ? last.text.match(/reset-password\?token=([a-f0-9]{64})/)?.[1] : undefined;
};

// Thư được gửi nền (không chờ), nên test phải chờ thư xuất hiện
const waitForMail = async (email, count = 1) => {
  for (let i = 0; i < 40; i += 1) {
    if (mailsFor(email).length >= count) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Không thấy thư gửi tới ${email}`);
};

beforeAll(() => {
  setMailerForTest(async ({ to, subject, text }) => {
    sentMails.set(to, [...mailsFor(to), { subject, text }]);
  });
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_pr\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test quên mật khẩu:', err.message);
  } finally {
    await pool.end();
  }
});

const newUser = () => createUser(app, { role: 'customer', prefix: 'test_pr', verified: false });
const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token, new_password) =>
  request(app).post('/api/auth/reset-password').send({ token, new_password });
const login = (email, password) =>
  request(app).post('/api/auth/login').send({ credential: email, password });

describe('POST /api/auth/forgot-password', () => {
  test('R1. Email tồn tại → 200, gửi thư có link; DB chỉ lưu băm mã', async () => {
    const u = await newUser();
    const res = await forgot(u.email);
    expect(res.status).toBe(200);

    await waitForMail(u.email);
    const token = lastTokenFor(u.email);
    expect(token).toBeDefined();

    const [rows] = await pool.query(
      'SELECT password_reset_token_hash FROM users WHERE id = ?',
      [u.id]
    );
    expect(rows[0].password_reset_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].password_reset_token_hash).not.toBe(token);
  });

  test('R2. Email không tồn tại → 200 với CÙNG thông báo, không gửi thư (không lộ email nào đã đăng ký)', async () => {
    const real = await newUser();
    const ghost = `test_pr_khong_co_${uniqueStamp()}@example.com`;

    const a = await forgot(real.email);
    const b = await forgot(ghost);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);

    await new Promise((r) => setTimeout(r, 200));
    expect(mailsFor(ghost)).toHaveLength(0);
  });

  test('R3. Email sai định dạng hoặc thiếu → 422', async () => {
    expect((await forgot('khong-phai-email')).status).toBe(422);
    expect((await request(app).post('/api/auth/forgot-password').send({})).status).toBe(422);
  });

  test('R4. Tài khoản bị khóa → 200 nhưng KHÔNG gửi thư', async () => {
    const u = await newUser();
    await pool.query("UPDATE users SET status = 'locked' WHERE id = ?", [u.id]);

    const res = await forgot(u.email);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 200));
    expect(mailsFor(u.email)).toHaveLength(0);
  });

  test('R5. Yêu cầu lần hai tạo mã mới, mã cũ hết tác dụng', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email, 1);
    const oldToken = lastTokenFor(u.email);

    await forgot(u.email);
    await waitForMail(u.email, 2);
    const newToken = lastTokenFor(u.email);
    expect(newToken).not.toBe(oldToken);

    expect((await reset(oldToken, NEW_PASSWORD)).status).toBe(400);
    expect((await reset(newToken, NEW_PASSWORD)).status).toBe(200);
  });
});

describe('POST /api/auth/reset-password', () => {
  test('R6. Đặt mật khẩu mới → 200; đăng nhập bằng mật khẩu mới được, mật khẩu cũ và JWT cũ hết hiệu lực; email thành đã xác minh', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);

    const res = await reset(token, NEW_PASSWORD);
    expect(res.status).toBe(200);

    expect((await login(u.email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(u.email, PASSWORD)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authHeader(u))).status).toBe(401);

    const [rows] = await pool.query(
      'SELECT email_verified, password_reset_token_hash, password_reset_expires FROM users WHERE id = ?',
      [u.id]
    );
    expect(rows[0].email_verified).toBe(1);
    expect(rows[0].password_reset_token_hash).toBeNull();
    expect(rows[0].password_reset_expires).toBeNull();
  });

  test('R7. Mã chỉ dùng được một lần', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);

    expect((await reset(token, NEW_PASSWORD)).status).toBe(200);
    expect((await reset(token, 'MatKhauKhac789!')).status).toBe(400);
    expect((await login(u.email, NEW_PASSWORD)).status).toBe(200);
  });

  test('R8. Mã sai định dạng, thiếu hoặc không tồn tại → 400', async () => {
    expect((await reset('abc', NEW_PASSWORD)).status).toBe(400);
    expect((await reset('a'.repeat(64), NEW_PASSWORD)).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ new_password: NEW_PASSWORD })).status).toBe(400);
  });

  test('R9. Mã hết hạn → 400 và mật khẩu không đổi', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);
    await pool.query(
      'UPDATE users SET password_reset_expires = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
      [u.id]
    );

    expect((await reset(token, NEW_PASSWORD)).status).toBe(400);
    expect((await login(u.email, PASSWORD)).status).toBe(200);
  });

  test('R10. Mật khẩu yếu / chứa email / trùng mật khẩu cũ → 422 và KHÔNG tiêu hao mã (sửa lại vẫn dùng được)', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);

    const weak = await reset(token, 'chuyenchucai');
    expect(weak.status).toBe(422);

    const emailLocal = u.email.split('@')[0];
    const hasEmail = await reset(token, `${emailLocal}A1`);
    expect(hasEmail.status).toBe(422);

    const same = await reset(token, PASSWORD);
    expect(same.status).toBe(422);

    const tooLong = await reset(token, `A1${'x'.repeat(80)}`);
    expect(tooLong.status).toBe(422);

    expect((await reset(token, NEW_PASSWORD)).status).toBe(200);
  });

  test('R11. Tài khoản bị khóa sau khi xin mã → không đặt lại được (400)', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);
    await pool.query("UPDATE users SET status = 'locked' WHERE id = ?", [u.id]);

    expect((await reset(token, NEW_PASSWORD)).status).toBe(400);
  });

  test('R12. Ghi nhật ký REQUEST_PASSWORD_RESET và RESET_PASSWORD, không lưu mật khẩu hay mã', async () => {
    const u = await newUser();
    await forgot(u.email);
    await waitForMail(u.email);
    const token = lastTokenFor(u.email);
    await reset(token, NEW_PASSWORD);

    const [logs] = await pool.query(
      `SELECT action, old_values, new_values FROM system_logs
       WHERE user_id = ? AND action IN ('REQUEST_PASSWORD_RESET', 'RESET_PASSWORD')`,
      [u.id]
    );
    expect(logs.map((l) => l.action).sort()).toEqual(['REQUEST_PASSWORD_RESET', 'RESET_PASSWORD']);
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(NEW_PASSWORD);
    expect(dump).not.toContain(token);
  });
});
