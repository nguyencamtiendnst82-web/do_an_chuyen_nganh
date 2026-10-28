import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tính số ngày giữa 2 chuỗi YYYY-MM-DD (bao gồm cả 2 đầu ngày)
 */
export const countDaysBetween = (fromStr, toStr) => {
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const bulkAssignSchema = z
  .object({
    employee_id: z.number({ required_error: 'ID nhân viên là bắt buộc' }).int().positive(),
    shift_ids: z
      .array(z.number().int().positive(), { required_error: 'Danh sách ca làm việc là bắt buộc' })
      .min(1, 'Phải chọn ít nhất một ca làm việc'),
    from: z
      .string({ required_error: 'Ngày bắt đầu là bắt buộc' })
      .regex(dateRegex, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD'),
    to: z
      .string({ required_error: 'Ngày kết thúc là bắt buộc' })
      .regex(dateRegex, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD'),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .optional()
      .nullable(),
  })
  .refine((data) => data.to >= data.from, {
    message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu',
    path: ['to'],
  })
  .refine((data) => countDaysBetween(data.from, data.to) <= 62, {
    message: 'Khoảng thời gian phân ca không được vượt quá 62 ngày',
    path: ['to'],
  });

export const dateRangeQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD').optional(),
    employee_id: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.to >= data.from;
      }
      return true;
    },
    {
      message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu',
      path: ['to'],
    }
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        return countDaysBetween(data.from, data.to) <= 62;
      }
      return true;
    },
    {
      message: 'Khoảng thời gian tra cứu không được vượt quá 62 ngày',
      path: ['to'],
    }
  );

