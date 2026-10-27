import { pool } from '../config/db.js';

/**
 * Repository bảng services. LUÔN dùng prepared statement (?)
 * DECIMAL của MySQL trả về dạng chuỗi → đổi sang number tại đây.
 */
const mapRow = (row) =>
  row && {
    ...row,
    price: Number(row.price),
    is_active: Boolean(row.is_active),
  };

const findAll = async ({ search, is_active } = {}) => {
  const conditions = [];
  const params = [];

  if (typeof is_active === 'boolean') {
    conditions.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT id, name, description, price, duration_minutes, image_url, is_active, created_at, updated_at
     FROM services
     ${where}
     ORDER BY is_active DESC, name ASC`,
    params
  );
  return rows.map(mapRow);
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, price, duration_minutes, image_url, is_active, created_at, updated_at
     FROM services WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapRow(rows[0]) || null;
};

/** Tìm theo tên (không phân biệt hoa thường nhờ collation), có thể loại trừ một ID khi sửa */
const findByName = async (name, excludeId = null) => {
  const [rows] = await pool.query(
    `SELECT id FROM services WHERE name = ? ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
    excludeId ? [name, excludeId] : [name]
  );
  return rows[0] || null;
};

const create = async ({ name, description = null, price, duration_minutes, is_active = true }) => {
  const [result] = await pool.query(
    `INSERT INTO services (name, description, price, duration_minutes, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, price, duration_minutes, is_active ? 1 : 0]
  );
  return result.insertId;
};

const update = async (id, fields) => {
  const allowed = ['name', 'description', 'price', 'duration_minutes'];
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
  const [result] = await pool.query(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

const setActive = async (id, isActive) => {
  const [result] = await pool.query('UPDATE services SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return result.affectedRows > 0;
};

const setImage = async (id, url) => {
  const [result] = await pool.query('UPDATE services SET image_url = ? WHERE id = ?', [url, id]);
  return result.affectedRows > 0;
};

export { findAll, findById, findByName, create, update, setActive, setImage };
export default { findAll, findById, findByName, create, update, setActive, setImage };
