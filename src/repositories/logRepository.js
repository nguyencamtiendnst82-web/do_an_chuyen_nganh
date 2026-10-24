const { pool } = require('../config/db');

/**
 * Repository cho bảng system_logs
 * Ghi nhật ký kiểm toán các thao tác quan trọng
 */

/**
 * Chèn một bản ghi log vào system_logs
 * @param {object} logData
 * @param {number|null} logData.user_id - ID người thực hiện (null nếu là hệ thống)
 * @param {string} logData.action - Tên hành động: USER_REGISTER, USER_LOGIN, ...
 * @param {string} logData.entity_name - Tên bảng bị tác động: users, appointments, ...
 * @param {number|null} logData.entity_id - ID bản ghi bị tác động
 * @param {object|null} logData.old_values - Dữ liệu trước khi thay đổi
 * @param {object|null} logData.new_values - Dữ liệu sau khi thay đổi
 * @param {string|null} logData.ip_address - IP của client
 * @param {string|null} logData.user_agent - User-Agent của client
 */
const insert = async ({
  user_id = null,
  action,
  entity_name,
  entity_id = null,
  old_values = null,
  new_values = null,
  ip_address = null,
  user_agent = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO system_logs
         (user_id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        action,
        entity_name,
        entity_id,
        old_values !== null ? JSON.stringify(old_values) : null,
        new_values !== null ? JSON.stringify(new_values) : null,
        ip_address,
        user_agent ? user_agent.substring(0, 255) : null,
      ]
    );
  } catch (err) {
    // Không để lỗi ghi log làm sập request chính
    console.error('⚠️ [LogRepository] Không thể ghi system_log:', err.message);
  }
};

module.exports = { insert };
