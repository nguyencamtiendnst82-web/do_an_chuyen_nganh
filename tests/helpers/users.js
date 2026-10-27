import request from 'supertest';
import bcrypt from 'bcryptjs';
import { pool } from '../../src/config/db.js';

export const PASSWORD = 'MatKhauCu123@';
const ROLE_IDS = { admin: 1, staff: 2, customer: 3 };
let counter = 0;

export const uniqueStamp = () => {
  counter += 1;
  return `${Date.now()}${counter}`;
};

/**
 * Tạo trực tiếp một user trong DB (đúng vai trò) rồi đăng nhập để lấy token.
 * Email bắt đầu bằng `${prefix}_` để file test tự dọn sau khi chạy xong.
 */
export const createUser = async (app, { role = 'customer', prefix = 'test_h' } = {}) => {
  const stamp = uniqueStamp();
  const email = `${prefix}_${stamp}@example.com`;
  const phone = `03${stamp.slice(-8)}`;
  const hash = await bcrypt.hash(PASSWORD, 10);

  const [result] = await pool.query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)`,
    [ROLE_IDS[role], `Test ${role}`, email, phone, hash]
  );

  const res = await request(app).post('/api/auth/login').send({ credential: email, password: PASSWORD });
  return { id: result.insertId, email, phone, role, token: res.body.data.token };
};

export const authHeader = (user) => ({ Authorization: `Bearer ${user.token}` });
