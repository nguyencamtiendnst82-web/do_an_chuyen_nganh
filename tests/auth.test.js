/**
 * Test Suite: Phân hệ Tài khoản & Phân quyền
 * Chạy: npm test -- --testPathPattern="auth"
 *
 * LƯU Ý:
 * - Cần MySQL đang chạy và database pet_spa_db đã được init (npm run init-db)
 * - Test tạo dữ liệu với email/phone có prefix "test_" → cleanup sau khi chạy
 * - TUYỆT ĐỐI KHÔNG xóa 5 tài khoản mẫu (admin@petspa.com, staff1@, staff2@, khachhang1@, khachhang2@)
 */

import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

// ── Helper: tạo thông tin user test ngẫu nhiên ──────────────────────────────
let testCounter = 0;
const uniqueSuffix = () => {
  testCounter += 1;
  return `${Date.now()}${testCounter}`;
};
const makeTestUser = () => {
  const suffix = uniqueSuffix();
  return {
    full_name: `Test User ${suffix}`,
    email: `test_user_${suffix}@example.com`,
    phone: `09${suffix.slice(-8).padStart(8, '0')}`,
    password: 'TestPass123',
  };
};

// ── Cleanup: chỉ xóa user có email bắt đầu bằng "test_" ─────────────────────
afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test:', err.message);
  } finally {
    await pool.end();
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 1. ĐĂNG KÝ (POST /api/auth/register)
// ────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  test('1.1 Đăng ký thành công với dữ liệu hợp lệ → 201', async () => {
    const userData = makeTestUser();
    const res = await request(app).post('/api/auth/register').send(userData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(userData.email.toLowerCase());
    // KHÔNG trả password_hash
    expect(res.body.data.user.password_hash).toBeUndefined();
    // Server tự gán role customer
    expect(res.body.data.user.role_name).toBe('customer');
  });

  test('1.2 Đăng ký trùng email → 409', async () => {
    const userData = makeTestUser();
    // Đăng ký lần 1
    await request(app).post('/api/auth/register').send(userData);
    // Đăng ký lại cùng email
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...makeTestUser(), email: userData.email });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message.toLowerCase()).toContain('email');
  });

  test('1.3 Đăng ký trùng phone → 409', async () => {
    const userData = makeTestUser();
    await request(app).post('/api/auth/register').send(userData);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...makeTestUser(), phone: userData.phone });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('1.4 Mật khẩu yếu (chỉ có chữ cái) → 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...makeTestUser(), password: 'OnlyLetters' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    const pwError = res.body.errors.find((e) => e.field === 'password');
    expect(pwError).toBeDefined();
  });

  test('1.5 Phone không đúng định dạng VN → 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...makeTestUser(), phone: '12345678' }); // không bắt đầu 0, không đủ 10 số

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.field === 'phone')).toBe(true);
  });

  test('1.6 Gửi role_id tùy chỉnh → bị bỏ qua, vẫn là customer', async () => {
    const userData = makeTestUser();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...userData, role_id: 1 }); // cố gắng leo thành admin

    // Nếu schema strict, trả 422 (trường lạ bị từ chối)
    // Nếu trả 201, role phải là customer
    if (res.status === 201) {
      expect(res.body.data.user.role_name).toBe('customer');
    } else {
      expect(res.status).toBe(422);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. ĐĂNG NHẬP (POST /api/auth/login)
// ────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let testUser;

  beforeAll(async () => {
    testUser = makeTestUser();
    await request(app).post('/api/auth/register').send(testUser);
  });

  test('2.1 Đăng nhập thành công bằng email → 200, có token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      credential: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  test('2.2 Đăng nhập thành công bằng phone → 200', async () => {
    const res = await request(app).post('/api/auth/login').send({
      credential: testUser.phone,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  test('2.3 Sai mật khẩu → 401, không tiết lộ email tồn tại', async () => {
    const res = await request(app).post('/api/auth/login').send({
      credential: testUser.email,
      password: 'WrongPass999',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Thông báo không được gợi ý email có tồn tại không
    expect(res.body.message).not.toContain('tồn tại');
    expect(res.body.message).not.toContain('không tìm thấy');
  });

  test('2.4 Tài khoản bị khóa → 403, thông báo rõ ràng', async () => {
    // Tạo user rồi khóa bằng DB trực tiếp
    const lockedUser = makeTestUser();
    await request(app).post('/api/auth/register').send(lockedUser);
    await pool.query(`UPDATE users SET status = 'locked' WHERE email = ?`, [lockedUser.email]);

    const res = await request(app).post('/api/auth/login').send({
      credential: lockedUser.email,
      password: lockedUser.password,
    });

    expect(res.status).toBe(403);
    expect(res.body.message.toLowerCase()).toContain('khóa');
  });

  test('2.5 Đăng nhập bằng email không tồn tại → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      credential: 'test_nonexistent@nowhere.com',
      password: 'SomePass123',
    });

    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. XEM HỒ SƠ (GET /api/auth/me)
// ────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  test('3.1 Không có token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('3.2 Token hợp lệ → 200, trả thông tin user', async () => {
    // Đăng nhập để lấy token
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: 'khachhang1@gmail.com',
      password: 'Password123@',
    });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('khachhang1@gmail.com');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. ĐỔI MẬT KHẨU (POST /api/auth/change-password)
// ────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
  let pwTestUser;
  let pwTestToken;

  beforeAll(async () => {
    pwTestUser = makeTestUser();
    await request(app).post('/api/auth/register').send(pwTestUser);
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: pwTestUser.email,
      password: pwTestUser.password,
    });
    pwTestToken = loginRes.body.data.token;
  });

  test('4.1 Đổi mật khẩu thành công → 200', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${pwTestToken}`)
      .send({
        old_password: pwTestUser.password,
        new_password: 'NewPass456',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Đăng nhập lại với mật khẩu mới phải thành công
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: pwTestUser.email,
      password: 'NewPass456',
    });
    expect(loginRes.status).toBe(200);
  });

  test('4.2 Sai mật khẩu cũ → 400', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${pwTestToken}`)
      .send({
        old_password: 'WrongOldPassword999',
        new_password: 'AnotherPass789',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. PHÂN QUYỀN: Customer gọi API Admin
// ────────────────────────────────────────────────────────────────────────────
describe('Phân quyền: Customer không được truy cập API Admin', () => {
  let customerToken;

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: 'khachhang1@gmail.com',
      password: 'Password123@',
    });
    customerToken = loginRes.body.data.token;
  });

  test('5.1 GET /api/users với token customer → 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('5.2 POST /api/users với token customer → 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ full_name: 'Hacker', email: 'test_hacker@x.com', phone: '0900000001', password: 'Hack123', hire_date: '2026-01-01' });

    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. PHÂN QUYỀN: Staff gọi API Admin → 403
// ────────────────────────────────────────────────────────────────────────────
describe('Phân quyền: Staff không được truy cập GET /api/users', () => {
  let staffToken;

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: 'staff1@petspa.com',
      password: 'Password123@',
    });
    staffToken = loginRes.body.data.token;
  });

  test('6.1 GET /api/users với token staff → 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. ADMIN: Tạo nhân viên
// ────────────────────────────────────────────────────────────────────────────
describe('Admin: Tạo nhân viên mới', () => {
  let adminToken;

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      credential: 'admin@petspa.com',
      password: 'Password123@',
    });
    adminToken = loginRes.body.data.token;
  });

  test('7.1 Admin tạo nhân viên thành công → 201, có bản ghi employees', async () => {
    const newEmployee = makeTestUser();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...newEmployee,
        specialty: 'Tắm vệ sinh',
        experience_years: 2,
        hire_date: '2026-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Phải có bản ghi employee
    expect(res.body.data.employee).toBeDefined();
    expect(res.body.data.employee.user_id).toBeDefined();
    // Role phải là staff
    expect(res.body.data.user.role_name).toBe('staff');
    // Không trả password_hash
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  test('7.2 Admin không thể tự khóa chính mình → 403', async () => {
    // Lấy ID của admin
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminId = meRes.body.data.user.id;

    const res = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'locked' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('7.3 Admin lấy danh sách users → 200, có phân trang', async () => {
    const res = await request(app)
      .get('/api/users?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toBeInstanceOf(Array);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    // Không có password_hash trong danh sách
    res.body.data.users.forEach((u) => {
      expect(u.password_hash).toBeUndefined();
    });
  });
});
