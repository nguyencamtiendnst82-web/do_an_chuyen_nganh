import logRepository from '../repositories/logRepository.js';

/**
 * Helper ghi nhật ký thao tác vào system_logs
 * Không ném lỗi ra ngoài (lỗi ghi log không được làm sập request)
 *
 * @param {object} req - Express request (để lấy IP, user-agent)
 * @param {string} action - Tên hành động: USER_REGISTER, USER_LOGIN, CHANGE_STATUS, ...
 * @param {string} entityName - Tên bảng: users, appointments, invoices, ...
 * @param {number|null} entityId - ID của bản ghi bị tác động
 * @param {object|null} oldValues - Dữ liệu cũ (trước khi thay đổi)
 * @param {object|null} newValues - Dữ liệu mới (sau khi thay đổi)
 */
const logAction = async (req, action, entityName, entityId = null, oldValues = null, newValues = null) => {
  const userId = req.user ? req.user.id : null;
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers?.['user-agent'] || null;

  await logRepository.insert({
    user_id: userId,
    action,
    entity_name: entityName,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
};

export default logAction;
