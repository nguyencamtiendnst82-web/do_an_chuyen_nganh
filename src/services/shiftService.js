import shiftRepository from '../repositories/shiftRepository.js';
import logRepository from '../repositories/logRepository.js';
import { createShiftSchema, updateShiftSchema, normalizeTime } from '../validations/shiftSchemas.js';
import { httpError, fieldError, auditContext, parseId } from '../utils/params.js';

const listShifts = async (user, query = {}) => {
  const isAdmin = user && user.role_name === 'admin';
  const includeInactive = isAdmin && query.all === 'true';
  const shifts = await shiftRepository.findAll({ includeInactive });
  return shifts;
};

const getShiftById = async (rawId) => {
  const id = parseId(rawId, 'ID ca làm việc');
  const shift = await shiftRepository.findById(id);
  if (!shift) {
    throw httpError(404, 'Không tìm thấy ca làm việc.');
  }
  return shift;
};

const createShift = async (user, body, req) => {
  const parsed = createShiftSchema.parse(body);

  // Kiểm tra trùng tên ca
  const existing = await shiftRepository.findByName(parsed.shift_name);
  if (existing) {
    throw fieldError('shift_name', 'Tên ca làm việc đã tồn tại. Vui lòng chọn tên khác.');
  }

  const shiftData = {
    shift_name: parsed.shift_name,
    start_time: normalizeTime(parsed.start_time),
    end_time: normalizeTime(parsed.end_time),
    description: parsed.description ?? null,
    is_active: parsed.is_active !== undefined ? parsed.is_active : true,
  };

  const shiftId = await shiftRepository.create(shiftData);

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: user.id,
    action: 'CREATE_SHIFT',
    entity_name: 'shifts',
    entity_id: shiftId,
    new_values: shiftData,
    ip_address: audit.ip,
    user_agent: audit.userAgent,
  });

  return shiftRepository.findById(shiftId);
};

const updateShift = async (user, rawId, body, req) => {
  const id = parseId(rawId, 'ID ca làm việc');
  const parsed = updateShiftSchema.parse(body);

  const existing = await shiftRepository.findById(id);
  if (!existing) {
    throw httpError(404, 'Không tìm thấy ca làm việc.');
  }

  // Nếu đổi tên ca, kiểm tra trùng
  if (parsed.shift_name && parsed.shift_name.toLowerCase() !== existing.shift_name.toLowerCase()) {
    const duplicate = await shiftRepository.findByName(parsed.shift_name, id);
    if (duplicate) {
      throw fieldError('shift_name', 'Tên ca làm việc đã tồn tại. Vui lòng chọn tên khác.');
    }
  }

  const newStartTime = parsed.start_time ? normalizeTime(parsed.start_time) : existing.start_time;
  const newEndTime = parsed.end_time ? normalizeTime(parsed.end_time) : existing.end_time;
  const isChangingTime = parsed.start_time !== undefined || parsed.end_time !== undefined;
  const isHiding = parsed.is_active === false && existing.is_active === true;

  // Nếu ẩn ca hoặc đổi giờ ca: kiểm tra xem có lịch hẹn tương lai nằm trong ca đó không
  if (isHiding || isChangingTime) {
    const futureAptsCount = await shiftRepository.countActiveFutureAppointments(id);
    if (futureAptsCount > 0) {
      const actionText = isHiding ? 'ẩn' : 'thay đổi khung giờ của';
      throw httpError(
        409,
        `Không thể ${actionText} ca làm việc vì còn ${futureAptsCount} lịch hẹn trong tương lai thuộc ca này.`
      );
    }
  }

  const fieldsToUpdate = {};
  if (parsed.shift_name !== undefined) fieldsToUpdate.shift_name = parsed.shift_name;
  if (parsed.start_time !== undefined) fieldsToUpdate.start_time = newStartTime;
  if (parsed.end_time !== undefined) fieldsToUpdate.end_time = newEndTime;
  if (parsed.description !== undefined) fieldsToUpdate.description = parsed.description;
  if (parsed.is_active !== undefined) fieldsToUpdate.is_active = parsed.is_active;

  if (Object.keys(fieldsToUpdate).length > 0) {
    await shiftRepository.update(id, fieldsToUpdate);
  }

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: user.id,
    action: 'UPDATE_SHIFT',
    entity_name: 'shifts',
    entity_id: id,
    old_values: existing,
    new_values: fieldsToUpdate,
    ip_address: audit.ip,
    user_agent: audit.userAgent,
  });

  return shiftRepository.findById(id);
};

const deleteShift = async (user, rawId, req) => {
  const id = parseId(rawId, 'ID ca làm việc');
  const existing = await shiftRepository.findById(id);
  if (!existing) {
    throw httpError(404, 'Không tìm thấy ca làm việc.');
  }

  // Không xóa cứng ca đã được phân cho ai: chỉ ẩn (is_active=false) hoặc trả 409 nêu rõ số lượt phân ca
  const assignedCount = await shiftRepository.countAssignedEmployees(id);
  if (assignedCount > 0) {
    throw httpError(
      409,
      `Không thể xóa ca làm việc đang được phân công (đã có ${assignedCount} lượt phân ca). Vui lòng ẩn ca thay vì xóa.`
    );
  }

  const futureAptsCount = await shiftRepository.countActiveFutureAppointments(id);
  if (futureAptsCount > 0) {
    throw httpError(
      409,
      `Không thể xóa ca làm việc vì còn ${futureAptsCount} lịch hẹn trong tương lai thuộc ca này.`
    );
  }

  await shiftRepository.deleteById(id);

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: user.id,
    action: 'DELETE_SHIFT',
    entity_name: 'shifts',
    entity_id: id,
    old_values: existing,
    ip_address: audit.ip,
    user_agent: audit.userAgent,
  });

  return { message: 'Xóa ca làm việc thành công.' };
};

export { listShifts, getShiftById, createShift, updateShift, deleteShift };
export default { listShifts, getShiftById, createShift, updateShift, deleteShift };

