import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;

/**
 * Chuẩn hóa input để hỗ trợ cả camelCase lẫn snake_case từ client
 */
export const normalizeAppointmentInput = (body = {}) => {
  return {
    pet_id: body.petId ?? body.pet_id,
    service_ids: body.serviceIds ?? body.service_ids,
    appointment_date: body.appointmentDate ?? body.appointment_date,
    start_time: body.startTime ?? body.start_time,
    employee_id: body.employeeId !== undefined ? body.employeeId : body.employee_id,
    customer_notes: body.customerNotes ?? body.customer_notes ?? null,
    customer_id: body.customerId ?? body.customer_id,
  };
};

export const createAppointmentSchema = z.object({
  pet_id: z.number({ required_error: 'Vui lòng chọn thú cưng' }).int().positive('Thú cưng không hợp lệ'),
  service_ids: z
    .array(z.number().int().positive(), { required_error: 'Vui lòng chọn ít nhất một dịch vụ' })
    .min(1, 'Vui lòng chọn ít nhất một dịch vụ'),
  appointment_date: z
    .string({ required_error: 'Ngày hẹn là bắt buộc' })
    .regex(dateRegex, 'Ngày hẹn phải có định dạng YYYY-MM-DD'),
  start_time: z
    .string({ required_error: 'Giờ hẹn là bắt buộc' })
    .regex(timeRegex, 'Giờ hẹn phải có định dạng HH:MM'),
  employee_id: z.number().int().positive().optional().nullable(),
  customer_notes: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional().nullable(),
  customer_id: z.number().int().positive().optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  appointment_date: z
    .string({ required_error: 'Ngày hẹn mới là bắt buộc' })
    .regex(dateRegex, 'Ngày hẹn phải có định dạng YYYY-MM-DD'),
  start_time: z
    .string({ required_error: 'Giờ hẹn mới là bắt buộc' })
    .regex(timeRegex, 'Giờ hẹn phải có định dạng HH:MM'),
  employee_id: z.number().int().positive().optional().nullable(),
});

export const cancelAppointmentSchema = z.object({
  cancellation_reason: z
    .string({ required_error: 'Lý do hủy là bắt buộc' })
    .min(3, 'Lý do hủy phải có ít nhất 3 ký tự')
    .max(500, 'Lý do hủy tối đa 500 ký tự')
    .trim(),
});

export const assignEmployeeSchema = z.object({
  employee_id: z
    .number({ required_error: 'Vui lòng chọn nhân viên' })
    .int()
    .positive('Mã nhân viên không hợp lệ'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Trạng thái lịch hẹn không hợp lệ' }),
  }),
  cancellation_reason: z.string().max(500).optional().nullable(),
  staff_notes: z.string().max(1000).optional().nullable(),
});

export const availabilityQuerySchema = z.object({
  date: z
    .string({ required_error: 'Vui lòng chọn ngày cần tra cứu' })
    .regex(dateRegex, 'Ngày tra cứu phải có định dạng YYYY-MM-DD'),
  serviceIds: z.union([z.string(), z.array(z.coerce.number().int().positive())]),
  employeeId: z.coerce.number().int().positive().optional(),
});

