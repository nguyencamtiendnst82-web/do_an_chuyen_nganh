import fs from 'fs';
import path from 'path';
import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { AVATAR_DIR } from '../src/middlewares/uploadImage.js';

// Ảnh PNG 1x1 pixel hợp lệ
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const stamp = Date.now();
const testUser = {
  full_name: 'Test Avatar',
  email: `test_avatar_${stamp}@example.com`,
  phone: `09${String(stamp).slice(-8)}`,
  password: 'Password123@',
};

let token;
const uploadedUrls = [];

const fileOnDisk = (avatarUrl) => path.join(AVATAR_DIR, path.basename(avatarUrl));

beforeAll(async () => {
  await request(app).post('/api/auth/register').send(testUser);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ credential: testUser.email, password: testUser.password });
  token = res.body.data.token;
});

afterAll(async () => {
  try {
    // Dọn file ảnh còn sót và dữ liệu test
    for (const url of uploadedUrls) {
      await fs.promises.unlink(fileOnDisk(url)).catch(() => {});
    }
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_avatar\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test avatar:', err.message);
  } finally {
    await pool.end();
  }
});

describe('POST /api/auth/me/avatar', () => {
  test('A1. Tải ảnh PNG hợp lệ → 200, avatar_url được cập nhật, file có trên đĩa', async () => {
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_1X1, { filename: 'anh.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar_url).toMatch(/^\/api\/auth\/avatars\/.+\.png$/);
    expect(res.body.data.user.password_hash).toBeUndefined();

    const url = res.body.data.user.avatar_url;
    uploadedUrls.push(url);
    expect(fs.existsSync(fileOnDisk(url))).toBe(true);

    // Ảnh phải truy cập công khai được
    const imgRes = await request(app).get(url);
    expect(imgRes.status).toBe(200);
  });

  test('A2. Tải ảnh lần 2 → file cũ bị xóa khỏi đĩa', async () => {
    const oldUrl = uploadedUrls[0];

    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_1X1, { filename: 'anh2.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    const newUrl = res.body.data.user.avatar_url;
    uploadedUrls.push(newUrl);

    expect(newUrl).not.toBe(oldUrl);
    expect(fs.existsSync(fileOnDisk(oldUrl))).toBe(false);
    expect(fs.existsSync(fileOnDisk(newUrl))).toBe(true);
  });

  test('A3. File giả ảnh (nội dung chữ, đuôi .png) → 422 và không để lại file rác', async () => {
    const before = fs.readdirSync(AVATAR_DIR).length;

    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('day khong phai la anh, chi la van ban thuong'), {
        filename: 'gia.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(422);
    expect(fs.readdirSync(AVATAR_DIR).length).toBe(before);
  });

  test('A4. Sai định dạng (text/plain) → 422', async () => {
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(res.status).toBe(422);
  });

  test('A5. Ảnh quá 2MB → 422', async () => {
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(3 * 1024 * 1024)]);
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', big, { filename: 'lon.png', contentType: 'image/png' });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('2MB');
  });

  test('A6. Không gửi file → 422', async () => {
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('A7. Không có token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .attach('avatar', PNG_1X1, { filename: 'anh.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/auth/me và DELETE /api/auth/me/avatar', () => {
  test('A8. PUT /me không còn cho đổi avatar_url bằng URL tự do', async () => {
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const currentAvatar = before.body.data.user.avatar_url;

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Test Avatar', avatar_url: 'https://example.com/hacker.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar_url).toBe(currentAvatar);
  });

  test('A9. Gỡ ảnh đại diện → avatar_url = null và file bị xóa', async () => {
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const url = current.body.data.user.avatar_url;
    expect(url).toBeTruthy();

    const res = await request(app)
      .delete('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar_url).toBeNull();
    expect(fs.existsSync(fileOnDisk(url))).toBe(false);
  });
});