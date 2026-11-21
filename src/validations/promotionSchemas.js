import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');

export const promotionSchema = z.object({
  name: z.string().trim().min(3, 'Tên chương trình tối thiểu 3 ký tự').max(150, 'Tên chương trình tối đa 150 ký tự'),
  discount_type: z.enum(['percent', 'amount'], { error: () => 'Loại giảm phải là percent hoặc amount' }),
  discount_value: z.coerce.number().positive('Mức giảm phải lớn hơn 0'),
  service_id: z.coerce.number().int().positive().nullable().optional(),
  min_invoice: z.coerce.number().min(0, 'Hóa đơn tối thiểu không được âm').optional().default(0),
  start_date: ymd,
  end_date: ymd,
}).strict().superRefine((v, ctx) => {
  if (v.discount_type === 'percent' && v.discount_value > 100) {
    ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Giảm theo % tối đa 100' });
  }
  if (v.end_date < v.start_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' });
  }
});

export const promotionActiveSchema = z.object({
  is_active: z.boolean({ error: () => 'is_active phải là true hoặc false' }),
}).strict();

export const discountApprovalSchema = z.object({
  approve: z.boolean({ error: () => 'approve phải là true hoặc false' }),
}).strict();
