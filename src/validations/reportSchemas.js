import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateStr = (val) => {
  if (!dateRegex.test(val)) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
};

/**
 * Schema kiểm tra tham số lọc khoảng thời gian báo cáo
 * Quy tắc:
 * - from và to định dạng YYYY-MM-DD
 * - from <= to
 * - Khoảng cách tối đa 366 ngày
 */
export const dateRangeSchema = z
  .object({
    from: z.string().refine(isValidDateStr, { message: 'Từ ngày (from) phải có định dạng YYYY-MM-DD.' }),
    to: z.string().refine(isValidDateStr, { message: 'Đến ngày (to) phải có định dạng YYYY-MM-DD.' }),
    groupBy: z.enum(['day', 'month']).default('day'),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .refine(
    (data) => {
      const fromD = new Date(data.from);
      const toD = new Date(data.to);
      return fromD <= toD;
    },
    { message: 'Từ ngày (from) phải nhỏ hơn hoặc bằng đến ngày (to).', path: ['to'] }
  )
  .refine(
    (data) => {
      const fromD = new Date(data.from);
      const toD = new Date(data.to);
      const diffDays = Math.round((toD - fromD) / (1000 * 60 * 60 * 24));
      return diffDays <= 366;
    },
    { message: 'Khoảng thời gian báo cáo tối đa là 366 ngày.', path: ['to'] }
  );

/**
 * Schema cho lọc nhật ký hệ thống system_logs
 */
export const logQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  user_id: z.coerce.number().int().positive().optional(),
  action: z.string().trim().max(100).optional(),
  from: z.string().refine((v) => !v || isValidDateStr(v), { message: 'Từ ngày không hợp lệ.' }).optional(),
  to: z.string().refine((v) => !v || isValidDateStr(v), { message: 'Đến ngày không hợp lệ.' }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
