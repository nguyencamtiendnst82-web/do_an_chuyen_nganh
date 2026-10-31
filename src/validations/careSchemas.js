import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);
const optionalText = (max) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `Tối đa ${max} ký tự.`).optional());

const INCIDENT_TYPES = ['injury', 'allergic_reaction', 'behavioral_aggression', 'service_delay', 'equipment_damage', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const INCIDENT_STATUSES = ['open', 'investigating', 'resolved'];

const pick = (body, camel, snake) => body?.[camel] ?? body?.[snake];

/* ---------- Tiếp nhận / hoàn tất ---------- */

const checkInSchema = z.object({
  initial_health_notes: optionalText(2000),
});

const completeSchema = z.object({
  treatment_notes: z.preprocess(
    emptyToUndefined,
    z
      .string({ required_error: 'Vui lòng nhập ghi chú quá trình thực hiện.' })
      .trim()
      .min(3, 'Ghi chú quá trình thực hiện cần ít nhất 3 ký tự.')
      .max(2000, 'Tối đa 2000 ký tự.')
  ),
  recommendations: optionalText(2000),
});

const normalizeCheckIn = (body = {}) => ({
  initial_health_notes: pick(body, 'initialHealthNotes', 'initial_health_notes'),
});

const normalizeComplete = (body = {}) => ({
  treatment_notes: pick(body, 'treatmentNotes', 'treatment_notes'),
  recommendations: body.recommendations,
});

/* ---------- Sự cố ---------- */

const incidentCreateSchema = z.object({
  pet_id: z.coerce
    .number({ invalid_type_error: 'Vui lòng chọn thú cưng.', required_error: 'Vui lòng chọn thú cưng.' })
    .int('Mã thú cưng không hợp lệ.')
    .positive('Vui lòng chọn thú cưng.'),
  appointment_id: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ invalid_type_error: 'Mã lịch hẹn không hợp lệ.' }).int().positive('Mã lịch hẹn không hợp lệ.').optional()
  ),
  title: z
    .string({ required_error: 'Vui lòng nhập tiêu đề sự cố.' })
    .trim()
    .min(3, 'Tiêu đề cần ít nhất 3 ký tự.')
    .max(200, 'Tiêu đề tối đa 200 ký tự.'),
  incident_type: z.enum(INCIDENT_TYPES, {
    errorMap: () => ({ message: 'Loại sự cố không hợp lệ.' }),
  }),
  severity: z.preprocess(
    emptyToUndefined,
    z.enum(SEVERITIES, { errorMap: () => ({ message: 'Mức độ nghiêm trọng không hợp lệ.' }) }).default('low')
  ),
  description: z
    .string({ required_error: 'Vui lòng mô tả diễn biến sự cố.' })
    .trim()
    .min(5, 'Mô tả cần ít nhất 5 ký tự.')
    .max(3000, 'Mô tả tối đa 3000 ký tự.'),
});

const normalizeIncidentCreate = (body = {}) => ({
  pet_id: pick(body, 'petId', 'pet_id'),
  appointment_id: pick(body, 'appointmentId', 'appointment_id'),
  title: body.title,
  incident_type: pick(body, 'incidentType', 'incident_type'),
  severity: body.severity,
  description: body.description,
});

const incidentUpdateSchema = z
  .object({
    status: z.enum(INCIDENT_STATUSES, { errorMap: () => ({ message: 'Trạng thái không hợp lệ.' }) }).optional(),
    severity: z.enum(SEVERITIES, { errorMap: () => ({ message: 'Mức độ nghiêm trọng không hợp lệ.' }) }).optional(),
    resolution: optionalText(3000),
  })
  .refine((v) => v.status !== undefined || v.severity !== undefined || v.resolution !== undefined, {
    message: 'Không có thông tin nào để cập nhật.',
  });

const normalizeIncidentUpdate = (body = {}) => ({
  status: emptyToUndefined(body.status),
  severity: emptyToUndefined(body.severity),
  resolution: body.resolution,
});

export {
  checkInSchema,
  completeSchema,
  normalizeCheckIn,
  normalizeComplete,
  incidentCreateSchema,
  incidentUpdateSchema,
  normalizeIncidentCreate,
  normalizeIncidentUpdate,
  INCIDENT_TYPES,
  SEVERITIES,
  INCIDENT_STATUSES,
};
