import { z } from 'zod';

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

const shape = {
  name: z.string({ required_error: 'Tên dịch vụ là bắt buộc', invalid_type_error: 'Tên dịch vụ không hợp lệ' })
    .trim()
    .min(2, 'Tên dịch vụ phải có ít nhất 2 ký tự')
    .max(150, 'Tên dịch vụ tối đa 150 ký tự'),

  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional()
  ),

  // Giá tính bằng VND, số nguyên; server không tin giá từ client ở các bước đặt lịch/hóa đơn sau này
  price: z.number({ required_error: 'Giá dịch vụ là bắt buộc', invalid_type_error: 'Giá dịch vụ phải là số' })
    .int('Giá dịch vụ phải là số nguyên (VND)')
    .min(0, 'Giá dịch vụ không được âm')
    .max(100000000, 'Giá dịch vụ tối đa 100.000.000đ'),

  duration_minutes: z.number({ required_error: 'Thời lượng là bắt buộc', invalid_type_error: 'Thời lượng phải là số' })
    .int('Thời lượng phải là số nguyên (phút)')
    .min(5, 'Thời lượng tối thiểu 5 phút')
    .max(480, 'Thời lượng tối đa 480 phút (8 giờ)'),
};

const createServiceSchema = z.object({
  ...shape,
  is_active: z.boolean({ invalid_type_error: 'Trạng thái không hợp lệ' }).optional(),
});

const updateServiceSchema = z
  .object({
    name: shape.name.optional(),
    description: shape.description,
    price: shape.price.optional(),
    duration_minutes: shape.duration_minutes.optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Không có dữ liệu để cập nhật.',
  });

const setActiveSchema = z.object({
  is_active: z.boolean({ required_error: 'Trạng thái là bắt buộc', invalid_type_error: 'Trạng thái phải là true hoặc false' }),
});

export { createServiceSchema, updateServiceSchema, setActiveSchema };
export default { createServiceSchema, updateServiceSchema, setActiveSchema };
