import { pool } from '../config/db.js';
import appointmentRepository from '../repositories/appointmentRepository.js';
import userRepository from '../repositories/userRepository.js';
import petRepository from '../repositories/petRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import careRepository from '../repositories/careRepository.js';
import serviceRepository from '../repositories/serviceRepository.js';
import logRepository from '../repositories/logRepository.js';
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  assignEmployeeSchema,
  updateStatusSchema,
  normalizeAppointmentInput,
} from '../validations/appointmentSchemas.js';
import { httpError, parseId, auditContext } from '../utils/params.js';
import {
  hasOverlap,
  isFullyInsideShift,
  timeToMinutes,
  minutesToTime,
  minutesToTimeHM,
} from '../utils/timeOverlap.js';
import {
  APPOINTMENT_STATUS,
  validateTransition,
  validateCancellation,
} from '../utils/appointmentState.js';
import { countDaysBetween } from '../validations/employeeShiftSchemas.js';

// Thời gian đệm (phút) giữa hai lượt phục vụ liên tiếp của cùng một nhân viên (dọn dẹp, vệ sinh dụng cụ).
// Có thể đổi bằng biến môi trường APPOINTMENT_BUFFER_MINUTES trong .env.
export const BUFFER_MINUTES = Number.isFinite(Number(process.env.APPOINTMENT_BUFFER_MINUTES))
  && process.env.APPOINTMENT_BUFFER_MINUTES !== undefined
  ? Number(process.env.APPOINTMENT_BUFFER_MINUTES)
  : 15;

/**
 * Xung đột lịch của NHÂN VIÊN có tính thời gian đệm:
 * mỗi lịch chiếm [start, end + BUFFER), hai lịch của cùng nhân viên không được chồng nhau.
 * (Lịch của thú cưng vẫn dùng hasOverlap thuần, không cần đệm.)
 */
const conflictsWithBuffer = (startA, endA, startB, endB) =>
  hasOverlap(
    minutesToTime(timeToMinutes(startA)),
    minutesToTime(timeToMinutes(endA) + BUFFER_MINUTES),
    minutesToTime(timeToMinutes(startB)),
    minutesToTime(timeToMinutes(endB) + BUFFER_MINUTES)
  );

/**
 * Nhân viên (staff) chỉ được thao tác trên lịch hẹn được phân cho chính mình.
 * Admin thao tác được mọi lịch. Khách đã bị chặn riêng theo quyền sở hữu.
 */
export const assertStaffOwnsAppointment = async (actor, appointment) => {
  if (actor.role_name !== 'staff') return;
  const emp = await employeeRepository.findByUserId(actor.id);
  if (!emp || appointment.employee_id !== emp.id) {
    throw httpError(
      403,
      'Bạn chỉ được thao tác trên lịch hẹn được phân cho mình. Vui lòng liên hệ quản lý để chuyển lịch.'
    );
  }
};

export const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getNowTimeStr = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * 1. GET /api/appointments/availability
 * Tra cứu các khung giờ trống và danh sách nhân viên phục vụ được
 */
export const getAvailability = async (query = {}) => {
  const { date, serviceIds, employeeId } = query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(422, 'Ngày tra cứu không hợp lệ (YYYY-MM-DD).');
  }

  const todayStr = getTodayStr();
  if (date < todayStr) {
    return [];
  }

  if (countDaysBetween(todayStr, date) > 60) {
    throw httpError(422, 'Chỉ có thể tra cứu lịch trước tối đa 60 ngày.');
  }

  // Parse serviceIds
  let sIdList = [];
  if (Array.isArray(serviceIds)) {
    sIdList = serviceIds.map(Number);
  } else if (typeof serviceIds === 'string') {
    sIdList = serviceIds.split(',').map((s) => Number(s.trim())).filter(Boolean);
  }

  if (sIdList.length === 0) {
    throw httpError(422, 'Vui lòng chọn ít nhất một dịch vụ.');
  }

  // Lấy dịch vụ và tính tổng thời lượng
  const services = await Promise.all(sIdList.map((id) => serviceRepository.findById(id)));
  if (services.some((s) => !s || !s.is_active)) {
    throw httpError(422, 'Một hoặc nhiều dịch vụ không tồn tại hoặc đã ngừng phục vụ.');
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  if (totalDuration <= 0) {
    throw httpError(422, 'Tổng thời lượng dịch vụ không hợp lệ.');
  }

  const targetEmpId = employeeId ? Number(employeeId) : null;

  // Lấy danh sách ca làm việc của các nhân viên đang active trong ngày
  const employeeShifts = await appointmentRepository.getActiveEmployeesWithShifts(date, targetEmpId);
  if (employeeShifts.length === 0) {
    return [];
  }

  // Lấy các lịch hẹn hiện có trong ngày
  const existingApts = await appointmentRepository.getAppointmentsOnDate(date);

  // Gom các ca làm việc theo từng nhân viên
  const employeesMap = new Map();
  for (const row of employeeShifts) {
    if (!employeesMap.has(row.employee_id)) {
      employeesMap.set(row.employee_id, {
        id: row.employee_id,
        name: row.employee_name,
        specialty: row.specialty,
        shifts: [],
        appointments: existingApts.filter((a) => a.employee_id === row.employee_id),
      });
    }
    employeesMap.get(row.employee_id).shifts.push({
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
    });
  }

  // Tìm khoảng thời gian sớm nhất và muộn nhất của các ca làm việc
  let minStartMin = 24 * 60;
  let maxEndMin = 0;
  for (const row of employeeShifts) {
    const sMin = timeToMinutes(row.start_time);
    const eMin = timeToMinutes(row.end_time);
    if (sMin < minStartMin) minStartMin = sMin;
    if (eMin > maxEndMin) maxEndMin = eMin;
  }

  // Khung giờ bước 30 phút
  const isToday = date === todayStr;
  const currentMinutes = timeToMinutes(getNowTimeStr());

  const slots = [];
  for (let slotStart = minStartMin; slotStart + totalDuration <= maxEndMin; slotStart += 30) {
    const slotEnd = slotStart + totalDuration;

    // Nếu là ngày hôm nay, loại bỏ các khung giờ đã bắt đầu hoặc đã qua
    if (isToday && slotStart <= currentMinutes) {
      continue;
    }

    const slotStartHM = minutesToTimeHM(slotStart);
    const slotEndHM = minutesToTimeHM(slotEnd);

    // Tìm các nhân viên có thể phục vụ trong khung giờ này
    const availableEmployees = [];
    for (const emp of employeesMap.values()) {
      // 1. Phải nằm trọn trong ít nhất một ca làm việc của nhân viên
      const isInside = emp.shifts.some((sh) => isFullyInsideShift(slotStartHM, slotEndHM, sh.start, sh.end));
      if (!isInside) continue;

      // 2. Không được trùng giờ với bất kỳ lịch hẹn nào hiện có của nhân viên
      const hasConflict = emp.appointments.some((apt) =>
        conflictsWithBuffer(slotStartHM, slotEndHM, apt.start_time.slice(0, 5), apt.end_time.slice(0, 5))
      );
      if (hasConflict) continue;

      availableEmployees.push({
        id: emp.id,
        name: emp.name,
      });
    }

    if (availableEmployees.length > 0) {
      slots.push({
        startTime: slotStartHM,
        endTime: slotEndHM,
        availableEmployees,
      });
    }
  }

  return slots;
};

/**
 * 2. POST /api/appointments
 * Đặt lịch hẹn mới kèm Transaction & SELECT ... FOR UPDATE chống đua
 */
export const createAppointment = async (actor, rawBody, req) => {
  const normalized = normalizeAppointmentInput(rawBody);
  const parsed = createAppointmentSchema.parse(normalized);

  // 1. Xác định customerId
  let customerId = actor.id;
  if (actor.role_name === 'staff' || actor.role_name === 'admin') {
    if (parsed.customer_id) {
      customerId = parsed.customer_id;
    }
  }

  // 2. Kiểm tra thông tin khách hàng và số điện thoại
  const customer = await userRepository.findById(customerId);
  if (!customer) {
    throw httpError(404, 'Không tìm thấy thông tin khách hàng.');
  }
  if (!customer.phone || customer.phone.trim() === '') {
    throw httpError(422, 'Vui lòng cập nhật số điện thoại trong Hồ sơ trước khi đặt lịch.');
  }

  // 3. Kiểm tra thú cưng
  const pet = await petRepository.findById(parsed.pet_id);
  if (!pet || (actor.role_name === 'customer' && pet.customer_id !== customerId)) {
    throw httpError(404, 'Không tìm thấy thú cưng hoặc thú cưng không thuộc sở hữu của bạn.');
  }
  if (pet.status !== 'active') {
    throw httpError(422, 'Hồ sơ thú cưng hiện không hoạt động.');
  }
  if (pet.customer_id !== customerId) {
    throw httpError(422, 'Thú cưng không thuộc khách hàng đã chọn.');
  }

  // 4. Kiểm tra dịch vụ và tính giá snapshot + thời lượng
  const services = await Promise.all(parsed.service_ids.map((id) => serviceRepository.findById(id)));
  if (services.some((s) => !s || !s.is_active)) {
    throw httpError(422, 'Một hoặc nhiều dịch vụ đã chọn không tồn tại hoặc đã ngừng phục vụ.');
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  if (totalDuration <= 0) {
    throw httpError(422, 'Tổng thời lượng dịch vụ không hợp lệ.');
  }

  const detailsToInsert = services.map((s) => ({
    service_id: s.id,
    price_at_booking: Number(s.price),
    duration_minutes: s.duration_minutes,
  }));

  // 5. Kiểm tra thời gian hẹn
  const todayStr = getTodayStr();
  if (parsed.appointment_date < todayStr) {
    throw httpError(422, 'Không thể đặt lịch vào ngày trong quá khứ.');
  }
  if (countDaysBetween(todayStr, parsed.appointment_date) > 60) {
    throw httpError(422, 'Chỉ có thể đặt lịch trước tối đa 60 ngày.');
  }

  const startMinutes = timeToMinutes(parsed.start_time);
  const endMinutes = startMinutes + totalDuration;
  const startTimeNormalized = minutesToTime(startMinutes);
  const endTimeNormalized = minutesToTime(endMinutes);

  if (parsed.appointment_date === todayStr) {
    const currentMinutes = timeToMinutes(getNowTimeStr());
    if (startMinutes <= currentMinutes) {
      throw httpError(422, 'Không thể đặt lịch vào khung giờ đã qua trong ngày hôm nay.');
    }
  }

  // 6. Thực hiện trong TRANSACTION với SELECT ... FOR UPDATE (Retry nếu gặp ER_LOCK_DEADLOCK)
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let assignedEmployeeId = parsed.employee_id || null;

      if (assignedEmployeeId) {
        // Đã chỉ định nhân viên
        const emp = await employeeRepository.findById(assignedEmployeeId);
        if (!emp || emp.status !== 'active' || emp.user_status !== 'active') {
          throw httpError(422, 'Nhân viên được chọn hiện không hoạt động hoặc đã nghỉ việc.');
        }

        // Kiểm tra ca làm việc của nhân viên
        const shifts = await appointmentRepository.getEmployeeShiftsOnDate(
          assignedEmployeeId,
          parsed.appointment_date,
          conn
        );
        const insideShift = shifts.some((sh) =>
          isFullyInsideShift(startTimeNormalized, endTimeNormalized, sh.start_time, sh.end_time)
        );
        if (!insideShift) {
          throw httpError(
            409,
            'Giờ hẹn phải nằm trọn trong một ca làm việc của nhân viên (không được bắc qua 2 ca khác nhau).'
          );
        }

        // Khóa nhân viên và kiểm tra trùng lịch
        const empApts = await appointmentRepository.lockAndGetEmployeeAppointments(
          assignedEmployeeId,
          parsed.appointment_date,
          null,
          conn
        );
        const empConflict = empApts.some((a) =>
          conflictsWithBuffer(startTimeNormalized, endTimeNormalized, a.start_time, a.end_time)
        );
        if (empConflict) {
          throw httpError(
            409,
            `Nhân viên đã có lịch hẹn trùng vào khung giờ này (các lượt phục vụ cần cách nhau tối thiểu ${BUFFER_MINUTES} phút). Vui lòng chọn khung giờ khác.`
          );
        }
      } else {
        // TỰ ĐỘNG PHÂN CÔNG (Load balancing)
        const candidates = await appointmentRepository.getActiveEmployeesWithShifts(
          parsed.appointment_date,
          null,
          conn
        );

        // Lọc các nhân viên có ca bao trọn giờ hẹn
        const eligibleEmpIds = [
          ...new Set(
            candidates
              .filter((c) =>
                isFullyInsideShift(startTimeNormalized, endTimeNormalized, c.start_time, c.end_time)
              )
              .map((c) => c.employee_id)
          ),
        ];

        if (eligibleEmpIds.length === 0) {
          throw httpError(
            409,
            'Khung giờ đã kín hoặc không có nhân viên trực. Vui lòng chọn khung giờ khác.'
          );
        }

        // Khóa theo thứ tự tăng dần ID để tránh deadlock
        eligibleEmpIds.sort((a, b) => a - b);
        const availableCandidates = [];

        for (const eId of eligibleEmpIds) {
          const empApts = await appointmentRepository.lockAndGetEmployeeAppointments(
            eId,
            parsed.appointment_date,
            null,
            conn
          );
          const hasConflict = empApts.some((a) =>
            conflictsWithBuffer(startTimeNormalized, endTimeNormalized, a.start_time, a.end_time)
          );
          if (!hasConflict) {
            // Đếm số lượng lịch hẹn hiện có trong ngày để cân bằng tải
            const aptCount = empApts.length;
            availableCandidates.push({ id: eId, aptCount });
          }
        }

        if (availableCandidates.length === 0) {
          throw httpError(
            409,
            'Khung giờ đã kín. Tất cả nhân viên trực đều đã có lịch hẹn vào giờ này.'
          );
        }

        // Sắp xếp: ít lịch nhất trước, nếu hòa thì id nhỏ nhất
        availableCandidates.sort((a, b) => a.aptCount - b.aptCount || a.id - b.id);
        assignedEmployeeId = availableCandidates[0].id;
      }

      // Khóa và kiểm tra lịch của Thú cưng (theo thứ tự: nhân viên trước, thú cưng sau)
      const petApts = await appointmentRepository.lockAndGetPetAppointments(
        parsed.pet_id,
        parsed.appointment_date,
        null,
        conn
      );
      const petConflict = petApts.some((a) =>
        hasOverlap(startTimeNormalized, endTimeNormalized, a.start_time, a.end_time)
      );
      if (petConflict) {
        throw httpError(
          409,
          'Thú cưng này đã có lịch hẹn khác trùng vào khung giờ này.'
        );
      }

      // Sinh mã lịch hẹn
      const appointmentCode = await appointmentRepository.generateAppointmentCode(
        parsed.appointment_date,
        conn
      );

      // Tạo bản ghi lịch hẹn
      const appointmentId = await appointmentRepository.create(
        {
          appointment_code: appointmentCode,
          customer_id: customerId,
          pet_id: parsed.pet_id,
          employee_id: assignedEmployeeId,
          appointment_date: parsed.appointment_date,
          start_time: startTimeNormalized,
          end_time: endTimeNormalized,
          status: APPOINTMENT_STATUS.PENDING,
          customer_notes: parsed.customer_notes,
          staff_notes: null,
        },
        conn
      );

      // Thêm chi tiết dịch vụ
      await appointmentRepository.createDetails(appointmentId, detailsToInsert, conn);

      await conn.commit();

      // Ghi nhật ký hệ thống
      const audit = auditContext(req);
      await logRepository.insert({
        user_id: actor.id,
        action: 'CREATE_APPOINTMENT',
        entity_name: 'appointments',
        entity_id: appointmentId,
        new_values: {
          appointment_code: appointmentCode,
          customer_id: customerId,
          pet_id: parsed.pet_id,
          employee_id: assignedEmployeeId,
          appointment_date: parsed.appointment_date,
          start_time: startTimeNormalized,
          end_time: endTimeNormalized,
          services: detailsToInsert,
        },
        ip_address: audit.ip_address,
        user_agent: audit.user_agent,
      });

      const created = await appointmentRepository.findById(appointmentId);
      const details = await appointmentRepository.findDetailsByAppointmentId(appointmentId);
      return { ...created, details };
    } catch (err) {
      await conn.rollback();
      // Nếu gặp Deadlock (MySQL error 1213) và còn lượt retry
        if ((err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_DUP_ENTRY') && attempt <= MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw err;
    } finally {
      conn.release();
    }
  }
};

/**
 * 3. GET /api/appointments/:id
 */
export const getAppointmentById = async (actor, rawId) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }

  // Customer chỉ được xem lịch của chính mình
  if (actor.role_name === 'customer' && appointment.customer_id !== actor.id) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }

  const details = await appointmentRepository.findDetailsByAppointmentId(id);

  // Bảo mật thông tin cho khách
  if (actor.role_name === 'customer') {
    delete appointment.customer_phone;
    delete appointment.customer_email;
    delete appointment.staff_notes;
    delete appointment.employee_user_id;
  }

  // Hồ sơ chăm sóc (tình trạng ban đầu, ghi chú, ảnh trước/sau): khách chỉ thấy khi lịch đã hoàn tất
  let careRecord = await careRepository.findByAppointmentId(id);
  if (actor.role_name === 'customer' && appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
    careRecord = null;
  }

  return { ...appointment, details, care_record: careRecord };
};

/**
 * 4. GET /api/appointments
 */
export const listAppointments = async (actor, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

  let customerId = undefined;
  if (actor.role_name === 'customer') {
    customerId = actor.id; // Luôn ép về chính mình
  } else if (query.customerId || query.customer_id) {
    customerId = Number(query.customerId || query.customer_id);
  }

  let employeeId = query.employeeId || query.employee_id ? Number(query.employeeId || query.employee_id) : undefined;
  if (actor.role_name === 'staff' && query.my === 'true') {
    const emp = await employeeRepository.findByUserId(actor.id);
    if (emp) {
      employeeId = emp.id;
    }
  }

  let fromDate = query.from || query.fromDate;
  let toDate = query.to || query.toDate;
  const date = query.date;

  if (fromDate && toDate && countDaysBetween(fromDate, toDate) > 62) {
    throw httpError(422, 'Khoảng thời gian tra cứu không được vượt quá 62 ngày.');
  }

  const filters = {
    customerId,
    employeeId,
    date,
    fromDate,
    toDate,
    status: query.status,
    search: query.search ? query.search.trim() : undefined,
    page,
    limit,
  };

  const [appointments, total] = await Promise.all([
    appointmentRepository.findAll(filters),
    appointmentRepository.countAll(filters),
  ]);

  // Bảo mật: Ẩn SĐT/email khách hàng nếu khách hàng đang xem danh sách
  const safeList = appointments.map((a) => {
    if (actor.role_name === 'customer') {
      const copy = { ...a };
      delete copy.customer_phone;
      delete copy.customer_email;
      delete copy.staff_notes;
      delete copy.employee_user_id;
      return copy;
    }
    return a;
  });

  return {
    appointments: safeList,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 5. PATCH /api/appointments/:id/reschedule
 * Đổi ngày/giờ hẹn hoặc đổi nhân viên (loại trừ chính lịch này khi xét trùng)
 */
export const rescheduleAppointment = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await assertStaffOwnsAppointment(actor, appointment);

  if (actor.role_name === 'customer' && appointment.customer_id !== actor.id) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }

  // Khách chỉ được đổi lịch khi pending/confirmed và trước 2 giờ
  if (actor.role_name === 'customer') {
    validateCancellation(appointment, 'customer', 'Đổi lịch hẹn');
  } else if (
    appointment.status === APPOINTMENT_STATUS.COMPLETED ||
    appointment.status === APPOINTMENT_STATUS.CANCELLED
  ) {
    throw httpError(409, `Không thể đổi lịch hẹn đã ở trạng thái "${appointment.status}".`);
  }

  const parsed = rescheduleAppointmentSchema.parse({
    appointment_date: body.appointmentDate ?? body.appointment_date,
    start_time: body.startTime ?? body.start_time,
    employee_id: body.employeeId !== undefined ? body.employeeId : body.employee_id,
  });

  const todayStr = getTodayStr();
  if (parsed.appointment_date < todayStr) {
    throw httpError(422, 'Không thể đổi lịch sang ngày trong quá khứ.');
  }
  if (countDaysBetween(todayStr, parsed.appointment_date) > 60) {
    throw httpError(422, 'Chỉ có thể đổi lịch trong vòng 60 ngày tới.');
  }

  // Lấy chi tiết dịch vụ của lịch hẹn để tính tổng thời lượng
  const details = await appointmentRepository.findDetailsByAppointmentId(id);
  const totalDuration = details.reduce((sum, d) => sum + d.duration_minutes, 0);

  const startMinutes = timeToMinutes(parsed.start_time);
  const endMinutes = startMinutes + totalDuration;
  const startTimeNormalized = minutesToTime(startMinutes);
  const endTimeNormalized = minutesToTime(endMinutes);

  if (parsed.appointment_date === todayStr) {
    const currentMinutes = timeToMinutes(getNowTimeStr());
    if (startMinutes <= currentMinutes) {
      throw httpError(422, 'Không thể đổi lịch vào khung giờ đã qua.');
    }
  }

  const targetEmployeeId = parsed.employee_id !== undefined ? parsed.employee_id : appointment.employee_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (targetEmployeeId) {
      const emp = await employeeRepository.findById(targetEmployeeId);
      if (!emp || emp.status !== 'active' || emp.user_status !== 'active') {
        throw httpError(422, 'Nhân viên được chọn hiện không hoạt động hoặc đã nghỉ việc.');
      }

      // Kiểm tra ca làm việc
      const shifts = await appointmentRepository.getEmployeeShiftsOnDate(
        targetEmployeeId,
        parsed.appointment_date,
        conn
      );
      const insideShift = shifts.some((sh) =>
        isFullyInsideShift(startTimeNormalized, endTimeNormalized, sh.start_time, sh.end_time)
      );
      if (!insideShift) {
        throw httpError(
          409,
          'Giờ hẹn phải nằm trọn trong một ca làm việc của nhân viên (không được bắc qua 2 ca khác nhau).'
        );
      }

      // Khóa và kiểm tra trùng (loại trừ chính lịch này: id)
      const empApts = await appointmentRepository.lockAndGetEmployeeAppointments(
        targetEmployeeId,
        parsed.appointment_date,
        id,
        conn
      );
      const empConflict = empApts.some((a) =>
        conflictsWithBuffer(startTimeNormalized, endTimeNormalized, a.start_time, a.end_time)
      );
      if (empConflict) {
        throw httpError(409, 'Nhân viên đã có lịch hẹn trùng vào khung giờ này.');
      }
    }

    // Khóa và kiểm tra pet (loại trừ chính lịch này: id)
    const petApts = await appointmentRepository.lockAndGetPetAppointments(
      appointment.pet_id,
      parsed.appointment_date,
      id,
      conn
    );
    const petConflict = petApts.some((a) =>
      hasOverlap(startTimeNormalized, endTimeNormalized, a.start_time, a.end_time)
    );
    if (petConflict) {
      throw httpError(409, 'Thú cưng đã có lịch hẹn khác trùng vào khung giờ này.');
    }

    const oldValues = {
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      employee_id: appointment.employee_id,
    };

    const newValues = {
      appointment_date: parsed.appointment_date,
      start_time: startTimeNormalized,
      end_time: endTimeNormalized,
      employee_id: targetEmployeeId,
    };

    await appointmentRepository.update(id, newValues, conn);

    await conn.commit();

    const audit = auditContext(req);
    await logRepository.insert({
      user_id: actor.id,
      action: 'RESCHEDULE_APPOINTMENT',
      entity_name: 'appointments',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: audit.ip_address,
      user_agent: audit.user_agent,
    });

    return appointmentRepository.findById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 6. PATCH /api/appointments/:id/cancel
 */
export const cancelAppointment = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await assertStaffOwnsAppointment(actor, appointment);

  if (actor.role_name === 'customer' && appointment.customer_id !== actor.id) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }

  const parsed = cancelAppointmentSchema.parse({
    cancellation_reason: body.cancellationReason ?? body.cancellation_reason,
  });

  validateCancellation(appointment, actor.role_name, parsed.cancellation_reason);

  const oldValues = {
    status: appointment.status,
    cancellation_reason: appointment.cancellation_reason,
  };

  const newValues = {
    status: APPOINTMENT_STATUS.CANCELLED,
    cancellation_reason: parsed.cancellation_reason,
  };

  await appointmentRepository.update(id, newValues);

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: actor.id,
    action: 'CANCEL_APPOINTMENT',
    entity_name: 'appointments',
    entity_id: id,
    old_values: oldValues,
    new_values: newValues,
    ip_address: audit.ip_address,
    user_agent: audit.user_agent,
  });

  return appointmentRepository.findById(id);
};

/**
 * 7. PATCH /api/appointments/:id/assign
 * Gán / Đổi nhân viên phục vụ (Staff / Admin)
 */
export const assignEmployee = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await assertStaffOwnsAppointment(actor, appointment);

  if (
    appointment.status === APPOINTMENT_STATUS.COMPLETED ||
    appointment.status === APPOINTMENT_STATUS.CANCELLED
  ) {
    throw httpError(409, `Không thể gán nhân viên cho lịch hẹn đã ở trạng thái "${appointment.status}".`);
  }

  const parsed = assignEmployeeSchema.parse({
    employee_id: body.employeeId ?? body.employee_id,
  });

  const emp = await employeeRepository.findById(parsed.employee_id);
  if (!emp || emp.status !== 'active' || emp.user_status !== 'active') {
    throw httpError(422, 'Nhân viên được chọn không hợp lệ hoặc đã nghỉ việc.');
  }

  // Kiểm tra ca làm việc
  const shifts = await appointmentRepository.getEmployeeShiftsOnDate(
    parsed.employee_id,
    appointment.appointment_date
  );
  const insideShift = shifts.some((sh) =>
    isFullyInsideShift(appointment.start_time, appointment.end_time, sh.start_time, sh.end_time)
  );
  if (!insideShift) {
    throw httpError(
      409,
      'Giờ hẹn phải nằm trọn trong một ca làm việc của nhân viên được chọn.'
    );
  }

  // Khóa và kiểm tra trùng lịch
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const empApts = await appointmentRepository.lockAndGetEmployeeAppointments(
      parsed.employee_id,
      appointment.appointment_date,
      id,
      conn
    );
    const empConflict = empApts.some((a) =>
      conflictsWithBuffer(appointment.start_time, appointment.end_time, a.start_time, a.end_time)
    );
    if (empConflict) {
      throw httpError(409, 'Nhân viên đã có lịch hẹn trùng vào khung giờ này.');
    }

    await appointmentRepository.update(id, { employee_id: parsed.employee_id }, conn);

    await conn.commit();

    const audit = auditContext(req);
    await logRepository.insert({
      user_id: actor.id,
      action: 'ASSIGN_STAFF',
      entity_name: 'appointments',
      entity_id: id,
      old_values: { employee_id: appointment.employee_id },
      new_values: { employee_id: parsed.employee_id },
      ip_address: audit.ip_address,
      user_agent: audit.user_agent,
    });

    return appointmentRepository.findById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 8. PATCH /api/appointments/:id/confirm
 * Xác nhận lịch hẹn (Staff / Admin)
 */
export const confirmAppointment = async (actor, rawId, req) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await assertStaffOwnsAppointment(actor, appointment);

  validateTransition(appointment.status, APPOINTMENT_STATUS.CONFIRMED);

  await appointmentRepository.update(id, { status: APPOINTMENT_STATUS.CONFIRMED });

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: actor.id,
    action: 'CONFIRM_APPOINTMENT',
    entity_name: 'appointments',
    entity_id: id,
    old_values: { status: appointment.status },
    new_values: { status: APPOINTMENT_STATUS.CONFIRMED },
    ip_address: audit.ip_address,
    user_agent: audit.user_agent,
  });

  return appointmentRepository.findById(id);
};

/**
 * 9. PATCH /api/appointments/:id/status
 * Đổi trạng thái lịch hẹn theo quy trình (Staff / Admin)
 */
export const updateAppointmentStatus = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await assertStaffOwnsAppointment(actor, appointment);

  const parsed = updateStatusSchema.parse(body);

  // Tiếp nhận và hoàn tất phải đi qua chức năng riêng để bắt buộc ghi chú / ảnh vào hồ sơ chăm sóc
  if (
    parsed.status !== appointment.status &&
    (parsed.status === APPOINTMENT_STATUS.CHECKED_IN || parsed.status === APPOINTMENT_STATUS.COMPLETED)
  ) {
    throw httpError(
      422,
      'Vui lòng dùng chức năng Tiếp nhận hoặc Hoàn tất lịch hẹn để nhập ghi chú và ảnh trước khi đổi trạng thái.'
    );
  }

  if (parsed.status === APPOINTMENT_STATUS.CANCELLED) {
    validateCancellation(appointment, actor.role_name, parsed.cancellation_reason || 'Nhân viên hủy lịch');
  } else {
    validateTransition(appointment.status, parsed.status);
  }

  const fields = { status: parsed.status };
  if (parsed.cancellation_reason) fields.cancellation_reason = parsed.cancellation_reason;
  if (parsed.staff_notes !== undefined) fields.staff_notes = parsed.staff_notes;

  await appointmentRepository.update(id, fields);

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: actor.id,
    action: 'UPDATE_APPOINTMENT_STATUS',
    entity_name: 'appointments',
    entity_id: id,
    old_values: {
      status: appointment.status,
      cancellation_reason: appointment.cancellation_reason,
      staff_notes: appointment.staff_notes,
    },
    new_values: fields,
    ip_address: audit.ip_address,
    user_agent: audit.user_agent,
  });

  return appointmentRepository.findById(id);
};

export default {
  getAvailability,
  createAppointment,
  getAppointmentById,
  listAppointments,
  rescheduleAppointment,
  cancelAppointment,
  assignEmployee,
  confirmAppointment,
  updateAppointmentStatus,
};
