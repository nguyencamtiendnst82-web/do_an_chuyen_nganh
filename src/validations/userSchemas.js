import { z } from 'zod';
import { profileExtraSchema } from './profileSchemas.js';

const phoneRegex = /^0\d{9}$/;
const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

const createEmployeeSchema = z.object({
  full_name: z.string({ error: (issue) => issue.input === undefined ? 'Họ và tên là bắt buộc' : undefined })
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên tối đa 100 ký tự')
    .trim(),

  email: z.string({ error: (issue) => issue.input === undefined ? 'Email là bắt buộc' : undefined })
    .email('Email không hợp lệ')
    .max(150, 'Email tối đa 150 ký tự')
    .toLowerCase(),

  phone: z.string({ error: (issue) => issue.input === undefined ? 'Số điện thoại là bắt buộc' : undefined })
    .regex(phoneRegex, 'Số điện thoại phải là 10 chữ số và bắt đầu bằng 0'),

  password: z.string({ error: (issue) => issue.input === undefined ? 'Mật khẩu là bắt buộc' : undefined })
    .regex(passwordRegex, 'Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số'),

  address: z.string().max(255).trim().optional().nullable(),

  // Giới tính + năm sinh (không bắt buộc)
  ...profileExtraSchema.shape,

  specialty: z.string().max(150, 'Chuyên môn tối đa 150 ký tự').optional().nullable(),

  experience_years: z.number()
    .min(0, 'Số năm kinh nghiệm không được âm')
    .max(50, 'Số năm kinh nghiệm tối đa 50')
    .optional(),

  hire_date: z.string({ error: (issue) => issue.input === undefined ? 'Ngày bắt đầu làm việc là bắt buộc' : undefined })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu làm việc phải có định dạng YYYY-MM-DD'),
}).strict();

// Không cho phép đổi role_id, email, password_hash qua PUT /api/users/:id
const updateUserSchema = z.object({
  full_name: z.string()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên tối đa 100 ký tự')
    .trim()
    .optional(),

  phone: z.string()
    .regex(phoneRegex, 'Số điện thoại phải là 10 chữ số và bắt đầu bằng 0')
    .optional(),

  address: z.string()
    .max(255, 'Địa chỉ tối đa 255 ký tự')
    .trim()
    .optional()
    .nullable(),

  avatar_url: z.string()
    .url('URL ảnh đại diện không hợp lệ')
    .max(255, 'URL tối đa 255 ký tự')
    .optional()
    .nullable(),

  // Giới tính + năm sinh (không bắt buộc)
  ...profileExtraSchema.shape,

  // Thông tin nhân viên (chỉ áp dụng nếu user có role staff)
  specialty: z.string().max(150).optional().nullable(),
  experience_years: z.number().min(0).max(50).optional(),
}).strict(); // Từ chối role_id, email, password_hash

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'locked'], {
    error: (issue) =>
      issue.input === undefined
        ? 'Trạng thái là bắt buộc'
        : typeof issue.input !== 'string'
          ? 'Trạng thái phải là active, inactive hoặc locked'
          : undefined,
  }),
});

export { createEmployeeSchema, updateUserSchema, updateStatusSchema };
export default { createEmployeeSchema, updateUserSchema, updateStatusSchema };
