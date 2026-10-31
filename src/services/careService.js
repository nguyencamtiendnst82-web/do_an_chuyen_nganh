import { pool } from '../config/db.js';
import appointmentRepository from '../repositories/appointmentRepository.js';
import careRepository from '../repositories/careRepository.js';
import petRepository from '../repositories/petRepository.js';
import logRepository from '../repositories/logRepository.js';
import { assertStaffOwnsAppointment } from './appointmentService.js';
import { isRealImageFile } from '../middlewares/uploadImage.js';
import { careImages } from '../middlewares/uploadCare.js';
import {
  checkInSchema,
  completeSchema,
  normalizeCheckIn,
  normalizeComplete,
} from '../validations/careSchemas.js';
import { APPOINTMENT_STATUS, STATUS_LABELS } from '../utils/appointmentState.js';
import { httpError, fieldError, parseId, auditContext } from '../utils/params.js';

const labelOf = (status) => STATUS_LABELS[status] || status;

/** Tải lịch hẹn + kiểm tra quyền: nhân viên chỉ thao tác lịch của mình, admin thao tác tất cả */
const loadForOperation = async (actor, rawId) => {
  const id = parseId(rawId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw httpError(404, 'Không tìm thấy lịch hẹn.');
  await assertStaffOwnsAppointment(actor, appointment);
  return appointment;
};

/** Ảnh phải là ảnh thật (kiểm tra nội dung, không chỉ đuôi file). Trả về URL công khai hoặc null */
const prepareImage = async (file, field) => {
  if (!file) return null;
  if (!(await isRealImageFile(file.path))) {
    throw fieldError(field, 'Tệp tải lên không phải là ảnh hợp lệ.');
  }
  return careImages.urlPrefix + file.filename;
};

/** Chạy một bước chuyển trạng thái trong transaction; callback ghi thêm dữ liệu cùng transaction */
const runTransition = async (appointmentId, from, to, writeExtra) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const moved = await careRepository.transitionStatus(appointmentId, from, to, conn);
    if (!moved) {
      throw httpError(409, 'Lịch hẹn vừa được người khác cập nhật. Vui lòng tải lại trang.');
    }
    if (writeExtra) await writeExtra(conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const withRecord = async (appointmentId) => ({
  appointment: await appointmentRepository.findById(appointmentId),
  care_record: await careRepository.findByAppointmentId(appointmentId),
});

/**
 * PATCH /api/appointments/:id/check-in
 * confirmed -> checked_in; ghi tình trạng ban đầu + ảnh trước vào pet_care_history
 */
export const checkIn = async (actor, rawId, body, file, req) => {
  let committed = false;
  try {
    const appointment = await loadForOperation(actor, rawId);
    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      throw httpError(
        409,
        `Chỉ tiếp nhận được lịch đã xác nhận. Lịch này đang ở trạng thái "${labelOf(appointment.status)}".`
      );
    }
    if (!appointment.employee_id) {
      throw httpError(422, 'Lịch hẹn chưa được phân công nhân viên. Vui lòng phân công trước khi tiếp nhận.');
    }

    const parsed = checkInSchema.parse(normalizeCheckIn(body));
    const photoUrl = await prepareImage(file, 'photo_before');
    const old = await careRepository.findByAppointmentId(appointment.id);

    await runTransition(appointment.id, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN, (conn) =>
      careRepository.saveCheckIn(conn, {
        pet_id: appointment.pet_id,
        appointment_id: appointment.id,
        employee_id: appointment.employee_id,
        service_date: appointment.appointment_date,
        initial_health_notes: parsed.initial_health_notes,
        photo_before_url: photoUrl,
      })
    );
    committed = true;

    if (photoUrl && old?.photo_before_url) await careImages.remove(old.photo_before_url);

    await logRepository.insert({
      ...auditContext(req),
      action: 'CHECK_IN_APPOINTMENT',
      entity_name: 'appointments',
      entity_id: appointment.id,
      old_values: { status: appointment.status },
      new_values: {
        status: APPOINTMENT_STATUS.CHECKED_IN,
        initial_health_notes: parsed.initial_health_notes ?? null,
        photo_before_url: photoUrl,
      },
    });

    return withRecord(appointment.id);
  } catch (err) {
    if (!committed) await careImages.discard(file); // không để lại file rác khi lỗi
    throw err;
  }
};

/** PATCH /api/appointments/:id/start : checked_in -> in_progress */
export const startService = async (actor, rawId, req) => {
  const appointment = await loadForOperation(actor, rawId);
  if (appointment.status !== APPOINTMENT_STATUS.CHECKED_IN) {
    throw httpError(
      409,
      `Chỉ bắt đầu được lịch đã tiếp nhận. Lịch này đang ở trạng thái "${labelOf(appointment.status)}".`
    );
  }

  await runTransition(appointment.id, APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_PROGRESS);

  await logRepository.insert({
    ...auditContext(req),
    action: 'START_APPOINTMENT',
    entity_name: 'appointments',
    entity_id: appointment.id,
    old_values: { status: appointment.status },
    new_values: { status: APPOINTMENT_STATUS.IN_PROGRESS },
  });

  return withRecord(appointment.id);
};

/**
 * PATCH /api/appointments/:id/complete
 * in_progress -> completed; bắt buộc treatment_notes; ghi lời khuyên + ảnh sau
 */
export const completeService = async (actor, rawId, body, file, req) => {
  let committed = false;
  try {
    const appointment = await loadForOperation(actor, rawId);
    if (appointment.status !== APPOINTMENT_STATUS.IN_PROGRESS) {
      throw httpError(
        409,
        `Chỉ hoàn tất được lịch đang phục vụ. Lịch này đang ở trạng thái "${labelOf(appointment.status)}".`
      );
    }
    if (!appointment.employee_id) {
      throw httpError(422, 'Lịch hẹn chưa được phân công nhân viên.');
    }

    const parsed = completeSchema.parse(normalizeComplete(body));
    const photoUrl = await prepareImage(file, 'photo_after');
    const old = await careRepository.findByAppointmentId(appointment.id);

    await runTransition(appointment.id, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.COMPLETED, (conn) =>
      careRepository.saveCompletion(conn, {
        pet_id: appointment.pet_id,
        appointment_id: appointment.id,
        employee_id: appointment.employee_id,
        service_date: appointment.appointment_date,
        treatment_notes: parsed.treatment_notes,
        recommendations: parsed.recommendations,
        photo_after_url: photoUrl,
      })
    );
    committed = true;

    if (photoUrl && old?.photo_after_url) await careImages.remove(old.photo_after_url);

    await logRepository.insert({
      ...auditContext(req),
      action: 'COMPLETE_APPOINTMENT',
      entity_name: 'appointments',
      entity_id: appointment.id,
      old_values: { status: appointment.status },
      new_values: {
        status: APPOINTMENT_STATUS.COMPLETED,
        treatment_notes: parsed.treatment_notes,
        recommendations: parsed.recommendations ?? null,
        photo_after_url: photoUrl,
      },
    });

    return withRecord(appointment.id);
  } catch (err) {
    if (!committed) await careImages.discard(file);
    throw err;
  }
};

/**
 * GET /api/pets/:petId/care-history : sổ tay chăm sóc của một thú cưng
 * Khách chỉ xem thú của mình và chỉ thấy các lần đã hoàn tất; staff/admin xem tất cả.
 */
export const listPetCareHistory = async (actor, rawPetId, query = {}) => {
  const petId = parseId(rawPetId, 'ID thú cưng');
  const pet = await petRepository.findById(petId);
  if (!pet || (actor.role_name === 'customer' && pet.customer_id !== actor.id)) {
    throw httpError(404, 'Không tìm thấy thú cưng.');
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));

  const { rows, total } = await careRepository.listByPet(petId, {
    page,
    limit,
    onlyCompleted: actor.role_name === 'customer',
  });

  return {
    pet: { id: pet.id, name: pet.name, species: pet.species, avatar_url: pet.avatar_url },
    records: rows,
    pagination: { total, page, limit, total_pages: Math.ceil(total / limit) || 1 },
  };
};

export default { checkIn, startService, completeService, listPetCareHistory };
