import { z } from 'zod';

// Regex số điện thoại VN: 10 số, bắt đầu 0
const phoneRegex = /^0\d{9}$/;

// Regex mật khẩu: tối thiểu 8 ký tự, phải có ít nhất 1 chữ cái và 1 chữ số
const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

const registerSchema = z.object({
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

  // Các trường sau bị bỏ qua hoàn toàn dù client có gửi lên
  // role_id, role_name, password_hash đều KHÔNG được nhận
});

const loginSchema = z.object({
  credential: z.string({ error: (issue) => issue.input === undefined ? 'Email hoặc số điện thoại là bắt buộc' : undefined })
    .min(1, 'Email hoặc số điện thoại không được để trống'),

  password: z.string({ error: (issue) => issue.input === undefined ? 'Mật khẩu là bắt buộc' : undefined })
    .min(1, 'Mật khẩu không được để trống'),
});

const updateMeSchema = z.object({
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
}).strict(); // Từ chối các trường không khai báo (bao gồm role_id, email)

const changePasswordSchema = z.object({
  old_password: z.string({ error: (issue) => issue.input === undefined ? 'Mật khẩu cũ là bắt buộc' : undefined })
    .min(1, 'Mật khẩu cũ không được để trống'),

  new_password: z.string({ error: (issue) => issue.input === undefined ? 'Mật khẩu mới là bắt buộc' : undefined })
    .regex(passwordRegex, 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số'),
});

const forgotPasswordSchema = z.object({
  email: z.string({ error: (issue) => issue.input === undefined ? 'Email là bắt buộc' : undefined })
    .email('Email không hợp lệ')
    .max(150, 'Email tối đa 150 ký tự')
    .toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string({ error: (issue) => issue.input === undefined ? 'Mã đặt lại mật khẩu là bắt buộc' : undefined })
    .regex(/^[a-f0-9]{64}$/, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'),

  new_password: z.string({ error: (issue) => issue.input === undefined ? 'Mật khẩu mới là bắt buộc' : undefined })
    .regex(passwordRegex, 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số'),
});

export { registerSchema, loginSchema, updateMeSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
export default { registerSchema, loginSchema, updateMeSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
