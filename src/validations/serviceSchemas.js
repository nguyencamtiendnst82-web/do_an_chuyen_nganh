import { z } from 'zod';

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

const shape = {
  name: z.string({
    error: (issue) =>
      issue.input === undefined
        ? 'Tên dịch vụ là bắt buộc'
        : issue.code === 'invalid_type'
          ? 'Tên dịch vụ không hợp lệ'
          : undefined,
  })
    .trim()
    .min(2, 'Tên dịch vụ phải có ít nhất 2 ký tự')
    .max(150, 'Tên dịch vụ tối đa 150 ký tự'),

  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional()
  ),

  // Giá tính bằng VND, số nguyên; server không tin giá từ client ở các bước đặt lịch/hóa đơn sau này
  price: z.number({
    error: (issue) =>
      issue.input === undefined
        ? 'Giá dịch vụ là bắt buộc'
        : issue.code === 'invalid_type'
          ? 'Giá dịch vụ phải là số'
          : undefined,
  })
    .int('Giá dịch vụ phải là số nguyên (VND)')
    .min(0, 'Giá dịch vụ không được âm')
    .max(100000000, 'Giá dịch vụ tối đa 100.000.000đ'),

  duration_minutes: z.number({
    error: (issue) =>
      issue.input === undefined
        ? 'Thời lượng là bắt buộc'
        : issue.code === 'invalid_type'
          ? 'Thời lượng phải là số'
          : undefined,
  })
    .int('Thời lượng phải là số nguyên (phút)')
    .min(5, 'Thời lượng tối thiểu 5 phút')
    .max(480, 'Thời lượng tối đa 480 phút (8 giờ)'),
};

const createServiceSchema = z.object({
  ...shape,
  is_active: z.boolean({ error: (issue) => issue.code === 'invalid_type' ? 'Trạng thái không hợp lệ' : undefined }).optional(),
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
  is_active: z.boolean({
    error: (issue) =>
      issue.input === undefined
        ? 'Trạng thái là bắt buộc'
        : issue.code === 'invalid_type'
          ? 'Trạng thái phải là true hoặc false'
          : undefined,
  }),
});

export { createServiceSchema, updateServiceSchema, setActiveSchema };
export default { createServiceSchema, updateServiceSchema, setActiveSchema };
