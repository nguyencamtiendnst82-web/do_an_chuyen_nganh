import { pool } from '../config/db.js';

const SELECT_BASE = `
  SELECT i.id, i.appointment_id, i.pet_id, i.reported_by, i.title, i.incident_type, i.severity,
         i.description, i.resolution, i.status, i.created_at, i.resolved_at,
         p.name AS pet_name, p.species AS pet_species,
         u.full_name AS reporter_name,
         a.appointment_code
  FROM incidents i
  JOIN pets p ON i.pet_id = p.id
  JOIN users u ON i.reported_by = u.id
  LEFT JOIN appointments a ON i.appointment_id = a.id`;

export const create = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO incidents
       (appointment_id, pet_id, reported_by, title, incident_type, severity, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.appointment_id ?? null,
      data.pet_id,
      data.reported_by,
      data.title,
      data.incident_type,
      data.severity,
      data.description,
    ]
  );
  return result.insertId;
};

export const findById = async (id) => {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE i.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
};

const buildWhere = ({ reportedBy, status, severity, petId }) => {
  const conditions = [];
  const params = [];
  if (reportedBy) { conditions.push('i.reported_by = ?'); params.push(reportedBy); }
  if (status) { conditions.push('i.status = ?'); params.push(status); }
  if (severity) { conditions.push('i.severity = ?'); params.push(severity); }
  if (petId) { conditions.push('i.pet_id = ?'); params.push(petId); }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
};

/** Sự cố chưa xử lý và nghiêm trọng hiện lên trước */
export const findAll = async (filters) => {
  const { page = 1, limit = 10 } = filters;
  const { where, params } = buildWhere(filters);
  const [rows] = await pool.query(
    `${SELECT_BASE}
     ${where}
     ORDER BY FIELD(i.status, 'open', 'investigating', 'resolved'),
              FIELD(i.severity, 'critical', 'high', 'medium', 'low'),
              i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return rows;
};

export const countAll = async (filters) => {
  const { where, params } = buildWhere(filters);
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM incidents i ${where}`, params);
  return rows[0]?.total || 0;
};

/**
 * Cập nhật sự cố. resolved_at do SERVER đặt:
 *  - resolvedAtNow: chuyển sang resolved -> NOW()
 *  - clearResolvedAt: mở lại sự cố -> NULL
 */
export const update = async (id, fields, { resolvedAtNow = false, clearResolvedAt = false } = {}) => {
  const sets = [];
  const values = [];
  for (const key of ['status', 'severity', 'resolution']) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      values.push(fields[key]);
    }
  }
  if (resolvedAtNow) sets.push('`resolved_at` = NOW()');
  if (clearResolvedAt) sets.push('`resolved_at` = NULL');
  if (sets.length === 0) return false;

  values.push(id);
  const [result] = await pool.query(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

export default { create, findById, findAll, countAll, update };
