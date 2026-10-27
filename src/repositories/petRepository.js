import { pool } from '../config/db.js';
import { ageInMonths } from '../utils/age.js';

/**
 * Repository bảng pets (JOIN users để lấy thông tin chủ nuôi).
 * LUÔN dùng prepared statement (?). DECIMAL → number.
 * Tuổi (age_months) được TỰ TÍNH từ birth_month; chỉ dùng số liệu cũ khi chưa có tháng sinh.
 */
const mapRow = (row) => {
  if (!row) return row;
  const age = row.birth_month ? ageInMonths(row.birth_month) : row.age_months ?? null;
  return {
    ...row,
    age_months: age,
    weight_kg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
  };
};

const SELECT_PET = `
  SELECT p.id, p.customer_id, p.name, p.species, p.breed, p.gender, p.age_months,
         DATE_FORMAT(p.birth_month, '%Y-%m') AS birth_month,
         p.weight_kg, p.special_notes, p.avatar_url, p.status, p.created_at, p.updated_at,
         u.full_name AS owner_name, u.phone AS owner_phone
  FROM pets p
  JOIN users u ON p.customer_id = u.id`;

// Danh sách cột sắp xếp được phép (KHÔNG đưa giá trị từ client vào SQL)
const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  oldest: 'p.created_at ASC, p.id ASC',
  name: 'p.name ASC, p.id ASC',
};

const buildFilters = ({ customerId, status, species, search }) => {
  const conditions = [];
  const params = [];

  if (customerId) {
    conditions.push('p.customer_id = ?');
    params.push(customerId);
  }
  if (status === 'active' || status === 'inactive') {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (species) {
    conditions.push('p.species = ?');
    params.push(species);
  }
  if (search) {
    conditions.push('(p.name LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
};

const findAll = async ({ customerId, status, species, search, sort = 'newest', page = 1, limit = 10 }) => {
  const { where, params } = buildFilters({ customerId, status, species, search });
  const orderBy = SORTS[sort] || SORTS.newest;
  const [rows] = await pool.query(
    `${SELECT_PET} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return rows.map(mapRow);
};

const countAll = async ({ customerId, status, species, search }) => {
  const { where, params } = buildFilters({ customerId, status, species, search });
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM pets p JOIN users u ON p.customer_id = u.id ${where}`,
    params
  );
  return rows[0].total;
};

const findById = async (id) => {
  const [rows] = await pool.query(`${SELECT_PET} WHERE p.id = ? LIMIT 1`, [id]);
  return mapRow(rows[0]) || null;
};

/** birth_month nhận 'YYYY-MM-01' hoặc null */
const create = async ({ customer_id, name, species, breed, gender, birth_month, weight_kg, special_notes }) => {
  const [result] = await pool.query(
    `INSERT INTO pets (customer_id, name, species, breed, gender, birth_month, weight_kg, special_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, name, species, breed ?? null, gender, birth_month ?? null, weight_kg ?? null, special_notes ?? null]
  );
  return result.insertId;
};

const update = async (id, fields) => {
  // Không cho đổi customer_id (chuyển chủ) qua API này; ảnh có endpoint riêng
  const allowed = ['name', 'species', 'breed', 'gender', 'birth_month', 'weight_kg', 'special_notes', 'status'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return false;
  values.push(id);
  const [result] = await pool.query(`UPDATE pets SET ${sets.join(', ')} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

const setAvatar = async (id, url) => {
  const [result] = await pool.query('UPDATE pets SET avatar_url = ? WHERE id = ?', [url, id]);
  return result.affectedRows > 0;
};

/** Số lịch hẹn chưa hoàn tất của thú cưng (chặn ẩn hồ sơ khi còn lịch) */
const countOpenAppointments = async (petId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM appointments
     WHERE pet_id = ? AND status IN ('pending', 'confirmed', 'checked_in', 'in_progress')`,
    [petId]
  );
  return rows[0].total;
};

export { findAll, countAll, findById, create, update, setAvatar, countOpenAppointments };
export default { findAll, countAll, findById, create, update, setAvatar, countOpenAppointments };
