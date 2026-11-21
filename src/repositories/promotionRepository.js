import { pool } from '../config/db.js';

const COLS = `p.id, p.name, p.discount_type, p.discount_value, p.service_id, p.min_invoice,
              p.start_date, p.end_date, p.is_active, p.created_at, s.name AS service_name`;

export const list = async () => {
  const [rows] = await pool.query(
    `SELECT ${COLS} FROM promotions p LEFT JOIN services s ON s.id = p.service_id ORDER BY p.is_active DESC, p.end_date DESC, p.id DESC`
  );
  return rows;
};

export const findById = async (id) => {
  const [rows] = await pool.query(`SELECT ${COLS} FROM promotions p LEFT JOIN services s ON s.id = p.service_id WHERE p.id = ?`, [id]);
  return rows[0] || null;
};

/** Chương trình đang hoạt động và còn hiệu lực vào ngày `ymd` */
export const findActive = async (conn, ymd) => {
  const [rows] = await conn.query(
    `SELECT id, name, discount_type, discount_value, service_id, min_invoice
     FROM promotions
     WHERE is_active = 1 AND start_date <= ? AND end_date >= ?`,
    [ymd, ymd]
  );
  return rows;
};

export const create = async (d) => {
  const [res] = await pool.query(
    `INSERT INTO promotions (name, discount_type, discount_value, service_id, min_invoice, start_date, end_date, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [d.name, d.discount_type, d.discount_value, d.service_id ?? null, d.min_invoice ?? 0, d.start_date, d.end_date, d.created_by]
  );
  return res.insertId;
};

export const update = async (id, d) => {
  await pool.query(
    `UPDATE promotions SET name = ?, discount_type = ?, discount_value = ?, service_id = ?, min_invoice = ?, start_date = ?, end_date = ?
     WHERE id = ?`,
    [d.name, d.discount_type, d.discount_value, d.service_id ?? null, d.min_invoice ?? 0, d.start_date, d.end_date, id]
  );
};

export const setActive = async (id, active) => {
  await pool.query('UPDATE promotions SET is_active = ? WHERE id = ?', [active ? 1 : 0, id]);
};

export default { list, findById, findActive, create, update, setActive };
