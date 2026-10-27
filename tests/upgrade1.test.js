import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { petPhotos, serviceImages } from '../src/middlewares/uploadMedia.js';
import { ageInMonths, currentYearMonth } from '../src/utils/age.js';
import { createUser, authHeader, uniqueStamp } from './helpers/users.js';

// Ảnh PNG 1x1 pixel hợp lệ
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let admin;
let staff;
let ownerA;
let ownerB;
const serviceIds = [];

const monthsAgo = (n) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const newPet = (extra = {}) => ({ name: `Bé ${uniqueStamp()}`, species: 'dog', gender: 'male', ...extra });
const createPet = (user, body) => request(app).post('/api/pets').set(authHeader(user)).send(body);
const fileOf = (dir, url) => path.join(dir, path.basename(url));

beforeAll(async () => {
  admin = await createUser(app, { role: 'admin', prefix: 'test_u1' });
  staff = await createUser(app, { role: 'staff', prefix: 'test_u1' });
  ownerA = await createUser(app, { role: 'customer', prefix: 'test_u1' });
  ownerB = await createUser(app, { role: 'customer', prefix: 'test_u1' });
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_u1\\_%'`);
    for (const id of serviceIds) await pool.query('DELETE FROM services WHERE id = ?', [id]);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test nâng cấp 1:', err.message);
  } finally {
    await pool.end();
  }
});

describe('Tháng sinh → tuổi tự tính', () => {
  test('N1. ageInMonths tính đúng theo tháng', () => {
    expect(ageInMonths('2025-03', new Date(2026, 9, 27))).toBe(19);
    expect(ageInMonths('2026-10', new Date(2026, 9, 27))).toBe(0);
    expect(ageInMonths(null)).toBeNull();
  });

  test('N2. Lưu tháng sinh → API trả birth_month và age_months tự tính', async () => {
    const res = await createPet(ownerA, newPet({ birth_month: monthsAgo(14) }));
    expect(res.status).toBe(201);
    expect(res.body.data.pet.birth_month).toBe(monthsAgo(14));
    expect(res.body.data.pet.age_months).toBe(14);
  });

  test('N3. Tháng sinh ở tương lai hoặc sai định dạng → 422 gắn birth_month', async () => {
    const [y, m] = currentYearMonth().split('-').map(Number);
    const future = `${y + 1}-${String(m).padStart(2, '0')}`;
    for (const bad of [future, '2024-13', '24-05', 'abc']) {
      const res = await createPet(ownerA, newPet({ birth_month: bad }));
      expect(res.status).toBe(422);
      expect(res.body.errors.map((e) => e.field)).toContain('birth_month');
    }
  });

  test('N4. Sửa tháng sinh và xóa tháng sinh (chuỗi rỗng → null)', async () => {
    const created = await createPet(ownerA, newPet({ birth_month: monthsAgo(3) }));
    const id = created.body.data.pet.id;

    const upd = await request(app).put(`/api/pets/${id}`).set(authHeader(ownerA)).send({ birth_month: monthsAgo(30) });
    expect(upd.status).toBe(200);
    expect(upd.body.data.pet.age_months).toBe(30);

    const clear = await request(app).put(`/api/pets/${id}`).set(authHeader(ownerA)).send({ birth_month: '' });
    expect(clear.body.data.pet.birth_month).toBeNull();
  });
});

describe('Lọc theo loài và sắp xếp', () => {
  test('N5. Lọc species=cat chỉ trả mèo', async () => {
    await createPet(ownerB, newPet({ species: 'cat' }));
    await createPet(ownerB, newPet({ species: 'dog' }));
    const res = await request(app).get('/api/pets?species=cat&limit=100').set(authHeader(ownerB));
    expect(res.status).toBe(200);
    expect(res.body.data.pets.length).toBeGreaterThan(0);
    expect(res.body.data.pets.every((p) => p.species === 'cat')).toBe(true);
  });

  test('N6. sort=name sắp theo tên; giá trị sort lạ không gây lỗi', async () => {
    await createPet(ownerB, newPet({ name: 'Zeta' }));
    await createPet(ownerB, newPet({ name: 'Alpha' }));
    const res = await request(app).get('/api/pets?sort=name&limit=100').set(authHeader(ownerB));
    const names = res.body.data.pets.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'vi')));

    const odd = await request(app).get('/api/pets?sort=1;DROP TABLE pets').set(authHeader(ownerB));
    expect(odd.status).toBe(200);
  });
});

describe('Ảnh thú cưng', () => {
  test('N7. Chủ tải ảnh PNG → 200, có file; thay ảnh thì file cũ bị xóa', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    const first = await request(app).post(`/api/pets/${id}/photo`).set(authHeader(ownerA))
      .attach('photo', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    const url1 = first.body.data.pet.avatar_url;
    expect(url1).toMatch(/^\/api\/pets\/photos\/.+\.png$/);
    expect(fs.existsSync(fileOf(petPhotos.dir, url1))).toBe(true);

    const second = await request(app).post(`/api/pets/${id}/photo`).set(authHeader(ownerA))
      .attach('photo', PNG_1X1, { filename: 'b.png', contentType: 'image/png' });
    const url2 = second.body.data.pet.avatar_url;
    expect(url2).not.toBe(url1);
    expect(fs.existsSync(fileOf(petPhotos.dir, url1))).toBe(false);

    // Ảnh được phục vụ công khai
    const served = await request(app).get(url2);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');

    const del = await request(app).delete(`/api/pets/${id}/photo`).set(authHeader(ownerA));
    expect(del.status).toBe(200);
    expect(del.body.data.pet.avatar_url).toBeNull();
    expect(fs.existsSync(fileOf(petPhotos.dir, url2))).toBe(false);
  });

  test('N8. File giả (đuôi png nhưng nội dung là chữ) → 422 và không để lại file', async () => {
    const created = await createPet(ownerA, newPet());
    const before = fs.readdirSync(petPhotos.dir).length;
    const res = await request(app).post(`/api/pets/${created.body.data.pet.id}/photo`).set(authHeader(ownerA))
      .attach('photo', Buffer.from('day khong phai anh'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(422);
    expect(fs.readdirSync(petPhotos.dir).length).toBe(before);
  });

  test('N9. Sai định dạng, quá 2MB, không gửi file → 422', async () => {
    const id = (await createPet(ownerA, newPet())).body.data.pet.id;
    const url = `/api/pets/${id}/photo`;

    const txt = await request(app).post(url).set(authHeader(ownerA))
      .attach('photo', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(422);

    const big = Buffer.concat([PNG_1X1, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    const large = await request(app).post(url).set(authHeader(ownerA))
      .attach('photo', big, { filename: 'lon.png', contentType: 'image/png' });
    expect(large.status).toBe(422);

    const none = await request(app).post(url).set(authHeader(ownerA));
    expect(none.status).toBe(422);
  });

  test('N10. Khách khác không tải/xóa ảnh thú người khác được (404); staff thì được', async () => {
    const id = (await createPet(ownerA, newPet())).body.data.pet.id;

    const other = await request(app).post(`/api/pets/${id}/photo`).set(authHeader(ownerB))
      .attach('photo', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(other.status).toBe(404);
    expect((await request(app).delete(`/api/pets/${id}/photo`).set(authHeader(ownerB))).status).toBe(404);

    const ok = await request(app).post(`/api/pets/${id}/photo`).set(authHeader(staff))
      .attach('photo', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(200);
  });

  test('N11. Không có token → 401', async () => {
    const res = await request(app).post('/api/pets/1/photo')
      .attach('photo', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});

describe('Ảnh dịch vụ (chỉ admin)', () => {
  const makeService = async () => {
    const res = await request(app).post('/api/services').set(authHeader(admin))
      .send({ name: `DV test u1 ${uniqueStamp()}`, price: 100000, duration_minutes: 30 });
    serviceIds.push(res.body.data.service.id);
    return res.body.data.service.id;
  };

  test('N12. Admin tải ảnh → 200, thay ảnh xóa file cũ, xóa ảnh', async () => {
    const id = await makeService();
    const first = await request(app).post(`/api/services/${id}/image`).set(authHeader(admin))
      .attach('image', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    const url1 = first.body.data.service.image_url;
    expect(url1).toMatch(/^\/api\/services\/images\/.+\.png$/);
    expect(fs.existsSync(fileOf(serviceImages.dir, url1))).toBe(true);

    const second = await request(app).post(`/api/services/${id}/image`).set(authHeader(admin))
      .attach('image', PNG_1X1, { filename: 'b.png', contentType: 'image/png' });
    expect(fs.existsSync(fileOf(serviceImages.dir, url1))).toBe(false);

    const del = await request(app).delete(`/api/services/${id}/image`).set(authHeader(admin));
    expect(del.status).toBe(200);
    expect(del.body.data.service.image_url).toBeNull();
    expect(fs.existsSync(fileOf(serviceImages.dir, second.body.data.service.image_url))).toBe(false);
  });

  test('N13. Staff và khách không đổi được ảnh dịch vụ → 403', async () => {
    const id = await makeService();
    for (const user of [staff, ownerA]) {
      const res = await request(app).post(`/api/services/${id}/image`).set(authHeader(user))
        .attach('image', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
      expect(res.status).toBe(403);
      expect((await request(app).delete(`/api/services/${id}/image`).set(authHeader(user))).status).toBe(403);
    }
  });

  test('N14. File giả làm ảnh dịch vụ → 422; dịch vụ không tồn tại → 404 và không để lại file', async () => {
    const id = await makeService();
    const before = fs.readdirSync(serviceImages.dir).length;

    const fake = await request(app).post(`/api/services/${id}/image`).set(authHeader(admin))
      .attach('image', Buffer.from('khong phai anh'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(422);

    const missing = await request(app).post('/api/services/99999999/image').set(authHeader(admin))
      .attach('image', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
    expect(missing.status).toBe(404);

    expect(fs.readdirSync(serviceImages.dir).length).toBe(before);
  });
});

describe('Tìm khách hàng để thêm thú hộ', () => {
  test('N15. Staff/admin tìm theo SĐT; chỉ trả trường cần thiết, chỉ khách hàng', async () => {
    const res = await request(app).get(`/api/customers?search=${ownerA.phone}`).set(authHeader(staff));
    expect(res.status).toBe(200);
    const list = res.body.data.customers;
    expect(list.some((c) => c.id === ownerA.id)).toBe(true);
    expect(list.every((c) => Object.keys(c).sort().join() === 'email,full_name,id,phone')).toBe(true);

    const byAdmin = await request(app).get(`/api/customers?search=${staff.phone}`).set(authHeader(admin));
    expect(byAdmin.body.data.customers.some((c) => c.id === staff.id)).toBe(false); // staff không phải khách
  });

  test('N16. Khách hàng gọi → 403; không token → 401', async () => {
    expect((await request(app).get('/api/customers').set(authHeader(ownerA))).status).toBe(403);
    expect((await request(app).get('/api/customers')).status).toBe(401);
  });
});
