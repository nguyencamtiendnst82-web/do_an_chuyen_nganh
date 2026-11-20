import appointmentService from './appointmentService.js';
import appointmentRepository from '../repositories/appointmentRepository.js';
import changeRequestRepository from '../repositories/changeRequestRepository.js';
import userRepository from '../repositories/userRepository.js';
import { notifyChangeRequest } from './notificationService.js';
import { httpError, parseId } from '../utils/params.js';

const HOURS = () => {
  const n = Number(process.env.CHANGE_REQUEST_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 12;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const safe = async (fn) => {
  try { await fn(); } catch (err) { console.error('[changeRequest]', err.message); }
};

const toMysqlDateTime = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Nhân viên phụ trách đề xuất chuyển nhân viên khác hoặc dời lịch; lịch hẹn giữ nguyên cho tới khi khách đồng ý */
export const createRequest = async (actor, rawAppointmentId, body = {}) => {
  const appointmentId = parseId(rawAppointmentId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(appointmentId);
  if (!appointment) throw httpError(404, 'Không tìm thấy lịch hẹn.');
  await appointmentService.assertStaffOwnsAppointment(actor, appointment);
  if (!['pending', 'confirmed'].includes(appointment.status)) {
    throw httpError(409, 'Chỉ đề xuất thay đổi cho lịch chưa được tiếp nhận.');
  }

  const type = body.request_type;
  const data = { appointment_id: appointmentId, request_type: type, created_by: actor.id };
  if (type === 'handover') {
    const employeeId = Number(body.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) throw httpError(422, 'Vui lòng chọn nhân viên thay thế.');
    if (employeeId === appointment.employee_id) throw httpError(422, 'Nhân viên thay thế phải khác nhân viên hiện tại.');
    data.proposed_employee_id = employeeId;
  } else if (type === 'reschedule') {
    if (!DATE.test(body.appointment_date || '') || !TIME.test(String(body.start_time || '').slice(0, 5))) {
      throw httpError(422, 'Vui lòng chọn ngày và giờ mới hợp lệ.');
    }
    data.proposed_date = body.appointment_date;
    data.proposed_start_time = String(body.start_time).slice(0, 5);
  } else {
    throw httpError(422, 'Loại đề xuất phải là handover hoặc reschedule.');
  }
  data.reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 255) || null : null;

  await changeRequestRepository.expireOverdue(appointmentId);
  const existing = (await changeRequestRepository.findByAppointment(appointmentId)).find((r) => r.status === 'pending');
  if (existing) throw httpError(409, 'Lịch này đang có một đề xuất chờ khách phản hồi.');

  data.expires_at = toMysqlDateTime(new Date(Date.now() + HOURS() * 3600 * 1000));
  const id = await changeRequestRepository.create(data);
  const request = await changeRequestRepository.findById(id);
  await safe(() => notifyChangeRequest('proposed', request, appointment, actor));
  return { request };
};

export const listRequests = async (actor, rawAppointmentId) => {
  const appointmentId = parseId(rawAppointmentId, 'ID lịch hẹn');
  const appointment = await appointmentRepository.findById(appointmentId);
  if (!appointment) throw httpError(404, 'Không tìm thấy lịch hẹn.');
  if (actor.role_name === 'customer' && appointment.customer_id !== actor.id) {
    throw httpError(404, 'Không tìm thấy lịch hẹn.');
  }
  await changeRequestRepository.expireOverdue(appointmentId);
  return { requests: await changeRequestRepository.findByAppointment(appointmentId) };
};

/** Khách đồng ý / không đồng ý. Đồng ý thì thực hiện thay đổi bằng quyền của nhân viên đã đề xuất */
export const respond = async (actor, rawId, body = {}, req = {}) => {
  const id = parseId(rawId, 'ID đề xuất');
  const request = await changeRequestRepository.findById(id);
  if (!request) throw httpError(404, 'Không tìm thấy đề xuất.');
  const appointment = await appointmentRepository.findById(request.appointment_id);
  if (!appointment || appointment.customer_id !== actor.id) throw httpError(404, 'Không tìm thấy đề xuất.');

  await changeRequestRepository.expireOverdue(request.appointment_id);
  const fresh = await changeRequestRepository.findById(id);
  if (fresh.status !== 'pending') throw httpError(409, 'Đề xuất này đã được xử lý hoặc đã hết hạn.');

  if (typeof body.accept !== 'boolean') throw httpError(422, 'Vui lòng chọn đồng ý hoặc không đồng ý.');
  const proposer = await userRepository.findById(request.created_by);

  if (!body.accept) {
    await changeRequestRepository.resolveIfPending(id, 'declined');
    await safe(() => notifyChangeRequest('declined', fresh, appointment, actor));
    return { request: await changeRequestRepository.findById(id) };
  }

  // Thực hiện thay đổi; nếu thất bại (trùng lịch, hết ca...) thì đề xuất vẫn pending để nhân viên đề xuất lại
  if (!proposer) throw httpError(409, 'Nhân viên đề xuất không còn khả dụng.');
  if (request.request_type === 'handover') {
    await appointmentService.assignEmployee(proposer, appointment.id, { employee_id: request.proposed_employee_id }, req);
  } else {
    await appointmentService.rescheduleAppointment(proposer, appointment.id, {
      appointment_date: String(request.proposed_date instanceof Date
        ? `${request.proposed_date.getFullYear()}-${String(request.proposed_date.getMonth() + 1).padStart(2, '0')}-${String(request.proposed_date.getDate()).padStart(2, '0')}`
        : request.proposed_date).slice(0, 10),
      start_time: String(request.proposed_start_time).slice(0, 5),
    }, req);
  }
  await changeRequestRepository.resolveIfPending(id, 'accepted');
  await safe(() => notifyChangeRequest('accepted', fresh, appointment, actor));
  return { request: await changeRequestRepository.findById(id) };
};

export default { createRequest, listRequests, respond };
