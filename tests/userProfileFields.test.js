import request from 'supertest';
import bcrypt from 'bcryptjs';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';

const PASSWORD = 'MatKhauCu123@';
const ADMIN_ROLE_ID = 1;
let counter = 0;
let adminToken;
let adminEmail;

const stamp = () => {
  counter += 1;
  return `${Date.now()}${counter}`;
};

const employeePayload = (extra = {}) => {
  const s = stamp();
  return {
    full_name: 'Test Nhan Vien',
    email: `test_us_${s}@example.com`,
    phone: `05${s.slice(-8)}`,
    password: PASSWORD,
    hire_date: '2026-01-15',
    ...extra,
  };
};

beforeAll(async () => {
  // Tạo riêng một admin để test, không phụ thuộc mật khẩu của tài khoản demo
  const s = stamp();
  adminEmail = `test_us_admin_${s}@example.com`;
  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)`,
    [ADMIN_ROLE_ID, 'Test Admin', adminEmail, `04${s.slice(-8)}`, hash]
  );
  const res = await request(app).post('/api/auth/login').send({ credential: adminEmail, password: PASSWORD });
  adminToken = res.body.data.token;
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_us\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test người dùng:', err.message);
  } finally {
    await pool.end();
  }
});

const createEmployee = (body) =>
  request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send(body);

describe('Admin: giới tính và năm sinh của nhân viên', () => {
  test('U1. Tạo nhân viên kèm giới tính + năm sinh → 201, có trong dữ liệu trả về', async () => {
    const res = await createEmployee(employeePayload({ gender: 'female', birth_year: 1997 }));
    expect(res.status).toBe(201);
    expect(res.body.data.user.gender).toBe('female');
    expect(res.body.data.user.birth_year).toBe(1997);
  });

  test('U2. Tạo nhân viên không gửi giới tính / năm sinh → vẫn 201, giá trị null', async () => {
    const res = await createEmployee(employeePayload());
    expect(res.status).toBe(201);
    expect(res.body.data.user.gender).toBeNull();
    expect(res.body.data.user.birth_year).toBeNull();
  });

  test('U3. Giới tính không hợp lệ khi tạo nhân viên → 422', async () => {
    const res = await createEmployee(employeePayload({ gender: 'alien' }));
    expect(res.status).toBe(422);
  });

  test('U4. Admin cập nhật giới tính + năm sinh của nhân viên → 200', async () => {
    const created = await createEmployee(employeePayload());
    const id = created.body.data.user.id;

    const res = await request(app)
      .put(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gender: 'male', birth_year: 1990 });
    expect(res.status).toBe(200);
    expect(res.body.data.user.gender).toBe('male');
    expect(res.body.data.user.birth_year).toBe(1990);
  });

  test('U5. Danh sách người dùng có giới tính và năm sinh', async () => {
    await createEmployee(employeePayload({ gender: 'male', birth_year: 1993 }));
    const res = await request(app)
      .get('/api/users?role=staff&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const list = res.body.data.users;
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('gender');
    expect(list[0]).toHaveProperty('birth_year');
  });
});
