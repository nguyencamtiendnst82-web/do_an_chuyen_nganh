import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isNotFutureDate = (val) => {
  if (!val) return true;
  const target = new Date(val);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target <= today;
};

export const updateEmployeeSchema = z
  .object({
    specialty: z.string().max(150, 'Chuyên môn tối đa 150 ký tự').trim().optional().nullable(),
    experience_years: z
      .number({ invalid_type_error: 'Số năm kinh nghiệm phải là số' })
      .min(0, 'Số năm kinh nghiệm không được nhỏ hơn 0')
      .max(60, 'Số năm kinh nghiệm tối đa 60')
      .optional(),
    hire_date: z
      .string()
      .regex(dateRegex, 'Ngày vào làm phải có định dạng YYYY-MM-DD')
      .refine(isNotFutureDate, 'Ngày vào làm không thể ở tương lai')
      .optional(),
    status: z
      .enum(['active', 'on_leave', 'resigned'], {
        errorMap: () => ({ message: 'Trạng thái nhân viên phải là active, on_leave hoặc resigned' }),
      })
      .optional(),
  })
  .strict();

