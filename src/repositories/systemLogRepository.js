import { pool } from '../config/db.js';

/**
 * Lấy danh sách nhật ký hệ thống kèm bộ lọc và phân trang
 * Bảo mật: old_values và new_values được làm sạch, không chứa password_hash, token hoặc secret.
 */
export const getLogs = async ({ userId, action, from, to, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];

  if (userId) {
    conditions.push('l.user_id = ?');
    params.push(userId);
  }

  if (action) {
    conditions.push('l.action LIKE ?');
    params.push(`%${action}%`);
  }

  if (from) {
    conditions.push('DATE(l.created_at) >= ?');
    params.push(from);
  }

  if (to) {
    conditions.push('DATE(l.created_at) <= ?');
    params.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Đếm tổng số bản ghi
  const countSql = `SELECT COUNT(*) AS total FROM system_logs l ${whereClause}`;
  const [countRows] = await pool.query(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  // Lấy dữ liệu phân trang kèm thông tin user (tên, email, role)
  const offset = (page - 1) * limit;
  const sql = `
    SELECT 
      l.id,
      l.user_id,
      u.full_name AS user_name,
      u.email AS user_email,
      r.role_name,
      l.action,
      l.entity_name,
      l.entity_id,
      l.old_values,
      l.new_values,
      l.ip_address,
      l.user_agent,
      l.created_at
    FROM system_logs l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, limit, offset]);

  // Làm sạch dữ liệu nhạy cảm nếu có lọt vào old_values hoặc new_values
  const sanitize = (val) => {
    if (!val || typeof val !== 'object') return val;
    const sanitized = { ...val };
    const sensitiveKeys = ['password', 'password_hash', 'token', 'refreshToken', 'google_id', 'secret'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return sanitized;
  };

  const logs = rows.map((r) => ({
    ...r,
    old_values: sanitize(r.old_values),
    new_values: sanitize(r.new_values),
  }));

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
};

export default {
  getLogs,
};
