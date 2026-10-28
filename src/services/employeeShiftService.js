import { pool } from '../config/db.js';
import employeeShiftRepository from '../repositories/employeeShiftRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import shiftRepository from '../repositories/shiftRepository.js';
import logRepository from '../repositories/logRepository.js';
import { bulkAssignSchema, dateRangeQuerySchema, countDaysBetween } from '../validations/employeeShiftSchemas.js';
import { httpError, parseId, auditContext } from '../utils/params.js';

/**
 * Lấy chuỗi YYYY-MM-DD hôm nay theo giờ địa phương
 */
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Cộng thêm n ngày vào chuỗi ngày YYYY-MM-DD
 */
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Lấy thứ trong tuần của YYYY-MM-DD (0: Chủ nhật, 1: Thứ 2, ..., 6: Thứ 7)
 */
const getDayOfWeek = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getUTCDay();
};

/**
 * Kiểm tra 2 khoảng giờ có chồng lấn nhau không
 * (start1 < end2 && end1 > start2)
 */
const isTimeOverlapping = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

/**
 * Phân ca hàng loạt theo khoảng ngày cho nhân viên
 */
const bulkAssignShifts = async (user, body, req) => {
  const parsed = bulkAssignSchema.parse(body);
  const { employee_id, shift_ids, from, to, weekdays } = parsed;

  // 1. Kiểm tra nhân viên hợp lệ và đang hoạt động
  const employee = await employeeRepository.findById(employee_id);
  if (!employee) {
    throw httpError(404, 'Không tìm thấy nhân viên.');
  }
  if (employee.status !== 'active' || employee.user_status !== 'active') {
    throw httpError(422, 'Nhân viên đã nghỉ việc hoặc tài khoản không còn hoạt động.');
  }

  // 2. Kiểm tra các ca làm việc
  const requestedShifts = [];
  for (const sId of shift_ids) {
    const s = await shiftRepository.findById(sId);
    if (!s) {
      throw httpError(422, `Ca làm việc ID ${sId} không tồn tại.`);
    }
    if (!s.is_active) {
      throw httpError(422, `Ca làm việc "${s.shift_name}" hiện đang bị ẩn.`);
    }
    requestedShifts.push(s);
  }

  const todayStr = getTodayStr();
  const totalDays = countDaysBetween(from, to);
  const weekdaysFilter = Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : null;

  let createdCount = 0;
  const skippedList = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < totalDays; i++) {
      const currentDate = addDays(from, i);
      const dayOfWeek = getDayOfWeek(currentDate);

      // Nếu có lọc thứ trong tuần và ngày này không nằm trong danh sách
      if (weekdaysFilter && !weekdaysFilter.includes(dayOfWeek)) {
        continue;
      }

      // Kiểm tra ngày trong quá khứ
      if (currentDate < todayStr) {
        for (const shift of requestedShifts) {
          skippedList.push({
            date: currentDate,
            shift_id: shift.id,
            shift_name: shift.shift_name,
            reason: 'Ngày trong quá khứ',
          });
        }
        continue;
      }

      // Lấy các ca hiện có trong ngày của nhân viên kèm khóa dòng FOR UPDATE
      const [existingRows] = await conn.query(
        `SELECT es.*, s.shift_name, s.start_time, s.end_time
         FROM employee_shifts es
         JOIN shifts s ON es.shift_id = s.id
         WHERE es.employee_id = ? AND es.work_date = ?
         FOR UPDATE`,
        [employee_id, currentDate]
      );

      const assignedToday = [...existingRows];

      for (const shift of requestedShifts) {
        // Kiểm tra đã phân ca này chưa
        const isAlreadyAssigned = assignedToday.some((a) => a.shift_id === shift.id);
        if (isAlreadyAssigned) {
          skippedList.push({
            date: currentDate,
            shift_id: shift.id,
            shift_name: shift.shift_name,
            reason: 'Đã được phân ca này',
          });
          continue;
        }

        // Kiểm tra tối đa 2 ca trong ngày
        if (assignedToday.length >= 2) {
          skippedList.push({
            date: currentDate,
            shift_id: shift.id,
            shift_name: shift.shift_name,
            reason: 'Đã đạt tối đa 2 ca trong ngày',
          });
          continue;
        }

        // Kiểm tra chồng giờ với các ca khác trong ngày
        const hasTimeConflict = assignedToday.some((a) =>
          isTimeOverlapping(shift.start_time, shift.end_time, a.start_time, a.end_time)
        );

        if (hasTimeConflict) {
          skippedList.push({
            date: currentDate,
            shift_id: shift.id,
            shift_name: shift.shift_name,
            reason: 'Trùng giờ với ca khác trong ngày',
          });
          continue;
        }

        // Thỏa mãn toàn bộ quy tắc: Thực hiện phân ca
        await employeeShiftRepository.create(
          {
            employee_id,
            shift_id: shift.id,
            work_date: currentDate,
            status: 'scheduled',
          },
          conn
        );

        assignedToday.push(shift);
        createdCount++;
      }
    }

    await conn.commit();

    const audit = auditContext(req);
    await logRepository.insert({
      user_id: user.id,
      action: 'BULK_ASSIGN_SHIFTS',
      entity_name: 'employee_shifts',
      entity_id: employee_id,
      new_values: {
        employee_id,
        shift_ids,
        from,
        to,
        created: createdCount,
        skipped_count: skippedList.length,
      },
        ip_address: audit.ip_address,
        user_agent: audit.user_agent,
    });

    return {
      created: createdCount,
      skipped: skippedList,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Admin lấy lịch phân ca dạng bảng theo khoảng ngày
 */
const listEmployeeShifts = async (user, query = {}) => {
  const parsed = dateRangeQuerySchema.parse(query);

  let from = parsed.from;
  let to = parsed.to;

  // Nếu không truyền from/to, lấy tuần hiện tại (thứ 2 đến CN)
  if (!from || !to) {
    const today = getTodayStr();
    const day = getDayOfWeek(today);
    from = addDays(today, day === 0 ? -6 : 1 - day);
    to = addDays(from, 6);
  }

  if (countDaysBetween(from, to) > 62) {
    throw httpError(422, 'Khoảng thời gian tra cứu không được vượt quá 62 ngày.');
  }

  const shifts = await shiftRepository.findAll({ includeInactive: true });
  const records = await employeeShiftRepository.findByRange({
    from,
    to,
    employeeId: parsed.employee_id,
  });

  return {
    from,
    to,
    shifts,
    records,
  };
};

/**
 * Nhân viên xem lịch ca CỦA MÌNH (/api/employee-shifts/me)
 * Mặc định 14 ngày tới
 */
const getMyShifts = async (user, query = {}) => {
  const employee = await employeeRepository.findByUserId(user.id);
  if (!employee) {
    throw httpError(404, 'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên.');
  }

  const parsed = dateRangeQuerySchema.parse(query);

  const from = parsed.from || getTodayStr();
  const to = parsed.to || addDays(from, 13); // Mặc định 14 ngày (tính cả ngày bắt đầu)

  if (countDaysBetween(from, to) > 62) {
    throw httpError(422, 'Khoảng thời gian tra cứu không được vượt quá 62 ngày.');
  }

  const records = await employeeShiftRepository.findByRange({
    from,
    to,
    employeeId: employee.id,
  });

  return {
    employee_id: employee.id,
    from,
    to,
    records,
  };
};

/**
 * Xóa một phân ca (Admin)
 * Chỉ xóa được khi không có lịch hẹn của nhân viên nằm trong ca/ngày ấy
 */
const deleteEmployeeShift = async (user, rawId, req) => {
  const id = parseId(rawId, 'ID phân ca');
  const existing = await employeeShiftRepository.findById(id);
  if (!existing) {
    throw httpError(404, 'Không tìm thấy phân công ca làm việc.');
  }

  // Kiểm tra lịch hẹn
  const aptCount = await employeeShiftRepository.countAppointmentsForEmployeeShift(id);
  if (aptCount > 0) {
    throw httpError(
      409,
      `Không thể xóa phân ca vì nhân viên đang có ${aptCount} lịch hẹn trong ca làm việc này.`
    );
  }

  await employeeShiftRepository.deleteById(id);

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: user.id,
    action: 'DELETE_EMPLOYEE_SHIFT',
    entity_name: 'employee_shifts',
    entity_id: id,
    old_values: existing,
    ip_address: audit.ip_address,
    user_agent: audit.user_agent,
  });

  return { message: 'Xóa phân ca làm việc thành công.' };
};

export { bulkAssignShifts, listEmployeeShifts, getMyShifts, deleteEmployeeShift };
export default { bulkAssignShifts, listEmployeeShifts, getMyShifts, deleteEmployeeShift };

