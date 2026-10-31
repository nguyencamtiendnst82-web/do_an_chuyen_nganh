import incidentRepository from '../repositories/incidentRepository.js';
import appointmentRepository from '../repositories/appointmentRepository.js';
import petRepository from '../repositories/petRepository.js';
import logRepository from '../repositories/logRepository.js';
import { assertStaffOwnsAppointment } from './appointmentService.js';
import {
  incidentCreateSchema,
  incidentUpdateSchema,
  normalizeIncidentCreate,
  normalizeIncidentUpdate,
  INCIDENT_STATUSES,
  SEVERITIES,
} from '../validations/careSchemas.js';
import { httpError, fieldError, parseId, auditContext } from '../utils/params.js';

/** POST /api/incidents (staff/admin) */
export const createIncident = async (actor, body, req) => {
  const parsed = incidentCreateSchema.parse(normalizeIncidentCreate(body));

  const pet = await petRepository.findById(parsed.pet_id);
  if (!pet) throw fieldError('pet_id', 'Không tìm thấy thú cưng.');

  if (parsed.appointment_id) {
    const appointment = await appointmentRepository.findById(parsed.appointment_id);
    if (!appointment) throw fieldError('appointment_id', 'Không tìm thấy lịch hẹn.');
    if (appointment.pet_id !== parsed.pet_id) {
      throw fieldError('appointment_id', 'Lịch hẹn này không thuộc thú cưng đã chọn.');
    }
    // Nhân viên chỉ gắn sự cố vào lịch của chính mình
    await assertStaffOwnsAppointment(actor, appointment);
  }

  const id = await incidentRepository.create({ ...parsed, reported_by: actor.id });

  await logRepository.insert({
    ...auditContext(req),
    action: 'CREATE_INCIDENT',
    entity_name: 'incidents',
    entity_id: id,
    new_values: {
      pet_id: parsed.pet_id,
      appointment_id: parsed.appointment_id ?? null,
      incident_type: parsed.incident_type,
      severity: parsed.severity,
      title: parsed.title,
    },
  });

  return { incident: await incidentRepository.findById(id) };
};

/** GET /api/incidents : nhân viên chỉ thấy sự cố do mình báo, admin thấy tất cả */
export const listIncidents = async (actor, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

  const filters = {
    reportedBy: actor.role_name === 'staff' ? actor.id : undefined,
    status: INCIDENT_STATUSES.includes(query.status) ? query.status : undefined,
    severity: SEVERITIES.includes(query.severity) ? query.severity : undefined,
    petId: Number(query.petId || query.pet_id) || undefined,
    page,
    limit,
  };

  const [incidents, total] = await Promise.all([
    incidentRepository.findAll(filters),
    incidentRepository.countAll(filters),
  ]);

  return {
    incidents,
    pagination: { total, page, limit, total_pages: Math.ceil(total / limit) || 1 },
  };
};

/** GET /api/incidents/:id */
export const getIncident = async (actor, rawId) => {
  const id = parseId(rawId, 'ID sự cố');
  const incident = await incidentRepository.findById(id);
  if (!incident || (actor.role_name === 'staff' && incident.reported_by !== actor.id)) {
    throw httpError(404, 'Không tìm thấy sự cố.');
  }
  return { incident };
};

/** PATCH /api/incidents/:id (admin): trạng thái, mức độ, biện pháp khắc phục */
export const updateIncident = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID sự cố');
  const old = await incidentRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy sự cố.');

  const parsed = incidentUpdateSchema.parse(normalizeIncidentUpdate(body));

  const nextStatus = parsed.status ?? old.status;
  const nextResolution = parsed.resolution ?? old.resolution;
  if (nextStatus === 'resolved' && !(nextResolution && nextResolution.trim())) {
    throw fieldError('resolution', 'Vui lòng nhập biện pháp khắc phục trước khi đánh dấu đã xử lý.');
  }

  await incidentRepository.update(id, parsed, {
    resolvedAtNow: nextStatus === 'resolved' && old.status !== 'resolved',
    clearResolvedAt: nextStatus !== 'resolved' && old.status === 'resolved',
  });

  await logRepository.insert({
    ...auditContext(req),
    action: 'UPDATE_INCIDENT',
    entity_name: 'incidents',
    entity_id: id,
    old_values: { status: old.status, severity: old.severity, resolution: old.resolution },
    new_values: {
      status: nextStatus,
      severity: parsed.severity ?? old.severity,
      resolution: nextResolution ?? null,
    },
  });

  return { incident: await incidentRepository.findById(id) };
};

export default { createIncident, listIncidents, getIncident, updateIncident };
