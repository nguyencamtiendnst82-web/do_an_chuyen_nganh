import request from 'supertest';

import appModule from '../src/app.js';
const app = appModule.app || appModule;
import { pool } from '../src/config/db.js';
import { createUser, authHeader, uniqueStamp } from './helpers/users.js';

let admin;
let staff;
let ownerA;
let ownerB;

const newPet = (extra = {}) => ({
  name: `Bé ${uniqueStamp()}`,
  species: 'dog',
  gender: 'male',
  breed: 'Poodle',
  birth_month: '2025-01',
  weight_kg: 4.5,
  special_notes: 'Sợ tiếng máy sấy',
  ...extra,
});

const createPet = (user, body) => request(app).post('/api/pets').set(authHeader(user)).send(body);

beforeAll(async () => {
  admin = await createUser(app, { role: 'admin', prefix: 'test_pt' });
  staff = await createUser(app, { role: 'staff', prefix: 'test_pt' });
  ownerA = await createUser(app, { role: 'customer', prefix: 'test_pt' });
  ownerB = await createUser(app, { role: 'customer', prefix: 'test_pt' });
});

afterAll(async () => {
  try {
    // Lịch hẹn tham chiếu khách hàng/thú cưng bằng RESTRICT → xóa trước
    await pool.query(`DELETE FROM appointments WHERE appointment_code LIKE 'TEST-PT-%'`);
    // Thú cưng tự xóa theo khách hàng (ON DELETE CASCADE)
    await pool.query(`DELETE FROM users WHERE email LIKE 'test\\_pt\\_%'`);
  } catch (err) {
    console.warn('[Cleanup] Không thể dọn dữ liệu test thú cưng:', err.message);
  } finally {
    await pool.end();
  }
});

describe('Thú cưng: khách hàng thao tác trên thú của mình', () => {
  test('PT1. Không có token → 401', async () => {
    expect((await request(app).get('/api/pets')).status).toBe(401);
    expect((await request(app).post('/api/pets').send(newPet())).status).toBe(401);
  });

  test('PT2. Thêm thú cưng → 201, chủ là chính khách dù gửi customer_id người khác', async () => {
    const res = await createPet(ownerA, newPet({ customer_id: ownerB.id }));
    expect(res.status).toBe(201);
    expect(res.body.data.pet.customer_id).toBe(ownerA.id);
    expect(res.body.data.pet.status).toBe('active');
    expect(typeof res.body.data.pet.weight_kg).toBe('number');
  });

  test('PT3. Dữ liệu sai (loài, cân nặng, tháng sinh, tên rỗng) → 422 theo từng trường', async () => {
    const res = await createPet(ownerA, { name: '', species: 'rong', weight_kg: -3, birth_month: '2999-13' });
    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'species', 'weight_kg', 'birth_month']));
  });

  test('PT4. Chuỗi rỗng ở trường không bắt buộc được lưu thành null', async () => {
    const res = await createPet(ownerA, newPet({ breed: '', special_notes: '', birth_month: '', weight_kg: '' }));
    expect(res.status).toBe(201);
    expect(res.body.data.pet.breed).toBeNull();
    expect(res.body.data.pet.special_notes).toBeNull();
    expect(res.body.data.pet.birth_month).toBeNull();
    expect(res.body.data.pet.age_months).toBeNull();
    expect(res.body.data.pet.weight_kg).toBeNull();
  });

  test('PT5. Danh sách của khách chỉ chứa thú của chính họ', async () => {
    const mine = await createPet(ownerA, newPet());
    const theirs = await createPet(ownerB, newPet());

    const res = await request(app).get('/api/pets?limit=100').set(authHeader(ownerA));
    expect(res.status).toBe(200);
    const ids = res.body.data.pets.map((p) => p.id);
    expect(ids).toContain(mine.body.data.pet.id);
    expect(ids).not.toContain(theirs.body.data.pet.id);
    expect(res.body.data.pets.every((p) => p.customer_id === ownerA.id)).toBe(true);
  });

  test('PT6. Khách đổi customer_id trên query vẫn chỉ thấy thú của mình', async () => {
    await createPet(ownerB, newPet());
    const res = await request(app).get(`/api/pets?customer_id=${ownerB.id}&limit=100`).set(authHeader(ownerA));
    expect(res.status).toBe(200);
    expect(res.body.data.pets.every((p) => p.customer_id === ownerA.id)).toBe(true);
  });

  test('PT7. Khách sửa thú của mình → 200 và ghi log UPDATE_PET', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    const res = await request(app).put(`/api/pets/${id}`).set(authHeader(ownerA)).send({ weight_kg: 5.678, name: 'Đổi tên' });
    expect(res.status).toBe(200);
    expect(res.body.data.pet.name).toBe('Đổi tên');
    expect(res.body.data.pet.weight_kg).toBe(5.68);

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs WHERE action = 'UPDATE_PET' AND entity_id = ? AND user_id = ?`,
      [id, ownerA.id]
    );
    expect(rows[0].total).toBe(1);
  });

  test('PT8. PUT không có trường nào để cập nhật → 422', async () => {
    const created = await createPet(ownerA, newPet());
    const res = await request(app).put(`/api/pets/${created.body.data.pet.id}`).set(authHeader(ownerA)).send({});
    expect(res.status).toBe(422);
  });
});

describe('Thú cưng: chống truy cập chéo (IDOR)', () => {
  test('PT9. Khách B không xem / sửa / xóa được thú của khách A → 404', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    expect((await request(app).get(`/api/pets/${id}`).set(authHeader(ownerB))).status).toBe(404);
    expect((await request(app).put(`/api/pets/${id}`).set(authHeader(ownerB)).send({ name: 'Hack' })).status).toBe(404);
    expect((await request(app).delete(`/api/pets/${id}`).set(authHeader(ownerB))).status).toBe(404);

    // Dữ liệu của khách A không bị thay đổi
    const still = await request(app).get(`/api/pets/${id}`).set(authHeader(ownerA));
    expect(still.status).toBe(200);
    expect(still.body.data.pet.name).not.toBe('Hack');
    expect(still.body.data.pet.status).toBe('active');
  });

  test('PT10. ID không phải số → 400; ID không tồn tại → 404', async () => {
    expect((await request(app).get('/api/pets/abc').set(authHeader(ownerA))).status).toBe(400);
    expect((await request(app).get('/api/pets/99999999').set(authHeader(ownerA))).status).toBe(404);
  });
});

describe('Thú cưng: staff và admin', () => {
  test('PT11. Staff xem được thú của mọi khách, tìm theo số điện thoại chủ', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    const detail = await request(app).get(`/api/pets/${id}`).set(authHeader(staff));
    expect(detail.status).toBe(200);
    expect(detail.body.data.pet.owner_phone).toBe(ownerA.phone);

    const search = await request(app).get(`/api/pets?search=${ownerA.phone}`).set(authHeader(staff));
    expect(search.status).toBe(200);
    expect(search.body.data.pets.some((p) => p.id === id)).toBe(true);
    expect(search.body.data.pets.every((p) => p.owner_phone === ownerA.phone)).toBe(true);
  });

  test('PT12. Staff thêm thú cho khách bằng customer_id → 201, chủ đúng khách', async () => {
    const res = await createPet(staff, newPet({ customer_id: ownerB.id }));
    expect(res.status).toBe(201);
    expect(res.body.data.pet.customer_id).toBe(ownerB.id);
  });

  test('PT13. Staff thiếu customer_id hoặc chọn người không phải khách → 422 gắn customer_id', async () => {
    const missing = await createPet(staff, newPet());
    expect(missing.status).toBe(422);
    expect(missing.body.errors[0].field).toBe('customer_id');

    const wrong = await createPet(admin, newPet({ customer_id: staff.id }));
    expect(wrong.status).toBe(422);
    expect(wrong.body.errors[0].field).toBe('customer_id');
  });

  test('PT14. Admin sửa được thú của khách', async () => {
    const created = await createPet(ownerA, newPet());
    const res = await request(app)
      .put(`/api/pets/${created.body.data.pet.id}`)
      .set(authHeader(admin))
      .send({ special_notes: 'Admin cập nhật' });
    expect(res.status).toBe(200);
    expect(res.body.data.pet.special_notes).toBe('Admin cập nhật');
  });
});

describe('Thú cưng: ẩn / khôi phục hồ sơ', () => {
  test('PT15. DELETE = ẩn hồ sơ; mặc định không hiện, xem được bằng status=inactive, khôi phục bằng PUT', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    const del = await request(app).delete(`/api/pets/${id}`).set(authHeader(ownerA));
    expect(del.status).toBe(200);
    expect(del.body.data.pet.status).toBe('inactive');

    const active = await request(app).get('/api/pets?limit=100').set(authHeader(ownerA));
    expect(active.body.data.pets.some((p) => p.id === id)).toBe(false);

    const hidden = await request(app).get('/api/pets?status=inactive&limit=100').set(authHeader(ownerA));
    expect(hidden.body.data.pets.some((p) => p.id === id)).toBe(true);

    const restore = await request(app).put(`/api/pets/${id}`).set(authHeader(ownerA)).send({ status: 'active' });
    expect(restore.status).toBe(200);
    expect(restore.body.data.pet.status).toBe('active');

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs WHERE action = 'ARCHIVE_PET' AND entity_id = ? AND user_id = ?`,
      [id, ownerA.id]
    );
    expect(rows[0].total).toBe(1);
  });

  test('PT16. Còn lịch hẹn chưa hoàn tất → không ẩn được hồ sơ (409), cả DELETE lẫn PUT', async () => {
    const created = await createPet(ownerA, newPet());
    const id = created.body.data.pet.id;

    await pool.query(
      `INSERT INTO appointments (appointment_code, customer_id, pet_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, CURDATE(), '09:00:00', '10:00:00', 'pending')`,
      [`TEST-PT-${uniqueStamp()}`, ownerA.id, id]
    );

    const del = await request(app).delete(`/api/pets/${id}`).set(authHeader(ownerA));
    expect(del.status).toBe(409);

    const put = await request(app).put(`/api/pets/${id}`).set(authHeader(ownerA)).send({ status: 'inactive' });
    expect(put.status).toBe(409);

    const still = await request(app).get(`/api/pets/${id}`).set(authHeader(ownerA));
    expect(still.body.data.pet.status).toBe('active');
  });

  test('PT17. Phân trang: limit và total_pages', async () => {
    await createPet(ownerB, newPet());
    await createPet(ownerB, newPet());
    const res = await request(app).get('/api/pets?limit=1&page=1').set(authHeader(ownerB));
    expect(res.status).toBe(200);
    expect(res.body.data.pets).toHaveLength(1);
    expect(res.body.data.pagination.total_pages).toBeGreaterThanOrEqual(2);
  });
});
