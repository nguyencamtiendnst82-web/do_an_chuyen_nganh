import request from 'supertest';
import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { setMailerForTest } from '../src/utils/mailer.js';
import { setGoogleVerifierForTest } from '../src/utils/googleVerifier.js';
import { authHeader, uniqueStamp, createUser } from './helpers/users.js';

// Bắt thư "gửi đi" thay vì gửi thật; key = email người nhận
const sentMails = new Map();
const lastTokenFor = (email) => {
  const mails = sentMails.get(email) || [];
  const last = mails[mails.length - 1];
  return last ? last.text.match(/token=([a-f0-9]{64})/)?.[1] : undefined;
};

// Giả lập Google, cùng định dạng với googleLogin.test.js
const fakeGoogle = async (credential) => {
  const [, sub, email, name] = credential.split('|');
  return { sub, email, name, email_verified: true };
};
const cred = (sub, email) => `ok|${sub}|${email}|Người Dùng|true|` + 'x'.repeat(20);

beforeAll(() => {
  setMailerForTest(async ({ to, subject, text }) => {
    sentMails.set(to, [...(sentMails.get(to) || []), { subject, text }]);
  });
  setGoogleVerifierForTest(fakeGoogle);
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_ev\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test xác minh email:', err.message);
  } finally {
    await pool.end();
  }
});

const registerUser = async () => {
  const stamp = uniqueStamp();
  const user = {
    full_name: `Test EV ${stamp}`,
    email: `test_ev_${stamp}@example.com`,
    phone: `09${stamp.slice(-8).padStart(8, '0')}`,
    password: 'TestPass123',
  };
  const res = await request(app).post('/api/auth/register').send(user);
  expect(res.status).toBe(201);
  const login = await request(app)
    .post('/api/auth/login')
    .send({ credential: user.email, password: user.password });
  return { ...user, id: res.body.data.user.id, token: login.body.data.token, registerRes: res };
};

describe('Xác minh email', () => {
  test('V1. Đăng ký → chưa xác minh, có gửi thư chứa link; DB chỉ lưu băm mã (không lưu mã gốc)', async () => {
    const u = await registerUser();
    expect(u.registerRes.body.data.user.email_verified).toBe(false);

    const token = lastTokenFor(u.email);
    expect(token).toBeDefined();
    expect(sentMails.get(u.email)[0].text).toContain('/api/auth/verify-email?token=');

    const [rows] = await pool.query(
      'SELECT email_verified, email_verify_token_hash FROM users WHERE id = ?',
      [u.id]
    );
    expect(rows[0].email_verified).toBe(0);
    expect(rows[0].email_verify_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].email_verify_token_hash).not.toBe(token);
  });

  test('V2. Bấm link đúng → 200 và tài khoản được xác minh; dùng lại link → 400', async () => {
    const u = await registerUser();
    const token = lastTokenFor(u.email);

    const ok = await request(app).get('/api/auth/verify-email').query({ token });
    expect(ok.status).toBe(200);

    const [rows] = await pool.query(
      'SELECT email_verified, email_verify_token_hash, email_verify_expires FROM users WHERE id = ?',
      [u.id]
    );
    expect(rows[0].email_verified).toBe(1);
    expect(rows[0].email_verify_token_hash).toBeNull();
    expect(rows[0].email_verify_expires).toBeNull();

    const again = await request(app).get('/api/auth/verify-email').query({ token });
    expect(again.status).toBe(400);

    const me = await request(app).get('/api/auth/me').set(authHeader(u));
    expect((me.body.data.user ?? me.body.data).email_verified).toBe(true);
  });

  test('V3. Mã sai định dạng, thiếu, hoặc không tồn tại → 400', async () => {
    expect((await request(app).get('/api/auth/verify-email')).status).toBe(400);
    expect((await request(app).get('/api/auth/verify-email').query({ token: 'abc' })).status).toBe(400);
    expect((await request(app).get('/api/auth/verify-email').query({ token: 'a'.repeat(64) })).status).toBe(400);
  });

  test('V4. Mã hết hạn → 400 và tài khoản vẫn chưa xác minh', async () => {
    const u = await registerUser();
    const token = lastTokenFor(u.email);
    await pool.query(
      'UPDATE users SET email_verify_expires = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
      [u.id]
    );

    const res = await request(app).get('/api/auth/verify-email').query({ token });
    expect(res.status).toBe(400);
    const [rows] = await pool.query('SELECT email_verified FROM users WHERE id = ?', [u.id]);
    expect(rows[0].email_verified).toBe(0);
  });

  test('V5. Gửi lại thư: cần đăng nhập; mã mới thay mã cũ (mã cũ hết tác dụng)', async () => {
    const u = await registerUser();
    const oldToken = lastTokenFor(u.email);

    expect((await request(app).post('/api/auth/resend-verification')).status).toBe(401);

    const res = await request(app).post('/api/auth/resend-verification').set(authHeader(u));
    expect(res.status).toBe(200);
    expect(res.body.data.already_verified).toBe(false);

    const newToken = lastTokenFor(u.email);
    expect(newToken).not.toBe(oldToken);
    expect((await request(app).get('/api/auth/verify-email').query({ token: oldToken })).status).toBe(400);
    expect((await request(app).get('/api/auth/verify-email').query({ token: newToken })).status).toBe(200);
  });

  test('V6. Đã xác minh thì gửi lại → 200, already_verified, không gửi thêm thư', async () => {
    const u = await registerUser();
    await request(app).get('/api/auth/verify-email').query({ token: lastTokenFor(u.email) });
    const before = sentMails.get(u.email).length;

    const res = await request(app).post('/api/auth/resend-verification').set(authHeader(u));
    expect(res.status).toBe(200);
    expect(res.body.data.already_verified).toBe(true);
    expect(sentMails.get(u.email)).toHaveLength(before);
  });

  test('V7. Gửi thư lỗi (SMTP hỏng) → đăng ký vẫn thành công', async () => {
    setMailerForTest(async () => {
      throw new Error('SMTP down');
    });
    try {
      const stamp = uniqueStamp();
      const res = await request(app).post('/api/auth/register').send({
        full_name: `Test EV ${stamp}`,
        email: `test_ev_${stamp}@example.com`,
        phone: `09${stamp.slice(-8).padStart(8, '0')}`,
        password: 'TestPass123',
      });
      expect(res.status).toBe(201);
    } finally {
      setMailerForTest(async ({ to, subject, text }) => {
        sentMails.set(to, [...(sentMails.get(to) || []), { subject, text }]);
      });
    }
  });
});

describe('Chống chiếm trước tài khoản qua liên kết Google', () => {
  test('V8. Kẻ đăng ký trước bằng email nạn nhân → Google đăng nhập bị 403, không gắn google_id', async () => {
    const squatter = await registerUser(); // chưa xác minh email
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: cred(`sub${uniqueStamp()}`, squatter.email) });
    expect(res.status).toBe(403);

    const [rows] = await pool.query('SELECT google_id FROM users WHERE id = ?', [squatter.id]);
    expect(rows[0].google_id).toBeNull();
  });

  test('V9. Sau khi xác minh email → Google liên kết được vào đúng tài khoản đó', async () => {
    const u = await registerUser();
    await request(app).get('/api/auth/verify-email').query({ token: lastTokenFor(u.email) });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: cred(`sub${uniqueStamp()}`, u.email) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(u.id);
  });

  test('V10. Tài khoản tạo mới bằng Google → email_verified = true ngay', async () => {
    const stamp = uniqueStamp();
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: cred(`sub${stamp}`, `test_ev_${stamp}@gmail.com`) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email_verified).toBe(true);
  });
});

describe('Đặt lịch yêu cầu email đã xác minh', () => {
  test('V11. Khách chưa xác minh email đặt lịch → 403; xác minh xong thì qua cửa này (body rỗng → 422)', async () => {
    const u = await registerUser();

    const blocked = await request(app).post('/api/appointments').set(authHeader(u)).send({});
    expect(blocked.status).toBe(403);

    await request(app).get('/api/auth/verify-email').query({ token: lastTokenFor(u.email) });
    const passed = await request(app).post('/api/appointments').set(authHeader(u)).send({});
    expect(passed.status).toBe(422);
  });

  test('V12. Staff đặt hộ khách tại quầy không bị chặn bởi xác minh email (body rỗng → 422, không phải 403)', async () => {
    const staff = await createUser(app, { role: 'staff', prefix: 'test_ev' });
    const res = await request(app).post('/api/appointments').set(authHeader(staff)).send({});
    expect(res.status).toBe(422);
  });
});
